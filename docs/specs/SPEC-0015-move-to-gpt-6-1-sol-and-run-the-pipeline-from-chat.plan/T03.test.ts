import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const models = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../agent/models.json"), "utf8"));
test("Codex 6.1 Sol override matches context and cache, never overrides cost", () => {
  const overrides = models.providers["openai-codex"].modelOverrides;
  assert.deepEqual(overrides["gpt-6.1-sol"], { contextWindow: 272000, promptCache: { short: 1800, long: 1800 } });
  for (const entry of Object.values(overrides)) assert.equal(Object.hasOwn(entry as object, "cost"), false);
});
