import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildSummary } from "../../../lib/run-summary.ts";

function fixture(t: any) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spec20-plan-summary-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const metadata = { spec: "docs/specs/SPEC-0042-demo.md", specTests: "generated", branch: "pipeline/demo", base: "abcdef0123456789", baseBranch: "main", startedAt: "2026-10-15T12:00:00Z" };
  const put = (file: string, value: unknown) => fs.writeFileSync(path.join(dir, file), JSON.stringify(value));
  put("pipeline.json", metadata);
  const render = () => buildSummary({ runDir: dir, outcome: { ok: false, stage: "plan", reason: "planner stopped", next: "fix and retry" } });
  return { dir, metadata, put, render };
}

function section(text: string): string {
  const start = text.indexOf("## Spec tests\n");
  assert.ok(start >= 0, "summary has a Spec tests section");
  assert.ok(start < text.indexOf("## Plan gate\n"), "new section is before the existing plan gate");
  return text.slice(start, text.indexOf("## Plan gate\n"));
}

test("generated tests are labelled with writer, rounds, per-file before status and manual reasons", (t) => {
  const { put, render } = fixture(t);
  put("spec-tests.json", { writer: "example/sol", rounds: 2,
    files: [{ file: "v01-new.test.ts", before: "fail" }, { file: "v02-keeps.test.ts", before: "pass" }],
    manual: [{ check: "V3", reason: "needs a model-driven run" }] });
  const text = render();
  const block = section(text);
  assert.match(block, /Written by example\/sol in 2 round\(s\)/);
  assert.ok(block.split("\n").some((line) => line.includes("v01-new.test.ts") && line.includes("fail-to-pass")));
  assert.ok(block.split("\n").some((line) => line.includes("v02-keeps.test.ts") && line.includes("pass-to-pass")));
  assert.ok(block.split("\n").some((line) => line.includes("V3") && line.includes("needs a model-driven run")));
  assert.match(text, /Reason: planner stopped/);
  assert.match(text, /Next: fix and retry/);
  assert.match(text, /Base: abcdef0/);
  assert.match(text, /Branch: pipeline\/demo/);
  assert.match(text, /\| Total \| 0 \| 0 \| 0 \| \$0\.00 \|/);
  const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(headings, ["Status", "Run", "Spec tests", "Plan gate", "Tasks", "Final grade", "Sessions"]);
  assert.equal(render(), text, "summary remains deterministic");
});

test("unfinished, supplied and legacy runs have explicit fallback status without inventing test evidence", (t) => {
  const { dir, metadata, put, render } = fixture(t);
  assert.match(section(render()), /to be written; not finished/);
  put("pipeline.json", { ...metadata, specTests: "supplied" });
  assert.match(section(render()), /supplied with the spec/);
  put("pipeline.json", { spec: metadata.spec });
  assert.match(section(render()), /not recorded/);
  fs.rmSync(path.join(dir, "pipeline.json"));
  assert.match(section(render()), /not recorded/);
});

test("spec-tests evidence wins over metadata while existing gate, tasks and grade sections remain intact", (t) => {
  const { metadata, put, render } = fixture(t);
  put("pipeline.json", { ...metadata, specTests: "supplied" });
  put("spec-tests.json", { writer: "example/custom", rounds: 1, files: [{ file: "v01.test.ts", before: "fail" }], manual: [] });
  put("gate.json", { result: "pass" });
  put("grade.json", { specTests: { code: 0 }, planTests: { code: 0 }, typecheck: { code: null } });
  const text = render();
  assert.match(section(text), /Written by example\/custom in 1 round\(s\)/);
  assert.match(text, /## Plan gate\n- Passed/);
  assert.match(text, /## Tasks\n- none recorded/);
  assert.match(text, /## Final grade\n- spec tests: pass\n- plan tests: pass\n- typecheck: not run/);
});
