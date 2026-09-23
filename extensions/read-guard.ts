/**
 * Suppress repeated reads of an unchanged file inside one user prompt.
 * Range reads always pass. Compaction marks every path unread.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { changedLineBytes, classifyNotesPath, unifiedDiff } from "../lib/markdown.ts";
import {
  annotateCall,
  attachTelemetry,
  contextEpoch,
  extensionEnabled,
  markContextDropped,
  notePrompt,
  readPiSettings,
  settingsBlock,
  sha256,
} from "../lib/telemetry.ts";

interface FileMemory {
  call: number;
  content: string;
  epoch: number;
  readSerial: number;
}

export interface ReadGuardDecision {
  action: "pass" | "pointer" | "diff" | "range" | "force";
  call: number;
  pointer?: string;
}

export class ReadGuard {
  enabled = true;
  allowRangeReads = true;
  private call = 0;
  private serial = 0;
  private files = new Map<string, FileMemory>();
  private writes = new Map<string, number>();

  onNewPrompt(): void {
    this.files.clear();
    this.writes.clear();
    this.call = 0;
    this.serial = 0;
  }

  onCompaction(): void {
    markContextDropped();
  }

  recordWrite(path: string): void {
    this.serial += 1;
    this.writes.set(path, this.serial);
  }

  decide(input: { path: string; offset?: number; limit?: number; force?: boolean }): ReadGuardDecision {
    this.call += 1;
    if (!this.enabled) return { action: "pass", call: this.call };
    if (input.force === true) return { action: "force", call: this.call };
    if (this.allowRangeReads && (input.offset != null || input.limit != null)) return { action: "range", call: this.call };
    const epoch = contextEpoch();
    const prev = this.files.get(input.path);
    if (!prev || prev.epoch !== epoch) return { action: "pass", call: this.call };
    const writeSerial = this.writes.get(input.path) ?? 0;
    if (writeSerial > prev.readSerial) return { action: "diff", call: this.call };
    return {
      action: "pointer",
      call: this.call,
      pointer: `already read this turn at call ${prev.call}, unchanged. Pass offset and limit to read a range. force is not in the read schema; a range is the supported re-read.`,
    };
  }

  recordRead(path: string, content: string): void {
    this.serial += 1;
    this.files.set(path, {
      call: this.call,
      content,
      epoch: contextEpoch(),
      readSerial: this.serial,
    });
    void sha256(content);
  }

  stored(path: string): string | undefined {
    const row = this.files.get(path);
    if (!row || row.epoch !== contextEpoch()) return undefined;
    return row.content;
  }
}

export function renderRepeat(path: string, oldText: string, newText: string): { kind: "diff" | "full"; text: string } {
  // Compare changed lines with the file, not a full-context diff. A diff that
  // reprints every unchanged line is always larger than the file.
  if (newText.length === 0 || changedLineBytes(oldText, newText) > newText.length * 0.5) {
    return { kind: "full", text: newText };
  }
  const diff = unifiedDiff(path, oldText, newText);
  return { kind: "diff", text: diff || "no textual change\n" };
}

function contentText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => (block && typeof block === "object" && typeof (block as { text?: string }).text === "string" ? (block as { text: string }).text : ""))
    .join("\n");
}

export default function readGuardExtension(pi: ExtensionAPI): void {
  try {
    const settings = readPiSettings();
    if (!extensionEnabled(settings, "readGuard")) return;
    attachTelemetry(pi as unknown as Parameters<typeof attachTelemetry>[0], "read-guard");
    const block = settingsBlock(settings, "readGuard");
    const guard = new ReadGuard();
    guard.enabled = block["enabled"] !== false && block["dedupeWithinTurn"] !== false;
    guard.allowRangeReads = block["allowRangeReads"] !== false;
    const diffOnWrite = block["diffOnRepeatAfterWrite"] !== false;
    const pending = new Map<string, ReadGuardDecision>();

    pi.on("before_agent_start", (event, ctx) => {
      if (notePrompt(ctx.sessionManager.getSessionId(), event.prompt)) guard.onNewPrompt();
    });

    pi.on("session_compact", () => {
      guard.onCompaction();
      pending.clear();
    });

    pi.on("tool_call", (event) => {
      if (event.toolName !== "read") return;
      const input = event.input as { path?: string; offset?: number; limit?: number; force?: boolean };
      if (!input.path || classifyNotesPath(input.path)) return;
      const decision = guard.decide({
        path: input.path,
        offset: input.offset,
        limit: input.limit,
        force: input.force,
      });
      pending.set(event.toolCallId, decision);
      if (decision.action === "force") {
        console.error(`[read-guard] force bypass ${input.path} call ${decision.call}`);
      }
      if (decision.action === "pointer" && decision.pointer) {
        annotateCall(event.toolCallId, {
          outcome: "deduped",
          path: input.path,
          resultBytes: decision.pointer.length,
          blockedBy: "read-guard",
        });
      }
    });

    pi.on("tool_result", (event) => {
      if (event.toolName === "edit" || event.toolName === "write") {
        const filePath = (event.input as { path?: string }).path;
        if (filePath && !event.isError) guard.recordWrite(filePath);
        return;
      }
      if (event.toolName !== "read") return;
      const filePath = (event.input as { path?: string }).path;
      const decision = pending.get(event.toolCallId);
      pending.delete(event.toolCallId);
      if (!filePath || !decision || event.isError) return;
      const text = contentText(event.content);
      if (decision.action === "pointer" && decision.pointer) {
        return { content: [{ type: "text" as const, text: decision.pointer }], isError: false };
      }
      if (decision.action === "range" || decision.action === "force" || decision.action === "pass") {
        if (decision.action === "pass" || decision.action === "force") guard.recordRead(filePath, text);
        return;
      }
      if (decision.action === "diff" && !diffOnWrite) {
        guard.recordRead(filePath, text);
        return;
      }
      const previous = guard.stored(filePath) ?? "";
      const rendered = renderRepeat(filePath, previous, text);
      guard.recordRead(filePath, text);
      if (rendered.kind === "full") return;
      return { content: [{ type: "text" as const, text: rendered.text }], isError: false };
    });
  } catch (err) {
    console.error("[read-guard] failed to load; other extensions continue", err);
  }
}
