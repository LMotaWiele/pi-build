// extensions/quota-gate.ts — hold work when the Codex subscription's 5-hour or
// weekly window is used up, until a person confirms continuation.
//
// All decisions are made by lib/quota.ts (tested). This file only moves data
// between pi and that module.
//
// Verified against @earendil-works/pi-coding-agent 0.87.0:
//   ExtensionAPI is the type the other extensions import.
//   ctx.model.provider is the active provider id. ctx.model may be undefined.
//   ctx.modelRegistry.getApiKeyForProvider(provider) => Promise<string | undefined>.
//     pi refreshes OAuth inside that call. This file does not.
//   ctx.hasUI is a boolean. Print mode leaves the UI context empty, so it is false.
//     TUI and RPC set a UI context, so it is true.
//   ctx.ui.confirm(title, message) => Promise<boolean>
//   ctx.ui.notify(message, type) accepts "info" | "warning" | "error"
//   after_provider_response is { status: number, headers: Record<string, string> }
//   message_end is { message } and emitMessageEnd awaits the handler.
//   before_agent_start and session_start are awaited. session_start runs in
//     bindExtensions, before print mode sends the prompt.
//   agent_end is { messages }. It has no error object. The assistant message
//     carries errorMessage. HTTP status stays on the preceding
//     after_provider_response event, so the two are joined here.
//   appendEntry(customType, data) is the session entry writer.
//   Print mode returns its own exit code and overwrites process.exitCode, so a
//     headless hold uses process.exit(75).
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

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
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
import { readPiSettings, settingsBlock } from "../lib/telemetry.ts";

const PROVIDER = "openai-codex";
export const HOLD_EXIT_CODE = 75;

type Ctx = {
  model?: { provider?: string };
  modelRegistry?: { getApiKeyForProvider?: (provider: string) => Promise<string | undefined> };
  hasUI?: boolean;
  ui?: {
    confirm?: (title: string, message: string) => Promise<boolean>;
    notify?: (message: string, type?: "info" | "warning" | "error") => void;
  };
  abort?: () => void;
};

export default function quotaGate(pi: ExtensionAPI) {
  const env = process.env as Record<string, string | undefined>;
  const holdPath = defaultHoldPath(env);
  const overridePath = defaultOverridePath(env);
  const thresholds = resolveThresholds(loadQuotaSettings(), env);
  let windows: QuotaWindow[] = [];
  let lastProviderStatus: number | undefined;

  function isCodex(ctx: Ctx): boolean {
    return ctx?.model?.provider === PROVIDER;
  }

  async function token(ctx: Ctx): Promise<string | null> {
    try {
      const t = await ctx.modelRegistry?.getApiKeyForProvider?.(PROVIDER);
      return typeof t === "string" && t ? t : null;
    } catch {
      return null;
    }
  }

  function hasUI(ctx: Ctx): boolean {
    return Boolean(ctx?.hasUI);
  }

  async function confirm(ctx: Ctx, title: string, body: string): Promise<boolean> {
    return Boolean(await ctx.ui?.confirm?.(title, body));
  }

  function notify(ctx: Ctx, text: string): void {
    if (hasUI(ctx)) ctx.ui?.notify?.(text, "warning");
    else console.error(`[quota-gate] ${text}`);
  }

  function lastError(event: {
    error?: { status?: number; statusCode?: number; message?: string; errorMessage?: string };
    messages?: Array<{
      role?: string;
      errorMessage?: string;
      error?: { status?: number; statusCode?: number; message?: string; errorMessage?: string };
    }>;
  }): { status?: number; message?: string } | null {
    const direct = event?.error;
    if (direct && typeof direct === "object") {
      return { status: direct.status ?? direct.statusCode, message: String(direct.message ?? direct.errorMessage ?? "") };
    }
    const messages = event?.messages;
    if (!Array.isArray(messages)) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg?.error && typeof msg.error === "object") {
        return {
          status: msg.error.status ?? msg.error.statusCode,
          message: String(msg.error.message ?? msg.error.errorMessage ?? ""),
        };
      }
      if (msg?.role === "assistant" && typeof msg.errorMessage === "string" && msg.errorMessage) {
        return { status: lastProviderStatus, message: msg.errorMessage };
      }
    }
    return null;
  }

  function record(kind: string, data: unknown): void {
    try {
      pi.appendEntry("pi-build-quota", { kind, at: new Date().toISOString(), data });
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

  function stopHeadless(ctx: Ctx): void {
    if (!hasUI(ctx)) process.exit(HOLD_EXIT_CODE);
    ctx.abort?.();
  }

  pi.on("session_start", async (_event, ctx: Ctx) => {
    if (isCodex(ctx)) await poll(ctx);
    setSoftHoldIfNeeded();
    const hold = readHold(holdPath);
    if (hold) notify(ctx, `${describe(hold)} Work is on hold until you confirm.`);
  });

  pi.on("after_provider_response", (event, ctx: Ctx) => {
    lastProviderStatus = event.status;
    if (!isCodex(ctx)) return;
    const usage = parseCodexHeaders(event.headers ?? {});
    if (!usage.length) return;
    // Without a usage snapshot a slot's duration is unknown. Never guess it:
    // track the slot as "other", which holds only at 100%.
    if (!windows.length) {
      windows = usage.map((u) => ({
        slot: u.slot,
        label: "other" as const,
        windowSeconds: 0,
        usedPercent: u.usedPercent,
        resetAt: null,
      }));
    } else {
      windows = applyHeaderUsage(windows, usage);
    }
    setSoftHoldIfNeeded();
  });

  pi.on("message_end", async (event, ctx: Ctx) => {
    if (event?.message?.role !== "assistant") return;
    if (!readHold(holdPath)) return;
    if (!(await resolveHold(ctx))) stopHeadless(ctx);
  });

  pi.on("before_agent_start", async (_event, ctx: Ctx) => {
    if (await resolveHold(ctx)) return;
    stopHeadless(ctx);
  });

  pi.on("agent_end", (event, ctx: Ctx) => {
    const err = lastError(event);
    if (!err || !isUsageLimitError(err)) {
      if (!hasUI(ctx) && readHold(holdPath)) process.exit(HOLD_EXIT_CODE);
      return;
    }
    const hold: Hold = { reason: "usage_limit", hard: true, setAt: new Date().toISOString(), windows };
    writeHold(holdPath, hold);
    record("hold", hold);
    notify(ctx, `${describe(hold)} Work is on hold until you confirm.`);
    if (!hasUI(ctx)) process.exit(HOLD_EXIT_CODE);
  });
}

function loadQuotaSettings(): { fiveHour?: unknown; weekly?: unknown } | undefined {
  const block = settingsBlock(readPiSettings(), "quotaGate");
  if (block["fiveHour"] === undefined && block["weekly"] === undefined) return undefined;
  return { fiveHour: block["fiveHour"], weekly: block["weekly"] };
}
