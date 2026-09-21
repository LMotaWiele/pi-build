/**
 * Projection for one Jev decision. Never the conversation.
 * Drop fields from the bottom when the 4k budget is exceeded, and always log the token count.
 */

import { estimateTokens } from "../../lib/telemetry.ts";

export interface ToolTrace {
  name: string;
  outcome: string;
  path?: string;
}

export interface TurnContext {
  userPrompt: string;
  loopIndex: number;
  elapsedMs: number;
  tier: string;
  tools: ToolTrace[];
  filesWritten: string[];
  indexRow?: string;
  currentClaim?: string;
  lastToolResult?: string;
  filesRead: string[];
}

const DROP_ORDER = ["files_read", "last_tool_result", "index", "files_written", "tools"] as const;

function capChars(text: string, tokens: number): string {
  const max = tokens * 4;
  if (text.length <= max) return text;
  return text.slice(0, max);
}

function section(id: string, ctx: TurnContext): string | null {
  if (id === "tools") {
    const lines = ctx.tools.map((tool) => `- ${tool.name} ${tool.outcome}${tool.path ? ` ${tool.path}` : ""}`);
    return `tools:\n${lines.length ? lines.join("\n") : "- (none)"}`;
  }
  if (id === "files_written") {
    const lines = ctx.filesWritten.map((file) => `- ${file}`);
    return `files_written:\n${lines.length ? lines.join("\n") : "- (none)"}`;
  }
  if (id === "index") {
    return `index_row: ${ctx.indexRow || "(none)"}\ncurrent_claim: ${ctx.currentClaim || "(none)"}`;
  }
  if (id === "last_tool_result") {
    const text = capChars(ctx.lastToolResult || "", 500);
    return `last_tool_result:\n${text || "(none)"}`;
  }
  if (id === "files_read") {
    const lines = ctx.filesRead.map((file) => `- ${file}`);
    return `files_read:\n${lines.length ? lines.join("\n") : "- (none)"}`;
  }
  return null;
}

export function buildState(ctx: TurnContext, budgetTokens = 4000): string {
  // Leave room for the "user_prompt:" label so that block stays within 1k tokens.
  const promptRoom = 4000 - "user_prompt:\n".length - "\n\n".length;
  const prompt = (ctx.userPrompt || "").slice(0, promptRoom);
  const header = [`user_prompt:\n${prompt}`, `loop_index: ${ctx.loopIndex}\nelapsed_ms: ${ctx.elapsedMs}\ntier: ${ctx.tier}`];
  const dropped = new Set<string>();
  let text = "";
  for (;;) {
    const parts = [...header];
    for (const id of ["tools", "files_written", "index", "last_tool_result", "files_read"]) {
      if (dropped.has(id)) continue;
      const block = section(id, ctx);
      if (block) parts.push(block);
    }
    text = parts.join("\n\n");
    if (estimateTokens(text) <= budgetTokens) break;
    const next = DROP_ORDER.find((id) => !dropped.has(id));
    if (!next) {
      text = capChars(text, budgetTokens);
      break;
    }
    dropped.add(next);
  }
  const tokens = estimateTokens(text);
  console.error(`[state-builder] tokens=${tokens} budget=${budgetTokens} dropped=${[...dropped].join(",") || "none"}`);
  return text;
}
