import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const host = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../settings/hosts/machina.json"), "utf8"));
test("machina selects 6.1 Sol without disturbing the ladder or pipeline thinking", () => {
  const sol = "openai-codex/gpt-6.1-sol", luna = "openai-codex/gpt-6-luna", astra = "openai-codex/gpt-6-astra";
  assert.equal(host.defaultProvider, "openai-codex");
  assert.equal(host.defaultModel, "gpt-6.1-sol");
  assert.deepEqual(host.enabledModels, [sol, luna, astra]);
  assert.deepEqual(host.modelThinkingLevels, { [sol]: "medium", [luna]: "medium", [astra]: "high" });
  assert.deepEqual(host.routing.tiers, { scout: luna, work: sol, escalate: sol, explain: luna });
  assert.equal(host.routing.enabled, false);
  assert.deepEqual({ planner: host.pipeline.plannerThinking, editor: host.pipeline.editorThinking }, { planner: "high", editor: "medium" });
});
