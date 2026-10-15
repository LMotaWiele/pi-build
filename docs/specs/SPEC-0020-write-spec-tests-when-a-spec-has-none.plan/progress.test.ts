import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProgressLine, initialProgress, reduceProgress, renderProgress, progressSummary } from "../../../lib/progress.ts";

test("spec-tests stage survives parsing, reduction and both progress renderings", () => {
  const event = parseProgressLine(JSON.stringify({ type: "stage", stage: "spec-tests" }));
  assert.deepEqual(event, { type: "stage", stage: "spec-tests" });
  assert.ok(event);
  const state = reduceProgress(initialProgress("SPEC-0042"), event);
  assert.equal(state.stage, "spec-tests");
  assert.match(progressSummary(state), /Running spec-tests/);
  for (const expanded of [false, true]) assert.match(renderProgress(state, expanded).join("\n"), /spec-tests/);
});

test("existing stages still parse and unknown or malformed stages still cannot update the UI", () => {
  for (const stage of ["preflight", "plan", "gate", "tasks", "integration", "grade", "handoff", "install", "land"]) {
    assert.deepEqual(parseProgressLine(JSON.stringify({ type: "stage", stage })), { type: "stage", stage });
  }
  for (const stage of ["spec-test", "other", null, 42]) assert.equal(parseProgressLine(JSON.stringify({ type: "stage", stage })), null);
  assert.equal(parseProgressLine("not json"), null);
});
