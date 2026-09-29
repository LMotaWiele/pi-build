// The run, as the chat sees it: child events become progress, progress becomes state,
// state becomes lines on screen and a short summary for the model.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  childEventToProgress, finalText, initialProgress, parseProgressLine,
  progressSummary, reduceProgress, renderProgress, type ProgressEvent,
} from "../../../lib/progress.ts";

const assistant = (content: unknown[], cost = 0) => ({
  type: "message_end",
  message: { role: "assistant", content, usage: { cost: { total: cost } } },
});

test("a child's tool calls become activity lines, and its usage becomes cost for its role", () => {
  const long = "node --experimental-strip-types --test docs/specs/SPEC-0015-x.tests/progress.test.ts && echo done";
  const out = childEventToProgress("editor", "T3", assistant([
    { type: "text", text: "Editing." },
    { type: "toolCall", name: "edit", arguments: { path: "lib/progress.ts" } },
    { type: "toolCall", name: "bash", arguments: { command: long } },
  ], 0.0012));
  assert.deepEqual(out[0], { type: "activity", role: "editor", taskId: "T3", tool: "edit", target: "lib/progress.ts" });
  assert.equal(out[1].type, "activity");
  assert.ok((out[1] as any).target.length <= 80 && long.startsWith((out[1] as any).target.replace(/…$/, "")));
  assert.deepEqual(out[2], { type: "usage", role: "editor", taskId: "T3", cost: 0.0012 });
});

test("notifications a child raises become notices; everything else is ignored", () => {
  assert.deepEqual(
    childEventToProgress("integration", undefined, { type: "extension_ui_request", method: "notify", message: "Paused until 18:05" }),
    [{ type: "notice", text: "Paused until 18:05" }],
  );
  assert.deepEqual(childEventToProgress("editor", "T1", { type: "message_end", message: { role: "user", content: [] } }), []);
  assert.deepEqual(childEventToProgress("editor", "T1", { type: "tool_result_end", message: {} }), []);
  assert.deepEqual(childEventToProgress("editor", "T1", { type: "turn_start" }), []);
});

test("progress lines are parsed strictly: malformed or unknown lines are dropped", () => {
  assert.deepEqual(parseProgressLine('{"type":"stage","stage":"plan"}'), { type: "stage", stage: "plan" });
  assert.equal(parseProgressLine("not json"), null);
  assert.equal(parseProgressLine('{"type":"mystery"}'), null);
  assert.equal(parseProgressLine(""), null);
});

function run(): ReturnType<typeof initialProgress> {
  const events: ProgressEvent[] = [
    { type: "stage", stage: "plan" },
    { type: "usage", role: "planner", cost: 0.5 },
    { type: "stage", stage: "tasks" },
    { type: "task_start", id: "T3", title: "Add progress reducer", model: "gpt-6-luna" },
    { type: "task_start", id: "T4", title: "Render progress", model: "gpt-6-luna" },
    { type: "activity", role: "editor", taskId: "T3", tool: "edit", target: "lib/progress.ts" },
    { type: "usage", role: "editor", taskId: "T3", cost: 0.01 },
    { type: "task_end", id: "T3", pass: true, rounds: 4, cost: 0.003 },
    { type: "task_end", id: "T4", pass: false, rounds: 9, cost: 0.004 },
    { type: "notice", text: "Paused until 18:05" },
    { type: "stage", stage: "integration" },
    { type: "usage", role: "integration", cost: 0.2 },
  ];
  return events.reduce(reduceProgress, initialProgress("SPEC-0015"));
}

test("state follows the run: stage, tasks, the current child's recent activity, cost by role, notices", () => {
  const s = run();
  assert.equal(s.stage, "integration");
  assert.deepEqual(s.tasks.map((t) => [t.id, t.status, t.rounds]), [["T3", "pass", 4], ["T4", "fail", 9]]);
  assert.ok(s.current.recent.some((l) => l.includes("edit") && l.includes("lib/progress.ts")));
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  assert.ok(near(s.cost.planner, 0.5) && near(s.cost.editor, 0.01) && near(s.cost.integration, 0.2) && near(s.cost.total, 0.71));
  assert.deepEqual(s.notices, ["Paused until 18:05"]);
  assert.equal(s.done, null);
});

test("collapsed, the run is two lines at most; expanded, every task and notice is listed", () => {
  const s = run();
  const short = renderProgress(s, false);
  assert.ok(short.length >= 1 && short.length <= 2, short.join("\n"));
  assert.match(short[0], /SPEC-0015/);
  assert.match(short[0], /integration/);
  assert.match(short[0], /1\/2/);
  assert.match(short[0], /\$0\.71/);
  const long = renderProgress(s, true).join("\n");
  for (const want of ["T3", "Add progress reducer", "T4", "Render progress", "Paused until 18:05"]) assert.ok(long.includes(want), want);
});

test("when the run ends, the model gets a short summary with the branch, the run record and the cost split", () => {
  const done = reduceProgress(run(), {
    type: "done", ok: true, branch: "pipeline/SPEC-0015-x-2026", runRecord: "docs/specs/SPEC-0015-run.md", summary: "spec pass, plan pass",
  });
  const text = progressSummary(done);
  for (const want of ["pipeline/SPEC-0015-x-2026", "SPEC-0015-run.md", "spec pass, plan pass", "planner", "integration"]) {
    assert.ok(text.includes(want), want);
  }
  const failed = progressSummary(reduceProgress(run(), { type: "done", ok: false, summary: "gate failed: V3 unmapped" }));
  assert.match(failed, /gate failed: V3 unmapped/);
});

test("a child's final text is recovered from its JSON event log", () => {
  const log = [
    JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "first" }] } }),
    "garbage line",
    JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "Done: " }, { type: "toolCall", name: "x", arguments: {} }, { type: "text", text: "all green." }] } }),
    JSON.stringify({ type: "agent_end" }),
  ].join("\n");
  assert.equal(finalText(log), "Done: all green.");
  assert.equal(finalText(""), "");
});
