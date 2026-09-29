import { test } from "node:test";
import assert from "node:assert/strict";
import { continueAfterCompaction, MAX_CONTINUES_WITHOUT_EDIT } from "../../../lib/continuation.ts";

test("threshold and manual compaction need nothing: pi continues or the user asked", () => {
  assert.equal(continueAfterCompaction({ reason: "threshold", willRetry: false, failed: false }, 0), "none");
  assert.equal(continueAfterCompaction({ reason: "manual", willRetry: false, failed: false }, 0), "none");
});

test("overflow compaction that pi retries needs nothing", () => {
  assert.equal(continueAfterCompaction({ reason: "overflow", willRetry: true, failed: false }, 0), "none");
});

test("overflow compaction that ends the turn is continued", () => {
  assert.equal(continueAfterCompaction({ reason: "overflow", willRetry: false, failed: false }, 0), "continue");
  assert.equal(continueAfterCompaction({ reason: "overflow", willRetry: true, failed: true }, 1), "continue");
});

test("repeated continues with no file edited in between are a loop", () => {
  assert.equal(MAX_CONTINUES_WITHOUT_EDIT, 3);
  assert.equal(continueAfterCompaction({ reason: "overflow", willRetry: false, failed: false }, 2), "continue");
  assert.equal(continueAfterCompaction({ reason: "overflow", willRetry: false, failed: false }, 3), "stuck");
});
