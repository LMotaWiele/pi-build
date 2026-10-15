import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  STOP_AND_REPORT, findHarnessRoot, targetRepo, implementArgs,
  pythonProjectFor, runDirBase, planPrompt, preflight,
} from "../../../lib/pipeline.ts";

function temporary(t: { after: (fn: () => void) => void }): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "spec18-plan-")));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const SPEC = "# S\n\n## 8. Verification\n| Outcome | Change | Check ID: condition |\n|---|---|---|\n| O1 | §6.2 | V1: works |\n\n## 9. Stop\n";
const STOP = "Do not implement this spec with other tools. Report this result to the user and wait for instructions.";

test("STOP_AND_REPORT is the exact fixed sentence", () => {
  assert.equal(STOP_AND_REPORT, STOP);
});

test("findHarnessRoot uses real files/directories, follows symlinks and chooses the nearest runner ancestor", (t) => {
  const dir = temporary(t);
  const harness = path.join(dir, "harness");
  const extensions = path.join(harness, "extensions");
  fs.mkdirSync(extensions, { recursive: true });
  fs.mkdirSync(path.join(harness, "bin"));
  fs.writeFileSync(path.join(harness, "bin/pi-implement"), "");
  fs.writeFileSync(path.join(extensions, "pipeline.ts"), "");
  // docs/specs is deliberately absent: harness discovery needs only the runner marker.
  assert.equal(findHarnessRoot(extensions), harness);
  assert.equal(findHarnessRoot(path.join(extensions, "pipeline.ts")), harness);
  fs.symlinkSync(extensions, path.join(dir, "linked-extensions"), "dir");
  fs.symlinkSync(path.join(extensions, "pipeline.ts"), path.join(dir, "linked.ts"));
  assert.equal(findHarnessRoot(path.join(dir, "linked-extensions/pipeline.ts")), harness);
  assert.equal(findHarnessRoot(path.join(dir, "linked.ts")), harness);
  const inner = path.join(extensions, "inner");
  fs.mkdirSync(path.join(inner, "bin"), { recursive: true });
  fs.writeFileSync(path.join(inner, "bin/pi-implement"), "");
  assert.equal(findHarnessRoot(inner), inner);
  assert.equal(findHarnessRoot(dir), null);
  assert.equal(findHarnessRoot(path.join(dir, "missing.ts")), null);
});

test("targetRepo returns the real git top level from subdirectories, symlinks and worktrees, or null", (t) => {
  const dir = temporary(t);
  const repo = path.join(dir, "repo");
  execFileSync("git", ["init", "-q", repo]);
  fs.mkdirSync(path.join(repo, "src/deep"), { recursive: true });
  assert.equal(targetRepo(repo), repo);
  assert.equal(targetRepo(path.join(repo, "src/deep")), repo);
  fs.symlinkSync(repo, path.join(dir, "link"), "dir");
  assert.equal(targetRepo(path.join(dir, "link/src")), repo);
  execFileSync("git", ["-C", repo, "-c", "user.name=spec18", "-c", "user.email=spec18@localhost", "commit", "--allow-empty", "-qm", "fixture"]);
  const work = path.join(dir, "work");
  execFileSync("git", ["-C", repo, "worktree", "add", "-q", "--detach", work]);
  assert.equal(targetRepo(work), work);
  assert.equal(targetRepo(dir), null);
  assert.equal(targetRepo(path.join(dir, "absent")), null);
});

test("implementArgs keeps old argument order and appends --repo after all existing switches", () => {
  assert.deepEqual(implementArgs({ spec: "15" }), ["15", "--progress", "json"]);
  assert.deepEqual(implementArgs({ spec: "00B1", planOnly: true, resume: true }), ["00B1", "--progress", "json", "--plan-only", "--resume"]);
  assert.deepEqual(implementArgs({ spec: "00B1", planOnly: true, resume: true, repo: "/target" }),
    ["00B1", "--progress", "json", "--plan-only", "--resume", "--repo", "/target"]);
  assert.deepEqual(implementArgs({ spec: "x", planOnly: false, resume: false, repo: "/target" }), ["x", "--progress", "json", "--repo", "/target"]);
});

test("pythonProjectFor prioritises target config, real-path host identity, target pyproject, then null", (t) => {
  const dir = temporary(t);
  const harness = path.join(dir, "harness");
  const target = path.join(dir, "target");
  for (const repo of [harness, target]) fs.mkdirSync(path.join(repo, ".pi"), { recursive: true });
  const settings = { pipeline: { pythonProject: "host/py" } };
  assert.equal(pythonProjectFor({ target: harness, harnessRoot: harness, settings }), "host/py");
  assert.equal(pythonProjectFor({ target: harness, harnessRoot: harness, settings: {} }), "tools/map");
  fs.symlinkSync(harness, path.join(dir, "harness-link"), "dir");
  assert.equal(pythonProjectFor({ target: path.join(dir, "harness-link"), harnessRoot: harness, settings }), "host/py");
  assert.equal(pythonProjectFor({ target, harnessRoot: harness, settings }), null);
  fs.writeFileSync(path.join(target, "pyproject.toml"), "");
  assert.equal(pythonProjectFor({ target, harnessRoot: harness, settings }), ".");
  const config = path.join(target, ".pi/pipeline.json");
  fs.writeFileSync(config, JSON.stringify({ pythonProject: "python/pkg" }));
  assert.equal(pythonProjectFor({ target, harnessRoot: harness, settings }), "python/pkg");
  for (const invalid of ["", 42, null]) {
    fs.writeFileSync(config, JSON.stringify({ pythonProject: invalid }));
    assert.equal(pythonProjectFor({ target, harnessRoot: harness, settings }), ".");
  }
  fs.writeFileSync(path.join(harness, ".pi/pipeline.json"), JSON.stringify({ pythonProject: "local/py" }));
  assert.equal(pythonProjectFor({ target: harness, harnessRoot: harness, settings }), "local/py");
});

test("runDirBase preserves the pi-build layout, recognises real-path aliases, and namespaces foreign targets", (t) => {
  const dir = temporary(t);
  const harness = path.join(dir, "harness");
  const target = path.join(dir, "other");
  fs.mkdirSync(harness); fs.mkdirSync(target);
  fs.symlinkSync(harness, path.join(dir, "alias"), "dir");
  const common = { runRoot: path.join(dir, "runs"), harnessRoot: harness, id: "00B1", slug: "demo" };
  assert.equal(runDirBase({ ...common, target: harness }), path.join(dir, "runs/SPEC-00B1-demo"));
  assert.equal(runDirBase({ ...common, target: path.join(dir, "alias") }), path.join(dir, "runs/SPEC-00B1-demo"));
  assert.equal(runDirBase({ ...common, target }), path.join(dir, "runs/other/SPEC-00B1-demo"));
  // The spec's own test also uses lexical, nonexistent paths; identity comparison must not throw.
  assert.equal(runDirBase({ runRoot: "/runs", target: "/src/pi-build", harnessRoot: "/src/pi-build", id: "0018", slug: "s" }), "/runs/SPEC-0018-s");
});

test("preflight preserves legacy results and blocks only recognized Python tests with an explicit null project", () => {
  const base = { specText: SPEC, hasTestsDir: true, held: false, dirty: [] as string[] };
  assert.deepEqual(preflight(base), { checks: 1, blocking: [], warnings: [] });
  assert.deepEqual(preflight({ ...base, hasTestsDir: false, held: true, dirty: ["a.ts"] }), {
    checks: 1,
    blocking: ["spec has no .tests/ directory: the pipeline grades against the spec's tests", "quota hold in place: run bin/pi-continue first"],
    warnings: ["1 uncommitted path(s) are not part of the run, which starts from HEAD: a.ts"],
  });
  const reason = "Python tests but no Python project; add .pi/pipeline.json with pythonProject";
  for (const file of ["test_a.py", "docs/specs/S.tests/a_test.py"]) {
    assert.deepEqual(preflight({ ...base, testFiles: [file], pythonProject: null }).blocking, [reason]);
    assert.deepEqual(preflight({ ...base, testFiles: [file], pythonProject: "." }).blocking, []);
  }
  assert.deepEqual(preflight({ ...base, testFiles: ["test_a.py"] }).blocking, []);
  assert.deepEqual(preflight({ ...base, testFiles: ["x.test.ts", "helpers.py"], pythonProject: null }).blocking, []);
  assert.deepEqual(preflight({ ...base, pythonProject: null }).blocking, []);
});

test("planPrompt preserves the entire old prompt apart from its absolute harness Plan path", () => {
  const actual = planPrompt({ spec: "docs/specs/SPEC-00B1-demo.md", planDir: "docs/specs/SPEC-00B1-demo.plan", checks: 11, harnessRoot: "/harness" });
  const expected = "Read docs/specs/SPEC-00B1-demo.md and the repository. Write an implementation plan to docs/specs/SPEC-00B1-demo.plan/plan.json following the Plan interface in /harness/lib/plan.ts, and one acceptance test per Luna task in docs/specs/SPEC-00B1-demo.plan/.\n\n" +
    'Map each verification V-number, 1 through 11, to verifyMap key without the V (V3 is key "3"). Order tasks by the spec\'s stages. List every requirement and map every V-number to requirement ids or "process". Split tasks into one file each; assign to Luna only tasks needing no cross-file reasoning or open design decision; assign the rest to Sol. Each Luna brief must stand alone, with exact interfaces, constants, reading and forbidden edits. Tests import only declared interfaces and assert behaviour. Run validatePlan and undeclaredImports, confirm every acceptance test fails before implementation. Do not implement anything.';
  assert.equal(actual, expected);
});
