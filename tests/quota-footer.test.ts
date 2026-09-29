import assert from "node:assert/strict";
import test from "node:test";
import {
  collectFooterUsage,
  contextTokenText,
  formatFooterCwd,
  formatFooterTokens,
  quotaFooterParts,
} from "../lib/footer.ts";
import type { QuotaWindow } from "../lib/quota.ts";

function window(label: "5h" | "weekly", usedPercent: number): QuotaWindow {
  return {
    slot: label === "5h" ? "primary" : "secondary",
    label,
    windowSeconds: label === "5h" ? 18_000 : 604_800,
    usedPercent,
    resetAt: null,
  };
}

test("the context footer uses compact token counts instead of a percentage", () => {
  assert.equal(formatFooterTokens(999), "999");
  assert.equal(formatFooterTokens(1_250), "1.3k");
  assert.equal(formatFooterTokens(12_345), "12k");
  assert.equal(contextTokenText(12_345, 272_000), "12k/272k");
  assert.equal(contextTokenText(null, 272_000), "?/272k");
});

test("quota footer parts put the 5h and weekly percentages after the token count", () => {
  assert.deepEqual(quotaFooterParts([window("weekly", 23), window("5h", 67.5)]), ["5h 67.5%", "weekly 23%"]);
  assert.deepEqual(quotaFooterParts([window("weekly", 23)]), ["weekly 23%"]);
});

test("footer usage preserves Pi's input, output, cache, and cost totals", () => {
  const usage = collectFooterUsage([
    {
      type: "message",
      message: {
        role: "assistant",
        usage: { input: 100, output: 20, cacheRead: 300, cacheWrite: 10, cost: { total: 0.2 } },
      },
    },
    { type: "compaction", usage: { input: 5, output: 2, cacheRead: 0, cacheWrite: 0, cost: { total: 0.1 } } },
  ]);
  assert.deepEqual(usage, {
    input: 105,
    output: 22,
    cacheRead: 300,
    cacheWrite: 10,
    cost: 0.30000000000000004,
    latestCacheHitRate: (300 / 410) * 100,
  });
});

test("footer paths abbreviate the home directory", () => {
  assert.equal(formatFooterCwd("/home/me/src/project", "/home/me"), "~/src/project");
  assert.equal(formatFooterCwd("/srv/project", "/home/me"), "/srv/project");
});
