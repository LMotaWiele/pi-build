/**
 * After compaction, re-inject orientation and tell read-guard that context was dropped.
 * Session-end summary uses the scout tier with thinking off. It does not write notes or the queue.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { selectExplainModel, stringMap } from "../lib/models.ts";
import { replaceMarked } from "../lib/markdown.ts";
import { findProjectRoot } from "../lib/scaffold.ts";
import {
  attachTelemetry,
  explainCommand,
  extensionEnabled,
  getLastRecap,
  getMemoryBlock,
  getOpenNote,
  markContextDropped,
  noteRunAborted,
  readPiSettings,
  sawRunAborted,
  setLastRecap,
  settingsBlock,
  shouldWriteSessionRecap,
} from "../lib/telemetry.ts";

const execFileAsync = promisify(execFile);

export function orientationBlock(input: {
  memory: string;
  claim?: string;
  criteria?: { if: string; then: string }[];
  todos?: string[];
  lastRecap?: string;
}): string {
  const index = input.memory.replace(/<!-- \/?pi-build:memory -->/g, "").trim();
  const parts: string[] = [];
  if (input.claim) parts.push(`Current claim: ${input.claim}`);
  if (input.criteria && input.criteria.length) {
    parts.push(`Pre-committed criteria:\n${input.criteria.map((row) => `- If ${row.if} then ${row.then}`).join("\n")}`);
  }
  if (input.todos && input.todos.length) parts.push(`Todos:\n${input.todos.map((item) => `- ${item}`).join("\n")}`);
  if (input.lastRecap) parts.push(`Last recap: ${input.lastRecap}`);
  let extras = parts.join("\n\n");
  const cap = 400 * 4;
  if (extras.length > cap) extras = extras.slice(0, cap);
  const inner = [index, extras].filter(Boolean).join("\n\n");
  return replaceMarked("", inner);
}

function extractAssistantText(jsonl: string): string {
  const chunks: string[] = [];
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as {
        type?: string;
        message?: { role?: string; content?: { type?: string; text?: string }[] };
      };
      if (event.type !== "message_end" || event.message?.role !== "assistant") continue;
      for (const block of event.message.content ?? []) {
        if (block.type === "text" && block.text) chunks.push(block.text);
      }
    } catch {
      continue;
    }
  }
  return chunks.join("\n").trim();
}

export { extractAssistantText };

export default function recapExtension(pi: ExtensionAPI): void {
  try {
    const settings = readPiSettings();
    if (!extensionEnabled(settings, "recap")) return;
    attachTelemetry(pi as unknown as Parameters<typeof attachTelemetry>[0]);
    const block = settingsBlock(settings, "recap");
    const explainRel = typeof block["explainDir"] === "string" ? block["explainDir"] : ".agent/explain";
    let cwd = process.cwd();

    pi.on("session_start", (_event, ctx) => {
      cwd = ctx.cwd;
    });

    pi.on("agent_end", (event) => {
      const messages = (event as { messages?: { stopReason?: string }[] }).messages;
      if (Array.isArray(messages) && messages.some((message) => message.stopReason === "aborted")) noteRunAborted();
    });

    let lastSent = "";

    const orient = () => {
      const note = getOpenNote();
      return orientationBlock({
        memory: getMemoryBlock(),
        claim: note?.currentClaim,
        criteria: note?.preCommitted,
        lastRecap: getLastRecap() || undefined,
      });
    };

    pi.on("before_agent_start", (event) => {
      const text = orient();
      if (text.trim()) event.systemPromptOptions.sections.pi_build_memory = text;
    });

    pi.on("session_compact", (_event, ctx) => {
      markContextDropped();
      cwd = ctx.cwd;
      const text = orient();
      if (!text.trim() || text === lastSent) return;
      lastSent = text;
      pi.sendMessage({ customType: "pi-build-recap", content: text, display: false });
    });

    pi.on("session_shutdown", async (event, ctx) => {
      if (!shouldWriteSessionRecap(event.reason, sawRunAborted())) return;
      const day = new Date().toISOString().slice(0, 10);
      const root = findProjectRoot(ctx.cwd || cwd);
      const routing = settingsBlock(readPiSettings(), "routing");
      const registry = (ctx as { modelRegistry?: { getAll: () => { provider: string; id: string; name?: string }[] } }).modelRegistry;
      const catalog = registry?.getAll().map((model) => ({ provider: model.provider, id: model.id, name: model.name })) ?? [];
      const selected = selectExplainModel({
        tiers: stringMap(routing["tiers"]),
        catalog,
        routingEnabled: extensionEnabled(readPiSettings(), "routing"),
      });
      for (const line of selected.warnings) console.error(`[recap] ${line}`);
      const dir = path.resolve(root, explainRel);
      fs.mkdirSync(dir, { recursive: true });
      const existing = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.startsWith(`${day}-session-`)) : [];
      const file = path.join(dir, `${day}-session-${existing.length + 1}.md`);
      const prompt = "Write two sentences: what shipped, and what changed. No preamble.";
      let summary = "";
      if (!selected.model) {
        summary = `Session ended (${event.reason}). Recap model did not resolve.`;
      } else {
        const command = explainCommand(prompt, selected.model);
        try {
          const result = await execFileAsync(command.bin, command.args, {
            timeout: 120_000,
            maxBuffer: 8_000_000,
            cwd: ctx.cwd || cwd,
          });
          summary = extractAssistantText(result.stdout) || result.stdout.trim();
        } catch (err) {
          summary = `Session ended (${event.reason}). Recap model was unavailable: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`[recap] ${summary}`);
        }
      }
      const two = summary.split(/(?<=\.)\s+/).slice(0, 2).join(" ");
      const body = `${two || summary}\n`;
      fs.writeFileSync(file, body);
      setLastRecap(body.trim());
      pi.appendEntry("pi-build-session-recap", { path: file, summary: body.trim(), reason: event.reason });
      console.error(`[recap] wrote ${file}`);
    });
  } catch (err) {
    console.error("[recap] failed to load; other extensions continue", err);
  }
}
