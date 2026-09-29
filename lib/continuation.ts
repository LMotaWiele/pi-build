// lib/continuation.ts — when a turn that pi ended should resume by itself.

export interface CompactionOutcome {
  reason: "threshold" | "overflow" | "manual";
  willRetry: boolean; // pi's own flag: it will re-run the response
  failed: boolean; // pi gave up on overflow recovery
}

export const MAX_CONTINUES_WITHOUT_EDIT = 3;

// Threshold compaction happens inside the turn and pi continues itself.
// Overflow compaction that pi will not retry, or that failed, ends the turn:
// continue it, unless it has already been continued three times with no file
// edited in between — that is a loop, handled as stuck.
export function continueAfterCompaction(o: CompactionOutcome, continuesWithoutEdit: number): "none" | "continue" | "stuck" {
  if (o.reason !== "overflow") return "none";
  if (o.willRetry && !o.failed) return "none";
  return continuesWithoutEdit < MAX_CONTINUES_WITHOUT_EDIT ? "continue" : "stuck";
}
