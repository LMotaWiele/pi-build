import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isTestFile, checksNamed, manualEntries, specTestsGate, pathsOutside, specTestsPrompt, parseErrors } from "../../../lib/spec-tests.ts";

const T = "docs/specs/SPEC-0042-demo.tests";

test("test recognition and basename V-IDs use runner patterns and numeric boundaries", () => {
  for (const file of ["a.test.ts", "a.test.mts", "a.test.js", "a.test.mjs", "test_a.py", "a_test.py", "dir/test_a.py"]) {
    assert.equal(isTestFile(file), true, file);
  }
  for (const file of ["MANUAL.md", "a.ts", "a.tests.ts", "test_a.txt", "a.py", "a.test.ts.bak"]) {
    assert.equal(isTestFile(file), false, file);
  }
  assert.deepEqual(checksNamed(`${T}/v01-v10-adds.test.ts`), [1, 10]);
  assert.deepEqual(checksNamed(`${T}/test_v10_y.py`), [10]);
  assert.deepEqual(checksNamed("v1-directory/av2.test.ts"), []);
  assert.deepEqual(checksNamed("v1-directory/v100-last.test.ts"), [100]);
  assert.deepEqual(checksNamed("v01-keeps.test.mts"), [1]);
});

test("manual entries require a reason and normalize padded check numbers", () => {
  assert.deepEqual(manualEntries(null), []);
  assert.deepEqual(manualEntries("V01: needs a person\n- V2: model-driven run\n* V3: next use\nV4:   \nV5 no colon\nordinary prose\n"), [
    { check: "V1", reason: "needs a person" },
    { check: "V2", reason: "model-driven run" },
    { check: "V3", reason: "next use" },
  ]);
});

test("gate accepts mixed fail-to-pass/pass-to-pass coverage and rejects omissions, range errors and vacuity", () => {
  const files = [`${T}/v01-new.test.ts`, `${T}/test_v02_keeps.py`];
  const before = [{ file: files[0], passed: false }, { file: files[1], passed: true }];
  assert.deepEqual(specTestsGate({ checks: 3, files, manual: "V3: needs a model-driven run", syntaxErrors: [], before }), []);
  const missing = specTestsGate({ checks: 3, files: [files[0]], manual: "V3:", syntaxErrors: [], before: [before[0]] });
  assert.ok(missing.includes("V2: no test file and no MANUAL.md entry"));
  assert.ok(missing.includes("V3: no test file and no MANUAL.md entry"));
  const range = specTestsGate({ checks: 10, files: [`${T}/v10-ten.test.ts`, `${T}/v11-extra.test.ts`],
    manual: Array.from({ length: 8 }, (_, i) => `V${i + 2}: manual`).join("\n"), syntaxErrors: [],
    before: [{ file: `${T}/v10-ten.test.ts`, passed: false }] });
  assert.ok(range.includes("V1: no test file and no MANUAL.md entry"));
  assert.ok(!range.some((e) => e.startsWith("V10:")));
  assert.ok(range.includes(`${T}/v11-extra.test.ts: names V11, but the spec has V1–V10`));
  const allManual = specTestsGate({ checks: 1, files: [`${T}/MANUAL.md`], manual: "V1: human", syntaxErrors: [], before: [] });
  assert.ok(allManual.some((e) => e.startsWith("no automated checks:")));
  const allPass = specTestsGate({ checks: 1, files: [files[0]], manual: null, syntaxErrors: [], before: [{ file: files[0], passed: true }] });
  assert.ok(allPass.some((e) => e.includes("pass before implementation")));
  const syntax = `${files[0]}: syntax error: Unexpected token`;
  assert.ok(specTestsGate({ checks: 1, files: [files[0]], manual: null, syntaxErrors: [syntax], before: [before[0]] }).includes(syntax));
});

test("outside edits return paths, honor directory boundaries, rename destinations and .agent noise", () => {
  assert.deepEqual(pathsOutside([`?? ${T}/`, `A  ${T}/v01.test.ts`, " M README.md", "?? .agent/explain/x.md",
    `R  src/old.ts -> ${T}/v02.test.ts`, `R  ${T}/old.test.ts -> src/new.ts`, `?? ${T}-other/v03.test.ts`,
    "?? .agent-other/x.md"], T), ["README.md", "src/new.ts", `${T}-other/v03.test.ts`, ".agent-other/x.md"]);
  assert.deepEqual(pathsOutside([], T), []);
});

test("writer prompt gives every check, permitted runners, red-test rule, isolation and repair feedback", () => {
  const p = specTestsPrompt({ spec: "docs/specs/SPEC-0042-demo.md", testsDir: T, checks: 12, pythonProject: null });
  for (const text of ["docs/specs/SPEC-0042-demo.md", T, "MANUAL.md", "node --experimental-strip-types --test", "Do not implement"]) {
    assert.ok(p.includes(text), text);
  }
  for (let n = 1; n <= 12; n++) assert.match(p, new RegExp(`\\bV${n}\\b`));
  assert.match(p, /v<digits>|v01|v\d/i);
  assert.match(p, /at least one[\s\S]*fail/i);
  assert.match(p, /preserv[\s\S]*pass/i);
  assert.match(p, /temporar/i);
  assert.match(p, /no models|not (?:call|use)[^\n]*models/i);
  assert.match(p, /no network|not (?:call|use)[^\n]*network/i);
  assert.match(p, /not[^\n]*edit[^\n]*outside/i);
  assert.ok(!p.includes("pytest"));
  const py = specTestsPrompt({ spec: "s.md", testsDir: T, checks: 1, pythonProject: "tools/map", errors: ["V1: missing", "all pass before implementation"] });
  assert.ok(py.includes("uv run --project tools/map pytest"));
  assert.ok(py.includes("V1: missing"));
  assert.ok(py.includes("all pass before implementation"));
});

test("parse checks strip TS, check JS/Python, never execute or resolve imports, and ignore non-tests", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spec20-plan-parse-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const fixture: Record<string, string> = {
    "v01-broken.test.ts": "const x: number = ;\n",
    "v02-broken.test.mts": "export const x: number = ;\n",
    "v03-broken.test.js": "const x = ;\n",
    "v04-broken.test.mjs": "const x = ;\n",
    "test_v05_broken.py": "def broken(:\n",
    "v06-future.test.ts": "import './not-built.ts';\nconst n: number = 1;\nthrow new Error('must not execute');\n",
    "v07-future.test.mts": "import './not-built.mjs';\nconst n: number = 1;\n",
    "v08-future.test.js": "import './not-built.js';\nthrow new Error('must not execute');\n",
    "v09-future.test.mjs": "import './not-built.mjs';\n",
    "test_v10_future.py": "from not_built import future\nraise RuntimeError('must not execute')\n",
    "MANUAL.md": "not valid JavaScript or Python",
    "helper.ts": "this is invalid too (",
  };
  for (const [file, source] of Object.entries(fixture)) fs.writeFileSync(path.join(dir, file), source);
  const errors = parseErrors(dir, Object.keys(fixture));
  assert.equal(errors.length, 5, errors.join("\n"));
  for (const file of Object.keys(fixture).slice(0, 5)) {
    const error = errors.find((e) => e.startsWith(`${file}: syntax error: `));
    assert.ok(error, `missing syntax failure for ${file}: ${errors.join("\n")}`);
    assert.ok(error.split("\n").length === 1, "only the first error line is returned");
  }
  assert.deepEqual(parseErrors(dir, Object.keys(fixture).slice(5)), []);
});
