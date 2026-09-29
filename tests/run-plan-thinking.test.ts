import assert from "node:assert/strict";
import test from "node:test";
import { pipelineThinking } from "../lib/plan.ts";

test("pipeline thinking overrides interactive model levels", () => {
  assert.deepEqual(
    pipelineThinking({ pipeline: { plannerThinking: "high", editorThinking: "medium" }, modelThinkingLevels: { x: "low" } }),
    { planner: "high", editor: "medium" },
  );
});

test("pipeline thinking defaults to high planning and medium editing", () => {
  assert.deepEqual(pipelineThinking({}), { planner: "high", editor: "medium" });
  assert.deepEqual(pipelineThinking(null), { planner: "high", editor: "medium" });
});
