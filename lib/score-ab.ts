/** Scorer for SPEC-delegation-ab. Voids are recomputed from tool rows, not from ab_trials.void_reason. */

export interface ToolRow {
  toolName: string;
  outcome: string;
  path?: string | null;
  arguments?: string | null;
}

export interface ScoredTrial {
  trial: number;
  arm: string;
  voidReason: string | null;
  boundReason: string | null;
  childEdits: number;
  parentWrote: boolean;
  completed: boolean;
  parentCalls: number;
}

interface TrialRow {
  trial: number;
  arm: string;
  parent_turn_id: string | null;
  completed: number | null;
  bound_reason: string | null;
  started_at: number | null;
  wall_clock_s: number | null;
}

interface Statement {
  all(...args: unknown[]): unknown[];
  get(...args: unknown[]): unknown;
}

export interface ScoreDb {
  prepare(sql: string): Statement;
}

const FIXTURE = "tests/fixtures/ab";

export function underFixture(target: string | null | undefined): boolean {
  if (!target) return false;
  const norm = target.replace(/\\/g, "/");
  const at = norm.indexOf(FIXTURE);
  if (at < 0) return false;
  if (at > 0 && norm[at - 1] !== "/") return false;
  const after = norm[at + FIXTURE.length];
  return after === undefined || after === "/";
}

function pathFromArguments(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const key of ["path", "target_file", "file_path"]) {
      if (typeof parsed[key] === "string") return parsed[key];
    }
  } catch {
    return null;
  }
  return null;
}

/** edit/write paths only. A bash command that mentions the fixture is not a write. */
export function parentWroteFixture(rows: ToolRow[]): boolean {
  return rows.some((row) => {
    if (row.toolName !== "edit" && row.toolName !== "write") return false;
    if (row.outcome !== "success") return false;
    return underFixture(row.path) || underFixture(pathFromArguments(row.arguments));
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export interface VerdictInput {
  arm: string;
  voidReason: string | null;
  completed: boolean;
  totalPromptTokens: number;
  totalCostUsd: number;
}

/** §6 in order. Rule 0 matches before a void arm can look like NEITHER or MONOLITHIC. */
export function setVerdict(trials: VerdictInput[]): string {
  const nonVoid = (arm: string) => trials.filter((trial) => trial.arm === arm && !trial.voidReason);
  if (nonVoid("A").length < 3 || nonVoid("B").length < 3) return "VOID";
  const done = (arm: string) => nonVoid(arm).filter((trial) => trial.completed).length;
  if (done("A") < 2 && done("B") < 2) return "NEITHER";
  if (done("B") >= 2 && done("A") <= 1) return "DELEGATED";
  if (done("A") >= 2 && done("B") <= 1) return "MONOLITHIC";
  const tokens = (arm: string) => median(nonVoid(arm).map((trial) => trial.totalPromptTokens));
  const cost = (arm: string) => median(nonVoid(arm).map((trial) => trial.totalCostUsd));
  if (done("A") >= 2 && done("B") >= 2 && tokens("B") <= 0.75 * tokens("A") && cost("B") <= cost("A")) return "DELEGATED";
  if (done("A") >= 2 && done("B") >= 2 && cost("A") <= 0.75 * cost("B")) return "MONOLITHIC";
  return "INCONCLUSIVE";
}

function rowsOf<T>(db: ScoreDb, sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

function one(db: ScoreDb, sql: string, ...params: unknown[]): number {
  const row = db.prepare(sql).get(...params) as Record<string, number> | undefined;
  if (!row) return 0;
  return Object.values(row)[0] ?? 0;
}

export function orphanCount(db: ScoreDb): number {
  return one(db, `
    WITH RECURSIVE chain(turn_id, root_turn_id) AS (
      SELECT DISTINCT turn_id, turn_id FROM inference_calls WHERE parent_turn_id IS NULL
      UNION
      SELECT i.turn_id, c.root_turn_id
      FROM inference_calls i
      JOIN chain c ON i.parent_turn_id = c.turn_id
      WHERE i.parent_turn_id IS NOT NULL AND i.turn_id != i.parent_turn_id
    )
    SELECT COUNT(*) AS n FROM inference_calls
    WHERE turn_id NOT IN (SELECT turn_id FROM chain)
  `);
}

function chainFrom(db: ScoreDb, rootId: string): string[] {
  return rowsOf<{ turn_id: string }>(db, `
    WITH RECURSIVE chain(turn_id) AS (
      SELECT ?
      UNION
      SELECT i.turn_id
      FROM inference_calls i
      JOIN chain c ON i.parent_turn_id = c.turn_id
      WHERE i.parent_turn_id IS NOT NULL AND i.turn_id != i.parent_turn_id
    )
    SELECT turn_id FROM chain
  `, rootId).map((row) => row.turn_id);
}

function editCount(db: ScoreDb, turnIds: string[]): number {
  if (!turnIds.length) return 0;
  const marks = turnIds.map(() => "?").join(",");
  return one(db, `
    SELECT COUNT(*) AS n FROM tool_calls
    WHERE turn_id IN (${marks}) AND tool_name IN ('edit', 'write') AND outcome = 'success'
  `, ...turnIds);
}

export function scoreDatabase(db: ScoreDb): { orphans: number; trials: ScoredTrial[]; verdict: string } {
  const trials = rowsOf<TrialRow>(db, `
    SELECT trial, arm, parent_turn_id, completed, bound_reason, started_at, wall_clock_s
    FROM ab_trials ORDER BY trial
  `);
  const roots = rowsOf<{ turn_id: string; ts: number }>(db, `
    SELECT turn_id, MIN(ts) AS ts FROM inference_calls
    WHERE parent_turn_id IS NULL GROUP BY turn_id
  `);
  const scored: ScoredTrial[] = trials.map((trial) => {
    const parent = trial.parent_turn_id;
    const start = trial.started_at ?? 0;
    const end = start + (trial.wall_clock_s ?? 0) * 1000;
    const extra = roots
      .filter((root) => root.turn_id !== parent && root.ts >= start && root.ts <= end)
      .map((root) => root.turn_id);
    const chain = new Set<string>();
    for (const root of [parent, ...extra]) {
      if (!root) continue;
      for (const id of chainFrom(db, root)) chain.add(id);
    }
    const childTurns = [...chain].filter((id) => id !== parent);
    const childEdits = editCount(db, childTurns);
    const parentRows = parent
      ? rowsOf<{ tool_name: string; outcome: string; path: string | null; arguments: string | null }>(db, `
          SELECT tool_name, outcome, path, arguments FROM tool_calls WHERE turn_id = ?
        `, parent).map((row) => ({
          toolName: row.tool_name,
          outcome: row.outcome,
          path: row.path,
          arguments: row.arguments,
        }))
      : [];
    const parentWrote = parentWroteFixture(parentRows);
    const parentBound = parent
      ? rowsOf<{ arguments: string | null }>(db, `
          SELECT arguments FROM tool_calls
          WHERE tool_name = 'bound' AND turn_id = ? ORDER BY id DESC LIMIT 1
        `, parent)[0]
      : undefined;
    let boundReason = trial.bound_reason;
    if (parentBound?.arguments) {
      try {
        const parsed = JSON.parse(parentBound.arguments) as { reason?: string };
        boundReason = parsed.reason ?? parentBound.arguments;
      } catch {
        boundReason = parentBound.arguments;
      }
    }
    const parentCalls = parent
      ? one(db, "SELECT COUNT(*) AS n FROM inference_calls WHERE turn_id = ?", parent)
      : 0;
    const voids: string[] = [];
    if (parentCalls <= 3 && boundReason?.startsWith("consecutive tool failures")) {
      voids.push("died within first 3 calls at consecutive tool failures");
    }
    if (trial.arm === "B" && childEdits === 0) voids.push("0 child edits");
    if (trial.arm === "B" && parentWrote) voids.push("parent wrote a fixture file");
    const voidReason = voids.length ? voids.join("; ") : null;
    const completed = !voidReason && !boundReason && trial.completed === 1;
    return {
      trial: trial.trial,
      arm: trial.arm,
      voidReason,
      boundReason,
      childEdits,
      parentWrote,
      completed,
      parentCalls,
    };
  });
  return {
    orphans: orphanCount(db),
    trials: scored,
    verdict: setVerdict(scored.map((trial) => ({
      arm: trial.arm,
      voidReason: trial.voidReason,
      completed: trial.completed,
      totalPromptTokens: 0,
      totalCostUsd: 0,
    }))),
  };
}
