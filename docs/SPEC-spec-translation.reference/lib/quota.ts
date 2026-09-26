// lib/quota.ts — pure quota logic for the Codex subscription gate.
// Everything here is testable without pi. The pi wiring lives in
// extensions/quota-gate.ts and touches this module only through these exports.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type Slot = "primary" | "secondary";
export type WindowLabel = "5h" | "weekly" | "other";

export interface QuotaWindow {
  slot: Slot;
  label: WindowLabel;
  windowSeconds: number;
  usedPercent: number;
  resetAt: number | null; // epoch seconds
}

export interface SlotUsage {
  slot: Slot;
  usedPercent: number;
}

export interface Thresholds {
  fiveHour: number;
  weekly: number;
}

export interface Override {
  label: WindowLabel;
  until: number; // epoch seconds
}

export interface HoldDecision {
  hold: boolean;
  reason: WindowLabel | null;
  window: QuotaWindow | null;
}

export type HoldReason = WindowLabel | "usage_limit" | "unreadable";

export interface Hold {
  reason: HoldReason;
  hard: boolean; // true: the provider refused (429). false: a threshold was crossed.
  setAt: string; // ISO timestamp
  windows: QuotaWindow[];
}

export interface Continuation {
  clear: true;
  override: Override | null;
  warning: string | null;
}

export const DEFAULT_THRESHOLDS: Thresholds = { fiveHour: 95, weekly: 95 };
export const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

// Windows are labelled by duration, never by slot: some plans report only a
// seven-day window, and it arrives in the primary slot.
export function labelWindow(windowSeconds: number): WindowLabel {
  if (windowSeconds >= 4.5 * 3600 && windowSeconds <= 5.5 * 3600) return "5h";
  if (windowSeconds >= 6 * 86400 && windowSeconds <= 8 * 86400) return "weekly";
  return "other";
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

// Body of GET /backend-api/wham/usage. Malformed input yields [] — never throws.
export function parseUsageResponse(body: unknown): QuotaWindow[] {
  if (!body || typeof body !== "object") return [];
  const rl = (body as Record<string, unknown>).rate_limit;
  if (!rl || typeof rl !== "object") return [];
  const out: QuotaWindow[] = [];
  for (const slot of ["primary", "secondary"] as const) {
    const w = (rl as Record<string, unknown>)[`${slot}_window`];
    if (!w || typeof w !== "object") continue;
    const rec = w as Record<string, unknown>;
    const windowSeconds = num(rec.limit_window_seconds);
    const usedPercent = num(rec.used_percent);
    if (windowSeconds === null || usedPercent === null) continue;
    out.push({
      slot,
      label: labelWindow(windowSeconds),
      windowSeconds,
      usedPercent,
      resetAt: num(rec.reset_at),
    });
  }
  return out;
}

// x-codex-{primary,secondary}-used-percent on every Codex response.
// Headers carry slot and percent only; the slot's duration comes from the
// last usage-endpoint snapshot, via applyHeaderUsage.
export function parseCodexHeaders(headers: Record<string, string | undefined>): SlotUsage[] {
  const lower: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  const out: SlotUsage[] = [];
  for (const slot of ["primary", "secondary"] as const) {
    const v = num(lower[`x-codex-${slot}-used-percent`]);
    if (v !== null) out.push({ slot, usedPercent: v });
  }
  return out;
}

export function applyHeaderUsage(windows: QuotaWindow[], usage: SlotUsage[]): QuotaWindow[] {
  return windows.map((w) => {
    const u = usage.find((x) => x.slot === w.slot);
    return u ? { ...w, usedPercent: u.usedPercent } : w;
  });
}

// A hard quota refusal. A plain 429 without usage-limit text is burst
// throttling and is left to pi's own retry.
export function isUsageLimitError(err: { status?: number; message?: string }): boolean {
  if (err.status !== 429) return false;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("usage_limit_reached") || m.includes("usage limit");
}

const PRIORITY: WindowLabel[] = ["weekly", "5h", "other"];

export function shouldHold(
  windows: QuotaWindow[],
  t: Thresholds,
  overrides: Override[] = [],
  nowSec: number = Date.now() / 1000,
): HoldDecision {
  const suspended = (label: WindowLabel) => overrides.some((o) => o.label === label && nowSec < o.until);
  const over = windows.filter((w) => {
    if (w.usedPercent >= 100) return true; // exhausted: no override applies
    if (suspended(w.label)) return false;
    if (w.label === "5h") return w.usedPercent >= t.fiveHour;
    if (w.label === "weekly") return w.usedPercent >= t.weekly;
    return false; // "other" windows hold only when exhausted
  });
  if (over.length === 0) return { hold: false, reason: null, window: null };
  over.sort((a, b) => PRIORITY.indexOf(a.label) - PRIORITY.indexOf(b.label));
  return { hold: true, reason: over[0].label, window: over[0] };
}

function clampPercent(v: unknown): number | null {
  const n = num(v);
  if (n === null || n <= 0) return null;
  return Math.min(100, n);
}

// Environment wins over settings. Invalid values fall back.
export function resolveThresholds(
  settings: { fiveHour?: unknown; weekly?: unknown } | undefined,
  env: Record<string, string | undefined>,
): Thresholds {
  return {
    fiveHour:
      clampPercent(env.PI_BUILD_QUOTA_5H) ?? clampPercent(settings?.fiveHour) ?? DEFAULT_THRESHOLDS.fiveHour,
    weekly:
      clampPercent(env.PI_BUILD_QUOTA_WEEKLY) ?? clampPercent(settings?.weekly) ?? DEFAULT_THRESHOLDS.weekly,
  };
}

export function defaultHoldPath(env: Record<string, string | undefined>): string {
  return env.PI_BUILD_QUOTA_HOLD ?? join(homedir(), ".pi", "agent", "quota-hold.json");
}

export function defaultOverridePath(env: Record<string, string | undefined>): string {
  return env.PI_BUILD_QUOTA_OVERRIDE ?? join(homedir(), ".pi", "agent", "quota-override.json");
}

export function writeHold(path: string, hold: Hold): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(hold, null, 2));
}

// Fails safe: a hold file that exists but cannot be read is a hold.
export function readHold(path: string): Hold | null {
  if (!existsSync(path)) return null;
  try {
    const h = JSON.parse(readFileSync(path, "utf8"));
    if (h && typeof h.reason === "string" && typeof h.hard === "boolean") return h as Hold;
  } catch {
    // fall through
  }
  return { reason: "unreadable", hard: true, setAt: "", windows: [] };
}

export function clearHold(path: string): void {
  rmSync(path, { force: true });
}

export function readOverrides(path: string): Override[] {
  if (!existsSync(path)) return [];
  try {
    const v = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(v) ? v.filter((o) => o && typeof o.label === "string" && typeof o.until === "number") : [];
  } catch {
    return [];
  }
}

export function writeOverrides(path: string, overrides: Override[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(overrides, null, 2));
}

// What confirming a hold does. A soft hold suspends that window's threshold
// until the window resets; a hard hold only clears, because the provider will
// refuse again until reset.
export function continuationFor(hold: Hold, nowSec: number): Continuation {
  if (hold.hard) {
    const reset = hold.windows.map((w) => w.resetAt).filter((r): r is number => r !== null && r > nowSec);
    const when = reset.length ? new Date(Math.min(...reset) * 1000).toISOString() : "an unknown time";
    return {
      clear: true,
      override: null,
      warning: `The provider refused further use (${hold.reason}). Calls will fail again until ${when}.`,
    };
  }
  const label = hold.reason as WindowLabel;
  const w = hold.windows.find((x) => x.label === label);
  const until = w?.resetAt && w.resetAt > nowSec ? w.resetAt : Math.floor(nowSec) + 3600;
  return { clear: true, override: { label, until }, warning: null };
}

// Account id for the chatgpt-account-id header. VERIFY against a live token:
// the claim path below is the one Codex tokens are understood to carry.
export function accountIdFromToken(jwt: string): string | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const id = payload?.["https://api.openai.com/auth"]?.chatgpt_account_id;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

// One read-only poll. Never refreshes tokens: pi owns refresh, and OpenAI
// refresh tokens are single-use, so a second refresher breaks pi's login.
export async function fetchUsage(
  token: string,
  accountId: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<QuotaWindow[] | null> {
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    if (accountId) headers["chatgpt-account-id"] = accountId;
    const res = await fetchImpl(USAGE_URL, { method: "GET", headers });
    if (!res.ok) return null;
    return parseUsageResponse(await res.json());
  } catch {
    return null;
  }
}
