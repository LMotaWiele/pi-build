import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { preflight } from "../../../lib/pipeline.ts";
import { buildSummary } from "../../../lib/run-summary.ts";

const SPEC = "# S\n\n## 8. Verification\n| O | C | Check ID: condition |\n|---|---|---|\n| O1 | §6.1 | V1: a |\n\n## 9. Stop\n";

test("a spec without tests no longer blocks when the pipeline will write them; it still blocks otherwise", () => {
  const writing = preflight({ specText: SPEC, hasTestsDir: false, held: false, dirty: [], writeTests: true });
  assert.deepEqual(writing.blocking, []);
  const old = preflight({ specText: SPEC, hasTestsDir: false, held: false, dirty: [] });
  assert.equal(old.blocking.length, 1);
  assert.match(old.blocking[0], /\.tests/);
});

test("the summary says who wrote the spec tests, which failed before implementation and which checks are manual", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spec20-summary-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "pipeline.json"), JSON.stringify({ spec: "docs/specs/SPEC-0042-x.md", specTests: "generated" }));
  fs.writeFileSync(path.join(dir, "spec-tests.json"), JSON.stringify({
    writer: "openai-codex/gpt-6.1-sol", rounds: 2,
    files: [{ file: "docs/specs/SPEC-0042-x.tests/v01-a.test.ts", before: "fail" }, { file: "docs/specs/SPEC-0042-x.tests/v02-b.test.ts", before: "pass" }],
    manual: [{ check: "V3", reason: "needs a model-driven run" }],
  }));
  const text = buildSummary({ runDir: dir, outcome: { ok: false, stage: "plan", reason: "planning failed" } });
  for (const want of ["Spec tests", "gpt-6.1-sol", "v01-a.test.ts", "fail-to-pass", "v02-b.test.ts", "pass-to-pass", "V3", "needs a model-driven run"]) {
    assert.ok(text.includes(want), `missing ${want}\n${text}`);
  }
  fs.writeFileSync(path.join(dir, "pipeline.json"), JSON.stringify({ spec: "docs/specs/SPEC-0042-x.md", specTests: "supplied" }));
  fs.rmSync(path.join(dir, "spec-tests.json"));
  assert.match(buildSummary({ runDir: dir, outcome: { ok: false, stage: "plan", reason: "x" } }), /Spec tests[^\n]*\n[^\n]*supplied/i);
});
