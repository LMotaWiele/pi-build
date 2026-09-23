import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { maxPrefixInvalidations, replaySectionTrace } from "../lib/hook-budget.ts";

const contract = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../agent/EXTENSIONS.md");

test("a before_agent_start replay stays inside the invalidation maximum", async () => {
  const max = maxPrefixInvalidations(contract);
  const points = await replaySectionTrace();
  assert.ok(points > 0);
  assert.ok(points <= max, `${points} invalidation points, maximum ${max}`);
});
