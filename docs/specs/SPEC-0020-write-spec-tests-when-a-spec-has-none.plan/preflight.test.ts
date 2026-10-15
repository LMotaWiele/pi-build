import { test } from "node:test";
import assert from "node:assert/strict";
import { preflight } from "../../../lib/pipeline.ts";

const SPEC = "# S\n\n## 8. Verification\n| O | C | Check ID: condition |\n|---|---|---|\n| O1 | §6.2 | V1: holds |\n\n## 9. Stop\n";
const OLD = "spec has no .tests/ directory: the pipeline grades against the spec's tests";

test("writeTests opts out only of the missing-directory blocker and defaults to old behaviour", () => {
  const input = { specText: SPEC, hasTestsDir: false, held: false, dirty: [] };
  assert.deepEqual(preflight({ ...input, writeTests: true }), { checks: 1, blocking: [], warnings: [] });
  assert.deepEqual(preflight(input), { checks: 1, blocking: [OLD], warnings: [] });
  assert.deepEqual(preflight({ ...input, writeTests: false }), preflight(input));
  const supplied = { ...input, hasTestsDir: true };
  assert.deepEqual(preflight({ ...supplied, writeTests: true }), preflight(supplied));
});

test("test generation does not bypass malformed verification, quota, Python, dirty-spec blockers or warnings", () => {
  const input = { specText: "# no verification", hasTestsDir: false, held: true,
    dirty: [" M docs/specs/SPEC-0042-demo.md", " M README.md"],
    specPaths: { spec: "docs/specs/SPEC-0042-demo.md", tests: "docs/specs/SPEC-0042-demo.tests" },
    testFiles: ["docs/specs/SPEC-0042-demo.tests/test_v01.py"], pythonProject: null };
  const legacy = preflight(input);
  const writing = preflight({ ...input, writeTests: true });
  assert.deepEqual(writing.blocking, legacy.blocking.filter((text) => text !== OLD));
  assert.deepEqual(writing.warnings, legacy.warnings);
  assert.equal(writing.checks, null);
  for (const fragment of ["spec:", "quota hold", "Python tests", "uncommitted"]) {
    assert.ok(writing.blocking.some((text) => text.includes(fragment)), fragment);
  }
});
