import { test } from "node:test";
import assert from "node:assert/strict";
import { initialProgress, parseProgressLine, progressSummary, reduceProgress, renderProgress } from "../../../lib/progress.ts";

function state(event: object) {
  const parsed = parseProgressLine(JSON.stringify(event));
  assert.ok(parsed, "valid progress event");
  return reduceProgress(initialProgress("0042"), parsed);
}

test("done accepts optional landed/summaryPath strings and rejects invalid present types", () => {
  const event = { type: "done", ok: true, landed: "main", summaryPath: "/runs/summary.md", runRecord: "r.md" };
  assert.deepEqual(parseProgressLine(JSON.stringify(event)), event);
  for (const field of ["landed", "summaryPath"]) {
    for (const bad of [null, 3, false, {}, []]) {
      assert.equal(parseProgressLine(JSON.stringify({ ...event, [field]: bad })), null, `${field}: ${JSON.stringify(bad)}`);
    }
  }
  for (const stage of ["install", "land"]) {
    assert.deepEqual(parseProgressLine(JSON.stringify({ type: "stage", stage })), { type: "stage", stage });
  }
  assert.equal(parseProgressLine('{"type":"stage","stage":"unknown"}'), null);
});

test("landed output names landing, hides any review-branch label and exposes summary in both render modes", () => {
  const landed = state({ type: "done", ok: true, landed: "main", branch: "deleted-review", runRecord: "r.md",
    summary: "spec pass, plan pass", summaryPath: "/runs/summary.md" });
  for (const text of [progressSummary(landed), renderProgress(landed, true).join("\n"), renderProgress(landed, false).join("\n")]) {
    assert.match(text, /Landed on main/);
    assert.match(text, /Summary: \/runs\/summary\.md/);
    assert.doesNotMatch(text, /Branch:/);
    assert.doesNotMatch(text, /Handed off/);
  }
});

test("kept and failed outcomes retain status and show summaries", () => {
  const kept = state({ type: "done", ok: true, branch: "review", runRecord: "r.md", summaryPath: "/runs/summary.md" });
  for (const text of [progressSummary(kept), renderProgress(kept, true).join("\n")]) {
    assert.match(text, /Handed off/);
    assert.match(text, /Branch: review/);
    assert.match(text, /Run record: r.md/);
    assert.match(text, /Summary: \/runs\/summary\.md/);
  }
  const failed = state({ type: "done", ok: false, summary: "gate failed", summaryPath: "/runs/summary.md" });
  for (const text of [progressSummary(failed), renderProgress(failed, true).join("\n"), renderProgress(failed, false).join("\n")]) {
    assert.match(text, /Summary: \/runs\/summary\.md/);
  }
  assert.match(progressSummary(failed), /Failed/);
});

test("legacy progress without new fields is byte-for-byte unchanged", () => {
  const legacy = state({ type: "done", ok: true, branch: "review", runRecord: "r.md", summary: "all green" });
  assert.equal(progressSummary(legacy), [
    "0042: Handed off (0/0 tasks).", "all green", "Branch: review", "Run record: r.md",
    "Cost: planner $0.00, editor $0.00, integration $0.00, other $0.00, total $0.00.",
  ].join("\n"));
  assert.deepEqual(renderProgress(legacy, false), ["0042 · preflight · 0/0 tasks · $0.00", "all green"]);
  assert.deepEqual(renderProgress(legacy, true), ["0042 · preflight · 0/0 tasks · $0.00", "Handed off", "Branch: review", "Run record: r.md"]);
});
