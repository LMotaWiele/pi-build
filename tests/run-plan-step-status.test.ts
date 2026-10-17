// run-plan end to end with a stub pi: a blocked Sol step stops the run before its dependents and is not
// recorded as done; a failed Luna task defers its dependents to integration; every child gets the context.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";

const PI_BUILD = fs.realpathSync(path.resolve(import.meta.dirname, ".."));
const RUN_PLAN = path.join(PI_BUILD, "scripts", "run-plan.mjs");
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

// Behaviour by prompt: a Sol step answers with FAKE_SOL_STATUS; "do L<n>" writes src/L<n>.ts unless listed in
// FAKE_LUNA_FAIL; integration writes the report. Every prompt is logged; telemetry rows satisfy the model pin.
const STUB = `#!/usr/bin/env node
const fs = require('node:fs'); const { DatabaseSync } = require('node:sqlite');
const args = process.argv.slice(2); const prompt = args[args.indexOf('-p') + 1]; const model = args[args.indexOf('--model') + 1];
fs.appendFileSync(process.env.STUB_LOG, JSON.stringify({ model, prompt }) + '\\n');
if (process.env.PI_BUILD_TELEMETRY_DB) { const db = new DatabaseSync(process.env.PI_BUILD_TELEMETRY_DB);
  db.exec('CREATE TABLE IF NOT EXISTS inference_calls (id INTEGER PRIMARY KEY, model TEXT, cost_usd REAL, subagent_role TEXT)');
  db.prepare('INSERT INTO inference_calls (model, cost_usd, subagent_role) VALUES (?, 0.01, ?)').run(model.split('/').pop(), process.env.PI_BUILD_SUBAGENT_ROLE ?? null); db.close(); }
fs.mkdirSync('src', { recursive: true });
let reply = 'ok';
if (prompt.includes('Implement only these Sol tasks')) {
  for (const m of prompt.matchAll(/^## (\\S+) /gm)) fs.writeFileSync('src/' + m[1] + '.ts', 'export {}\\n');
  reply = 'done\\n' + process.env.FAKE_SOL_STATUS;
} else {
  const luna = prompt.match(/do (L\\d+)/);
  if (luna && !prompt.includes('per-task results')) {
    if (!(process.env.FAKE_LUNA_FAIL || '').split(',').includes(luna[1])) fs.writeFileSync('src/' + luna[1] + '.ts', 'export {}\\n');
  } else { const m = prompt.match(/Write \\\`([^\\\`]+report\\.md)\\\`/); if (m) fs.writeFileSync(m[1], '# report\\n'); }
}
process.stdout.write(JSON.stringify({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: reply }] } }) + '\\n');
`;

function tmp(t: any, prefix: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function setup(t: any, tasks: Array<{ id: string; assignee: "luna" | "sol"; dependsOn?: string[] }>) {
  const dir = tmp(t, "step-status-");
  const repo = path.join(dir, "repo");
  git(dir, "init", "-q", "-b", "main", repo);
  git(repo, "config", "user.email", "t@t"); git(repo, "config", "user.name", "t");
  const plan = "docs/specs/SPEC-0001-x.plan";
  fs.mkdirSync(path.join(repo, plan), { recursive: true });
  fs.mkdirSync(path.join(repo, "docs/specs/SPEC-0001-x.tests"), { recursive: true });
  fs.writeFileSync(path.join(repo, "docs/specs/SPEC-0001-x.md"), "# S\n\n## 8. Verification\n| O | C | Check ID: condition |\n|---|---|---|\n| O1 | x | V1: a |\n\n## 9. Stop\n");
  fs.writeFileSync(path.join(repo, "docs/specs/SPEC-0001-x.tests/v01.test.ts"), "import { test } from 'node:test';\ntest('v1', () => {});\n");
  const full = tasks.map((task) => {
    const acceptanceTest = task.assignee === "luna" ? `${plan}/${task.id}.test.ts` : null;
    if (acceptanceTest) {
      fs.writeFileSync(path.join(repo, acceptanceTest), `import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';\ntest('${task.id}', () => assert.ok(fs.existsSync('src/${task.id}.ts')));\n`);
    }
    return { id: task.id, file: `src/${task.id}.ts`, assignee: task.assignee, requirements: ["R1"], brief: `do ${task.id}`, interfaces: [], acceptanceTest, dependsOn: task.dependsOn ?? [] };
  });
  fs.writeFileSync(path.join(repo, plan, "plan.json"), JSON.stringify({ spec: "docs/specs/SPEC-0001-x.md", verifyMap: { "1": ["R1"] }, requirements: [{ id: "R1", text: "r" }], tasks: full }));
  git(repo, "add", "-A"); git(repo, "commit", "-q", "-m", "plan");
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "pi"), STUB, { mode: 0o755 });
  const settings = path.join(dir, "settings.json");
  fs.writeFileSync(settings, JSON.stringify({ routing: { tiers: { escalate: "openai-codex/gpt-6.1-sol", scout: "openai-codex/gpt-6-luna" } } }));
  const runDir = path.join(dir, "run");
  fs.mkdirSync(runDir);
  fs.writeFileSync(path.join(runDir, "context.txt"), "PIPELINE CONTEXT MARKER");
  const log = path.join(dir, "prompts.jsonl");
  const run = (extra: Record<string, string> = {}) => {
    const env: Record<string, string | undefined> = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, STUB_LOG: log,
      PI_BUILD_SETTINGS: settings, PI_BUILD_QUOTA_HOLD: path.join(dir, "no-hold"), PI_BUILD_SKIP_BATTERY: "1", ...extra };
    delete env.NODE_TEST_CONTEXT; delete env.PI_BUILD_PIPELINE; delete env.PI_BUILD_SUBAGENT_ROLE; delete env.PI_BUILD_TELEMETRY_DB;
    return spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", RUN_PLAN, "--repo", repo, "--plan", path.join(repo, plan, "plan.json"),
      "--run-dir", runDir, "--python-project", "", "--progress", "json"], { env, encoding: "utf8" });
  };
  const prompts = () => fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
  const results = () => { const f = path.join(runDir, "results.jsonl"); return fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []; };
  return { run, prompts, results };
}

test("a Sol step that reports BLOCKED stops the run before its dependents and is not recorded as done", (t) => {
  const { run, prompts, results } = setup(t, [{ id: "U0", assignee: "sol" }, { id: "L1", assignee: "luna", dependsOn: ["U0"] }]);
  const result = run({ FAKE_SOL_STATUS: "STATUS: BLOCKED: the spec says to commit on master" });
  assert.notEqual(result.status, 0, result.stderr);
  assert.match(result.stdout + result.stderr, /the spec says to commit on master/);
  assert.equal(prompts().length, 1, "no Luna or integration session after the block");
  assert.deepEqual(results(), [], "a blocked step leaves nothing that a resume would treat as done");
});

test("a Sol step that reports DONE is recorded and its dependents run", (t) => {
  const { run, prompts, results } = setup(t, [{ id: "U0", assignee: "sol" }, { id: "L1", assignee: "luna", dependsOn: ["U0"] }]);
  const result = run({ FAKE_SOL_STATUS: "STATUS: DONE" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(results().map((r) => [r.id, r.acceptance]), [["U0", "n/a"], ["L1", "pass"]]);
  assert.equal(prompts().length, 3);
});

test("a failed Luna task defers its dependents to integration, which is told about them", (t) => {
  const { run, prompts, results } = setup(t, [
    { id: "L1", assignee: "luna" }, { id: "L2", assignee: "luna", dependsOn: ["L1"] }, { id: "L3", assignee: "luna" },
  ]);
  const result = run({ FAKE_LUNA_FAIL: "L1" });
  assert.equal(result.status, 0, result.stderr);
  const all = prompts();
  assert.ok(!all.some((p) => /^do L2/m.test(p.prompt) && !p.prompt.includes("per-task results")), "L2 never ran");
  assert.ok(all.some((p) => p.prompt.includes("do L3")), "an independent task still ran");
  const integration = all.at(-1).prompt;
  assert.match(integration, /L2/);
  assert.match(integration, /depend/i);
  assert.deepEqual(results().map((r) => [r.id, r.acceptance]), [["L1", "fail"], ["L3", "pass"]]);
  assert.match(result.stdout, /L2[^"]*deferred/);
});

test("every child prompt starts with the pipeline context", (t) => {
  const { run, prompts } = setup(t, [{ id: "U0", assignee: "sol" }, { id: "L1", assignee: "luna", dependsOn: ["U0"] }]);
  run({ FAKE_SOL_STATUS: "STATUS: DONE" });
  for (const p of prompts()) assert.ok(p.prompt.startsWith("PIPELINE CONTEXT MARKER"), p.prompt.slice(0, 80));
});
