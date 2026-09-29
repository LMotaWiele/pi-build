// Append to lib/quota.ts. What the gate does at a round boundary.
//   weekly over threshold -> hold: stop and wait for the user
//   5-hour over threshold -> pause in place until the window resets, plus five minutes
// A window at 100% is over threshold whatever the overrides say.

export type QuotaAction =
  | { action: "continue" }
  | { action: "pause"; untilSec: number; window: QuotaWindow }
  | { action: "hold"; reason: WindowLabel; window: QuotaWindow };

export const PAUSE_MARGIN_SEC = 300;

export function quotaAction(
  windows: QuotaWindow[],
  t: Thresholds,
  overrides: Override[] = [],
  nowSec: number = Date.now() / 1000,
): QuotaAction {
  const suspended = (label: WindowLabel) => overrides.some((o) => o.label === label && nowSec < o.until);
  const over = (w: QuotaWindow, threshold: number) => w.usedPercent >= 100 || (!suspended(w.label) && w.usedPercent >= threshold);
  const weekly = windows.find((w) => w.label === "weekly" && over(w, t.weekly));
  if (weekly) return { action: "hold", reason: "weekly", window: weekly };
  const other = windows.find((w) => w.label === "other" && w.usedPercent >= 100);
  if (other) return { action: "hold", reason: "other", window: other };
  const five = windows.find((w) => w.label === "5h" && w.usedPercent >= Math.min(t.fiveHour, 100));
  if (five) {
    const base = five.resetAt !== null && five.resetAt > nowSec ? five.resetAt : nowSec;
    return { action: "pause", untilSec: Math.ceil(base + PAUSE_MARGIN_SEC), window: five };
  }
  return { action: "continue" };
}
