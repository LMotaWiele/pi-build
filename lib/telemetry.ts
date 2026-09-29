/**
 * SQLite telemetry and the shared compaction epoch.
 * Opening the database is lazy. A failure here must not take an extension down.
 */

import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { findProjectRoot } from "./scaffold.ts";

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * jiti loads this module once per extension (`moduleCache: false`).
 * Every counter the extensions share has to live on the process global.
 */
const TELEMETRY_KEY = Symbol.for("pi-build.telemetry");

interface TelemetryBag {
  epoch: number;
  turn: TurnState;
  openNote: OpenNoteState | null;
  memoryBlock: string;
  lastRecap: string;
  sawAbort: boolean;
  indexTopics: string[];
  filesWritten: string[];
  db: Db | null;
  dbFailed: boolean;
  projectRoot: string | null;
  subagentRole: string | null;
  recordedIds: Set<string>;
  annotations: Map<string, Partial<ToolCallRow>>;
  startedAt: Map<string, number>;
  attached: boolean;
  turnUsage: TurnUsage;
  turnReported: boolean;
  sessionCost: number;
  activeTier: string;
  activeModel: string;
  messageStarted: Map<string, number>;
  /** First resolution wins. A later subagent dispatch rewrites the env for children and must not retarget this process. */
  parentTurnResolved: boolean;
  resolvedParentTurnId: string | null;
  hookSeq: number;
  lastDeclaredHook: string;
  retriedPrompts: Set<string>;
}

function emptyUsage(): TurnUsage {
  return { calls: 0, prompt: 0, cached: 0, completion: 0, reasoning: 0, cost: 0 };
}

function freshTurn(): TurnState {
  return {
    sessionId: "",
    turnId: "",
    loopIndex: 0,
    started: Date.now(),
    consecutiveFailures: 0,
    reads: 0,
    edits: 0,
    prompt: "",
  };
}

function freshBag(): TelemetryBag {
  return {
    epoch: 0,
    turn: freshTurn(),
    openNote: null,
    memoryBlock: "",
    lastRecap: "",
    sawAbort: false,
    indexTopics: [],
    filesWritten: [],
    db: null,
    dbFailed: false,
    projectRoot: null,
    subagentRole: process.env.PI_BUILD_SUBAGENT_ROLE?.trim() || null,
    recordedIds: new Set(),
    annotations: new Map(),
    startedAt: new Map(),
    attached: false,
    turnUsage: emptyUsage(),
    turnReported: false,
    sessionCost: 0,
    activeTier: "unassigned",
    activeModel: "",
    messageStarted: new Map(),
    parentTurnResolved: false,
    resolvedParentTurnId: null,
    hookSeq: 0,
    lastDeclaredHook: "",
    retriedPrompts: new Set(),
  };
}

function bag(): TelemetryBag {
  const g = globalThis as typeof globalThis & { [TELEMETRY_KEY]?: TelemetryBag };
  if (!g[TELEMETRY_KEY]) g[TELEMETRY_KEY] = freshBag();
  return g[TELEMETRY_KEY];
}

/** Bump when compaction drops context. A second call in the same event still invalidates readers. */
export function markContextDropped(): number {
  const state = bag();
  state.epoch += 1;
  return state.epoch;
}

export function contextEpoch(): number {
  return bag().epoch;
}

export function resetEpochForTests(): void {
  bag().epoch = 0;
}

export interface BoundSnapshot {
  sessionId: string;
  turnId: string;
  loopIndex: number;
  elapsedMs: number;
  consecutiveFailures: number;
  reads: number;
  edits: number;
  promptTokens: number;
  costUsd: number;
}

interface TurnState {
  sessionId: string;
  turnId: string;
  loopIndex: number;
  started: number;
  consecutiveFailures: number;
  reads: number;
  edits: number;
  prompt: string;
}

export interface OpenNoteState {
  path: string;
  topic: string;
  currentClaim: string;
  preCommitted: { if: string; then: string }[];
}

export function setOpenNote(note: OpenNoteState | null): void {
  bag().openNote = note;
}

export function getOpenNote(): OpenNoteState | null {
  return bag().openNote;
}

export function setMemoryBlock(text: string): void {
  bag().memoryBlock = text;
}

export function getMemoryBlock(): string {
  return bag().memoryBlock;
}

export function setLastRecap(text: string): void {
  bag().lastRecap = text;
}

export function getLastRecap(): string {
  return bag().lastRecap;
}

export function noteRunAborted(): void {
  bag().sawAbort = true;
}

export function sawRunAborted(): boolean {
  return bag().sawAbort;
}

export function setIndexTopics(topics: string[]): void {
  bag().indexTopics = topics;
}

export function getIndexTopics(): string[] {
  return bag().indexTopics.slice();
}

export function noteWrittenFile(filePath: string): void {
  const files = bag().filesWritten;
  if (!files.includes(filePath)) files.push(filePath);
}

export function writtenFiles(): string[] {
  return bag().filesWritten.slice();
}

export function beginUserTurn(sessionId: string, prompt: string): void {
  const state = bag();
  const previousTurnId = state.turn.turnId;
  const turnId = randomUUID();
  state.turn = {
    sessionId,
    turnId,
    loopIndex: 0,
    started: Date.now(),
    consecutiveFailures: 0,
    reads: 0,
    edits: 0,
    prompt,
  };
  // Publish this turn so a nested pi started from bash inherits it.
  // A child process already has its parent's id in the env; leave that in place.
  const envId = process.env.PI_BUILD_PARENT_TURN?.trim() ?? "";
  if (!envId || (previousTurnId && envId === previousTurnId)) {
    process.env.PI_BUILD_PARENT_TURN = turnId;
  }
  state.openNote = null;
  state.filesWritten.length = 0;
  state.turnUsage = emptyUsage();
  state.turnReported = false;
  state.sawAbort = false;
}

export function currentPrompt(): string {
  return bag().turn.prompt;
}

/** Start a user-prompt turn when the text changes. Returns true only on a new prompt. */
export function notePrompt(sessionId: string, prompt: string): boolean {
  const turn = bag().turn;
  if (turn.turnId && prompt === turn.prompt) return false;
  beginUserTurn(sessionId, prompt);
  return true;
}

export function turnSnapshot(): BoundSnapshot {
  const state = bag();
  const turn = state.turn;
  return {
    sessionId: turn.sessionId,
    turnId: turn.turnId,
    loopIndex: turn.loopIndex,
    elapsedMs: Date.now() - turn.started,
    consecutiveFailures: turn.consecutiveFailures,
    reads: turn.reads,
    edits: turn.edits,
    promptTokens: state.turnUsage.prompt,
    costUsd: state.turnUsage.cost,
  };
}

/** One retry of this prompt. A checkpoint prompt is already the retry. */
export function claimBoundRetry(prompt: string): boolean {
  if (!prompt || prompt.startsWith("bounded at ")) return false;
  const seen = bag().retriedPrompts;
  if (seen.has(prompt)) return false;
  seen.add(prompt);
  return true;
}

export function bumpLoopIndex(): number {
  const turn = bag().turn;
  turn.loopIndex += 1;
  return turn.loopIndex;
}

/** A deduped or blocked read saved tokens and must not spend the no-progress budget. */
export function countsAsRead(name: string, outcome: string): boolean {
  return name === "read" && outcome !== "blocked" && outcome !== "deduped";
}

/**
 * Tools in pi 0.87.0 that can mutate a file. Widened from {edit, write} after
 * reading the installed package: bash and powershell are shells.
 */
const FILE_MUTATING_TOOLS = new Set(["edit", "write", "bash", "powershell"]);

export function countsAsEdit(name: string): boolean {
  return FILE_MUTATING_TOOLS.has(name);
}

export function noteToolOutcome(isError: boolean, countsAsRead: boolean, countsAsEdit: boolean): void {
  const turn = bag().turn;
  if (isError) turn.consecutiveFailures += 1;
  else turn.consecutiveFailures = 0;
  if (countsAsRead) turn.reads += 1;
  if (countsAsEdit) turn.edits += 1;
}

export function readPiSettings(): Record<string, unknown> {
  const dir = process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");
  const candidates = [process.env.PI_BUILD_SETTINGS, path.join(dir, "settings.json")].filter(
    (value): value is string => Boolean(value),
  );
  for (const file of candidates) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    } catch {
      continue;
    }
  }
  return {};
}

export function settingsBlock(settings: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = settings[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/** Absent block or absent enabled flag means the extension loads. */
export function extensionEnabled(settings: Record<string, unknown>, key: string): boolean {
  const block = settings[key];
  if (block === undefined) return true;
  if (!block || typeof block !== "object" || Array.isArray(block)) return true;
  return (block as Record<string, unknown>)["enabled"] !== false;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tool_calls (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  loop_index INTEGER,
  tool_name TEXT NOT NULL,
  arguments TEXT NOT NULL,
  path TEXT,
  result_bytes INTEGER,
  elapsed_ms INTEGER,
  outcome TEXT,
  blocked_by TEXT,
  parent_turn_id TEXT,
  tool_call_id TEXT,
  project_root TEXT,
  subagent_role TEXT
);
CREATE INDEX IF NOT EXISTS idx_tool_path ON tool_calls(session_id, path);

CREATE TABLE IF NOT EXISTS inference_calls (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  loop_index INTEGER,
  tier TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  cached_tokens INTEGER,
  completion_tokens INTEGER,
  reasoning_tokens INTEGER,
  ttft_ms INTEGER,
  elapsed_ms INTEGER,
  cost_usd REAL,
  parent_turn_id TEXT,
  project_root TEXT,
  subagent_role TEXT
);

CREATE TABLE IF NOT EXISTS ab_trials (
  trial INTEGER NOT NULL,
  arm TEXT NOT NULL,
  parent_turn_id TEXT,
  parent_session_id TEXT,
  head TEXT,
  started_at INTEGER,
  wall_clock_s REAL,
  completed INTEGER,
  bound_reason TEXT,
  gap_since_previous_run_s REAL,
  tier TEXT,
  void_reason TEXT
);

CREATE TABLE IF NOT EXISTS hook_touches (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  event TEXT NOT NULL,
  extension TEXT NOT NULL,
  seq INTEGER NOT NULL,
  key_or_tool TEXT,
  bytes_before INTEGER,
  bytes_after INTEGER
);
CREATE INDEX IF NOT EXISTS idx_hook_turn ON hook_touches(session_id, turn_id, seq);
`;

export interface ToolCallRow {
  toolCallId?: string;
  toolName: string;
  arguments: unknown;
  path?: string | null;
  resultBytes?: number | null;
  elapsedMs?: number | null;
  outcome: "success" | "error" | "blocked" | "deduped";
  blockedBy?: string | null;
}

export interface InferenceRow {
  tier: string;
  model: string;
  promptTokens?: number | null;
  cachedTokens?: number | null;
  completionTokens?: number | null;
  reasoningTokens?: number | null;
  ttftMs?: number | null;
  elapsedMs?: number | null;
  costUsd?: number | null;
}

interface Statement {
  run(...args: unknown[]): unknown;
  all(...args: unknown[]): unknown[];
}

interface Db {
  exec(sql: string): void;
  prepare(sql: string): Statement;
}

/**
 * The parent turn this process was started under.
 * Captured once: `markParentTurnForDispatch` later rewrites the env so grandchildren
 * inherit this process, and that rewrite must not retarget rows already in flight.
 * A nested pi started from bash has depth 0 and still inherits the env. Its rows
 * keep that parent. A process whose env is its own turn id is a root.
 */
export function currentParentTurnId(): string | null {
  const state = bag();
  if (state.parentTurnResolved) return state.resolvedParentTurnId;
  const own = state.turn.turnId;
  const id = process.env.PI_BUILD_PARENT_TURN?.trim() ?? "";
  state.resolvedParentTurnId = id && id !== own ? id : null;
  state.parentTurnResolved = true;
  return state.resolvedParentTurnId;
}

export function markParentTurnForDispatch(toolName: string): void {
  if (toolName !== "subagent") return;
  const turnId = bag().turn.turnId;
  if (turnId) process.env.PI_BUILD_PARENT_TURN = turnId;
}

function ensureColumn(store: Db, table: string, column: string): void {
  const rows = store.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (rows.some((row) => row.name === column)) return;
  store.exec(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT`);
}

/** The git common directory belongs to the main checkout even in a linked worktree. */
export function telemetryProjectRoot(cwd: string): string {
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (common && path.isAbsolute(common)) return path.dirname(common);
  } catch {
    // Scratch directories use the same project-root discovery as the rest of the harness.
  }
  return findProjectRoot(cwd);
}

export function telemetryPath(): string {
  if (process.env.PI_BUILD_TELEMETRY_DB) return process.env.PI_BUILD_TELEMETRY_DB;
  const dir = process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");
  return path.join(dir, "telemetry.db");
}

function database(): Db | null {
  const state = bag();
  if (state.dbFailed) return null;
  if (state.db) return state.db;
  try {
    const file = telemetryPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const opened = new DatabaseSync(file);
    opened.exec(SCHEMA);
    ensureColumn(opened, "tool_calls", "parent_turn_id");
    ensureColumn(opened, "inference_calls", "parent_turn_id");
    for (const column of ["tool_call_id", "project_root", "subagent_role"]) ensureColumn(opened, "tool_calls", column);
    for (const column of ["project_root", "subagent_role"]) ensureColumn(opened, "inference_calls", column);
    state.db = opened;
    return state.db;
  } catch (err) {
    state.dbFailed = true;
    console.error("[telemetry] database unavailable", err);
    return null;
  }
}

export function resetTelemetryForTests(): void {
  const g = globalThis as typeof globalThis & { [TELEMETRY_KEY]?: TelemetryBag };
  g[TELEMETRY_KEY] = freshBag();
}

export function annotateCall(toolCallId: string, patch: Partial<ToolCallRow>): void {
  const annotations = bag().annotations;
  annotations.set(toolCallId, { ...annotations.get(toolCallId), ...patch });
}

export function recordToolCall(row: ToolCallRow): void {
  const recordedIds = bag().recordedIds;
  if (row.toolCallId && recordedIds.has(row.toolCallId)) return;
  if (row.toolCallId) recordedIds.add(row.toolCallId);
  const snap = turnSnapshot();
  const store = database();
  if (!store) return;
  try {
    store
      .prepare(
        `INSERT INTO tool_calls
          (ts, session_id, turn_id, loop_index, tool_name, arguments, path, result_bytes, elapsed_ms, outcome, blocked_by, parent_turn_id, tool_call_id, project_root, subagent_role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        Date.now(),
        snap.sessionId,
        snap.turnId,
        snap.loopIndex,
        row.toolName,
        JSON.stringify(row.arguments ?? {}),
        row.path ?? null,
        row.resultBytes ?? null,
        row.elapsedMs ?? null,
        row.outcome,
        row.blockedBy ?? null,
        currentParentTurnId(),
        row.toolCallId ?? null,
        bag().projectRoot,
        bag().subagentRole,
      );
  } catch (err) {
    console.error("[telemetry] tool_calls insert failed", err);
  }
}

interface TurnUsage {
  calls: number;
  prompt: number;
  cached: number;
  completion: number;
  reasoning: number;
  cost: number;
}

function addTurnUsage(row: InferenceRow): void {
  const turnUsage = bag().turnUsage;
  turnUsage.calls += 1;
  turnUsage.prompt += row.promptTokens ?? 0;
  turnUsage.cached += row.cachedTokens ?? 0;
  turnUsage.completion += row.completionTokens ?? 0;
  turnUsage.reasoning += row.reasoningTokens ?? 0;
  turnUsage.cost += row.costUsd ?? 0;
}

/** One line for the session log. A second call in the same turn returns null. */
export function consumeTurnCostLine(tier: string): string | null {
  const state = bag();
  if (state.turnReported) return null;
  state.turnReported = true;
  const turnUsage = state.turnUsage;
  const cache = turnUsage.prompt > 0 ? (100 * turnUsage.cached) / turnUsage.prompt : 0;
  const reasoning = turnUsage.completion > 0 ? (100 * turnUsage.reasoning) / turnUsage.completion : 0;
  state.sessionCost += turnUsage.cost;
  const line = `[cost] tier=${tier} calls=${turnUsage.calls} prompt=${turnUsage.prompt} cache=${cache.toFixed(1)}% completion=${turnUsage.completion} reasoning=${reasoning.toFixed(1)}% turn=$${turnUsage.cost.toFixed(4)} session=$${state.sessionCost.toFixed(4)}`;
  state.turnUsage = emptyUsage();
  return line;
}

export function resolvedResultBytes(annotation: { resultBytes?: number | null } | undefined, content: unknown): number {
  if (annotation && typeof annotation.resultBytes === "number") return annotation.resultBytes;
  return textOf(content).length;
}

export function recordInference(row: InferenceRow): void {
  addTurnUsage(row);
  const snap = turnSnapshot();
  const store = database();
  if (!store) return;
  try {
    store
      .prepare(
        `INSERT INTO inference_calls
          (ts, session_id, turn_id, loop_index, tier, model, prompt_tokens, cached_tokens, completion_tokens, reasoning_tokens, ttft_ms, elapsed_ms, cost_usd, parent_turn_id, project_root, subagent_role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        Date.now(),
        snap.sessionId,
        snap.turnId,
        snap.loopIndex,
        row.tier,
        row.model,
        row.promptTokens ?? null,
        row.cachedTokens ?? null,
        row.completionTokens ?? null,
        row.reasoningTokens ?? null,
        row.ttftMs ?? null,
        row.elapsedMs ?? null,
        row.costUsd ?? null,
        currentParentTurnId(),
        bag().projectRoot,
        bag().subagentRole,
      );
  } catch (err) {
    console.error("[telemetry] inference_calls insert failed", err);
  }
}

export interface TelemetryHost {
  on(event: string, handler: (event: Record<string, unknown>, ctx: Record<string, unknown>) => void | Promise<void>): void;
}

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const text = (block as { text?: string }).text;
      return typeof text === "string" ? text : "";
    })
    .join("\n");
}

function pathOf(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  for (const key of ["path", "target_file", "file_path"]) {
    if (typeof record[key] === "string") return record[key];
  }
  return null;
}

export function setActiveTier(tier: string, model: string): void {
  const state = bag();
  state.activeTier = tier;
  state.activeModel = model;
}

/**
 * pi-smart-router records its decision tier in `.pi-smart-router/state.db`.
 * This process copies that tier when it has not selected one itself.
 */
export function readSmartRouterTier(cwd: string): string | null {
  const dbPath = path.join(cwd, ".pi-smart-router", "state.db");
  if (!fs.existsSync(dbPath)) return null;
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const row = db.prepare("SELECT tier FROM dataset ORDER BY id DESC LIMIT 1").get() as { tier?: unknown } | undefined;
    const tier = row?.tier;
    return typeof tier === "string" && tier.length > 0 ? tier : null;
  } catch {
    return null;
  } finally {
    try {
      db?.close();
    } catch {
      // A locked router database must not take the inference row down.
    }
  }
}

export function activeTierName(): string {
  return bag().activeTier;
}

const HOOK_WRAP = Symbol.for("pi-build.hook-wrap");

/** Streaming deltas are not context rewrites. Leave them off the trace. */
const TRACED_EVENTS = new Set([
  "before_agent_start",
  "context",
  "context_with_system",
  "tool_result",
  "tool_call",
  "session_compact",
  "session_before_compact",
  "session_start",
  "session_shutdown",
  "agent_end",
  "agent_start",
  "turn_end",
  "turn_start",
  "message_end",
  "message_start",
  "input",
  "before_provider_request",
  "tool_execution_start",
]);

function byteSize(value: unknown): number {
  if (typeof value === "string") return value.length;
  if (value == null) return 0;
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

function sectionSizes(event: Record<string, unknown>): Map<string, number> {
  const options = event.systemPromptOptions;
  const sections =
    options && typeof options === "object"
      ? (options as { sections?: Record<string, unknown> }).sections
      : undefined;
  const sizes = new Map<string, number>();
  if (!sections || typeof sections !== "object") return sizes;
  for (const [key, value] of Object.entries(sections)) sizes.set(key, byteSize(value));
  return sizes;
}

function changedSectionKeys(before: Map<string, number>, after: Map<string, number>): string {
  const keys = new Set([...before.keys(), ...after.keys()]);
  const changed: string[] = [];
  for (const key of keys) {
    if ((before.get(key) ?? -1) !== (after.get(key) ?? -1)) changed.push(key);
  }
  changed.sort();
  return changed.join(",");
}

interface HookMeasure {
  key: string;
  bytes: number;
  sections?: Map<string, number>;
}

function measureHook(eventName: string, event: Record<string, unknown>): HookMeasure {
  if (eventName === "before_agent_start") {
    const sections = sectionSizes(event);
    const bytes = [...sections.values()].reduce((sum, value) => sum + value, 0);
    const key = [...sections.keys()].sort().join(",") || "(none)";
    return { key, bytes, sections };
  }
  if (eventName === "tool_call" || eventName === "tool_result" || eventName === "tool_execution_start") {
    const key = typeof event.toolName === "string" ? event.toolName : "(tool)";
    const payload = eventName === "tool_call" ? event.input : eventName === "tool_result" ? event.content : event.args;
    return { key, bytes: byteSize(payload) };
  }
  if (eventName === "context" || eventName === "context_with_system") {
    return { key: "messages", bytes: byteSize(event.messages) };
  }
  if (eventName === "message_end" || eventName === "message_start") {
    const message = event.message as { content?: unknown } | undefined;
    return { key: "message", bytes: byteSize(message?.content ?? "") };
  }
  return { key: eventName, bytes: byteSize(event.type ?? eventName) };
}

/** Our extensions set this around their handlers. Anything else is a third-party touch. */
export function declareHookExtension(name: string): void {
  bag().lastDeclaredHook = name;
}

export function recordHookTouch(row: {
  event: string;
  extension: string;
  seq: number;
  key: string;
  bytesBefore: number;
  bytesAfter: number;
}): void {
  const snap = turnSnapshot();
  const store = database();
  if (!store) return;
  try {
    store
      .prepare(
        `INSERT INTO hook_touches
          (ts, session_id, turn_id, event, extension, seq, key_or_tool, bytes_before, bytes_after)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(Date.now(), snap.sessionId, snap.turnId, row.event, row.extension, row.seq, row.key, row.bytesBefore, row.bytesAfter);
  } catch (err) {
    console.error("[telemetry] hook_touches insert failed", err);
  }
}

type HookHandler = (event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown;

/** One row for this handler. A handler that did not declare a name is `unknown:<seq>`. */
export async function runTracedHook(
  eventName: string,
  handler: HookHandler,
  event: Record<string, unknown>,
  ctx: Record<string, unknown> = {},
): Promise<unknown> {
  const state = bag();
  state.lastDeclaredHook = "";
  const before = measureHook(eventName, event);
  const seq = state.hookSeq + 1;
  state.hookSeq = seq;
  let result: unknown;
  let thrown: unknown;
  try {
    result = await handler(event, ctx);
  } catch (err) {
    thrown = err;
  }
  const after = measureHook(eventName, event);
  let key = after.key || before.key;
  if (eventName === "before_agent_start" && before.sections && after.sections) {
    key = changedSectionKeys(before.sections, after.sections) || before.key;
  }
  const extension = state.lastDeclaredHook || `unknown:${seq}`;
  state.lastDeclaredHook = "";
  recordHookTouch({ event: eventName, extension, seq, key, bytesBefore: before.bytes, bytesAfter: after.bytes });
  if (thrown) throw thrown;
  return result;
}

const HOOK_PATCH = Symbol.for("pi-build.hook-patch");

function hookPatch(): { patched: boolean; traced: WeakMap<HookHandler, HookHandler> } {
  const g = globalThis as typeof globalThis & {
    [HOOK_PATCH]?: { patched: boolean; traced: WeakMap<HookHandler, HookHandler> };
  };
  if (!g[HOOK_PATCH]) g[HOOK_PATCH] = { patched: false, traced: new WeakMap() };
  return g[HOOK_PATCH];
}

function traceHandler(handler: HookHandler, eventName: string): HookHandler {
  const traced = hookPatch().traced;
  const existing = traced.get(handler);
  if (existing) return existing;
  const wrapped: HookHandler = (event, ctx) => runTracedHook(eventName, handler, event, ctx);
  traced.set(handler, wrapped);
  return wrapped;
}

/**
 * The runner reads each extension's handler list through Map.get inside
 * snapshotEventHandlers. Wrapping that read names every touch. Our extensions
 * declare a name; the rest are unknown:<seq>.
 * jiti loads this file once per extension, so the patch flag lives on the process global.
 */
function installHookMapPatch(): void {
  const patch = hookPatch();
  if (patch.patched) return;
  patch.patched = true;
  const original = Map.prototype.get;
  Map.prototype.get = function (key: unknown) {
    const value = original.call(this, key);
    if (typeof key !== "string" || !TRACED_EVENTS.has(key) || !Array.isArray(value) || value.length === 0) return value;
    if (!value.every((item) => typeof item === "function")) return value;
    const stack = new Error().stack ?? "";
    if (!stack.includes("snapshotEventHandlers")) return value;
    return value.map((handler) => traceHandler(handler as HookHandler, key));
  };
}

function wrapExtensionOn(pi: TelemetryHost, extensionName: string): void {
  const host = pi as TelemetryHost & { [HOOK_WRAP]?: boolean; on: TelemetryHost["on"] };
  if (host[HOOK_WRAP]) return;
  host[HOOK_WRAP] = true;
  const original = host.on.bind(host);
  host.on = (event, handler) => {
    const named: HookHandler = (eventObj, ctx) => {
      declareHookExtension(extensionName);
      return handler(eventObj, ctx);
    };
    return original(event, named);
  };
}

/**
 * One process-wide listener. Later calls are no-ops so every extension can try to attach.
 * The flag is on the process global because each extension loads its own copy of this file.
 * Each caller still names its own handlers. Third-party handlers stay unknown:<seq>.
 */
export function attachTelemetry(pi: TelemetryHost, extensionName = "unnamed"): void {
  // The router writes dataset.tier only when this is set. The inference row copies that tier.
  process.env.SMART_ROUTER_DATASET = "1";
  wrapExtensionOn(pi, extensionName);
  installHookMapPatch();
  const state = bag();
  if (state.attached) return;
  state.attached = true;
  try {
    pi.on("agent_start", (_event, ctx) => {
      const state = bag();
      state.projectRoot = telemetryProjectRoot(typeof ctx.cwd === "string" ? ctx.cwd : process.cwd());
      const turn = state.turn;
      const session = sessionIdOf(ctx);
      if (turn.sessionId !== session || !turn.turnId) beginUserTurn(session, turn.prompt);
    });
    pi.on("message_start", (event) => {
      const message = event.message as { role?: string; id?: string } | undefined;
      if (message?.role === "assistant" && message.id) bag().messageStarted.set(message.id, Date.now());
    });
    pi.on("message_update", (event) => {
      const message = event.message as { role?: string; id?: string } | undefined;
      const messageStarted = bag().messageStarted;
      if (message?.role === "assistant" && message.id && messageStarted.has(message.id)) {
        const started = messageStarted.get(message.id)!;
        if (started > 0) messageStarted.set(message.id, -started);
      }
    });
    pi.on("message_end", (event, ctx) => {
      const message = event.message as {
        role?: string;
        id?: string;
        usage?: {
          input?: number;
          output?: number;
          cacheRead?: number;
          reasoning?: number;
          cost?: { total?: number };
        };
        model?: string;
      } | undefined;
      if (!message || message.role !== "assistant") return;
      const current = bag();
      if (!current.turn.sessionId) beginUserTurn(sessionIdOf(ctx), current.turn.prompt);
      const loop = bumpLoopIndex();
      const usage = message.usage ?? {};
      let ttft: number | null = null;
      const messageStarted = bag().messageStarted;
      if (message.id && messageStarted.has(message.id)) {
        const mark = messageStarted.get(message.id)!;
        const origin = Math.abs(mark);
        if (mark < 0) ttft = Date.now() - origin;
        messageStarted.delete(message.id);
      }
      const after = bag();
      let tier = after.activeTier;
      if (tier === "unassigned") {
        const routed = readSmartRouterTier(process.cwd());
        if (routed) {
          setActiveTier(routed, message.model || after.activeModel || "");
          tier = routed;
        }
      }
      recordInference({
        tier,
        model: message.model || after.activeModel || "unknown",
        promptTokens: usage.input ?? null,
        cachedTokens: usage.cacheRead ?? null,
        completionTokens: usage.output ?? null,
        reasoningTokens: usage.reasoning ?? null,
        ttftMs: ttft,
        elapsedMs: turnSnapshot().elapsedMs,
        costUsd: usage.cost?.total ?? null,
      });
      void loop;
    });
    pi.on("tool_call", (event) => {
      const name = stringField(event, "toolName");
      if (name) markParentTurnForDispatch(name);
    });
    pi.on("tool_execution_start", (event) => {
      const id = stringField(event, "toolCallId");
      if (id) bag().startedAt.set(id, Date.now());
    });
    pi.on("tool_result", (event) => {
      const id = stringField(event, "toolCallId");
      const name = stringField(event, "toolName") || "unknown";
      const input = event.input;
      const state = bag();
      const annotation = id ? state.annotations.get(id) : undefined;
      const isError = event.isError === true && annotation?.outcome !== "blocked" && annotation?.outcome !== "deduped";
      const outcome = annotation?.outcome ?? (isError ? "error" : "success");
      const filePath = annotation?.path ?? pathOf(input);
      noteToolOutcome(outcome === "error", countsAsRead(name, outcome), countsAsEdit(name));
      const started = id ? state.startedAt.get(id) : undefined;
      recordToolCall({
        toolCallId: id,
        toolName: name,
        arguments: input ?? {},
        path: filePath,
        resultBytes: resolvedResultBytes(annotation, event.content),
        elapsedMs: started ? Date.now() - started : null,
        outcome,
        blockedBy: annotation?.blockedBy ?? null,
      });
    });
    pi.on("turn_end", () => {
      const line = consumeTurnCostLine(bag().activeTier);
      if (line) console.error(line);
    });
  } catch (err) {
    console.error("[telemetry] attach failed", err);
  }
}

function sessionIdOf(ctx: Record<string, unknown>): string {
  const manager = ctx.sessionManager as { getSessionId?: () => string } | undefined;
  try {
    return manager?.getSessionId?.() || "unknown";
  } catch {
    return "unknown";
  }
}

function stringField(event: Record<string, unknown>, key: string): string | undefined {
  const value = event[key];
  return typeof value === "string" ? value : undefined;
}

export function shouldWriteSessionRecap(
  reason: string,
  sawAbort: boolean,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (explainOneShot(env)) return false;
  return reason === "quit" || sawAbort;
}

export function explainCommand(prompt: string, model?: string): { bin: string; args: string[] } {
  const args = ["--mode", "json", "--no-session"];
  if (model) args.push("--model", model);
  args.push("--thinking", "off", "--tools", "read", "-p", prompt);
  return { bin: "pi", args };
}

/** An open stdin makes the one-shot wait forever and never call its model. */
export const explainStdio = ["ignore", "pipe", "pipe"] as const;

/** execFile never closes stdin, and it ignores a stdio override. */
export function explainExec(
  command: { bin: string; args: string[] },
  options: { cwd: string; env: NodeJS.ProcessEnv; timeout: number; maxBuffer?: number },
): Promise<{ stdout: string; stderr: string }> {
  const maxBuffer = options.maxBuffer ?? 8_000_000;
  return new Promise((resolve, reject) => {
    const child = spawn(command.bin, command.args, {
      cwd: options.cwd,
      env: options.env,
      stdio: [...explainStdio],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutLen = 0;
    let stderrLen = 0;
    let settled = false;
    const timer = setTimeout(() => child.kill("SIGTERM"), options.timeout);
    const finish = (err: Error | null, out = "", errText = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve({ stdout: out, stderr: errText });
    };
    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutLen += chunk.length;
      if (stdoutLen <= maxBuffer) stdout.push(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrLen += chunk.length;
      if (stderrLen <= maxBuffer) stderr.push(chunk);
    });
    child.on("error", (err) => finish(err));
    child.on("exit", (code, signal) => {
      const out = Buffer.concat(stdout).toString("utf8");
      const errText = Buffer.concat(stderr).toString("utf8");
      if (code === 0 && !signal) finish(null, out, errText);
      else finish(new Error(`Command failed: ${command.bin} ${command.args.join(" ")}\n${errText}`));
    });
  });
}

/** The explain/recap process keeps the model it was given. It is not a trial row. */
export function explainOneShot(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PI_BUILD_EXPLAIN_ONESHOT === "1";
}

/**
 * The child writes to the default ledger, not the trial database.
 * `PI_BUILD_PARENT_TURN` is this process's turn, so the child's rows join here
 * instead of opening a second root. An inherited grandparent id is replaced.
 */
export function explainSpawnEnv(base: NodeJS.ProcessEnv = process.env, role = "explain"): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base, PI_BUILD_EXPLAIN_ONESHOT: "1", PI_BUILD_SUBAGENT_ROLE: role };
  delete env.PI_BUILD_TELEMETRY_DB;
  delete env.PI_OFFLINE;
  for (const key of Object.keys(env)) {
    if (key.startsWith("PI_SUBAGENT_")) delete env[key];
  }
  const parent = turnSnapshot().turnId.trim();
  if (parent) env.PI_BUILD_PARENT_TURN = parent;
  else delete env.PI_BUILD_PARENT_TURN;
  return env;
}

export function mergeKnown(existing: string, entries: string[]): string {
  const seen = new Set(
    existing
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const added: string[] = [];
  for (const entry of entries) {
    const line = entry.trim();
    if (!line || seen.has(line)) continue;
    seen.add(line);
    added.push(line);
  }
  if (added.length === 0) return existing;
  const base = existing.replace(/\s*$/, "");
  return `${base}${base ? "\n" : ""}${added.join("\n")}\n`;
}

export function knownEntriesFromExplanation(body: string): string[] {
  const lines: string[] = [];
  for (const line of body.split("\n")) {
    const match = line.match(/^known:\s*(.+)$/i);
    if (match) lines.push(match[1].trim());
  }
  return lines;
}

export interface TierAnswers {
  single_file_edit: boolean;
  needs_repo_reasoning: boolean;
  unfamiliar_stack: boolean;
  spec_exists: boolean;
  reversible: boolean;
}

/** A spec that can be undone is work, including a multi-file spec. Repo reasoning still escalates. */
export function selectTier(answers: TierAnswers): "work" | "escalate" {
  if (answers.needs_repo_reasoning || answers.unfamiliar_stack) return "escalate";
  if (answers.spec_exists && answers.reversible) return "work";
  return "escalate";
}

export interface BoundConfig {
  maxTurnPromptTokens: number;
  maxTurnCostUsd: number;
}

export const DEFAULT_BOUNDS: BoundConfig = {
  maxTurnPromptTokens: 50_000_000,
  maxTurnCostUsd: 30,
};

export function boundReason(snapshot: BoundSnapshot, config: BoundConfig = DEFAULT_BOUNDS): string | null {
  const promptTokens = snapshot.promptTokens ?? 0;
  const costUsd = snapshot.costUsd ?? 0;
  if (promptTokens >= config.maxTurnPromptTokens) {
    return `max turn prompt tokens ${promptTokens} >= ${config.maxTurnPromptTokens}`;
  }
  if (costUsd >= config.maxTurnCostUsd) {
    return `max turn cost ${costUsd} >= ${config.maxTurnCostUsd}`;
  }
  return null;
}
