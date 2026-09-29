// extensions/quota-gate.ts — hold work when the Codex subscription's 5-hour or
// weekly window is used up, until a person confirms continuation.
//
// All decisions are made by lib/quota.ts (tested). This file only moves data
// between pi and that module. Every pi API touchpoint is marked VERIFY: check
// it against the installed @earendil-works/pi-coding-agent 0.87.0 before use,
// and record the verified shape in INDEX.
//
// Behaviour:
//   session_start          poll /backend-api/wham/usage once; if a hold file exists, surface it
//   after_provider_response update usage from x-codex-*-used-percent headers; set a soft hold on threshold
//   message_end (assistant) at each round boundary: if held, ask (interactive) or stop (headless)
//   before_agent_start     if held, ask (interactive) or exit 75 before any inference (headless)
//   agent_end              a 429 usage-limit error sets a hard hold
//
// Headless runs exit with code 75 (EX_TEMPFAIL) while held. bin/pi-continue
// clears a hold from outside pi. No hold is ever lifted automatically.

import {
  applyHeaderUsage,
  clearHold,
  continuationFor,
  defaultHoldPath,
  defaultOverridePath,
  fetchUsage,
  accountIdFromToken,
  isUsageLimitError,
  parseCodexHeaders,
  readHold,
  readOverrides,
  resolveThresholds,
  shouldHold,
  writeHold,
  writeOverrides,
  type Hold,
  type QuotaWindow,
} from "../lib/quota.ts";

const PROVIDER = "openai-codex";
export const HOLD_EXIT_CODE = 75;

// VERIFY: the type import other extensions in this repo use for the API object.
type PiAPI = any;
type Ctx = any;

export default function quotaGate(pi: PiAPI) {
  const env = process.env as Record<string, string | undefined>;
  const holdPath = defaultHoldPath(env);
  const overridePath = defaultOverridePath(env);
  // VERIFY: read `quotaGate` from host settings through the same loader bounds.ts uses.
  const thresholds = resolveThresholds(loadQuotaSettings(), env);
  let windows: QuotaWindow[] = [];

  // ---- pi adapters: the only lines that depend on pi's API shape ----------

  function isCodex(ctx: Ctx): boolean {
    return ctx?.model?.provider === PROVIDER; // VERIFY: where the active provider id lives on ctx
  }

  async function token(ctx: Ctx): Promise<string | null> {
    try {
      // VERIFY: documented by pi-keep-going; pi performs OAuth refresh itself.
      const t = await ctx.modelRegistry.getApiKeyForProvider(PROVIDER);
      return typeof t === "string" && t ? t : null;
    } catch {
      return null;
    }
  }

  function hasUI(ctx: Ctx): boolean {
    return Boolean(ctx?.hasUI); // VERIFY: interactive-mode flag on ctx
  }

  async function confirm(ctx: Ctx, title: string, body: string): Promise<boolean> {
    return Boolean(await ctx.ui.confirm(title, body)); // VERIFY: ctx.ui.confirm signature
  }

  function notify(ctx: Ctx, text: string): void {
    if (hasUI(ctx)) ctx.ui.notify(text, "warning"); // VERIFY: ctx.ui.notify signature
    else console.error(`[quota-gate] ${text}`);
  }

  function responseHeaders(event: any): Record<string, string | undefined> {
    return event?.headers ?? {}; // VERIFY: after_provider_response payload shape
  }

  function lastError(event: any): { status?: number; message?: string } | null {
    // VERIFY: where agent_end exposes the terminating provider error.
    const e = event?.error ?? event?.messages?.at?.(-1)?.error ?? null;
    if (!e) return null;
    return { status: e.status ?? e.statusCode, message: String(e.message ?? e.errorMessage ?? "") };
  }

  // ---- logic --------------------------------------------------------------

  function record(kind: string, data: unknown): void {
    try {
      pi.appendEntry("pi-build-quota", { kind, at: new Date().toISOString(), data }); // VERIFY
    } catch {
      /* telemetry must never block the gate */
    }
  }

  function describe(hold: Hold): string {
    const parts = hold.windows.map((w) => {
      const reset = w.resetAt ? new Date(w.resetAt * 1000).toLocaleString() : "unknown";
      return `${w.label} ${w.usedPercent}% (resets ${reset})`;
    });
    return `${hold.hard ? "Provider refused" : "Threshold reached"}: ${hold.reason}. ${parts.join(", ")}`;
  }

  function setSoftHoldIfNeeded(): void {
    if (readHold(holdPath)) return;
    const d = shouldHold(windows, thresholds, readOverrides(overridePath));
    if (!d.hold) return;
    const hold: Hold = { reason: d.reason!, hard: false, setAt: new Date().toISOString(), windows };
    writeHold(holdPath, hold);
    record("hold", hold);
  }

  // Returns true when work may continue.
  async function resolveHold(ctx: Ctx): Promise<boolean> {
    const hold = readHold(holdPath);
    if (!hold) return true;
    if (!hasUI(ctx)) {
      notify(ctx, `${describe(hold)} Run bin/pi-continue to resume.`);
      return false;
    }
    const fresh = isCodex(ctx) ? await poll(ctx) : null;
    const now = fresh ? { ...hold, windows: fresh } : hold;
    const ok = await confirm(ctx, "Quota hold", `${describe(now)}\n\nContinue anyway?`);
    if (!ok) return false;
    const c = continuationFor(now, Date.now() / 1000);
    clearHold(holdPath);
    if (c.override) writeOverrides(overridePath, [...readOverrides(overridePath), c.override]);
    if (c.warning) notify(ctx, c.warning);
    record("continued", { hold: now, continuation: c });
    return true;
  }

  async function poll(ctx: Ctx): Promise<QuotaWindow[] | null> {
    const t = await token(ctx);
    if (!t) return null;
    const ws = await fetchUsage(t, accountIdFromToken(t));
    if (ws && ws.length) {
      windows = ws;
      record("snapshot", ws);
    }
    return ws;
  }

  // ---- events -------------------------------------------------------------

  pi.on("session_start", async (_event: any, ctx: Ctx) => {
    if (isCodex(ctx)) await poll(ctx);
    setSoftHoldIfNeeded(); // a session that opens over threshold holds before its first inference
    const hold = readHold(holdPath);
    if (hold) notify(ctx, `${describe(hold)} Work is on hold until you confirm.`);
  });

  pi.on("after_provider_response", (event: any, ctx: Ctx) => {
    if (!isCodex(ctx)) return;
    const usage = parseCodexHeaders(responseHeaders(event));
    if (!usage.length) return;
    // Without a usage snapshot a slot's duration is unknown. Never guess it:
    // track the slot as "other", which holds only at 100%.
    if (!windows.length) {
      windows = usage.map((u) => ({ slot: u.slot, label: "other" as const, windowSeconds: 0, usedPercent: u.usedPercent, resetAt: null }));
    } else {
      windows = applyHeaderUsage(windows, usage);
    }
    setSoftHoldIfNeeded();
  });

  pi.on("message_end", async (event: any, ctx: Ctx) => {
    if (event?.message?.role !== "assistant") return; // VERIFY: message_end payload
    if (!readHold(holdPath)) return;
    // VERIFY: pi awaits this handler; if it does not, the confirm below cannot
    // pause the turn, and the else-branch abort is the only safe behaviour.
    if (!(await resolveHold(ctx))) ctx.abort();
  });

  pi.on("before_agent_start", async (_event: any, ctx: Ctx) => {
    if (await resolveHold(ctx)) return;
    if (!hasUI(ctx)) process.exit(HOLD_EXIT_CODE); // before any inference; same pattern as routing's halt()
    ctx.abort();
  });

  pi.on("agent_end", (event: any, ctx: Ctx) => {
    const err = lastError(event);
    if (!err || !isUsageLimitError(err)) {
      if (!hasUI(ctx) && readHold(holdPath)) process.exitCode = HOLD_EXIT_CODE;
      return;
    }
    const hold: Hold = { reason: "usage_limit", hard: true, setAt: new Date().toISOString(), windows };
    writeHold(holdPath, hold);
    record("hold", hold);
    notify(ctx, `${describe(hold)} Work is on hold until you confirm.`);
    if (!hasUI(ctx)) process.exitCode = HOLD_EXIT_CODE;
  });
}

function loadQuotaSettings(): { fiveHour?: unknown; weekly?: unknown } | undefined {
  // VERIFY: replace with the repo's settings loader; key is `quotaGate`.
  return undefined;
}
