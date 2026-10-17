// Pipeline safety: children are told the pipeline owns git, Sol steps must report DONE or BLOCKED,
// failed prerequisites defer their dependents, and Python tests run in the project's own environment.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { failedPrerequisite, solTasksPrompt, type Plan } from "../lib/plan.ts";
import { parseStepStatus, pipelineContext, pythonRunnerFor, testCommands } from "../lib/pipeline.ts";
import { specTestsPrompt } from "../lib/spec-tests.ts";

const task = (id: string, assignee: "luna" | "sol", dependsOn: string[] = []) => ({
  id, assignee, dependsOn, file: `src/${id}.ts`, requirements: [], brief: `do ${id}`, interfaces: [],
  acceptanceTest: assignee === "luna" ? `t/${id}.test.ts` : null,
});
const plan = (tasks: ReturnType<typeof task>[]): Plan => ({ spec: "s.md", verifyMap: {}, requirements: [], tasks });

function tmp(t: any): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-safety-")));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("children are told the pipeline owns commits and branches, and not to build environments", () => {
  const text = pipelineContext({ target: "/src/repo", baseBranch: "master" });
  for (const want of ["/src/repo", "worktree", "master", "Do not commit", "not a reason to stop", "virtual environment"]) {
    assert.ok(text.includes(want), want);
  }
  assert.match(pipelineContext({ target: "/r", baseBranch: null }), /the branch the run started on/);
});

test("a Sol step is done only when its last STATUS line says DONE", () => {
  assert.deepEqual(parseStepStatus("work\nSTATUS: DONE\n"), { done: true, reason: "" });
  assert.deepEqual(parseStepStatus("STATUS: DONE\nlater\nSTATUS: BLOCKED: spec requires commits on master"),
    { done: false, reason: "spec requires commits on master" });
  assert.equal(parseStepStatus("I implemented everything.").done, false);
  assert.match(parseStepStatus("I implemented everything.").reason, /no STATUS line/);
  assert.equal(parseStepStatus("**STATUS: DONE**").done, true, "markdown emphasis is tolerated");
});

test("the Sol step prompt asks for the STATUS line", () => {
  const text = solTasksPrompt({ planFile: "p.json", plan: plan([task("U0", "sol")]), ids: ["U0"] });
  assert.match(text, /STATUS: DONE/);
  assert.match(text, /STATUS: BLOCKED: <reason>/);
});

test("a task that depends, directly or through others, on a failed task names that failure", () => {
  const p = plan([task("L1", "luna"), task("S2", "sol", ["L1"]), task("L3", "luna", ["S2"]), task("L4", "luna")]);
  const failed = new Set(["L1"]);
  assert.equal(failedPrerequisite(p, "S2", failed), "L1");
  assert.equal(failedPrerequisite(p, "L3", failed), "L1");
  assert.equal(failedPrerequisite(p, "L4", failed), null);
  assert.equal(failedPrerequisite(p, "L1", failed), null, "a failed task is not its own prerequisite");
});

test("Python tests run with the project's own .venv and the worktree's sources first on the path", (t) => {
  const target = tmp(t);
  assert.equal(pythonRunnerFor({ target, pythonProject: null }), null);
  assert.equal(pythonRunnerFor({ target, pythonProject: "." }), null, "no .venv: fall back to uv");
  fs.mkdirSync(path.join(target, ".venv/bin"), { recursive: true });
  fs.writeFileSync(path.join(target, ".venv/bin/python"), "");
  assert.deepEqual(pythonRunnerFor({ target, pythonProject: "." }), { python: path.join(target, ".venv/bin/python"), pythonPath: "." });
  fs.mkdirSync(path.join(target, "src"));
  assert.deepEqual(pythonRunnerFor({ target, pythonProject: "." }), { python: path.join(target, ".venv/bin/python"), pythonPath: "src" });
  fs.mkdirSync(path.join(target, ".pi"));
  fs.writeFileSync(path.join(target, ".pi/pipeline.json"), JSON.stringify({ python: "/opt/py/bin/python" }));
  assert.equal(pythonRunnerFor({ target, pythonProject: "." })!.python, "/opt/py/bin/python");

  const files = ["t/test_v01_a.py", "t/v02.test.ts"];
  assert.deepEqual(testCommands(files, { pythonProject: ".", python: "/v/bin/python", pythonPath: "src" })[1],
    { cmd: "env", args: ["PYTHONPATH=src", "/v/bin/python", "-m", "pytest", "-q", "t/test_v01_a.py"] });
  assert.deepEqual(testCommands(files, { pythonProject: "." })[1],
    { cmd: "uv", args: ["run", "--project", ".", "pytest", "-q", "t/test_v01_a.py"] }, "unchanged without a runner");
});

test("the spec test writer is told how to name and run Python tests, and not to wrap them in Node", () => {
  const text = specTestsPrompt({ spec: "s.md", testsDir: "d.tests", checks: 2, pythonProject: ".", pythonCommand: "env PYTHONPATH=src /v/bin/python -m pytest -q" });
  assert.match(text, /test_v01_/);
  assert.ok(text.includes("env PYTHONPATH=src /v/bin/python -m pytest -q"));
  assert.match(text, /never wrap/i);
});

test("the summary names task sessions by their task directory", async (t) => {
  const { buildSummary } = await import("../lib/run-summary.ts");
  const { DatabaseSync } = await import("node:sqlite");
  const dir = tmp(t);
  for (const sub of ["tasks/sol-U0", "tasks/L1"]) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
    const db = new DatabaseSync(path.join(dir, sub, "telemetry.db"));
    db.exec("CREATE TABLE inference_calls (cost_usd REAL, prompt_tokens INTEGER, completion_tokens INTEGER)");
    db.exec("INSERT INTO inference_calls VALUES (0.1, 10, 2)");
    db.close();
  }
  const text = buildSummary({ runDir: dir, outcome: { ok: false, stage: "tasks", reason: "x" } });
  assert.match(text, /\| sol-U0 \|/);
  assert.match(text, /\| L1 \|/);
  assert.doesNotMatch(text, /\| telemetry\.db \|/);
});
