import { test } from "node:test";
import assert from "node:assert/strict";
import { labelWindow, quotaAction, PAUSE_MARGIN_SEC, type QuotaWindow } from "../../../lib/quota.ts";

const NOW = 1_000_000;
const t = { fiveHour: 95, weekly: 95 };
function w(label: "5h" | "weekly" | "other", used: number, resetAt: number | null = null): QuotaWindow {
  const seconds = label === "5h" ? 18000 : label === "weekly" ? 604800 : 86400;
  return { slot: label === "weekly" ? "secondary" : "primary", label: labelWindow(seconds), windowSeconds: seconds, usedPercent: used, resetAt };
}

test("under both thresholds, continue", () => {
  assert.deepEqual(quotaAction([w("5h", 94), w("weekly", 50)], t, [], NOW), { action: "continue" });
});

test("5-hour window over threshold pauses until its reset plus five minutes", () => {
  const a = quotaAction([w("5h", 96, NOW + 1200), w("weekly", 50)], t, [], NOW);
  assert.equal(a.action, "pause");
  assert.equal(a.action === "pause" && a.untilSec, NOW + 1200 + 300);
  assert.equal(PAUSE_MARGIN_SEC, 300);
});

test("an exhausted 5-hour window pauses too; it never needs the user", () => {
  assert.equal(quotaAction([w("5h", 100, NOW + 60), w("weekly", 50)], t, [], NOW).action, "pause");
});

test("a 5-hour window with no known reset pauses five minutes, to check again", () => {
  const a = quotaAction([w("5h", 97, null)], t, [], NOW);
  assert.equal(a.action === "pause" && a.untilSec, NOW + 300);
});

test("weekly window over threshold holds for the user, ahead of any 5-hour pause", () => {
  assert.equal(quotaAction([w("weekly", 95)], t, [], NOW).action, "hold");
  const both = quotaAction([w("5h", 99, NOW + 60), w("weekly", 96)], t, [], NOW);
  assert.equal(both.action === "hold" && both.reason, "weekly");
});

test("a confirmed weekly override continues until exhaustion", () => {
  const o = [{ label: "weekly" as const, until: NOW + 3600 }];
  assert.equal(quotaAction([w("weekly", 97)], t, o, NOW).action, "continue");
  assert.equal(quotaAction([w("weekly", 100)], t, o, NOW).action, "hold");
});

test("an exhausted window of another length holds", () => {
  assert.equal(quotaAction([w("other", 100)], t, [], NOW).action, "hold");
  assert.equal(quotaAction([w("other", 99)], t, [], NOW).action, "continue");
});
