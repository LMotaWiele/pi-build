import assert from "node:assert/strict";
import test from "node:test";
import { ReadGuard, renderRepeat } from "../extensions/read-guard.ts";
import {
  beginUserTurn,
  boundReason,
  contextEpoch,
  countsAsEdit,
  countsAsRead,
  noteToolOutcome,
  resetEpochForTests,
  resetTelemetryForTests,
  turnSnapshot,
} from "../lib/telemetry.ts";

test("repeat read with no write returns a pointer", () => {
  resetEpochForTests();
  const guard = new ReadGuard();
  const first = guard.decide({ path: "a.ts" });
  assert.equal(first.action, "pass");
  guard.recordRead("a.ts", "one\n");
  const second = guard.decide({ path: "a.ts" });
  assert.equal(second.action, "pointer");
  assert.match(second.pointer ?? "", /call 1/);
});

test("read write read returns a diff, and a large rewrite returns the file", () => {
  resetEpochForTests();
  const guard = new ReadGuard();
  guard.decide({ path: "a.ts" });
  guard.recordRead("a.ts", "alpha\nbeta\n");
  guard.recordWrite("a.ts");
  const again = guard.decide({ path: "a.ts" });
  assert.equal(again.action, "diff");
  const before = Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n");
  const small = renderRepeat("a.ts", before, before.replace("line 3", "line THREE"));
  assert.equal(small.kind, "diff");
  assert.match(small.text, /THREE/);
  const rewritten = "z\n".repeat(4);
  const large = renderRepeat("a.ts", "alpha\n".repeat(30), rewritten);
  assert.equal(large.kind, "full");
  assert.equal(large.text, rewritten);
});

test("compaction signal lets the next read pass through", () => {
  resetEpochForTests();
  const guard = new ReadGuard();
  assert.equal(contextEpoch(), 0);
  guard.decide({ path: "a.ts" });
  guard.recordRead("a.ts", "body\n");
  guard.onCompaction();
  const after = guard.decide({ path: "a.ts" });
  assert.equal(after.action, "pass");
  assert.ok(contextEpoch() >= 1);
});

test("range reads are never suppressed and a disabled guard passes everything", () => {
  resetEpochForTests();
  const guard = new ReadGuard();
  guard.decide({ path: "a.ts" });
  guard.recordRead("a.ts", "body\n");
  assert.equal(guard.decide({ path: "a.ts", offset: 10 }).action, "range");
  assert.equal(guard.decide({ path: "a.ts", limit: 20 }).action, "range");
  guard.enabled = false;
  assert.equal(guard.decide({ path: "a.ts" }).action, "pass");
  guard.onNewPrompt();
  guard.enabled = true;
  assert.equal(guard.decide({ path: "a.ts" }).action, "pass");
});

test("a deduped read does not move reads; a passed read does", () => {
  resetTelemetryForTests();
  beginUserTurn("s", "p");
  noteToolOutcome(false, countsAsRead("read", "deduped"), countsAsEdit("read"));
  assert.equal(turnSnapshot().reads, 0);
  noteToolOutcome(false, countsAsRead("read", "success"), countsAsEdit("read"));
  assert.equal(turnSnapshot().reads, 1);
  assert.equal(turnSnapshot().edits, 0);
  resetTelemetryForTests();
});

test("bounds fire on the configured backstops", () => {
  const base = { sessionId: "s", turnId: "t", loopIndex: 1, elapsedMs: 1, consecutiveFailures: 0, reads: 0, edits: 0 };
  assert.equal(boundReason({ ...base, loopIndex: 60 }), "max loop depth 60 (loop_index 60)");
  assert.match(boundReason({ ...base, elapsedMs: 600_000 }) ?? "", /wall clock/);
  assert.match(boundReason({ ...base, consecutiveFailures: 3 }) ?? "", /consecutive/);
  assert.match(boundReason({ ...base, reads: 6, edits: 0 }) ?? "", /no progress/);
  assert.equal(boundReason({ ...base, reads: 6, edits: 1 }), null);
});
