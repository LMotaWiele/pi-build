import { test } from "node:test";
import assert from "node:assert/strict";
import { childPiArgs, costByRole, implementArgs, testEnv } from "../../../lib/pipeline.ts";

test("tests run without the pipeline's own markers, so they see a normal session", () => {
  const base = { PATH: "/bin", PI_BUILD_PIPELINE: "1", PI_BUILD_SUBAGENT_ROLE: "editor", PI_BUILD_TELEMETRY_DB: "/r/t.db" };
  assert.deepEqual(testEnv(base), { PATH: "/bin" });
  assert.equal(base.PI_BUILD_PIPELINE, "1", "the input is not mutated");
});

test("children run in JSON mode, so their work can be followed live", () => {
  const args = childPiArgs({ model: "openai-codex/gpt-6-luna", thinking: "medium", prompt: "P", sessionDir: "/s" });
  assert.deepEqual(args.slice(0, 2), ["--mode", "json"]);
  assert.ok(args.includes("--approve"));
  assert.deepEqual(args.slice(-2), ["-p", "P"]);
  assert.ok(!args.includes("--continue"));
  assert.ok(childPiArgs({ model: "m", thinking: "high", prompt: "continue", sessionDir: "/s", continuing: true }).includes("--continue"));
});

test("cost is split by role, integration included", () => {
  const c = costByRole([
    { role: "planner", cost: 0.5 }, { role: "editor", cost: 0.01 }, { role: "editor", cost: 0.02 },
    { role: "integration", cost: 0.3 }, { role: null, cost: null }, { role: "explain", cost: 0.04 },
  ]);
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  assert.ok(near(c.planner, 0.5) && near(c.editor, 0.03) && near(c.integration, 0.3) && near(c.other, 0.04) && near(c.total, 0.87), JSON.stringify(c));
});

test("the chat tool starts the runner with a progress stream", () => {
  assert.deepEqual(implementArgs({ spec: "15" }), ["15", "--progress", "json"]);
  assert.deepEqual(implementArgs({ spec: "15", planOnly: true, resume: true }), ["15", "--progress", "json", "--plan-only", "--resume"]);
});
