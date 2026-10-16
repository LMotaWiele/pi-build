// Sol and Luna tasks run in dependency order: a Luna task never starts before the Sol tasks it
// depends on (directly or through other tasks). Sol tasks nothing Luna-side needs stay in integration.
import assert from "node:assert/strict";
import test from "node:test";
import { schedulePlan, solTasksPrompt, type Plan } from "../lib/plan.ts";

const task = (id: string, assignee: "luna" | "sol", dependsOn: string[] = []) => ({
  id, assignee, dependsOn, file: `src/${id}.ts`, requirements: [], brief: `do ${id}`, interfaces: [],
  acceptanceTest: assignee === "luna" ? `t/${id}.test.ts` : null,
});
const plan = (tasks: ReturnType<typeof task>[]): Plan => ({ spec: "s.md", verifyMap: {}, requirements: [], tasks });

test("Sol prerequisites run before the Luna task that needs them; the rest wait for integration", () => {
  const p = plan([task("U0a", "sol"), task("U0b", "sol", ["U0a"]), task("L1", "luna", ["U0b"]), task("S9", "sol", ["L1"]), task("L2", "luna")]);
  const s = schedulePlan(p, new Set());
  assert.deepEqual(s.steps, [
    { kind: "sol", ids: ["U0a", "U0b"] },
    { kind: "luna", id: "L1" },
    { kind: "luna", id: "L2" },
  ]);
  assert.deepEqual(s.integration, ["S9"]);
});

test("a Sol prerequisite reached through another Luna task runs once, before the first task that needs it", () => {
  const p = plan([task("U0", "sol"), task("L1", "luna", ["U0"]), task("L2", "luna", ["L1"]), task("U1", "sol", ["L1"]), task("L3", "luna", ["U1", "L2"])]);
  const s = schedulePlan(p, new Set());
  assert.deepEqual(s.steps, [
    { kind: "sol", ids: ["U0"] },
    { kind: "luna", id: "L1" },
    { kind: "luna", id: "L2" },
    { kind: "sol", ids: ["U1"] },
    { kind: "luna", id: "L3" },
  ]);
  assert.deepEqual(s.integration, []);
});

test("on resume, finished Sol tasks are not run again; Luna steps stay so their results are replayed", () => {
  const p = plan([task("U0a", "sol"), task("U0b", "sol"), task("L1", "luna", ["U0a", "U0b"])]);
  assert.deepEqual(schedulePlan(p, new Set(["U0a"])).steps, [{ kind: "sol", ids: ["U0b"] }, { kind: "luna", id: "L1" }]);
  assert.deepEqual(schedulePlan(p, new Set(["U0a", "U0b", "L1"])).steps, [{ kind: "luna", id: "L1" }]);
});

test("a plan without Luna tasks leaves every Sol task to integration, as before", () => {
  const s = schedulePlan(plan([task("A", "sol"), task("B", "sol", ["A"])]), new Set());
  assert.deepEqual(s.steps, []);
  assert.deepEqual(s.integration, ["A", "B"]);
});

test("the Sol step prompt names only its tasks, in order, and says to stop on a contradiction", () => {
  const p = plan([task("U0a", "sol"), task("U0b", "sol"), task("S9", "sol")]);
  const text = solTasksPrompt({ planFile: "docs/specs/S.plan/plan.json", plan: p, ids: ["U0a", "U0b"] });
  assert.ok(text.indexOf("U0a") < text.indexOf("U0b"), "in order");
  assert.ok(text.includes("do U0a") && text.includes("do U0b"), "carries the briefs");
  assert.ok(!text.includes("S9"), "no other task");
  assert.match(text, /docs\/specs\/S\.plan\/plan\.json/);
  assert.match(text, /contradict/i);
  assert.match(text, /acceptance tests|spec tests/i);
});
