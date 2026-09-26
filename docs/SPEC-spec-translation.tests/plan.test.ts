import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlan, taskOrder, undeclaredImports, type Plan, type PlanTask } from "../../lib/plan.ts";

function task(id: string, over: Partial<PlanTask> = {}): PlanTask {
  return {
    id,
    file: `lib/${id.toLowerCase()}.ts`,
    assignee: "luna",
    requirements: ["R1"],
    brief: "do it",
    interfaces: [],
    acceptanceTest: `docs/SPEC-x.plan/${id}.test.ts`,
    dependsOn: [],
    ...over,
  };
}

function plan(over: Partial<Plan> = {}): Plan {
  return {
    spec: "docs/SPEC-x.md",
    verifyMap: { "1": ["R1"], "2": "process" },
    requirements: [{ id: "R1", text: "r1" }],
    tasks: [task("T1")],
    ...over,
  };
}

const has = (errors: string[], code: string) => errors.some((e) => e.startsWith(code));

test("a complete plan passes", () => {
  assert.deepEqual(validatePlan(plan(), 2), { ok: true, errors: [] });
});

test("every Verify item must be mapped", () => {
  const r = validatePlan(plan(), 3);
  assert.equal(r.ok, false);
  assert.ok(has(r.errors, "UNMAPPED_VERIFY 3"));
});

test("a Verify item may not map to an unknown requirement", () => {
  assert.ok(has(validatePlan(plan({ verifyMap: { "1": ["R9"] } }), 1).errors, "VERIFY_UNKNOWN_REQUIREMENT 1:R9"));
});

test("every requirement must be covered by a task", () => {
  const p = plan({ requirements: [{ id: "R1", text: "" }, { id: "R2", text: "" }] });
  assert.ok(has(validatePlan(p, 2).errors, "UNCOVERED_REQUIREMENT R2"));
});

test("a task may not claim an unknown requirement", () => {
  assert.ok(has(validatePlan(plan({ tasks: [task("T1", { requirements: ["R1", "R7"] })] }), 2).errors, "UNKNOWN_REQUIREMENT T1:R7"));
});

test("a luna task needs an acceptance test; a sol task does not", () => {
  assert.ok(has(validatePlan(plan({ tasks: [task("T1", { acceptanceTest: null })] }), 2).errors, "MISSING_ACCEPTANCE_TEST T1"));
  assert.equal(validatePlan(plan({ tasks: [task("T1", { assignee: "sol", acceptanceTest: null })] }), 2).ok, true);
});

test("a task needs a file", () => {
  assert.ok(has(validatePlan(plan({ tasks: [task("T1", { file: " " })] }), 2).errors, "EMPTY_FILE T1"));
});

test("dependencies must exist and must not cycle", () => {
  assert.ok(has(validatePlan(plan({ tasks: [task("T1", { dependsOn: ["T9"] })] }), 2).errors, "UNKNOWN_DEPENDENCY T1->T9"));
  const cyc = plan({ tasks: [task("T1", { dependsOn: ["T2"] }), task("T2", { dependsOn: ["T1"] })] });
  assert.ok(has(validatePlan(cyc, 2).errors, "CYCLE"));
});

test("two luna tasks on one file must be ordered", () => {
  const same = { file: "lib/shared.ts" };
  const unordered = plan({ tasks: [task("T1", same), task("T2", same)] });
  assert.ok(has(validatePlan(unordered, 2).errors, "UNORDERED_SHARED_FILE T1,T2"));
  const ordered = plan({ tasks: [task("T1", same), task("T2", { ...same, dependsOn: ["T1"] })] });
  assert.equal(validatePlan(ordered, 2).ok, true);
  const transitive = plan({
    tasks: [task("T1", same), task("T2", { dependsOn: ["T1"] }), task("T3", { ...same, dependsOn: ["T2"] })],
  });
  assert.equal(validatePlan(transitive, 2).ok, true);
});

test("task order respects dependencies and keeps plan order on ties", () => {
  const p = plan({ tasks: [task("T1"), task("T2", { dependsOn: ["T3"] }), task("T3")] });
  assert.deepEqual(taskOrder(p), ["T1", "T3", "T2"]);
  const cyc = plan({ tasks: [task("T1", { dependsOn: ["T2"] }), task("T2", { dependsOn: ["T1"] })] });
  assert.throws(() => taskOrder(cyc), /CYCLE/);
});

test("undeclared imports are reported by name, relative specifiers only", () => {
  const src = [
    'import { test } from "node:test";',
    'import assert from "node:assert/strict";',
    'import { foo, bar as baz, type Qux } from "../../extensions/foo.ts";',
    "import {",
    "  multi,",
    "  foo",
    '} from "../../lib/multi.ts";',
    'import { helper } from "./helpers.ts";',
    'import { thing } from "some-package";',
  ].join("\n");
  const interfaces = [{ path: "extensions/foo.ts", exports: ["foo", "Qux"] }];
  assert.deepEqual(undeclaredImports(src, interfaces), ["bar", "helper", "multi"]);
});
