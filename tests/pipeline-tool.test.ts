import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { execFileSync } from "node:child_process";

// The harness runs without a local node_modules; pi owns its runtime TypeBox/TUI.
// Link its dependencies only for this test process, then remove the temporary link.
const localModules = path.resolve(import.meta.dirname, "../node_modules");
let linked = false;
if (!fs.existsSync(localModules)) {
  const piBinary = fs.realpathSync(execFileSync("which", ["pi"], { encoding: "utf8" }).trim());
  const piPackage = path.dirname(path.dirname(path.dirname(piBinary)));
  fs.symlinkSync(path.join(piPackage, "node_modules"), localModules, "dir");
  linked = true;
}
const { default: pipelineExtension } = await import("../extensions/pipeline.ts");
after(() => { if (linked) fs.unlinkSync(localModules); });

const runner = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const mode = process.env.FAKE_PIPELINE_MODE;
fs.writeFileSync(path.join(root, 'invocation.json'), JSON.stringify({cwd:root,args:process.argv.slice(2),env:[process.env.PI_BUILD_PIPELINE,process.env.PI_BUILD_SUBAGENT_ROLE,process.env.PI_BUILD_TELEMETRY_DB]}));
process.stdout.write('not an event\\n');
process.stdout.write(JSON.stringify({type:'stage',stage:'tasks'}) + '\\n');
process.stdout.write(JSON.stringify({type:'usage',role:'editor',cost:0.12}) + '\\n');
if (mode === 'hold') {
  process.stdout.write(JSON.stringify({type:'done',ok:false,summary:'Quota hold'}) + '\\n', () => process.exit(75));
}
if (mode === 'preflight') {
  process.stderr.write('spec has no .tests/ directory\\n', () => process.exit(2));
}
if (mode === 'fail') {
  process.stdout.write(JSON.stringify({type:'done',ok:false,summary:'gate failed'}) + '\\n', () => process.exit(1));
}
process.on('SIGTERM', () => {
  fs.writeFileSync(path.join(root, 'terminated'), 'SIGTERM');
  process.exit(130);
});
fs.writeFileSync(path.join(root, 'ready'), 'yes');
const wait = setInterval(() => {
  if (fs.existsSync(path.join(root, 'release'))) {
    clearInterval(wait);
    process.stdout.write(JSON.stringify({type:'stage',stage:'handoff'}) + '\\n');
    process.stdout.write(JSON.stringify({type:'done',ok:true,branch:'pipeline/SPEC-0015-test',runRecord:'docs/specs/SPEC-0015-run.md',summary:'all green'}) + '\\n');
  }
}, 10);
`;

type Tool = { execute: (...args: any[]) => Promise<any>; renderCall: (...args: any[]) => any; renderResult: (...args: any[]) => any; parameters: any; description: string };

async function fixture(t: any, mode = "success") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-tool-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "docs", "specs"), { recursive: true });
  fs.mkdirSync(path.join(root, "bin"));
  const script = path.join(root, "bin", "pi-implement");
  fs.writeFileSync(script, runner, { mode: 0o755 });
  const registered: Tool[] = [];
  await pipelineExtension({ registerTool(tool: Tool) { registered.push(tool); } } as any);
  assert.equal(registered.length, 1);
  const tool = registered[0];
  const previous = process.env.FAKE_PIPELINE_MODE;
  process.env.FAKE_PIPELINE_MODE = mode;
  t.after(() => {
    if (previous === undefined) delete process.env.FAKE_PIPELINE_MODE;
    else process.env.FAKE_PIPELINE_MODE = previous;
  });
  return { root, tool, cwd: path.join(root, "docs", "specs") };
}

async function until(predicate: () => boolean, timeout = 3000): Promise<void> {
  const end = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > end) throw new Error("Timed out waiting for fake runner");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function text(result: any): string { return result.content[0].text; }

test("registers implement_spec; updates stream before handoff, cleans environment and returns branch/cost", async (t) => {
  const { root, cwd, tool } = await fixture(t);
  const keys = ["PI_BUILD_PIPELINE", "PI_BUILD_SUBAGENT_ROLE", "PI_BUILD_TELEMETRY_DB"] as const;
  const original = keys.map((key) => process.env[key]);
  keys.forEach((key) => { process.env[key] = "leaked"; });
  t.after(() => keys.forEach((key, i) => {
    if (original[i] === undefined) delete process.env[key];
    else process.env[key] = original[i];
  }));
  assert.match(tool.description, /Sol plans, Luna implements each task, Sol integrates/);
  assert.deepEqual(tool.parameters.required, ["spec"]);
  const updates: any[] = [];
  let finished = false;
  const pending = tool.execute("call", { spec: "0015", planOnly: true, resume: true }, undefined,
    (update: any) => updates.push(update), { cwd }).then((result: any) => { finished = true; return result; });
  try {
    await until(() => updates.some((u) => u.details.cost.editor === 0.12));
    assert.equal(finished, false, "onUpdate arrived while runner was still executing");
    assert.match(updates.at(-1).content[0].text, /Running tasks/);
    assert.equal(updates.at(-1).details.cost.editor, 0.12);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, "invocation.json"), "utf8")), {
      cwd: root, args: ["0015", "--progress", "json", "--plan-only", "--resume"], env: [null, null, null],
    });
  } finally {
    fs.writeFileSync(path.join(root, "release"), "yes");
  }
  const result = await pending;
  assert.equal(result.isError, false);
  assert.match(text(result), /Handed off/);
  assert.match(text(result), /pipeline\/SPEC-0015-test/);
  assert.match(text(result), /editor \$0\.12/);
  assert.match(text(result), /SPEC-0015-run\.md/);
  assert.equal(result.details.done.branch, "pipeline/SPEC-0015-test");
  assert.equal(typeof tool.renderCall, "function");
  assert.equal(typeof tool.renderResult, "function");
});

test("failed run, quota hold and preflight failure are errors with actionable text", async (t) => {
  for (const [mode, expected] of [
    ["fail", /gate failed/],
    ["hold", /Held by the quota gate: run `bin\/pi-continue`, then call again with `resume: true`/],
    ["preflight", /spec has no \.tests\/ directory/],
  ]) {
    const { tool, cwd } = await fixture(t, mode);
    const result = await tool.execute("call", { spec: "SPEC-0015" }, undefined, () => {}, { cwd });
    assert.equal(result.isError, true, mode);
    assert.match(text(result), expected, mode);
  }
});

test("Esc abort sends SIGTERM to the runner and returns a resumable error", async (t) => {
  const { root, cwd, tool } = await fixture(t);
  const controller = new AbortController();
  const updates: any[] = [];
  const pending = tool.execute("call", { spec: "0015" }, controller.signal,
    (update: any) => updates.push(update), { cwd });
  try {
    await until(() => updates.some((u) => u.details.stage === "tasks") && fs.existsSync(path.join(root, "ready")));
    controller.abort();
    const result = await pending;
    assert.equal(result.isError, true);
    assert.match(text(result), /resume: true/);
    assert.equal(fs.readFileSync(path.join(root, "terminated"), "utf8"), "SIGTERM");
  } finally {
    controller.abort();
    fs.writeFileSync(path.join(root, "release"), "yes");
  }
});
