import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseErrors, pathsOutside, specTestsGate, specTestsPrompt } from "../../../lib/spec-tests.ts";

const T = "docs/specs/SPEC-0042-x.tests";

test("every V-check needs a test file named for it or a MANUAL.md entry with a reason", () => {
  const ok = specTestsGate({ checks: 3, files: [`${T}/v01-adds.test.ts`, `${T}/test_v02_keeps.py`], manual: "V3: needs a model-driven run\n",
    syntaxErrors: [], before: [{ file: `${T}/v01-adds.test.ts`, passed: false }, { file: `${T}/test_v02_keeps.py`, passed: true }] });
  assert.deepEqual(ok, []);
  const missing = specTestsGate({ checks: 3, files: [`${T}/v01-adds.test.ts`], manual: "V3:\n",
    syntaxErrors: [], before: [{ file: `${T}/v01-adds.test.ts`, passed: false }] });
  assert.ok(missing.some((e) => /V2\b/.test(e)), missing.join("\n"));
  assert.ok(missing.some((e) => /V3\b/.test(e)), "a MANUAL.md entry without a reason does not count");
});

test("V1 is not covered by a file named for V10, and a file naming a check the spec lacks is an error", () => {
  const errors = specTestsGate({ checks: 10, files: [`${T}/v10-ten.test.ts`, `${T}/v11-extra.test.ts`],
    manual: ["V2: x", "V3: x", "V4: x", "V5: x", "V6: x", "V7: x", "V8: x", "V9: x"].join("\n"),
    syntaxErrors: [], before: [{ file: `${T}/v10-ten.test.ts`, passed: false }, { file: `${T}/v11-extra.test.ts`, passed: false }] });
  assert.ok(errors.some((e) => e.startsWith("V1:")), errors.join("\n"));
  assert.ok(!errors.some((e) => e.startsWith("V10:")), "v10-ten covers V10");
  assert.ok(errors.some((e) => e.includes("v11-extra") && /V11/.test(e)), errors.join("\n"));
});

test("checks that are all manual, tests that all pass before implementation, and syntax errors are rejected", () => {
  const allManual = specTestsGate({ checks: 1, files: [], manual: "V1: needs a person\n", syntaxErrors: [], before: [] });
  assert.ok(allManual.some((e) => /no automated/i.test(e)), allManual.join("\n"));
  const vacuous = specTestsGate({ checks: 1, files: [`${T}/v01-a.test.ts`], manual: null, syntaxErrors: [], before: [{ file: `${T}/v01-a.test.ts`, passed: true }] });
  assert.ok(vacuous.some((e) => /pass before/i.test(e)), vacuous.join("\n"));
  const broken = specTestsGate({ checks: 1, files: [`${T}/v01-a.test.ts`], manual: null, syntaxErrors: [`${T}/v01-a.test.ts: SyntaxError: Unexpected token`], before: [{ file: `${T}/v01-a.test.ts`, passed: false }] });
  assert.ok(broken.some((e) => e.includes("SyntaxError")), broken.join("\n"));
});

test("edits outside the tests directory are found, generated walkthroughs are not", () => {
  assert.deepEqual(pathsOutside([`?? ${T}/`, " M lib/a.ts", "?? .agent/recaps/x.md", `A  ${T}/v01.test.ts`, "?? src/new.ts"], T), ["lib/a.ts", "src/new.ts"]);
  assert.deepEqual(pathsOutside([`?? ${T}/v01.test.ts`], T), []);
});

test("the writer's prompt names the spec, the directory, every check, the runners available, and forbids implementing", () => {
  const p = specTestsPrompt({ spec: "docs/specs/SPEC-0042-x.md", testsDir: T, checks: 7, pythonProject: null });
  for (const want of ["docs/specs/SPEC-0042-x.md", T, "V1", "V7", "MANUAL.md", "node --experimental-strip-types --test", "Do not implement"]) {
    assert.ok(p.includes(want), want);
  }
  assert.ok(!p.includes("pytest"), "no Python runner offered without a Python project");
  const py = specTestsPrompt({ spec: "s.md", testsDir: T, checks: 1, pythonProject: "tools/map" });
  assert.ok(py.includes("uv run --project tools/map pytest"));
  const repair = specTestsPrompt({ spec: "s.md", testsDir: T, checks: 1, pythonProject: null, errors: ["V1: no test file and no MANUAL.md entry"] });
  assert.ok(repair.includes("V1: no test file and no MANUAL.md entry"));
});

test("a syntax error is caught without running the file, and an import of a module that does not exist yet is not one", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spec20-parse-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "t"));
  fs.writeFileSync(path.join(dir, "t/v01-broken.test.ts"), "import { test } from 'node:test';\ntest('x', () => { (\n");
  fs.writeFileSync(path.join(dir, "t/v02-future.test.ts"), "import { add } from '../src/not-yet.ts';\nconst n: number = add(1, 2);\n");
  fs.writeFileSync(path.join(dir, "t/MANUAL.md"), "V3: by hand\n");
  const errors = parseErrors(dir, ["t/v01-broken.test.ts", "t/v02-future.test.ts", "t/MANUAL.md"]);
  assert.equal(errors.length, 1, errors.join("\n"));
  assert.match(errors[0], /^t\/v01-broken\.test\.ts: syntax error/);
});
