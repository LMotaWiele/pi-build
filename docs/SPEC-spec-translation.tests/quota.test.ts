import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  labelWindow,
  parseUsageResponse,
  parseCodexHeaders,
  applyHeaderUsage,
  isUsageLimitError,
  shouldHold,
  resolveThresholds,
  defaultHoldPath,
  writeHold,
  readHold,
  clearHold,
  continuationFor,
  accountIdFromToken,
  fetchUsage,
  USAGE_URL,
  type QuotaWindow,
} from "../../lib/quota.ts";

const FIVE_H = 18000;
const WEEK = 604800;

function w(slot: "primary" | "secondary", seconds: number, used: number, resetAt: number | null = null): QuotaWindow {
  return { slot, label: labelWindow(seconds), windowSeconds: seconds, usedPercent: used, resetAt };
}

test("windows are labelled by duration", () => {
  assert.equal(labelWindow(FIVE_H), "5h");
  assert.equal(labelWindow(300 * 60), "5h");
  assert.equal(labelWindow(WEEK), "weekly");
  assert.equal(labelWindow(10080 * 60), "weekly");
  assert.equal(labelWindow(86400), "other");
});

test("usage response with both windows", () => {
  const ws = parseUsageResponse({
    plan_type: "plus",
    rate_limit: {
      primary_window: { limit_window_seconds: FIVE_H, reset_at: 1788265323, used_percent: 40 },
      secondary_window: { limit_window_seconds: WEEK, reset_at: 1788765541, used_percent: 12 },
    },
  });
  assert.deepEqual(ws, [
    { slot: "primary", label: "5h", windowSeconds: FIVE_H, usedPercent: 40, resetAt: 1788265323 },
    { slot: "secondary", label: "weekly", windowSeconds: WEEK, usedPercent: 12, resetAt: 1788765541 },
  ]);
});

test("a weekly-only plan reports its week in the primary slot and is labelled weekly", () => {
  const ws = parseUsageResponse({
    plan_type: "plus",
    rate_limit: { primary_window: { limit_window_seconds: 604800, reset_at: 1786183859, used_percent: 87 } },
  });
  assert.equal(ws.length, 1);
  assert.equal(ws[0].slot, "primary");
  assert.equal(ws[0].label, "weekly");
  assert.equal(ws[0].usedPercent, 87);
});

test("malformed usage responses yield no windows and do not throw", () => {
  for (const body of [null, "x", 3, {}, { rate_limit: null }, { rate_limit: { primary_window: { used_percent: 5 } } }]) {
    assert.deepEqual(parseUsageResponse(body), []);
  }
});

test("codex headers are read case-insensitively by slot", () => {
  assert.deepEqual(parseCodexHeaders({ "X-Codex-Primary-Used-Percent": "40", "x-codex-secondary-used-percent": "12" }), [
    { slot: "primary", usedPercent: 40 },
    { slot: "secondary", usedPercent: 12 },
  ]);
  assert.deepEqual(parseCodexHeaders({ "x-codex-primary-used-percent": "n/a" }), []);
  assert.deepEqual(parseCodexHeaders({}), []);
});

test("header usage updates the window in the same slot, whatever its duration", () => {
  const updated = applyHeaderUsage([w("primary", WEEK, 50)], [{ slot: "primary", usedPercent: 91 }]);
  assert.equal(updated[0].label, "weekly");
  assert.equal(updated[0].usedPercent, 91);
});

test("only a 429 carrying usage-limit text is a quota refusal", () => {
  assert.equal(isUsageLimitError({ status: 429, message: "usage_limit_reached" }), true);
  assert.equal(isUsageLimitError({ status: 429, message: "You've hit your usage limit." }), true);
  assert.equal(isUsageLimitError({ status: 429, message: "Rate limit exceeded, retry shortly" }), false);
  assert.equal(isUsageLimitError({ status: 500, message: "usage limit" }), false);
  assert.equal(isUsageLimitError({ message: "usage_limit_reached" }), false);
});

test("hold when a window crosses its threshold", () => {
  const t = { fiveHour: 95, weekly: 95 };
  assert.equal(shouldHold([w("primary", FIVE_H, 94), w("secondary", WEEK, 50)], t).hold, false);
  const d = shouldHold([w("primary", FIVE_H, 96), w("secondary", WEEK, 50)], t);
  assert.equal(d.hold, true);
  assert.equal(d.reason, "5h");
  assert.equal(shouldHold([w("secondary", WEEK, 95)], t).reason, "weekly");
});

test("weekly is reported ahead of 5h when both are over", () => {
  const d = shouldHold([w("primary", FIVE_H, 99), w("secondary", WEEK, 97)], { fiveHour: 95, weekly: 95 });
  assert.equal(d.reason, "weekly");
});

test("windows of other durations hold only when exhausted", () => {
  const t = { fiveHour: 95, weekly: 95 };
  assert.equal(shouldHold([w("primary", 86400, 99)], t).hold, false);
  assert.equal(shouldHold([w("primary", 86400, 100)], t).reason, "other");
});

test("an override suspends a soft threshold until it expires, never an exhausted window", () => {
  const t = { fiveHour: 95, weekly: 95 };
  const now = 1_000_000;
  const o = [{ label: "weekly" as const, until: now + 60 }];
  assert.equal(shouldHold([w("secondary", WEEK, 97)], t, o, now).hold, false);
  assert.equal(shouldHold([w("secondary", WEEK, 97)], t, o, now + 61).hold, true);
  assert.equal(shouldHold([w("secondary", WEEK, 100)], t, o, now).hold, true);
});

test("thresholds: environment wins, invalid values fall back, values clamp to 100", () => {
  assert.deepEqual(resolveThresholds(undefined, {}), { fiveHour: 95, weekly: 95 });
  assert.deepEqual(resolveThresholds({ fiveHour: 80, weekly: 90 }, {}), { fiveHour: 80, weekly: 90 });
  assert.deepEqual(resolveThresholds({ fiveHour: 80 }, { PI_BUILD_QUOTA_5H: "70", PI_BUILD_QUOTA_WEEKLY: "abc" }), {
    fiveHour: 70,
    weekly: 95,
  });
  assert.deepEqual(resolveThresholds({ weekly: 150 }, { PI_BUILD_QUOTA_5H: "0" }), { fiveHour: 95, weekly: 100 });
});

test("hold path honours the environment override", () => {
  assert.equal(defaultHoldPath({ PI_BUILD_QUOTA_HOLD: "/x/hold.json" }), "/x/hold.json");
  assert.ok(defaultHoldPath({}).endsWith(join(".pi", "agent", "quota-hold.json")));
});

test("hold file round-trips, and an unreadable one counts as held", () => {
  const dir = mkdtempSync(join(tmpdir(), "quota-"));
  const p = join(dir, "sub", "hold.json");
  assert.equal(readHold(p), null);
  const hold = { reason: "5h" as const, hard: false, setAt: "2026-09-27T00:00:00Z", windows: [w("primary", FIVE_H, 96)] };
  writeHold(p, hold);
  assert.deepEqual(readHold(p), hold);
  writeFileSync(p, "{not json");
  const bad = readHold(p);
  assert.equal(bad?.reason, "unreadable");
  assert.equal(bad?.hard, true);
  clearHold(p);
  assert.equal(existsSync(p), false);
  clearHold(p); // absent: no throw
});

test("confirming a soft hold suspends that window until its reset", () => {
  const now = 1_000_000;
  const c = continuationFor(
    { reason: "5h", hard: false, setAt: "", windows: [w("primary", FIVE_H, 96, now + 900)] },
    now,
  );
  assert.deepEqual(c, { clear: true, override: { label: "5h", until: now + 900 }, warning: null });
  const noReset = continuationFor({ reason: "weekly", hard: false, setAt: "", windows: [w("secondary", WEEK, 96)] }, now);
  assert.deepEqual(noReset.override, { label: "weekly", until: now + 3600 });
});

test("confirming a hard hold clears it with a warning and no override", () => {
  const c = continuationFor({ reason: "usage_limit", hard: true, setAt: "", windows: [] }, 1_000_000);
  assert.equal(c.clear, true);
  assert.equal(c.override, null);
  assert.ok(c.warning && c.warning.length > 0);
});

test("account id is read from the token's auth claim", () => {
  const payload = Buffer.from(
    JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "acct-123" } }),
  ).toString("base64url");
  assert.equal(accountIdFromToken(`h.${payload}.s`), "acct-123");
  assert.equal(accountIdFromToken("not-a-jwt"), null);
  assert.equal(accountIdFromToken(`h.${Buffer.from("{}").toString("base64url")}.s`), null);
});

test("usage poll sends bearer and account id, parses on 200, returns null otherwise", async () => {
  let seen: { url: string; headers: Record<string, string> } | null = null;
  const ok = (async (url: string, init: { headers: Record<string, string> }) => {
    seen = { url, headers: init.headers };
    return new Response(
      JSON.stringify({ rate_limit: { primary_window: { limit_window_seconds: FIVE_H, used_percent: 10, reset_at: 1 } } }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
  const ws = await fetchUsage("tok", "acct-1", ok);
  assert.equal(ws?.[0].label, "5h");
  assert.equal(seen!.url, USAGE_URL);
  assert.equal(seen!.headers.Authorization, "Bearer tok");
  assert.equal(seen!.headers["chatgpt-account-id"], "acct-1");

  const denied = (async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
  assert.equal(await fetchUsage("tok", null, denied), null);
  const broken = (async () => {
    throw new Error("network");
  }) as unknown as typeof fetch;
  assert.equal(await fetchUsage("tok", null, broken), null);
});
