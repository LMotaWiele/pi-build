import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  auditTask,
  changedTests,
  chooseSplit,
  extractReferences,
  keepTests,
  namedImports,
  resolvePy,
  resolveTs,
  signatureOf,
} from "../scripts/audit-graders.mjs";
import { classify } from "../scripts/run-arm.mjs";

const suitePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "routing-suite/tasks.jsonl");

test("named imports keep the exported name", () => {
  assert.deepEqual(namedImports("{ type Reading, formatBatch as format }"), ["Reading", "formatBatch"]);
});

test("a new module path and its symbol are project references", () => {
  const source = [
    'import { unreadExampleKeys } from "../lib/settings-keys.ts";',
    'import fs from "node:fs";',
  ].join("\n");
  const refs = extractReferences(source, "tests/settings-keys.test.ts");
  assert.deepEqual(refs.map((ref) => `${ref.kind}:${ref.name}`), [
    "path:lib/settings-keys.ts",
    "symbol:unreadExampleKeys",
  ]);
  assert.deepEqual(resolveTs("tests/settings-keys.test.ts", "../lib/settings-keys.ts")[0], "lib/settings-keys.ts");
});

test("pytest is not a project interface", () => {
  const refs = extractReferences('import pytest\nfrom pathlib import Path\n', "tests/test_model.py");
  assert.deepEqual(refs, []);
});

test("python project imports skip the standard library", () => {
  const source = [
    "from pathlib import Path",
    "from agent_orchestration_harness.harness import Config",
    "from tests.research_panel.run import allocate_run_dir",
  ].join("\n");
  const refs = extractReferences(source, "tests/research_panel/test_run.py");
  const names = refs.map((ref) => ref.name);
  assert.equal(names.includes("Path"), false);
  assert.ok(names.includes("Config"));
  assert.ok(names.includes("allocate_run_dir"));
  assert.deepEqual(resolvePy("tests/research_panel/test_run.py", "tests.research_panel.run")[0], "tests/research_panel/run.py");
});

test("keepTests drops tests that are not in the kept set", () => {
  const source = 'test("one", () => {\n  assert.equal(1, 1);\n});\ntest("two", () => {\n  assert.equal(2, 2);\n});\n';
  const kept = keepTests(source, "tests/example.test.ts", ["two"]);
  assert.equal(kept.includes('"one"'), false);
  assert.match(kept, /test\("two"/);
});

test("keepTests retains a helper that sits between tests", () => {
  const source = 'test("one", () => {\n  assert.equal(1, 1);\n});\nfunction capture() { return 1; }\ntest("two", () => {\n  capture();\n});\n';
  const kept = keepTests(source, "tests/example.test.ts", ["two"]);
  assert.equal(kept.includes('"one"'), false);
  assert.match(kept, /function capture/);
  const python = [
    "def _params():",
    "    return 1",
    "",
    "def test_one():",
    "    pass",
    "",
    "def _later():",
    "    return 2",
    "",
    "@pytest.mark.parametrize(",
    '    "reason",',
    '    ["a"],',
    ")",
    "def test_two(reason):",
    "    _later()",
    "",
  ].join("\n");
  const keptPy = keepTests(python, "tests/example.py", ["test_two"]);
  assert.equal(keptPy.includes("test_one"), false);
  assert.match(keptPy, /def _params/);
  assert.match(keptPy, /def _later/);
  assert.match(keptPy, /parametrize/);
  assert.match(keptPy, /def test_two/);
});

test("the split puts a value check on the hidden side and keeps both sides", () => {
  const reqs = [
    { file: "a", name: "first" },
    { file: "a", name: "second" },
    { file: "v", name: "value_check" },
  ];
  const split = chooseSplit(reqs);
  assert.deepEqual(split.visible.map((req) => req.name), ["first"]);
  assert.deepEqual(split.hidden.map((req) => req.name), ["value_check", "second"]);
  assert.equal(split.survives, true);
  assert.equal(chooseSplit([{ file: "a", name: "only" }]).survives, false);
});

test("a changed test is a requirement and an unchanged test is not", () => {
  const parent = 'test("old", () => {\n  assert.equal(1, 1);\n});\n';
  const commit = `${parent}test("new", () => {\n  assert.equal(2, 2);\n});\n`;
  assert.deepEqual(changedTests(parent, commit, "tests/example.test.ts"), ["new"]);
  assert.deepEqual(changedTests(parent, parent, "tests/example.test.ts"), []);
});

test("a function signature stops before the body", () => {
  const text = "export function maxPrefixInvalidations(contractPath: string): number {\n  return 3;\n}\n";
  assert.equal(
    signatureOf(text, "maxPrefixInvalidations"),
    "export function maxPrefixInvalidations(contractPath: string): number",
  );
});

test("the repaired suite has no undeclared interface and sixteen tasks that split", () => {
  const tasks = fs.readFileSync(suitePath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  const dropped = tasks.filter((task) => !task.requirement_split?.survives).map((task) => task.id);
  assert.deepEqual(dropped, ["9e26310"]);
  for (const task of tasks) {
    assert.equal(auditTask(task).undeclared.length, 0, task.id);
    if (!task.requirement_split.survives) continue;
    assert.ok(task.requirement_split.visible.length > 0, task.id);
    assert.ok(task.requirement_split.hidden.length > 0, task.id);
    if (task.heldout.value_check) {
      assert.ok(task.requirement_split.hidden.some((req) => req.name === "value_check"), task.id);
    }
  }
  const panel = tasks.find((task) => task.id === "aoh-c40f118");
  assert.equal(panel.prompt.includes("return dest"), false);
  assert.match(panel.prompt, /def allocate_run_dir\(panel_root: Path\) -> Path:/);
  const explain = tasks.find((task) => task.id === "4384c58");
  assert.match(explain.prompt, /^- export const explainStdio$/m);
  assert.equal(explain.prompt.includes("PI_OWNED_SETTING_KEYS"), false);
});

test("a stopped run is censored and a visible pass with a hidden fail is silent", () => {
  const fail = { code: 1, pass: 0, fail: 1 };
  const pass = { code: 0, pass: 2, fail: 0 };
  assert.equal(classify(pass, pass, null), "Pass");
  assert.equal(classify(fail, fail, null), "Loud fail");
  assert.equal(classify(pass, fail, null), "Silent fail");
  assert.equal(classify(fail, pass, null), "Odd");
  assert.equal(classify(pass, fail, "cost-cap"), "censored");
});

test("a signature keeps a parameter type and a return type", () => {
  const text = [
    "export async function checkpointOnBound(input: {",
    "  edits: number;",
    "  written: string[];",
    "}): Promise<void> {",
    "  return;",
    "}",
    "export function decisionSupplements(root: string): { indexRow?: string; filesRead: string[] } {",
    "  return { filesRead: [] };",
    "}",
  ].join("\n");
  assert.equal(
    signatureOf(text, "checkpointOnBound"),
    "export async function checkpointOnBound(input: { edits: number; written: string[]; }): Promise<void>",
  );
  assert.equal(
    signatureOf(text, "decisionSupplements"),
    "export function decisionSupplements(root: string): { indexRow?: string; filesRead: string[] }",
  );
});
