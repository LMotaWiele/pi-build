// The spec test writer is a full pi session and may commit its own work. The runner must still
// end up with exactly one tests-only commit on the run branch, and discard committed edits
// outside the tests directory, including commits left behind by an earlier, interrupted run.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";

const PI_BUILD = fs.realpathSync(path.resolve(import.meta.dirname, ".."));
const IMPLEMENT = path.join(PI_BUILD, "bin", "pi-implement");
const SPEC = "# SPEC-0001: Demo\n\n| Field | Value |\n|---|---|\n| Status | ready |\n\n## 8. Verification\n| O | C | Check ID: condition |\n|---|---|---|\n" +
  "| O1 | §6.1 | V1: add() returns the sum |\n| O1 | — | V2: Lucas likes it |\n\n## 9. Stop\n";
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

// Actions: "commit" writes V1 test + MANUAL.md, edits README.md outside the tests directory and commits everything;
// "commit-then-crash" does the same and exits 99; "fail" exits 99 without writing.
const STUB = `#!/usr/bin/env node
const fs = require('node:fs'); const path = require('node:path'); const { execFileSync } = require('node:child_process');
const n = fs.existsSync(process.env.FAKE_PI_COUNTER) ? Number(fs.readFileSync(process.env.FAKE_PI_COUNTER, 'utf8')) : 0;
fs.writeFileSync(process.env.FAKE_PI_COUNTER, String(n + 1));
const action = JSON.parse(process.env.FAKE_PI_ACTIONS)[n] || 'fail';
if (action === 'fail') { process.stderr.write('stub pi: no more actions\\n'); process.exit(99); }
const prompt = process.argv[process.argv.indexOf('-p') + 1];
const dir = prompt.match(/docs\\/specs\\/[^\\s\`'"]+?\\.tests/)[0];
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'v01-add.test.ts'), "import { test } from 'node:test'; import assert from 'node:assert/strict';\\nimport { add } from '../../../src/add.ts';\\ntest('V1', () => assert.equal(add(2, 3), 5));\\n");
fs.writeFileSync(path.join(dir, 'MANUAL.md'), 'V2: needs Lucas to look at it\\n');
fs.writeFileSync('README.md', 'edited by the test writer\\n');
execFileSync('git', ['add', '-A']);
execFileSync('git', ['-c', 'user.email=w@w', '-c', 'user.name=writer', 'commit', '-q', '-m', 'writer: add tests']);
if (action === 'commit-then-crash') process.exit(99);
`;

function tmp(t: any, prefix: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function setup(t: any) {
  const dir = tmp(t, "writer-commits-env-");
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
    PATH: `${bin}${path.delimiter}${process.env.PATH}`, FAKE_PI_COUNTER: path.join(dir, "count") };
  delete env.PI_BUILD_PIPELINE; delete env.PI_BUILD_SUBAGENT_ROLE; delete env.PI_BUILD_TELEMETRY_DB; delete env.NODE_TEST_CONTEXT;
  const repo = tmp(t, "writer-commits-target-");
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@t"); git(repo, "config", "user.name", "t");
  fs.writeFileSync(path.join(repo, "README.md"), "");
  fs.mkdirSync(path.join(repo, "docs/specs"), { recursive: true });
  fs.writeFileSync(path.join(repo, "docs/specs/SPEC-0001-demo.md"), SPEC);
  git(repo, "add", "."); git(repo, "commit", "-q", "-m", "spec");
  const run = (actions: string[], extra: string[] = []) => {
    fs.rmSync(env.FAKE_PI_COUNTER!, { force: true });
    return spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", IMPLEMENT, "1", "--repo", repo, ...extra],
      { cwd: PI_BUILD, env: { ...env, FAKE_PI_ACTIONS: JSON.stringify(actions) }, encoding: "utf8" });
  };
  const runDir = () => {
    const runs = path.join(runRoot, path.basename(repo), "SPEC-0001-demo");
    const [stamp] = fs.readdirSync(runs);
    return path.join(runs, stamp);
  };
  return { repo, run, runDir };
}

function assertOneTestsOnlyCommit(repo: string, dir: string) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "pipeline.json"), "utf8"));
  const commits = git(repo, "rev-list", `${meta.base}..${meta.branch}`).split("\n").filter(Boolean);
  assert.equal(commits.length, 1, `expected one commit on the run branch, got ${commits.length}`);
  assert.match(git(repo, "log", "-1", "--format=%s", meta.branch), /^spec tests: SPEC-0001/);
  assert.deepEqual(git(repo, "show", "--name-only", "--format=", meta.branch).split("\n").sort(),
    ["docs/specs/SPEC-0001-demo.tests/MANUAL.md", "docs/specs/SPEC-0001-demo.tests/v01-add.test.ts"]);
  assert.equal(git(repo, "show", `${meta.branch}:README.md`), "", "the writer's committed README edit was discarded");
  assert.equal(fs.readFileSync(path.join(dir, "branch", "README.md"), "utf8"), "", "and is gone from the worktree");
  const record = JSON.parse(fs.readFileSync(path.join(dir, "spec-tests.json"), "utf8"));
  assert.deepEqual(record.files, [{ file: "docs/specs/SPEC-0001-demo.tests/v01-add.test.ts", before: "fail" }]);
}

test("a writer that commits its own tests and an outside edit still yields one tests-only commit, then planning", (t) => {
  const { repo, run, runDir } = setup(t);
  const result = run(["commit", "fail"]);
  assert.match(result.stderr, /planning failed/, result.stderr);
  assertOneTestsOnlyCommit(repo, runDir());
});

test("resuming a run whose branch already carries writer commits redoes the stage cleanly", (t) => {
  const { repo, run, runDir } = setup(t);
  const first = run(["commit-then-crash"]);
  assert.equal(first.status, 1, first.stderr);
  assert.match(first.stderr, /spec tests writer failed/);
  // Recreate what an older runner left behind: the writer's commit on the run branch, no spec-tests.json.
  const work = path.join(runDir(), "branch");
  fs.mkdirSync(path.join(work, "docs/specs/SPEC-0001-demo.tests"), { recursive: true });
  fs.writeFileSync(path.join(work, "docs/specs/SPEC-0001-demo.tests/v01-add.test.ts"), "// stale\n");
  fs.writeFileSync(path.join(work, "README.md"), "left behind\n");
  git(work, "add", "-A"); git(work, "-c", "user.email=w@w", "-c", "user.name=w", "commit", "-q", "-m", "leftover writer commit");
  assert.equal(fs.existsSync(path.join(runDir(), "spec-tests.json")), false);
  const second = run(["commit", "fail"], ["--resume"]);
  assert.match(second.stderr, /planning failed/, second.stderr);
  assertOneTestsOnlyCommit(repo, runDir());
});
