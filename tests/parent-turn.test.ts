import assert from "node:assert/strict";
import test from "node:test";
import {
  beginUserTurn,
  currentParentTurnId,
  markParentTurnForDispatch,
  resetTelemetryForTests,
  turnSnapshot,
} from "../lib/telemetry.ts";

const KEY = "PI_BUILD_PARENT_TURN";

function isolate(): void {
  resetTelemetryForTests();
  delete process.env[KEY];
}

test("a root publishes its turn and does not record itself as parent", () => {
  isolate();
  beginUserTurn("s", "p");
  const own = turnSnapshot().turnId;
  assert.equal(process.env[KEY], own);
  assert.equal(currentParentTurnId(), null);
  markParentTurnForDispatch("subagent");
  assert.equal(currentParentTurnId(), null);
  assert.equal(process.env[KEY], own);
  markParentTurnForDispatch("bash");
  assert.equal(process.env[KEY], own);
});

test("a depth-0 process that inherited a turn keeps it after dispatch", () => {
  isolate();
  process.env[KEY] = "outer-turn";
  beginUserTurn("s", "p");
  assert.equal(process.env[KEY], "outer-turn");
  assert.equal(currentParentTurnId(), "outer-turn");
  markParentTurnForDispatch("subagent");
  assert.equal(currentParentTurnId(), "outer-turn");
  assert.equal(process.env[KEY], turnSnapshot().turnId);
});

test("a later prompt on the root publishes the new turn", () => {
  isolate();
  beginUserTurn("s", "one");
  const first = turnSnapshot().turnId;
  beginUserTurn("s", "two");
  assert.notEqual(process.env[KEY], first);
  assert.equal(process.env[KEY], turnSnapshot().turnId);
  assert.equal(currentParentTurnId(), null);
});
