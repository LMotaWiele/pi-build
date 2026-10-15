import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  STOP_AND_REPORT, findHarnessRoot, implementArgs, planPrompt, preflight, pythonProjectFor, runDirBase, targetRepo,
} from "../../../lib/pipeline.ts";

const PI_BUILD = fs.realpathSync(path.resolve(import.meta.dirname, "../../.."));

function tmp(t: any, prefix: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function gitRepo(t: any): string {
  const dir = tmp(t, "spec18-target-");
  execFileSync("git", ["init", "-q", dir]);
  return dir;
}

test("the harness root is found from the extension's own file, also through a symlink", (t) => {
  assert.equal(findHarnessRoot(path.join(PI_BUILD, "extensions", "pipeline.ts")), PI_BUILD);
  const links = tmp(t, "spec18-link-");
  fs.symlinkSync(path.join(PI_BUILD, "extensions"), path.join(links, "extensions"), "dir");
  assert.equal(findHarnessRoot(path.join(links, "extensions", "pipeline.ts")), PI_BUILD);
  const empty = tmp(t, "spec18-empty-");
  fs.writeFileSync(path.join(empty, "x.ts"), "");
  assert.equal(findHarnessRoot(path.join(empty, "x.ts")), null);
});

test("the target is the git top level of the session's directory, or null outside a repository", (t) => {
  const repo = gitRepo(t);
  fs.mkdirSync(path.join(repo, "src", "deep"), { recursive: true });
  assert.equal(targetRepo(repo), repo);
  assert.equal(targetRepo(path.join(repo, "src", "deep")), repo);
  assert.equal(targetRepo(tmp(t, "spec18-plain-")), null);
  assert.equal(targetRepo(path.join(os.tmpdir(), "spec18-does-not-exist-" + process.pid)), null);
});

test("the tool passes the target as --repo, after the existing arguments", () => {
  assert.deepEqual(implementArgs({ spec: "15" }), ["15", "--progress", "json"]);
  assert.deepEqual(implementArgs({ spec: "00B1", repo: "/r" }), ["00B1", "--progress", "json", "--repo", "/r"]);
  assert.deepEqual(implementArgs({ spec: "00B1", planOnly: true, resume: true, repo: "/r" }),
    ["00B1", "--progress", "json", "--plan-only", "--resume", "--repo", "/r"]);
});

test("the Python project comes from the target's config, then pi-build's host setting, then pyproject.toml, else none", (t) => {
  const harness = tmp(t, "spec18-harness-");
  const configured = tmp(t, "spec18-configured-");
  fs.mkdirSync(path.join(configured, ".pi"));
  fs.writeFileSync(path.join(configured, ".pi", "pipeline.json"), JSON.stringify({ pythonProject: "py" }));
  fs.writeFileSync(path.join(configured, "pyproject.toml"), "");
  assert.equal(pythonProjectFor({ target: configured, harnessRoot: harness, settings: { pipeline: { pythonProject: "tools/map" } } }), "py");

  assert.equal(pythonProjectFor({ target: harness, harnessRoot: harness, settings: {} }), "tools/map");
  assert.equal(pythonProjectFor({ target: harness, harnessRoot: harness, settings: { pipeline: { pythonProject: "x/y" } } }), "x/y");

  const pyRoot = tmp(t, "spec18-pyroot-");
  fs.writeFileSync(path.join(pyRoot, "pyproject.toml"), "");
  assert.equal(pythonProjectFor({ target: pyRoot, harnessRoot: harness, settings: { pipeline: { pythonProject: "tools/map" } } }), ".");

  assert.equal(pythonProjectFor({ target: tmp(t, "spec18-none-"), harnessRoot: harness, settings: { pipeline: { pythonProject: "tools/map" } } }), null);
});

test("run directories keep their old place for pi-build and are namespaced by repository otherwise", () => {
  assert.equal(runDirBase({ runRoot: "/runs", target: "/src/pi-build", harnessRoot: "/src/pi-build", id: "0018", slug: "s" }), "/runs/SPEC-0018-s");
  assert.equal(runDirBase({ runRoot: "/runs", target: "/src/other", harnessRoot: "/src/pi-build", id: "00B1", slug: "s" }), "/runs/other/SPEC-00B1-s");
});

test("preflight blocks Python tests without a Python project, and is unchanged when not told about tests", () => {
  const SPEC = "# S\n\n## 8. Verification\n| O | C | Check ID: condition |\n|---|---|---|\n| O1 | §6.1 | V1: a |\n\n## 9. Stop\n";
  assert.deepEqual(preflight({ specText: SPEC, hasTestsDir: true, held: false, dirty: [] }), { checks: 1, blocking: [], warnings: [] });
  const blocked = preflight({ specText: SPEC, hasTestsDir: true, held: false, dirty: [], testFiles: ["docs/specs/S.tests/test_a.py"], pythonProject: null });
  assert.equal(blocked.blocking.length, 1);
  assert.match(blocked.blocking[0], /\.pi\/pipeline\.json/);
  assert.deepEqual(preflight({ specText: SPEC, hasTestsDir: true, held: false, dirty: [], testFiles: ["docs/specs/S.tests/a.test.ts"], pythonProject: null }).blocking, []);
  assert.deepEqual(preflight({ specText: SPEC, hasTestsDir: true, held: false, dirty: [], testFiles: ["docs/specs/S.tests/test_a.py"], pythonProject: "." }).blocking, []);
});

test("the planner is pointed at the harness's Plan interface by absolute path", () => {
  const p = planPrompt({ spec: "docs/specs/SPEC-00B1-x.md", planDir: "docs/specs/SPEC-00B1-x.plan", checks: 4, harnessRoot: "/src/pi-build" });
  assert.ok(p.includes("/src/pi-build/lib/plan.ts"), p);
  assert.ok(p.includes("docs/specs/SPEC-00B1-x.md") && p.includes("docs/specs/SPEC-00B1-x.plan/plan.json"));
  assert.ok(p.includes("1 through 4"));
  assert.ok(p.includes("Do not implement anything."));
});

test("the stop-and-report sentence is fixed", () => {
  assert.equal(STOP_AND_REPORT, "Do not implement this spec with other tools. Report this result to the user and wait for instructions.");
});
