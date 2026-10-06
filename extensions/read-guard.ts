/**
 * Suppress a repeated read only when the tool returned the same text last
 * delivered for that path and range. Relative, absolute, and symlink paths
 * to one file share an entry. A different full-file result is a unified diff
 * plus a one-line change notice when that is shorter than the text, and the
 * full result otherwise. A changed range returns the full result.
 * Scope is one user prompt. Compaction drops every entry.
 * readGuard.enabled: false, or dedupeWithinTurn: false, leaves every read unchanged.
 */

import fs from "node:fs";
import path from "node:path";
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

interface DeliveryMemory {
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

export interface ReadDeliveryInput {
  path: string;
  cwd: string;
  offset?: number;
  limit?: number;
  force?: boolean;
  isError: boolean;
  content: unknown;
  diffOnWrite: boolean;
}

export interface ReadDelivery {
  call: number;
  force?: boolean;
  /** Replacement text. Absent means the tool result stands. */
  text?: string;
  suppressed?: boolean;
}

const CHANGE_NOTICE = "File changed since it was last read.\n";

function unchangedPointer(call: number): string {
  return `already read this turn at call ${call}, unchanged. Pass offset and limit to read a range. force is not in the read schema; a range is the supported re-read.`;
}

function resolveGuardPath(raw: string, cwd: string, aliases: Map<string, string>): { absolute: string; canonical: string } {
  const absolute = path.resolve(cwd, raw);
  try {
    return { absolute, canonical: fs.realpathSync(absolute) };
  } catch {
    return { absolute, canonical: aliases.get(absolute) ?? absolute };
  }
}

function isTextResult(content: unknown): content is Array<{ type: string; text: string }> {
  if (!Array.isArray(content) || content.length === 0) return false;
  return content.every((block) => {
    if (!block || typeof block !== "object") return false;
    const record = block as { type?: unknown; text?: unknown };
    return record.type === "text" && typeof record.text === "string";
  });
}

function contentText(content: Array<{ text: string }>): string {
  return content.map((block) => block.text).join("\n");
}

function deliveryKey(canonical: string, offset?: number, limit?: number): string {
  return `${canonical}\0${offset == null ? "" : String(offset)}\0${limit == null ? "" : String(limit)}`;
}

export class ReadGuard {
  enabled = true;
  /** Still selects decide() actions. The model-facing path keys by path and range. */
  allowRangeReads = true;
  private call = 0;
  private serial = 0;
  private files = new Map<string, FileMemory>();
  private writes = new Map<string, number>();
  private delivered = new Map<string, DeliveryMemory>();
  private pathAliases = new Map<string, string>();
  private canonicalWrites = new Map<string, number>();

  onNewPrompt(): void {
    this.files.clear();
    this.writes.clear();
    this.delivered.clear();
    this.pathAliases.clear();
    this.canonicalWrites.clear();
    this.call = 0;
    this.serial = 0;
  }

  onCompaction(): void {
    markContextDropped();
    this.pathAliases.clear();
  }

  recordWrite(path: string, cwd?: string): void {
    this.serial += 1;
    this.writes.set(path, this.serial);
    if (cwd) {
      const { canonical } = resolveGuardPath(path, cwd, this.pathAliases);
      this.canonicalWrites.set(canonical, this.serial);
    }
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
      pointer: unchangedPointer(prev.call),
    };
  }

  /**
   * Compare the read tool's result with the text last delivered for this path
   * and range. Edit and write tracking does not decide the pointer.
   */
  deliver(input: ReadDeliveryInput): ReadDelivery {
    if (!this.enabled) return { call: this.call };
    this.call += 1;
    const call = this.call;
    const located = resolveGuardPath(input.path, input.cwd, this.pathAliases);
    if (input.isError) {
      this.clearDelivered(located.canonical);
      return { call };
    }
    if (input.force === true) {
      if (isTextResult(input.content)) {
        this.remember(located.absolute, located.canonical);
        this.delivered.set(deliveryKey(located.canonical, input.offset, input.limit), {
          call,
          content: contentText(input.content),
          epoch: contextEpoch(),
          readSerial: this.serial,
        });
      }
      return { call, force: true };
    }
    if (!isTextResult(input.content)) return { call };
    const fresh = contentText(input.content);
    this.remember(located.absolute, located.canonical);
    const epoch = contextEpoch();
    const key = deliveryKey(located.canonical, input.offset, input.limit);
    const entry = this.delivered.get(key);
    if (entry && entry.epoch === epoch && entry.content === fresh) {
      const writeSerial = this.canonicalWrites.get(located.canonical) ?? 0;
      if (writeSerial > entry.readSerial) entry.readSerial = this.serial;
      return { call, text: unchangedPointer(entry.call), suppressed: true };
    }
    const partial = input.offset != null || input.limit != null;
    const postWrite = entry != null && (this.canonicalWrites.get(located.canonical) ?? 0) > entry.readSerial;
    let text: string | undefined;
    if (entry && entry.epoch === epoch && !partial && !(postWrite && !input.diffOnWrite)) {
      const diff = unifiedDiff(input.path, entry.content, fresh);
      const payload = diff ? CHANGE_NOTICE + diff : "";
      if (payload && payload.length < fresh.length) text = payload;
    }
    this.delivered.set(key, { call, content: fresh, epoch, readSerial: this.serial });
    return text ? { call, text } : { call };
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

  private remember(absolute: string, canonical: string): void {
    this.pathAliases.set(absolute, canonical);
    this.pathAliases.set(canonical, canonical);
  }

  private clearDelivered(canonical: string): void {
    const prefix = `${canonical}\0`;
    for (const key of this.delivered.keys()) {
      if (key.startsWith(prefix)) this.delivered.delete(key);
    }
    // Keep path aliases. A later error through a symlink cannot call realpath
    // once the target is gone, and the alias is the only way back to this entry.
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

    pi.on("before_agent_start", (event, ctx) => {
      if (notePrompt(ctx.sessionManager.getSessionId(), event.prompt)) guard.onNewPrompt();
    });

    pi.on("session_compact", () => {
      guard.onCompaction();
    });

    pi.on("tool_result", (event, ctx) => {
      if (!guard.enabled) return;
      const cwd = typeof ctx.cwd === "string" ? ctx.cwd : process.cwd();
      if (event.toolName === "edit" || event.toolName === "write") {
        const filePath = (event.input as { path?: string }).path;
        if (filePath && !event.isError) guard.recordWrite(filePath, cwd);
        return;
      }
      if (event.toolName !== "read") return;
      const filePath = (event.input as { path?: string }).path;
      if (!filePath || classifyNotesPath(filePath)) return;
      const input = event.input as { offset?: number; limit?: number; force?: boolean };
      const delivery = guard.deliver({
        path: filePath,
        cwd,
        offset: input.offset,
        limit: input.limit,
        force: input.force === true,
        isError: event.isError === true,
        content: event.content,
        diffOnWrite,
      });
      if (delivery.force) {
        console.error(`[read-guard] force bypass ${filePath} call ${delivery.call}`);
      }
      if (!delivery.text) return;
      if (delivery.suppressed && event.toolCallId) {
        // Bounds attaches telemetry first, so this row is already recorded.
        // The annotation is here for a later reader. The model sees `text`.
        annotateCall(event.toolCallId, {
          outcome: "deduped",
          path: filePath,
          resultBytes: delivery.text.length,
          blockedBy: "read-guard",
        });
      }
      return { content: [{ type: "text" as const, text: delivery.text }], isError: false };
    });
  } catch (err) {
    console.error("[read-guard] failed to load; other extensions continue", err);
  }
}
