import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { childEnv, pipelineRunRoot, pipelineTelemetryDbs } from "../../../lib/pipeline.ts";

test("pipeline roles and DB override inherited values without changing the base", () => {
  const base = { HOME: "/h", PI_BUILD_SUBAGENT_ROLE: "old" };
  for (const role of ["planner", "editor", "integration"] as const) {
    const env = childEnv(base, role, "/runs/task/telemetry.db");
    assert.equal(env.PI_BUILD_PIPELINE, "1");
    assert.equal(env.PI_BUILD_SUBAGENT_ROLE, role);
    assert.equal(env.PI_BUILD_TELEMETRY_DB, "/runs/task/telemetry.db");
    assert.equal(env.HOME, "/h");
  }
  assert.equal(base.PI_BUILD_SUBAGENT_ROLE, "old");
});

test("configurable run root and sorted recursive telemetry DB discovery", () => {
  assert.equal(pipelineRunRoot({}, "/home/u"), "/home/u/var/pipeline-runs");
  assert.equal(pipelineRunRoot({ pipeline: { runRoot: "/elsewhere" } }, "/home/u"), "/elsewhere");
  const root = mkdtempSync(join(tmpdir(), "pipeline-plan-"));
  mkdirSync(join(root, "spec", "run", "tasks", "T1"), { recursive: true });
  for (const f of ["spec/run/planner-telemetry.db", "spec/run/tasks/T1/telemetry.db", "spec/run/tasks/T1/not-a.db"]) writeFileSync(join(root, f), "");
  assert.deepEqual(pipelineTelemetryDbs(root), [join(root, "spec/run/planner-telemetry.db"), join(root, "spec/run/tasks/T1/telemetry.db")]);
  assert.deepEqual(pipelineTelemetryDbs(join(root, "missing")), []);
});
