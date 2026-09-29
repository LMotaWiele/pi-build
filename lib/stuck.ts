// lib/stuck.ts — detect an agent repeating itself, after OpenHands' StuckDetector.
// The only runaway pattern observed in real use. Detection nudges first, then escalates.

export interface CallRecord {
  tool: string;
  input: unknown;
  output: string; // the tool result text, or the error message
  isError: boolean;
}

export type StuckPattern = "repeat" | "repeat-error" | "alternate";

export interface StuckFinding {
  pattern: StuckPattern;
  tool: string;
  count: number;
}

export const STUCK = { repeat: 4, repeatError: 3, alternateCalls: 6 } as const;

// Sorted-key JSON, so argument order never hides a repeat.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

// Remove what changes between identical runs: durations, timestamps, addresses.
// Counts stay, so "3 passed" and "2 passed" remain different results.
export function normalizeOutput(text: string): string {
  return text
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, "<time>")
    .replace(/duration_ms:?\s*[\d.]+/g, "duration_ms <n>")
    .replace(/\b\d+(?:\.\d+)?\s?(?:ms|s)\b/g, "<dur>")
    .replace(/\b0x[0-9a-f]+\b/gi, "<addr>");
}

function signature(c: CallRecord): string {
  return `${c.tool}\u0000${canonical(c.input)}\u0000${c.isError ? "E" : "O"}\u0000${normalizeOutput(c.output)}`;
}

function trailingRun(sigs: string[]): number {
  let n = 0;
  for (let i = sigs.length - 1; i >= 0 && sigs[i] === sigs[sigs.length - 1]; i--) n++;
  return n;
}

// Looks only at the end of the sequence: a loop is something happening now.
export function detectStuck(calls: CallRecord[]): StuckFinding | null {
  if (!calls.length) return null;
  const sigs = calls.map(signature);
  const last = calls[calls.length - 1];
  const run = trailingRun(sigs);
  if (last.isError && run >= STUCK.repeatError) return { pattern: "repeat-error", tool: last.tool, count: run };
  if (run >= STUCK.repeat) return { pattern: "repeat", tool: last.tool, count: run };
  const n = STUCK.alternateCalls;
  if (sigs.length >= n) {
    const tail = sigs.slice(-n);
    const alternating = tail[0] !== tail[1] && tail.every((s, i) => s === tail[i % 2]);
    if (alternating) return { pattern: "alternate", tool: last.tool, count: n };
  }
  return null;
}

export function stuckNudge(f: StuckFinding): string {
  if (f.pattern === "alternate") {
    return `You have alternated between the same two tool calls ${f.count} times with the same results. Repeating them will not work. Step back and change approach.`;
  }
  const what = f.pattern === "repeat-error" ? "and got the same error each time" : "and got the same result each time";
  return `You have called ${f.tool} with the same arguments ${f.count} times in a row ${what}. Repeating it will not work. Change approach.`;
}

// First detection in a turn nudges; any later one escalates.
export function stuckResponse(findingsThisTurn: number): "nudge" | "escalate" {
  return findingsThisTurn <= 1 ? "nudge" : "escalate";
}
