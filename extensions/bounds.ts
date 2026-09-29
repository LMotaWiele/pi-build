/**
 * Turn bounds. They abort the turn. They do not prompt, except one retry
 * on the GPT-6 ladder when the bound trip already wrote a file.
 * Retry policy lives in lib/tiers.ts. Disabling routing leaves this running.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import fs from "node:fs";
import path from "node:path";
import { appendQueue } from "../lib/markdown.ts";
import { findProjectRoot } from "../lib/scaffold.ts";
import { nextTier, retryAllowed } from "../lib/tiers.ts";
import {
  attachTelemetry,
  boundReason,
  type BoundConfig,
  claimBoundRetry,
  currentPrompt,
  DEFAULT_BOUNDS,
  explainOneShot,
  extensionEnabled,
  getOpenNote,
  noteRunAborted,
  readPiSettings,
  recordToolCall,
  setActiveTier,
  setLastRecap,
  settingsBlock,
  turnSnapshot,
  writtenFiles,
} from "../lib/telemetry.ts";
import { defaultHoldPath, readHold } from "../lib/quota.ts";
import { detectStuck, stuckNudge, type CallRecord, type StuckFinding } from "../lib/stuck.ts";
import { continueAfterCompaction, type CompactionOutcome } from "../lib/continuation.ts";

type SessionModel = { provider: string; id: string; name?: string };
type BoundContext = {
  abort: () => void;
  model?: SessionModel;
  thinkingLevel?: string;
  modelRegistry?: { find: (provider: string, id: string) => unknown };
};

export function firstUnwrittenPath(noteText: string | null, written: string[]): string {
  if (!noteText) return "(unknown)";
  const found = noteText.match(/(?:[\w.+-]+\/)*[\w.+-]+\.[A-Za-z0-9]+/g) ?? [];
  for (const candidate of found) {
    const hit = written.some((file) => file === candidate || file.endsWith(`/${candidate}`) || candidate.endsWith(`/${file}`));
    if (!hit) return candidate;
  }
  return "(unknown)";
}

export function boundCheckpointLine(reason: string, written: string[], resumeFrom: string): string {
  return `bounded at ${reason}; wrote ${written.join(", ")}; resume from ${resumeFrom}`;
}

export async function runBoundAbort(input: {
  reason: string;
  written: string[];
  resumeFrom: string;
  queueAppend: (item: string, source: string) => void | Promise<void>;
  setRecap: (line: string) => void;
  beforeAbort?: () => void | Promise<void>;
  abort: () => void;
}): Promise<void> {
  try {
    await checkpointOnBound(input);
  } catch (err) {
    console.error("[bounds] checkpoint failed", err);
  }
  try {
    if (input.beforeAbort) await input.beforeAbort();
  } catch (err) {
    console.error("[bounds] retry failed", err);
  }
  input.abort();
}

export async function checkpointOnBound(input: {
  reason: string;
  written: string[];
  resumeFrom: string;
  queueAppend: (item: string, source: string) => void | Promise<void>;
  setRecap: (line: string) => void;
}): Promise<void> {
  if (input.written.length === 0) return;
  const line = boundCheckpointLine(input.reason, input.written, input.resumeFrom);
  try {
    await input.queueAppend(line, "SPEC-delegation-ab §3.1");
  } catch (err) {
    console.error("[bounds] queue_append failed", err);
  }
  try {
    input.setRecap(line);
  } catch (err) {
    console.error("[bounds] setLastRecap failed", err);
  }
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export default async function boundsExtension(pi: ExtensionAPI): Promise<void> {
  try {
    const settings = readPiSettings();
    if (!extensionEnabled(settings, "bounds")) return;
    attachTelemetry(pi as unknown as Parameters<typeof attachTelemetry>[0], "bounds");
    const boundsBlock = settingsBlock(settings, "bounds");
    const bounds: BoundConfig = {
      maxTurnPromptTokens: numberOr(boundsBlock["maxTurnPromptTokens"], DEFAULT_BOUNDS.maxTurnPromptTokens),
      maxTurnCostUsd: numberOr(boundsBlock["maxTurnCostUsd"], DEFAULT_BOUNDS.maxTurnCostUsd),
    };
    let boundFired = false;
    let firedFor = "";
    let lastCwd = process.cwd();
    let calls: CallRecord[] = [];
    let findings = 0;
    let lastFindingAt = -1;
    let compaction: CompactionOutcome | null = null;
    let continuesWithoutEdit = 0;
    let observedTurn = "";

    const appendLiveQueue = (item: string, source: string) => {
      const memory = settingsBlock(readPiSettings(), "memoryGate");
      const indexRel = typeof memory["indexPath"] === "string" ? memory["indexPath"] : ".agent/notes/INDEX.md";
      const file = path.resolve(findProjectRoot(lastCwd), indexRel);
      const today = new Date().toISOString().slice(0, 10);
      fs.writeFileSync(file, appendQueue(fs.readFileSync(file, "utf8"), item, source, today));
    };

    const retryAtNextTier = async (ctx: BoundContext, line: string): Promise<string | null> => {
      if (!ctx.model || !ctx.modelRegistry) {
        console.error("[bounds] retry skipped; current model or registry is unavailable");
        return null;
      }
      const current = `${ctx.model.provider}/${ctx.model.id}`;
      const target = nextTier(current, ctx.thinkingLevel, (modelId) => {
        const [provider, id] = modelId.split("/", 2);
        return Boolean(provider && id && ctx.modelRegistry?.find(provider, id));
      });
      if (!target) {
        console.error(`[bounds] retry skipped; no next tier for ${current}`);
        return null;
      }
      const [provider, id] = target.model.split("/", 2);
      const model = provider && id ? ctx.modelRegistry.find(provider, id) : undefined;
      if (!model) {
        console.error(`[bounds] retry skipped; ${target.model} is not in the registry`);
        return null;
      }
      let ok = false;
      try {
        ok = (await pi.setModel(model as never)) === true;
      } catch (err) {
        console.error("[bounds] retry setModel failed", err);
      }
      if (!ok) {
        console.error(`[bounds] retry skipped; setModel refused ${target.model}`);
        return null;
      }
      pi.setThinkingLevel(target.thinking);
      setActiveTier("escalate", target.model);
      pi.sendUserMessage(line, { deliverAs: "followUp" });
      console.error(`[bounds] retry at ${target.model} (${target.thinking})`);
      return target.model;
    };

    const fireBound = async (ctx: BoundContext, reason: string) => {
      if (boundFired) return;
      boundFired = true;
      firedFor = currentPrompt();
      noteRunAborted();
      const snap = turnSnapshot();
      recordToolCall({
        toolName: "bound",
        arguments: { reason, loopIndex: snap.loopIndex, elapsedMs: snap.elapsedMs },
        path: null,
        resultBytes: reason.length,
        outcome: "blocked",
        blockedBy: "bounds",
      });
      pi.appendEntry("pi-build-bound", { reason, turnId: snap.turnId });
      console.error(`[bounds] ${reason}`);
      const written = writtenFiles();
      const note = getOpenNote();
      let noteText: string | null = null;
      if (note?.path) {
        try {
          noteText = fs.readFileSync(note.path, "utf8");
        } catch {
          noteText = null;
        }
      }
      await runBoundAbort({
        reason,
        written,
        resumeFrom: firstUnwrittenPath(noteText, written),
        queueAppend: appendLiveQueue,
        setRecap: setLastRecap,
        abort: () => ctx.abort(),
      });
    };

    const recordFinding = (finding: StuckFinding, response: string) => {
      const reason = `stuck: ${finding.pattern} ${finding.tool} ${finding.count}`;
      recordToolCall({ toolName: "bound", arguments: { reason, response }, path: null,
        resultBytes: reason.length, outcome: "blocked", blockedBy: "bounds" });
      pi.appendEntry("pi-build-bound", { reason, response, turnId: turnSnapshot().turnId });
    };
    const escalateStuck = async (ctx: BoundContext, finding: StuckFinding) => {
      const reason = `stuck: ${finding.pattern} ${finding.tool} ${finding.count}`;
      const written = writtenFiles();
      const note = getOpenNote();
      let text: string | null = null;
      try { if (note?.path) text = fs.readFileSync(note.path, "utf8"); } catch { /* optional note */ }
      const resumeFrom = firstUnwrittenPath(text, written);
      const line = `${boundCheckpointLine(reason, written, resumeFrom)}\n${stuckNudge(finding)}`;
      const eligible = !explainOneShot() && retryAllowed({ env: process.env,
        held: readHold(defaultHoldPath(process.env)) !== null, alreadyRetried: false }) &&
        claimBoundRetry(currentPrompt());
      let target: string | null = null;
      await runBoundAbort({ reason, written, resumeFrom, queueAppend: appendLiveQueue,
        setRecap: setLastRecap,
        beforeAbort: eligible ? async () => { target = await retryAtNextTier(ctx, line); } : undefined,
        abort: () => ctx.abort() });
      recordFinding(finding, target ? `escalated to ${target}` : "stopped");
    };
    const handleFinding = async (ctx: BoundContext, finding: StuckFinding) => {
      findings++;
      if (findings === 1) {
        recordFinding(finding, "nudged");
        pi.sendMessage({ customType: "pi-build-stuck", content: stuckNudge(finding), display: true }, { deliverAs: "steer" });
      } else await escalateStuck(ctx, finding);
    };
    pi.on("session_start", (_event, ctx) => {
      lastCwd = ctx.cwd;
      boundFired = false;
    });

    const check = async (ctx: { abort: () => void; cwd?: string }) => {
      if (ctx.cwd) lastCwd = ctx.cwd;
      const reason = boundReason(turnSnapshot(), bounds);
      if (reason) await fireBound(ctx, reason);
    };
    pi.on("message_end", async (_event, ctx) => { await check(ctx); });
    pi.on("tool_result", async (event, ctx) => {
      const text = (event.content ?? []).map((part: { text?: string }) => part.text ?? "").join("\n");
      if (!event.isError && (event.toolName === "edit" || event.toolName === "write")) continuesWithoutEdit = 0;
      calls.push({ tool: event.toolName, input: event.input, output: text, isError: Boolean(event.isError) });
      // A finding must be newly reached; the same trailing run is not a second finding.
      const finding = detectStuck(calls);
      if (finding && calls.length !== lastFindingAt && !boundFired) {
        lastFindingAt = calls.length;
        await handleFinding(ctx, finding);
      }
      await check(ctx);
    });
    pi.on("session_before_compact", (event) => {
      compaction = { reason: event.reason, willRetry: Boolean(event.willRetry), failed: false };
    });
    pi.on("agent_end", async (event, ctx) => {
      if (!compaction || boundFired) return;
      const failed = event.messages?.some((message: { errorMessage?: string }) =>
        message.errorMessage?.includes("recovery failed after one compact-and-retry attempt"));
      const decision = continueAfterCompaction({ ...compaction, failed: Boolean(failed) }, continuesWithoutEdit);
      compaction = null;
      if (decision === "none") return;
      if (decision === "stuck") {
        await escalateStuck(ctx, { pattern: "repeat-error", tool: "compaction", count: continuesWithoutEdit });
        return;
      }
      continuesWithoutEdit++;
      if (ctx.mode === "print" || ctx.mode === "json") pi.appendEntry("pi-build-continue-needed", { reason: "overflow" });
      else pi.sendUserMessage("continue", { deliverAs: "followUp" });
    });
    pi.on("before_agent_start", (event) => {
      if (event.prompt !== firedFor) boundFired = false;
      const turnId = turnSnapshot().turnId;
      if (turnId !== observedTurn) {
        observedTurn = turnId;
        calls = []; findings = 0; lastFindingAt = -1;
        // An automatic continue keeps the overflow streak across prompts.
        if (event.prompt !== "continue") continuesWithoutEdit = 0;
      }
    });
  } catch (err) {
    console.error("[bounds] failed to load; other extensions continue", err);
  }
}
