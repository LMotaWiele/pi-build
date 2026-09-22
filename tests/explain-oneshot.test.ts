import assert from "node:assert/strict";
import test from "node:test";
import { explainAfterTurn } from "../extensions/explain.ts";
import { explainExec, explainOneShot, explainSpawnEnv, explainStdio, shouldWriteSessionRecap } from "../lib/telemetry.ts";

test("an explain one-shot keeps its model and stays out of the trial ledger", () => {
  const env = explainSpawnEnv({
    PI_BUILD_TELEMETRY_DB: "/tmp/trial.db",
    PI_BUILD_PARENT_TURN: "parent",
    PI_SUBAGENT_DEPTH: "1",
    PI_SUBAGENT_STACK: "[\"implement\"]",
    PI_SUBAGENT_MAX_DEPTH: "2",
    PI_OFFLINE: "1",
    PATH: "/usr/bin",
  });
  assert.equal(env.PI_BUILD_EXPLAIN_ONESHOT, "1");
  assert.equal(env.PATH, "/usr/bin");
  assert.equal("PI_BUILD_TELEMETRY_DB" in env, false);
  assert.equal("PI_BUILD_PARENT_TURN" in env, false);
  assert.equal("PI_SUBAGENT_DEPTH" in env, false);
  assert.equal("PI_SUBAGENT_STACK" in env, false);
  assert.equal("PI_SUBAGENT_MAX_DEPTH" in env, false);
  assert.equal("PI_OFFLINE" in env, false);
  assert.equal(explainOneShot(env), true);
  assert.equal(explainOneShot({}), false);
  assert.deepEqual(explainStdio, ["ignore", "pipe", "pipe"]);
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
