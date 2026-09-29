import { test } from "node:test";
import assert from "node:assert/strict";
import { childPiArgs, implementArgs } from "../../../lib/pipeline.ts";
test("childPiArgs streams JSON and keeps the prompt last", () => {
  const args = childPiArgs({ model: "openai-codex/gpt-6-luna", thinking: "medium", prompt: "edit", sessionDir: "/session" });
  assert.deepEqual(args, ["--mode", "json", "--model", "openai-codex/gpt-6-luna", "--thinking", "medium", "--session-dir", "/session", "--approve", "-p", "edit"]);
  assert.deepEqual(childPiArgs({ model: "m", thinking: "high", prompt: "continue", sessionDir: "/s", continuing: true }), ["--mode", "json", "--model", "m", "--thinking", "high", "--session-dir", "/s", "--continue", "--approve", "-p", "continue"]);
});
test("implementArgs has stable progress and optional flag order", () => {
  assert.deepEqual(implementArgs({ spec: "15" }), ["15", "--progress", "json"]);
  assert.deepEqual(implementArgs({ spec: "15", planOnly: true, resume: true }), ["15", "--progress", "json", "--plan-only", "--resume"]);
});
