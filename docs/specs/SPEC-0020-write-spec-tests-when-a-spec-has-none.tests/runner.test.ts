import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";

const PI_BUILD = fs.realpathSync(path.resolve(import.meta.dirname, "../../.."));
const IMPLEMENT = path.join(PI_BUILD, "bin", "pi-implement");
// V1 is automatable; V2 is not.
const SPEC = "# SPEC-NNNN: Demo\n\n| Field | Value |\n|---|---|\n| Status | ready |\n\n## 8. Verification\n| O | C | Check ID: condition |\n|---|---|---|\n" +
  "| O1 | §6.1 | V1: add() returns the sum |\n| O1 | — | V2: Lucas likes it |\n\n## 9. Stop\n";
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

function tmp(t: any, prefix: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// A stand-in for pi: call N does actions[N]. "write-failing" writes a V1 test that fails until add() exists,
// "write-passing" a V1 test that passes today, "write-broken" a V1 test with a syntax error; all three write
// MANUAL.md for V2 and also touch a file outside the tests directory. "fail" exits 99.
const STUB = `#!/usr/bin/env node
const fs = require('node:fs'); const path = require('node:path');
const counter = process.env.FAKE_PI_COUNTER;
const n = fs.existsSync(counter) ? Number(fs.readFileSync(counter, 'utf8')) : 0;
fs.writeFileSync(counter, String(n + 1));
fs.appendFileSync(process.env.FAKE_PI_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');
const action = JSON.parse(process.env.FAKE_PI_ACTIONS)[n] || 'fail';
if (action === 'fail') { process.stderr.write('stub pi: no more actions\\n'); process.exit(99); }
const prompt = process.argv[process.argv.indexOf('-p') + 1];
const dir = prompt.match(/docs\\/specs\\/[^\\s\`'"]+?\\.tests/)[0];
fs.mkdirSync(dir, { recursive: true });
const body = {
  'write-failing': "import { test } from 'node:test'; import assert from 'node:assert/strict';\\nimport { add } from '../../../src/add.ts';\\ntest('V1', () => assert.equal(add(2, 3), 5));\\n",
  'write-passing': "import { test } from 'node:test'; import assert from 'node:assert/strict';\\ntest('V1', () => assert.equal(1, 1));\\n",
  'write-broken': "import { test } from 'node:test';\\ntest('V1', () => { (\\n",
}[action === 'write-failing-committed' ? 'write-failing' : action];
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'v01-add.test.ts'), body);
fs.writeFileSync(path.join(dir, 'MANUAL.md'), 'V2: needs Lucas to look at it\\n');
fs.writeFileSync('README.md', 'edited by the test writer\\n');
if (action === 'write-failing-committed') {
  const { execFileSync } = require('node:child_process');
  execFileSync('git', ['add', '--', dir]);
  execFileSync('git', ['commit', '--only', '-m', 'tests committed by writer', '--', dir]);
}
`;

function setup(t: any, actions: string[]) {
  const dir = tmp(t, "spec20-env-");
  const runRoot = path.join(dir, "runs");
  const settings = path.join(dir, "settings.json");
  fs.writeFileSync(settings, JSON.stringify({
    routing: { tiers: { escalate: "openai-codex/gpt-6.1-sol", scout: "openai-codex/gpt-6-luna" } },
    pipeline: { runRoot },
  }));
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "pi"), STUB, { mode: 0o755 });
  const env: Record<string, string | undefined> = { ...process.env, PI_BUILD_SETTINGS: settings, PI_BUILD_QUOTA_HOLD: path.join(dir, "no-hold.json"),
    PATH: `${bin}${path.delimiter}${process.env.PATH}`, FAKE_PI_ACTIONS: JSON.stringify(actions),
    FAKE_PI_COUNTER: path.join(dir, "count"), FAKE_PI_LOG: path.join(dir, "calls.jsonl") };
  delete env.PI_BUILD_PIPELINE; delete env.PI_BUILD_SUBAGENT_ROLE; delete env.PI_BUILD_TELEMETRY_DB;
  // node --test marks its children; a nested node --test that inherits the mark reports every file as passing.
  delete env.NODE_TEST_CONTEXT;

  const repo = tmp(t, "spec20-target-");
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@t"); git(repo, "config", "user.name", "t");
  fs.writeFileSync(path.join(repo, "README.md"), "");
  git(repo, "add", "."); git(repo, "commit", "-q", "-m", "base");
  const downloads = tmp(t, "spec20-dl-");
  fs.writeFileSync(path.join(downloads, "SPEC-NNNN-demo.md"), SPEC);
  const calls = () => fs.existsSync(env.FAKE_PI_LOG!) ? fs.readFileSync(env.FAKE_PI_LOG!, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { env, runRoot, repo, source: path.join(downloads, "SPEC-NNNN-demo.md"), calls };
}

const run = (args: string[], env: Record<string, string | undefined>) =>
  spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", IMPLEMENT, ...args], { cwd: PI_BUILD, env, encoding: "utf8" });

function onlyRun(runRoot: string, repo: string) {
  const runs = path.join(runRoot, path.basename(repo), "SPEC-0001-demo");
  const [stamp] = fs.readdirSync(runs);
  return { dir: path.join(runs, stamp), meta: JSON.parse(fs.readFileSync(path.join(runs, stamp, "pipeline.json"), "utf8")) };
}

test("a downloaded spec without tests is installed, the test writer runs first, and its tests are frozen in their own commit", (t) => {
  const { env, runRoot, repo, source, calls } = setup(t, ["write-failing", "fail"]);
  const result = run([source, "--repo", repo], env);
  assert.match(result.stderr, /planning failed/, result.stderr);
  const { dir, meta } = onlyRun(runRoot, repo);
  assert.equal(meta.specTests, "generated");
  const record = JSON.parse(fs.readFileSync(path.join(dir, "spec-tests.json"), "utf8"));
  assert.equal(record.writer, "openai-codex/gpt-6.1-sol");
  assert.deepEqual(record.files, [{ file: "docs/specs/SPEC-0001-demo.tests/v01-add.test.ts", before: "fail" }]);
  assert.deepEqual(record.manual, [{ check: "V2", reason: "needs Lucas to look at it" }]);
  const commit = git(repo, "log", "-1", "--format=%s", `${meta.branch}`);
  assert.match(commit, /spec tests: SPEC-0001/i);
  assert.deepEqual(git(repo, "show", "--name-only", "--format=", meta.branch).split("\n").sort(),
    ["docs/specs/SPEC-0001-demo.tests/MANUAL.md", "docs/specs/SPEC-0001-demo.tests/v01-add.test.ts"]);
  assert.equal(git(repo, "show", `${meta.branch}:README.md`), "", "the writer's edit outside the tests directory was discarded");
  const [writer, planner] = calls();
  assert.ok(writer.join(" ").includes("SPEC-0001-demo.tests") && writer.join(" ").includes("V2"), "the writer was asked for every check");
  assert.ok(planner, "planning ran after the tests were frozen");
  assert.match(fs.readFileSync(path.join(dir, "summary.md"), "utf8"), /fail-to-pass/);
});

test("an already committed test directory passes the gate without a duplicate commit, including on resume", (t) => {
  const { env, runRoot, repo, source, calls } = setup(t, ["write-failing-committed", "fail", "fail"]);
  const result = run([source, "--repo", repo], env);
  assert.match(result.stderr, /planning failed/, result.stderr);
  const { dir, meta } = onlyRun(runRoot, repo);
  // The writer's commit is folded into the pipeline's own tests-only commit.
  assert.match(git(repo, "log", "-1", "--format=%s", meta.branch), /^spec tests: SPEC-0001/);
  assert.equal(git(repo, "rev-list", "--count", `${meta.base}..${meta.branch}`), "1");
  const record = JSON.parse(fs.readFileSync(path.join(dir, "spec-tests.json"), "utf8"));
  assert.deepEqual(record.files, [{ file: "docs/specs/SPEC-0001-demo.tests/v01-add.test.ts", before: "fail" }]);
  assert.equal(git(repo, "show", `${meta.branch}:README.md`), "");
  assert.equal(calls().length, 2, "the writer's commit did not stop planning");
  const resumed = run(["1", "--repo", repo, "--resume"], env);
  assert.match(resumed.stderr, /planning failed/, resumed.stderr);
  assert.equal(calls().length, 3, "resume skips the completed test writer stage");
  assert.equal(git(repo, "rev-list", "--count", `${meta.base}..${meta.branch}`), "1");
});

test("tests that pass before implementation, or do not parse, go back to the writer with the gate's errors", (t) => {
  const { env, runRoot, repo, source, calls } = setup(t, ["write-passing", "write-broken", "write-failing", "fail"]);
  const result = run([source, "--repo", repo], env);
  assert.match(result.stderr, /planning failed/, result.stderr);
  const all = calls();
  assert.equal(all.length, 4);
  assert.match(all[1].join(" "), /pass before/i, "round 2 got the vacuous-tests error");
  assert.match(all[2].join(" "), /SyntaxError|syntax/i, "round 3 got the parse error");
  const { dir } = onlyRun(runRoot, repo);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "spec-tests.json"), "utf8")).rounds, 3);
});

test("after three rejected rounds the run stops before planning, with a summary", (t) => {
  const { env, runRoot, repo, source, calls } = setup(t, ["write-passing", "write-passing", "write-passing", "write-failing"]);
  const result = run([source, "--repo", repo], env);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /spec tests/i);
  assert.equal(calls().length, 3, "no planning session");
  const { dir, meta } = onlyRun(runRoot, repo);
  assert.equal(git(repo, "rev-parse", "main"), meta.base);
  assert.match(fs.readFileSync(path.join(dir, "summary.md"), "utf8"), /Failed/);
});

test("a spec that ships its own tests skips the writer", (t) => {
  const { env, runRoot, repo, calls } = setup(t, ["fail"]);
  fs.mkdirSync(path.join(repo, "docs/specs/SPEC-0001-demo.tests"), { recursive: true });
  fs.writeFileSync(path.join(repo, "docs/specs/SPEC-0001-demo.md"), SPEC.replaceAll("SPEC-NNNN", "SPEC-0001"));
  fs.writeFileSync(path.join(repo, "docs/specs/SPEC-0001-demo.tests/v01.test.ts"), "");
  git(repo, "add", "."); git(repo, "commit", "-q", "-m", "spec");
  const result = run(["1", "--repo", repo], env);
  assert.match(result.stderr, /planning failed/, result.stderr);
  assert.equal(calls().length, 1);
  assert.ok(!calls()[0].join(" ").includes("MANUAL.md"), "the only session was the planner");
  const { dir, meta } = onlyRun(runRoot, repo);
  assert.equal(meta.specTests, "supplied");
  assert.equal(fs.existsSync(path.join(dir, "spec-tests.json")), false);
});

test("a dry run of a spec without tests says who will write them instead of refusing", (t) => {
  const { env, repo, calls } = setup(t, []);
  fs.mkdirSync(path.join(repo, "docs/specs"), { recursive: true });
  fs.writeFileSync(path.join(repo, "docs/specs/SPEC-0001-demo.md"), SPEC.replaceAll("SPEC-NNNN", "SPEC-0001"));
  git(repo, "add", "."); git(repo, "commit", "-q", "-m", "spec");
  const result = run(["1", "--repo", repo, "--dry-run"], env);
  assert.equal(result.status, 0, result.stderr);
  assert.match(JSON.parse(result.stdout).specTests, /written by openai-codex\/gpt-6\.1-sol/);
  assert.equal(calls().length, 0);
});
