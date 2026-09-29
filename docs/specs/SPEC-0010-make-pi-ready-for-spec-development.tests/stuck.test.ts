import { test } from "node:test";
import assert from "node:assert/strict";
import { canonical, detectStuck, normalizeOutput, stuckNudge, stuckResponse, type CallRecord } from "../../../lib/stuck.ts";

const call = (tool: string, input: unknown, output: string, isError = false): CallRecord => ({ tool, input, output, isError });
const failRun = (file: string, out: string) => call("bash", { command: `node --test ${file}` }, out, true);

test("the same failing call three times is stuck", () => {
  const c = failRun("a.test.ts", "1 failed");
  assert.deepEqual(detectStuck([c, c, c]), { pattern: "repeat-error", tool: "bash", count: 3 });
  assert.equal(detectStuck([c, c]), null);
});

test("three different failing commands are normal work, not stuck", () => {
  assert.equal(detectStuck([failRun("a.test.ts", "x"), failRun("b.test.ts", "y"), failRun("c.test.ts", "z")]), null);
});

test("re-running a failing test after an edit, with a different result, is not stuck", () => {
  const edit = call("edit", { path: "a.ts" }, "ok");
  assert.equal(detectStuck([failRun("a.test.ts", "3 failed"), edit, failRun("a.test.ts", "2 failed"), edit, failRun("a.test.ts", "1 failed")]), null);
});

test("the same successful call with the same result four times is stuck", () => {
  const r = call("read", { path: "lib/x.ts" }, "same text");
  assert.equal(detectStuck([r, r, r]), null);
  assert.deepEqual(detectStuck([r, r, r, r]), { pattern: "repeat", tool: "read", count: 4 });
});

test("ping-pong between two calls over six calls is stuck", () => {
  const a = call("read", { path: "a.ts" }, "A");
  const b = call("read", { path: "b.ts" }, "B");
  assert.equal(detectStuck([a, b, a, b, a]), null);
  assert.equal(detectStuck([a, b, a, b, a, b])?.pattern, "alternate");
});

test("argument order never hides a repeat", () => {
  assert.equal(canonical({ b: 1, a: [2, { d: 3, c: 4 }] }), canonical({ a: [2, { c: 4, d: 3 }], b: 1 }));
  const x = call("grep", { pattern: "foo", path: "lib" }, "none", true);
  const y = call("grep", { path: "lib", pattern: "foo" }, "none", true);
  assert.equal(detectStuck([x, y, x])?.pattern, "repeat-error");
});

test("durations and timestamps do not hide a repeat; counts still distinguish results", () => {
  assert.equal(
    normalizeOutput("# fail 1\nduration_ms 12.5\n2026-09-29T10:00:01Z took 40ms"),
    normalizeOutput("# fail 1\nduration_ms 13.9\n2026-09-29T10:03:07Z took 52ms"),
  );
  assert.notEqual(normalizeOutput("# pass 3\n# fail 1"), normalizeOutput("# pass 2\n# fail 2"));
  const t1 = failRun("a.test.ts", "# fail 1\nduration_ms 12.5");
  const t2 = failRun("a.test.ts", "# fail 1\nduration_ms 13.1");
  const t3 = failRun("a.test.ts", "# fail 1\nduration_ms 11.8");
  assert.equal(detectStuck([t1, t2, t3])?.pattern, "repeat-error");
});

test("only the end of the sequence counts: a loop that was broken is not stuck", () => {
  const c = failRun("a.test.ts", "x");
  assert.equal(detectStuck([c, c, c, call("edit", { path: "a.ts" }, "ok")]), null);
});

test("first detection in a turn nudges, any later one escalates", () => {
  assert.equal(stuckResponse(1), "nudge");
  assert.equal(stuckResponse(2), "escalate");
  assert.equal(stuckResponse(5), "escalate");
});

test("the nudge names the tool and the count", () => {
  const n = stuckNudge({ pattern: "repeat-error", tool: "bash", count: 3 });
  assert.match(n, /bash/);
  assert.match(n, /3 times/);
});
