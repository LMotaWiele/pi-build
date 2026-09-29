import { test } from "node:test";
import assert from "node:assert/strict";
import { checkConformance, parseUnifiedDiff, type DiffFile } from "../../../lib/conformance.ts";
import type { PlanTask } from "../../../lib/plan.ts";

const task: PlanTask = {
  id: "T1",
  file: "extensions/bounds.ts",
  assignee: "luna",
  requirements: ["R1"],
  brief: "Add nextTier. The default budget is 5,000,000 tokens; the timeout stays 1800000 ms.",
  interfaces: [{ path: "extensions/bounds.ts", exports: ["nextTier"] }],
  acceptanceTest: "docs/SPEC-x.plan/T1.test.ts",
  dependsOn: [],
};

function f(path: string, added: string[] = [], removed: string[] = []): DiffFile {
  return { path, status: "modified", addedLines: added, removedLines: removed };
}

test("a diff confined to the task file with declared exports is clean", () => {
  const r = checkConformance(task, [f("extensions/bounds.ts", ["export function nextTier() {}"])], []);
  assert.deepEqual(r, {
    outOfScope: [],
    protectedTouched: [],
    undeclaredExports: [],
    removedExports: [],
    newNumericLiterals: [],
  });
});

test("files outside the task are out of scope, except under tests/", () => {
  const r = checkConformance(task, [f("extensions/bounds.ts"), f("lib/telemetry.ts"), f("tests/extra.test.ts")], []);
  assert.deepEqual(r.outOfScope, ["lib/telemetry.ts"]);
});

test("protected files are reported once, as protected, not as out of scope", () => {
  const protectedPaths = ["docs/SPEC-x.plan/T1.test.ts", "docs/SPEC-x.tests/"];
  const r = checkConformance(
    task,
    [f("docs/SPEC-x.plan/T1.test.ts"), f("docs/SPEC-x.tests/a.test.ts"), f("docs/SPEC-x.plan/T2.test.ts")],
    protectedPaths,
  );
  assert.deepEqual(r.protectedTouched, ["docs/SPEC-x.plan/T1.test.ts", "docs/SPEC-x.tests/a.test.ts"]);
  assert.deepEqual(r.outOfScope, ["docs/SPEC-x.plan/T2.test.ts"]);
});

test("exports added to the task file but not declared are reported", () => {
  const r = checkConformance(
    task,
    [f("extensions/bounds.ts", ["export function nextTier() {}", "export const helper = 1;", "export { a as renamed };"])],
    [],
  );
  assert.deepEqual(r.undeclaredExports, ["helper", "renamed"]);
});

test("removed exports are reported unless re-added in the same file", () => {
  const r = checkConformance(
    task,
    [
      f("extensions/bounds.ts", ["export function kept(x) {}"], ["export function kept() {}", "export const gone = 1;"]),
      f("lib/other.ts", [], ["export type Lost = string;"]),
    ],
    [],
  );
  assert.deepEqual(r.removedExports, ["Lost", "gone"]);
});

test("large numeric literals absent from the brief are reported; brief numbers and comments are not", () => {
  const r = checkConformance(
    task,
    [
      f("extensions/bounds.ts", [
        "const MAX_PROMPT = 100_000;",
        "const BUDGET = 5_000_000;",
        "const WALL = 1800000;",
        "const SMALL = 999;",
        "// see issue 42007",
        "const RETRIES = 3;",
      ]),
    ],
    [],
  );
  assert.deepEqual(r.newNumericLiterals, ["100000"]);
});

test("unified diffs parse into files with added and removed lines", () => {
  const text = [
    "diff --git a/extensions/bounds.ts b/extensions/bounds.ts",
    "index 1..2 100644",
    "--- a/extensions/bounds.ts",
    "+++ b/extensions/bounds.ts",
    "@@ -1,2 +1,2 @@",
    "-const a = 1;",
    "+const a = 2;",
    " unchanged",
    "diff --git a/lib/new.ts b/lib/new.ts",
    "new file mode 100644",
    "--- /dev/null",
    "+++ b/lib/new.ts",
    "@@ -0,0 +1 @@",
    "+export const x = 1;",
  ].join("\n");
  const files = parseUnifiedDiff(text);
  assert.equal(files.length, 2);
  assert.deepEqual(files[0], {
    path: "extensions/bounds.ts",
    status: "modified",
    addedLines: ["const a = 2;"],
    removedLines: ["const a = 1;"],
  });
  assert.equal(files[1].path, "lib/new.ts");
  assert.equal(files[1].status, "added");
  assert.deepEqual(files[1].addedLines, ["export const x = 1;"]);
});
