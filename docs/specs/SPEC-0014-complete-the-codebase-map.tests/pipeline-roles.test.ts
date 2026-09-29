// Pipeline sessions are labelled, found, and fed to the map; the map does not run inside them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { childEnv, pipelineRunRoot, pipelineTelemetryDbs } from "../../../lib/pipeline.ts";
import { mapCommand, shouldRunMap } from "../../../extensions/map.ts";

test("every pipeline child is marked as pipeline work, with its role and its database", () => {
  for (const role of ["planner", "editor", "integration"] as const) {
    const env = childEnv({ HOME: "/h", PI_BUILD_SUBAGENT_ROLE: "stale" }, role, "/runs/x/telemetry.db");
    assert.equal(env.PI_BUILD_PIPELINE, "1");
    assert.equal(env.PI_BUILD_SUBAGENT_ROLE, role);
    assert.equal(env.PI_BUILD_TELEMETRY_DB, "/runs/x/telemetry.db");
    assert.equal(env.HOME, "/h");
  }
});

test("the run root is a host setting, defaulting to ~/var/pipeline-runs", () => {
  assert.equal(pipelineRunRoot({}, "/home/u"), "/home/u/var/pipeline-runs");
  assert.equal(pipelineRunRoot({ pipeline: { runRoot: "/data/runs" } }, "/home/u"), "/data/runs");
});

test("every pipeline telemetry database under the run root is found, in a stable order", () => {
  const root = mkdtempSync(join(tmpdir(), "runs-"));
  const run = join(root, "SPEC-0014-x", "2026-09-30T10-00-00Z");
  mkdirSync(join(run, "tasks", "T1"), { recursive: true });
  mkdirSync(join(run, "tasks", "T2"), { recursive: true });
  for (const f of ["planner-telemetry.db", "integration-telemetry.db", "tasks/T1/telemetry.db", "tasks/T2/telemetry.db", "grade.json", "tasks/T1/log.txt"]) {
    writeFileSync(join(run, f), "");
  }
  const found = pipelineTelemetryDbs(root).map((p) => p.slice(run.length + 1));
  assert.deepEqual(found, ["integration-telemetry.db", "planner-telemetry.db", "tasks/T1/telemetry.db", "tasks/T2/telemetry.db"]);
  assert.deepEqual(pipelineTelemetryDbs(join(root, "missing")), []);
});

const settings = { uv: "uv", toolDir: "/tool", outDir: ".agent/map", windowDays: 30 } as any;

test("the map reads pipeline databases after the main one; existing calls are unchanged", () => {
  const plain = mapCommand(settings, { root: "/p", telemetry: "/main.db" });
  assert.deepEqual(plain.args.filter((a, i, all) => all[i - 1] === "--telemetry"), ["/main.db"]);
  const withRuns = mapCommand(settings, { root: "/p", telemetry: "/main.db", extraTelemetry: ["/r/a.db", "/r/b.db"] });
  assert.deepEqual(withRuns.args.filter((a, i, all) => all[i - 1] === "--telemetry"), ["/main.db", "/r/a.db", "/r/b.db"]);
});

test("the map does not run inside a pipeline child", () => {
  assert.equal(shouldRunMap({}), true);
  assert.equal(shouldRunMap({ PI_BUILD_PIPELINE: "1" }), false);
});
