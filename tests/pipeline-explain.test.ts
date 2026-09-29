import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("planner, Luna tasks and integration mark child sessions as pipeline runs", () => {
  const planner = fs.readFileSync("bin/pi-implement", "utf8");
  const runner = fs.readFileSync("scripts/run-plan.mjs", "utf8");
  assert.match(planner, /function pi\([\s\S]*?PI_BUILD_PIPELINE: "1"/);
  const childEnvs = runner.match(/const env = \{ \.\.\.process\.env, PI_BUILD_PIPELINE: "1", PI_BUILD_TELEMETRY_DB: dbPath \}/g) ?? [];
  assert.equal(childEnvs.length, 2, "Luna and integration each set the pipeline flag");
});
