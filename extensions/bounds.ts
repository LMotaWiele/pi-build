/**
 * Turn bounds. They abort the turn. They do not prompt, except one retry
 * at escalate when the bound trip already wrote a file.
 * Tier selection stays in routing.ts. Disabling routing leaves this running.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import fs from "node:fs";
import path from "node:path";
import { appendQueue } from "../lib/markdown.ts";
import { findProjectRoot } from "../lib/scaffold.ts";
import {
  resolveRouting,
  stringMap,
  thinkingLevelFor,
} from "../lib/models.ts";
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

type SessionModel = { provider: string; id: string; name?: string };

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
      maxLoopDepth: numberOr(boundsBlock["maxLoopDepth"], DEFAULT_BOUNDS.maxLoopDepth),
      maxTurnWallClockMs: numberOr(boundsBlock["maxTurnWallClockMs"], DEFAULT_BOUNDS.maxTurnWallClockMs),
      maxConsecutiveToolFailures: numberOr(boundsBlock["maxConsecutiveToolFailures"], DEFAULT_BOUNDS.maxConsecutiveToolFailures),
      noProgressReads: numberOr(boundsBlock["noProgressReads"], DEFAULT_BOUNDS.noProgressReads),
      maxTurnPromptTokens: numberOr(boundsBlock["maxTurnPromptTokens"], DEFAULT_BOUNDS.maxTurnPromptTokens),
      maxTurnCostUsd: numberOr(boundsBlock["maxTurnCostUsd"], DEFAULT_BOUNDS.maxTurnCostUsd),
    };
    let boundFired = false;
    let firedFor = "";
    let lastCwd = process.cwd();

    const appendLiveQueue = (item: string, source: string) => {
      const memory = settingsBlock(readPiSettings(), "memoryGate");
      const indexRel = typeof memory["indexPath"] === "string" ? memory["indexPath"] : ".agent/notes/INDEX.md";
      const file = path.resolve(findProjectRoot(lastCwd), indexRel);
      const today = new Date().toISOString().slice(0, 10);
      fs.writeFileSync(file, appendQueue(fs.readFileSync(file, "utf8"), item, source, today));
    };

    const retryAtEscalate = async (
      ctx: { modelRegistry?: { getAll: () => SessionModel[]; find: (provider: string, id: string) => unknown } },
      line: string,
    ) => {
      const live = readPiSettings();
      const routingBlock = settingsBlock(live, "routing");
      const tiers = stringMap(routingBlock["tiers"]);
      const catalog = ctx.modelRegistry?.getAll?.().map((model) => ({ provider: model.provider, id: model.id, name: model.name })) ?? [];
      const plan = resolveRouting({
        tiers,
        catalog,
        routingEnabled: true,
        defaultModel: typeof live["defaultModel"] === "string" ? live["defaultModel"] : undefined,
      });
      const chosen = plan.tiers.escalate;
      if (!chosen || !ctx.modelRegistry) {
        console.error("[bounds] retry skipped; escalate did not resolve");
        return;
      }
      const model = ctx.modelRegistry.find(chosen.provider, chosen.id);
      if (!model) {
        console.error(`[bounds] retry skipped; ${chosen.modelId} is not in the registry`);
        return;
      }
      let ok = false;
      try {
        ok = (await pi.setModel(model as never)) === true;
      } catch (err) {
        console.error("[bounds] retry setModel failed", err);
      }
      if (!ok) {
        console.error(`[bounds] retry skipped; setModel refused ${chosen.modelId}`);
        return;
      }
      const levels = (live["modelThinkingLevels"] ?? {}) as Record<string, unknown>;
      const level = thinkingLevelFor(chosen.modelId, levels);
      if (level) pi.setThinkingLevel(level as "low");
      setActiveTier("escalate", chosen.modelId);
      pi.sendUserMessage(line, { deliverAs: "followUp" });
      console.error(`[bounds] retry at escalate ${chosen.modelId}`);
    };

    const fireBound = async (
      ctx: { abort: () => void; modelRegistry?: { getAll: () => SessionModel[]; find: (provider: string, id: string) => unknown } },
      reason: string,
    ) => {
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
      const prompt = currentPrompt();
      const held = readHold(defaultHoldPath(process.env)) !== null;
      const retry =
        !held &&
        process.env.PI_BUILD_RETRY !== "0" &&
        written.length > 0 &&
        !explainOneShot() &&
        claimBoundRetry(prompt);
      const line = boundCheckpointLine(reason, written, firstUnwrittenPath(noteText, written));
      await runBoundAbort({
        reason,
        written,
        resumeFrom: firstUnwrittenPath(noteText, written),
        queueAppend: appendLiveQueue,
        setRecap: setLastRecap,
        beforeAbort: retry ? () => retryAtEscalate(ctx, line) : undefined,
        abort: () => ctx.abort(),
      });
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
    pi.on("message_end", async (_event, ctx) => {
      await check(ctx);
    });
    pi.on("tool_result", async (_event, ctx) => {
      await check(ctx);
    });
    pi.on("before_agent_start", (event) => {
      if (event.prompt !== firedFor) boundFired = false;
    });
  } catch (err) {
    console.error("[bounds] failed to load; other extensions continue", err);
  }
}
