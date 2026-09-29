// lib/rework.ts — the human rework log. One JSON line per finding.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface ReworkRow {
  spec: string; // normalized name: "tiered-retry" for docs/specs/SPEC-NNNN-<slug>.md
  task: string; // a plan task id, or "*" for the spec as a whole
  reason: string; // free text
  at: string; // ISO timestamp
  project: string; // repository root the finding belongs to
}

export const WHOLE_SPEC = "*";

export function defaultReworkPath(env: Record<string, string | undefined>): string {
  return env.PI_BUILD_REWORK ?? join(homedir(), ".pi", "agent", "rework.jsonl");
}

// "docs/specs/SPEC-NNNN-<slug>.md", "SPEC-NNNN-<slug>.md", and a bare slug all name that slug.
export function normalizeSpecName(input: string): string {
  const base = input.trim().split("/").pop() ?? "";
  return base.replace(/\.md$/i, "").replace(/^SPEC-/, "");
}

export function planTaskIds(plan: unknown): string[] {
  if (!plan || typeof plan !== "object") return [];
  const tasks = (plan as { tasks?: unknown }).tasks;
  if (!Array.isArray(tasks)) return [];
  return tasks.map((t) => (t && typeof t === "object" ? (t as { id?: unknown }).id : null)).filter((id): id is string => typeof id === "string");
}

export type Validation = { ok: true } | { ok: false; error: string };

// specExists: docs/specs/SPEC-NNNN-<slug>.md is present. taskIds: from the spec's plan,
// or null when the spec has no plan.
export function validateRework(
  input: { spec: string; task: string; reason: string },
  specExists: boolean,
  taskIds: string[] | null,
): Validation {
  if (!specExists) return { ok: false, error: `No spec named "${input.spec}".` };
  if (!input.reason.trim()) return { ok: false, error: "A reason is required." };
  if (input.task === WHOLE_SPEC) return { ok: true };
  if (taskIds === null) return { ok: false, error: `Spec "${input.spec}" has no plan. Use "${WHOLE_SPEC}" for the spec as a whole.` };
  if (!taskIds.includes(input.task)) {
    return { ok: false, error: `No task "${input.task}" in "${input.spec}". Tasks: ${taskIds.join(", ")}, or "${WHOLE_SPEC}".` };
  }
  return { ok: true };
}

export function appendRework(path: string, row: ReworkRow): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(row) + "\n");
}

// Malformed lines are skipped, never fatal.
export function readRework(path: string): ReworkRow[] {
  if (!existsSync(path)) return [];
  const out: ReworkRow[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (r && typeof r.spec === "string" && typeof r.task === "string" && typeof r.reason === "string") out.push(r);
    } catch {
      // skip
    }
  }
  return out;
}
