import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
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
import { addedText, checklistOf, symbolsOf, uncovered } from "../scripts/check-c1.mjs";
import { coverageState, requirementsOf } from "../scripts/check-c2.mjs";
import {
  blindPrompt,
  blindVerdict,
  importsExistingTest,
  interfaceLines,
  restoreTree,
  sameTree,
  sandboxArgs,
  scoreChecks,
  snapshotTree,
} from "../scripts/check-c3.mjs";
import { C4_IDS, reviewPrompt, reviewVerdict } from "../scripts/check-c4.mjs";
import { classify, piArgs, queryDb, sectionHeader } from "../scripts/run-arm.mjs";

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

test("a locked telemetry database returns null instead of throwing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "routing-lock-"));
  const dbPath = path.join(dir, "telemetry.db");
  const writer = new DatabaseSync(dbPath);
  writer.exec(`
    CREATE TABLE inference_calls (
      model TEXT, cost_usd REAL, session_id TEXT, parent_turn_id TEXT
    );
    CREATE TABLE tool_calls (
      id INTEGER, ts TEXT, tool_name TEXT, path TEXT, session_id TEXT, parent_turn_id TEXT
    );
  `);
  writer.exec("BEGIN EXCLUSIVE");
  const started = Date.now();
  const locked = queryDb(dbPath, 200);
  assert.equal(locked, null);
  assert.ok(Date.now() - started < 2000);
  writer.exec("ROLLBACK");
  writer.close();
  const open = queryDb(dbPath, 200);
  assert.ok(open);
  assert.equal(open.cost, 0);
  assert.deepEqual(open.models, []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("model, thinking, and session flags come before the end of options", () => {
  const args = piArgs("do the task", { model: "openai-codex/gpt-5.6-terra", thinking: "medium" }, "/tmp/sessions");
  const end = args.indexOf("--");
  assert.ok(end > 0);
  assert.ok(args.indexOf("--model") < end);
  assert.ok(args.indexOf("--thinking") < end);
  assert.ok(args.indexOf("--approve") < end);
  assert.ok(args.indexOf("--session-dir") < end);
  assert.deepEqual(args.slice(end), ["--", "do the task"]);
});

test("checklist reconciliation ignores a requirement whose symbol was added", () => {
  const prompt = [
    "Set maxTurnPromptTokens to 100000.",
    "Declared interface, names and signatures only:",
    "- export function readSmartRouterTier(cwd: string): string | null",
    "Keep the note short.",
  ].join("\n");
  const requirements = checklistOf(prompt);
  assert.equal(requirements.some((line) => line.startsWith("Declared interface")), false);
  assert.ok(requirements.some((line) => line.includes("100000")));
  assert.ok(symbolsOf(prompt).includes("readSmartRouterTier"));
  const evidence = addedText(JSON.stringify({
    edits: [{ newText: "export function readSmartRouterTier(cwd: string): string | null { return null; }" }],
  }));
  const flags = uncovered(requirements, evidence);
  assert.equal(flags.some((flag) => flag.requirement.includes("readSmartRouterTier")), false);
  assert.ok(flags.some((flag) => flag.requirement.includes("100000")));
});

test("a coverage state keeps the requirement and omits hidden tests", () => {
  const prompt = "Declared interface, names and signatures only:\nSet the default to 100000.\n";
  assert.deepEqual(requirementsOf(prompt), ["Set the default to 100000."]);
  const state = coverageState("Set the default to 100000.", "const limit = 20000000;");
  assert.match(state, /100000/);
  assert.match(state, /20000000/);
  assert.equal(state.includes("hidden"), false);
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

test("the sandbox binds credential files and hides the repositories", () => {
  const args = sandboxArgs("/tmp/c3-gen");
  const sources = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--ro-bind" || args[i] === "--bind") sources.push(args[i + 1]);
  }
  assert.ok(sources.includes("/home/george-contis/.pi/agent/auth.json"));
  assert.equal(sources.includes("/home/george-contis/src/pi-build"), false);
  assert.equal(sources.includes("/home/george-contis/Documents/agent-orchestration-harness"), false);
  assert.equal(sources.some((source) => source.includes("routing-runs")), false);
  assert.ok(args.includes("--clearenv"));
});

test("a blind prompt carries the task and names the new test file", () => {
  const prompt = blindPrompt({ repo: "pi-build", prompt: "Set the default to 100000." });
  assert.match(prompt, /tests\/routing-blind\.test\.ts/);
  assert.match(prompt, /100000/);
  assert.equal(prompt.includes("lib/example.ts"), false);
  assert.equal(prompt.includes("heldout"), false);
  assert.equal(prompt.includes("routing-runs"), false);
});

test("a name-only interface omits the test assertion", () => {
  const task = { prompt: "Set the default to 100000.", repo: "pi-build" };
  const sources = [{
    file: "tests/example.test.ts",
    text: 'import { countsAsEdit } from "../lib/telemetry.ts";\ntest("keeps the limit", () => { assert.equal(limit, 100000); });\n',
  }];
  assert.deepEqual(interfaceLines(task, sources), ["lib/telemetry.ts: countsAsEdit"]);
  const withHelper = interfaceLines(task, [...sources, {
    file: "tests/interop.test.ts",
    text: 'const tools = require("./dist/core/tools/index.js");\nimport { write_full_run } from "./conftest.py";\n',
  }]);
  assert.deepEqual(withHelper, ["lib/telemetry.ts: countsAsEdit"]);
  const signed = interfaceLines({
    ...task,
    module_text: {
      "lib/telemetry.ts": "export function countsAsEdit(name: string): boolean {\n  return true;\n}\n",
    },
  }, sources);
  assert.deepEqual(signed, ["lib/telemetry.ts: countsAsEdit(name: string): boolean"]);
  const classLines = interfaceLines({
    ...task,
    module_text: {
      "extensions/read-guard.ts": "export class ReadGuard {\n  private call = 0;\n  onNewPrompt(): void { this.call += 1; }\n}\n",
    },
  }, [{
    file: "tests/read-guard.test.ts",
    text: 'import { ReadGuard } from "../extensions/read-guard.ts";\n',
  }]);
  assert.deepEqual(classLines, ["extensions/read-guard.ts: ReadGuard"]);
  const prompt = blindPrompt(task, sources);
  assert.match(prompt, /Do not invent a field/);
  assert.match(prompt, /lib\/telemetry\.ts: countsAsEdit/);
  assert.equal(prompt.includes("assert.equal"), false);
  assert.deepEqual(interfaceLines({ prompt: "Declared interface, names and signatures only:\nlib/telemetry.ts\n" }, sources), []);
});

test("a blind test that imports an existing test is rejected", () => {
  assert.ok(importsExistingTest(
    'import { x } from "../tests/read-guard.test.ts";\n',
    ["tests/read-guard.test.ts"],
  ));
  assert.equal(importsExistingTest(
    'import { countsAsEdit } from "../lib/telemetry.ts";\n',
    ["tests/read-guard.test.ts"],
  ), null);
  assert.ok(importsExistingTest(
    "from tests.test_harness import helper\n",
    ["tests/test_harness.py"],
  ));
  assert.equal(importsExistingTest(
    'import { unreadExampleKeys } from "../lib/settings-keys.ts";\n',
    ["tests/settings-keys.test.ts"],
  ), null);
});

test("a missing blind test is not a flag and a failing one is", () => {
  assert.deepEqual(blindVerdict({ stopped: null, generated: false, grade: null, importedTest: null }), {
    flagged: false,
    outcome: "missing",
  });
  assert.equal(blindVerdict({ stopped: "pin", generated: true, grade: null, importedTest: null }).flagged, false);
  assert.equal(blindVerdict({
    stopped: null,
    generated: true,
    grade: { code: 1, pass: 0, fail: 1 },
    importedTest: null,
  }).flagged, true);
  assert.equal(blindVerdict({
    stopped: null,
    generated: true,
    grade: { code: 0, pass: 2, fail: 0 },
    importedTest: null,
  }).flagged, false);
  assert.equal(blindVerdict({
    stopped: null,
    generated: true,
    grade: { code: 1, pass: 0, fail: 1, out: "ERR_MODULE_NOT_FOUND imported from tests/routing-blind.test.ts" },
    importedTest: null,
  }).outcome, "unloadable");
  assert.deepEqual(scoreChecks([
    { class: "Silent fail", flagged: true },
    { class: "Silent fail", flagged: false },
    { class: "Pass", flagged: false },
  ]), { silent: [1, 2], pass: [0, 1], loud: [0, 0] });
});

test("grading a blind test restores the worktree", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "c3-restore-"));
  const git = ["-c", "user.email=t@example.com", "-c", "user.name=t", "-c", "commit.gpgsign=false"];
  execFileSync("git", ["init"], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
  fs.writeFileSync(path.join(dir, "kept.ts"), "export const n = 1;\n");
  fs.writeFileSync(path.join(dir, "clean.ts"), "export const c = 1;\n");
  execFileSync("git", ["-C", dir, ...git, "add", "kept.ts", "clean.ts"], { stdio: ["ignore", "pipe", "pipe"] });
  execFileSync("git", ["-C", dir, ...git, "commit", "-m", "init"], { stdio: ["ignore", "pipe", "pipe"] });
  fs.writeFileSync(path.join(dir, "kept.ts"), "export const n = 2;\n");
  fs.writeFileSync(path.join(dir, "extra.ts"), "export const extra = 1;\n");
  const before = snapshotTree(dir);
  fs.writeFileSync(path.join(dir, "kept.ts"), "export const n = 3;\n");
  fs.writeFileSync(path.join(dir, "clean.ts"), "export const c = 9;\n");
  fs.rmSync(path.join(dir, "extra.ts"));
  fs.writeFileSync(path.join(dir, "tests-new.ts"), "nope\n");
  restoreTree(dir, before);
  assert.equal(fs.readFileSync(path.join(dir, "kept.ts"), "utf8"), "export const n = 2;\n");
  assert.equal(fs.readFileSync(path.join(dir, "clean.ts"), "utf8"), "export const c = 1;\n");
  assert.equal(fs.readFileSync(path.join(dir, "extra.ts"), "utf8"), "export const extra = 1;\n");
  assert.equal(fs.existsSync(path.join(dir, "tests-new.ts")), false);
  assert.equal(sameTree(before, snapshotTree(dir)), true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a later arm can write its own matrix section", () => {
  const previous = process.env.RUN_ARM_SECTION;
  delete process.env.RUN_ARM_SECTION;
  assert.equal(sectionHeader("terra"), "## Section 12 Phase B — terra");
  process.env.RUN_ARM_SECTION = "## Section 12 Phase C — terra";
  assert.equal(sectionHeader("terra"), "## Section 12 Phase C — terra");
  if (previous == null) delete process.env.RUN_ARM_SECTION;
  else process.env.RUN_ARM_SECTION = previous;
});

test("a Sol review flags a missing requirement and ignores other prose", () => {
  assert.deepEqual(C4_IDS, ["78ce7cb", "59c9121", "a0043ca", "4384c58"]);
  assert.deepEqual(reviewVerdict("1. PRESENT the cap\n2. MISSING the default\n"), {
    flagged: true,
    outcome: "missing",
    missing: 1,
    present: 1,
  });
  assert.equal(reviewVerdict("I am not sure.").flagged, false);
  const prompt = reviewPrompt(["Set the default to 100000."], "const limit = 100000;");
  assert.match(prompt, /100000/);
  assert.match(prompt, /MISSING/);
  assert.equal(prompt.includes("heldout"), false);
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
