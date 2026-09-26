import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { explainAfterTurn } from "../extensions/explain.ts";
import {
  beginUserTurn,
  bumpLoopIndex,
  explainExec,
  explainOneShot,
  explainSpawnEnv,
  explainStdio,
  recordInference,
  recordToolCall,
  resetTelemetryForTests,
  shouldWriteSessionRecap,
  turnSnapshot,
} from "../lib/telemetry.ts";

test("an explain one-shot keeps its model, inherits this turn, and stays out of the trial ledger", () => {
  resetTelemetryForTests();
  const previous = process.env.PI_BUILD_PARENT_TURN;
  delete process.env.PI_BUILD_PARENT_TURN;
  beginUserTurn("s", "p");
  const turnId = turnSnapshot().turnId;
  try {
    const env = explainSpawnEnv({
      PI_BUILD_TELEMETRY_DB: "/tmp/trial.db",
      PI_BUILD_PARENT_TURN: "grandparent",
      PI_SUBAGENT_DEPTH: "1",
      PI_SUBAGENT_STACK: "[\"implement\"]",
      PI_SUBAGENT_MAX_DEPTH: "2",
      PI_OFFLINE: "1",
      PATH: "/usr/bin",
    });
    assert.equal(env.PI_BUILD_EXPLAIN_ONESHOT, "1");
    assert.equal(env.PATH, "/usr/bin");
    assert.equal(env.PI_BUILD_PARENT_TURN, turnId);
    assert.notEqual(env.PI_BUILD_PARENT_TURN, "grandparent");
    assert.equal("PI_BUILD_TELEMETRY_DB" in env, false);
    assert.equal("PI_SUBAGENT_DEPTH" in env, false);
    assert.equal("PI_SUBAGENT_STACK" in env, false);
    assert.equal("PI_SUBAGENT_MAX_DEPTH" in env, false);
    assert.equal("PI_OFFLINE" in env, false);
    assert.equal(explainOneShot(env), true);
    assert.equal(explainOneShot({}), false);
    assert.deepEqual(explainStdio, ["ignore", "pipe", "pipe"]);
  } finally {
    if (previous === undefined) delete process.env.PI_BUILD_PARENT_TURN;
    else process.env.PI_BUILD_PARENT_TURN = previous;
    resetTelemetryForTests();
  }
});

test("rows written under the explain env keep the spawning turn, the child turn, and the loop index", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-build-explain-parent-"));
  const previousDb = process.env.PI_BUILD_TELEMETRY_DB;
  const previousParent = process.env.PI_BUILD_PARENT_TURN;
  process.env.PI_BUILD_TELEMETRY_DB = path.join(dir, "telemetry.db");
  resetTelemetryForTests();
  delete process.env.PI_BUILD_PARENT_TURN;
  beginUserTurn("parent-session", "write a file");
  const parentTurn = turnSnapshot().turnId;
  const env = explainSpawnEnv();
  process.env.PI_BUILD_PARENT_TURN = env.PI_BUILD_PARENT_TURN;
  resetTelemetryForTests();
  beginUserTurn("explain-session", "walkthrough");
  const childTurn = turnSnapshot().turnId;
  bumpLoopIndex();
  recordToolCall({
    toolName: "read",
    arguments: { path: "core/loop.py" },
    path: "core/loop.py",
    outcome: "success",
  });
  recordInference({
    tier: "work",
    model: "gpt-5.6-luna",
    promptTokens: 3,
    cachedTokens: 0,
    completionTokens: 1,
    reasoningTokens: 0,
    costUsd: 0,
  });
  const db = new DatabaseSync(process.env.PI_BUILD_TELEMETRY_DB);
  const tool = db.prepare("SELECT turn_id, loop_index, parent_turn_id FROM tool_calls").all() as {
    turn_id: string;
    loop_index: number;
    parent_turn_id: string;
  }[];
  const inference = db.prepare("SELECT turn_id, loop_index, parent_turn_id FROM inference_calls").all() as {
    turn_id: string;
    loop_index: number;
    parent_turn_id: string;
  }[];
  db.close();
  assert.equal(tool.length, 1);
  assert.equal(tool[0].turn_id, childTurn);
  assert.equal(tool[0].loop_index, 1);
  assert.equal(tool[0].parent_turn_id, parentTurn);
  assert.equal(inference[0].turn_id, childTurn);
  assert.equal(inference[0].loop_index, 1);
  assert.equal(inference[0].parent_turn_id, parentTurn);
  if (previousDb === undefined) delete process.env.PI_BUILD_TELEMETRY_DB;
  else process.env.PI_BUILD_TELEMETRY_DB = previousDb;
  if (previousParent === undefined) delete process.env.PI_BUILD_PARENT_TURN;
  else process.env.PI_BUILD_PARENT_TURN = previousParent;
  resetTelemetryForTests();
});

test("explain exec closes stdin so the child is not left waiting", async () => {
  const result = await explainExec(
    {
      bin: process.execPath,
      args: ["-e", "process.stdin.resume(); process.stdin.on('end', () => process.exit(0)); setTimeout(() => process.exit(2), 800);"],
    },
    { cwd: process.cwd(), env: process.env, timeout: 2000 },
  );
  assert.equal(result.stdout, "");
});

test("a one-shot does not explain or recap itself", () => {
  const env = { PI_BUILD_EXPLAIN_ONESHOT: "1" };
  assert.equal(explainAfterTurn(["a.ts"], false, env), false);
  assert.equal(shouldWriteSessionRecap("quit", false, env), false);
  assert.equal(explainAfterTurn(["a.ts"], false, {}), true);
  assert.equal(shouldWriteSessionRecap("quit", false, {}), true);
  assert.equal(shouldWriteSessionRecap("reload", false, {}), false);
});
