import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("planner, Luna tasks and integration mark child sessions as pipeline runs", () => {
  const planner = fs.readFileSync("bin/pi-implement", "utf8");
  const runner = fs.readFileSync("scripts/run-plan.mjs", "utf8");
  assert.match(planner, /childEnv\(process\.env, "planner", db\)/);
  assert.match(runner, /childEnv\(process\.env, "editor", dbPath\)/);
  assert.match(runner, /childEnv\(process\.env, "integration", dbPath\)/);
});
