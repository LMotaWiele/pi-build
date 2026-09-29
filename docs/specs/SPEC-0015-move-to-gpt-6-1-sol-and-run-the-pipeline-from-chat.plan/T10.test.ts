import { test } from "node:test";
import assert from "node:assert/strict";
import { testEnv, costByRole } from "../../../lib/pipeline.ts";
test("testEnv strips only pipeline markers from a new environment", () => {
  const original = { PATH: "/bin", PI_BUILD_PIPELINE: "1", PI_BUILD_SUBAGENT_ROLE: "editor", PI_BUILD_TELEMETRY_DB: "/tmp/db", EXTRA: "keep" };
  const cleaned = testEnv(original);
  assert.notStrictEqual(cleaned, original);
  assert.deepEqual(cleaned, { PATH: "/bin", EXTRA: "keep" });
  assert.equal(original.PI_BUILD_PIPELINE, "1");
});
test("role costs include integration and unknown roles exactly once", () => {
  const costs = costByRole([{ role: "planner", cost: 0.5 }, { role: "editor", cost: 0.01 }, { role: "editor", cost: 0.02 }, { role: "integration", cost: 0.3 }, { role: "explain", cost: 0.04 }, { role: null, cost: null }]);
  assert.ok(Math.abs(costs.editor - 0.03) < 1e-9);
  assert.deepEqual({ planner: costs.planner, integration: costs.integration, other: costs.other }, { planner: 0.5, integration: 0.3, other: 0.04 });
  assert.ok(Math.abs(costs.total - 0.87) < 1e-9);
});
