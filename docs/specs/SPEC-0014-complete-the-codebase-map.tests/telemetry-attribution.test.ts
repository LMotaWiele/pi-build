// M0: every telemetry row carries its project root, tool call id and subagent role,
// and explain files name the turn that produced them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import * as telemetry from "../../../lib/telemetry.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = resolve(here, "../../../tools/map/fixtures/telemetry.db");

function freshDb(): string {
  const db = join(mkdtempSync(join(tmpdir(), "m0-db-")), "telemetry.db");
  copyFileSync(SNAPSHOT, db);
  return db;
}

function query(db: string, sql: string): any[] {
  const c = new DatabaseSync(db);
  try {
    return c.prepare(sql).all() as any[];
  } finally {
    c.close();
  }
}

const columns = (db: string, table: string) => query(db, `pragma table_info(${table})`).map((r) => r.name);
const count = (db: string, table: string) => Number(query(db, `select count(*) as n from ${table}`)[0].n);

function projectRepo(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "m0-repo-")));
  writeFileSync(join(dir, "AGENTS.md"), "# fixture\n");
  mkdirSync(join(dir, "src"));
  return dir;
}

async function startTurn(db: string, cwd: string, env: Record<string, string> = {}): Promise<void> {
  process.env.PI_BUILD_TELEMETRY_DB = db;
  delete process.env.PI_BUILD_PARENT_TURN;
  delete process.env.PI_BUILD_SUBAGENT_ROLE;
  Object.assign(process.env, env);
  telemetry.resetTelemetryForTests(); // the bag is created here and captures the environment
  const handlers: Record<string, Function[]> = {};
  telemetry.attachTelemetry({ on: (e: string, h: Function) => (handlers[e] ??= []).push(h) } as any, "spec-test");
  for (const h of handlers.agent_start ?? []) await h({}, { cwd, sessionManager: { getSessionId: () => "s-m0" } });
}

function toolRow(id: string) {
  telemetry.recordToolCall({ toolCallId: id, toolName: "read", arguments: {}, path: "src/a.ts", outcome: "success" });
}

test("opening a pre-M0 database adds the columns and keeps every row", async () => {
  const db = freshDb();
  const tools = count(db, "tool_calls");
  const infs = count(db, "inference_calls");
  await startTurn(db, projectRepo());
  toolRow("c-migrate");
  for (const col of ["tool_call_id", "project_root", "subagent_role", "parent_turn_id"]) {
    assert.ok(columns(db, "tool_calls").includes(col), `tool_calls.${col}`);
  }
  for (const col of ["project_root", "subagent_role", "parent_turn_id"]) {
    assert.ok(columns(db, "inference_calls").includes(col), `inference_calls.${col}`);
  }
  assert.equal(count(db, "tool_calls"), tools + 1);
  assert.equal(count(db, "inference_calls"), infs);
});

test("rows carry the project root found from the turn's working directory, and the tool call id", async () => {
  const db = freshDb();
  const repo = projectRepo();
  await startTurn(db, join(repo, "src"));
  toolRow("c-root");
  telemetry.recordInference({ tier: "work", model: "m" });
  const tool = query(db, "select project_root, tool_call_id from tool_calls order by id desc limit 1")[0];
  const inf = query(db, "select project_root from inference_calls order by id desc limit 1")[0];
  assert.equal(tool.project_root, repo);
  assert.equal(tool.tool_call_id, "c-root");
  assert.equal(inf.project_root, repo);
});

test("a subagent role in the environment at startup is written on every row; none is null", async () => {
  const db = freshDb();
  await startTurn(db, projectRepo(), { PI_BUILD_SUBAGENT_ROLE: "explain" });
  toolRow("c-role");
  telemetry.recordInference({ tier: "scout", model: "m" });
  assert.equal(query(db, "select subagent_role from tool_calls order by id desc limit 1")[0].subagent_role, "explain");
  assert.equal(query(db, "select subagent_role from inference_calls order by id desc limit 1")[0].subagent_role, "explain");

  const plain = freshDb();
  await startTurn(plain, projectRepo());
  toolRow("c-norole");
  assert.equal(query(plain, "select subagent_role from tool_calls order by id desc limit 1")[0].subagent_role, null);
});

test("explain and recap children are spawned with their role", () => {
  assert.equal(telemetry.explainSpawnEnv({}).PI_BUILD_SUBAGENT_ROLE, "explain");
  assert.equal((telemetry.explainSpawnEnv as any)({}, "recap").PI_BUILD_SUBAGENT_ROLE, "recap");
});

test("inside a git worktree, the project root is the repository's main working tree", async () => {
  const repo = projectRepo();
  const git = (args: string[], cwd: string) => execFileSync("git", args, { cwd, stdio: "ignore" });
  git(["init", "-q"], repo);
  git(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init"], repo);
  const work = join(realpathSync(mkdtempSync(join(tmpdir(), "m0-wt-"))), "work");
  git(["worktree", "add", "-q", "--detach", work], repo);
  const db = freshDb();
  await startTurn(db, work);
  toolRow("c-worktree");
  assert.equal(query(db, "select project_root from tool_calls order by id desc limit 1")[0].project_root, repo);
});
