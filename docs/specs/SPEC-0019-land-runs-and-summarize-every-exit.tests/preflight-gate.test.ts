import { test } from "node:test";
import assert from "node:assert/strict";
import { gateRepairable, preflight, uncommittedSpecPaths } from "../../../lib/pipeline.ts";

const PATHS = { spec: "docs/specs/SPEC-0042-x.md", tests: "docs/specs/SPEC-0042-x.tests" };
const SPEC = "# S\n\n## 8. Verification\n| O | C | Check ID: condition |\n|---|---|---|\n| O1 | §6.1 | V1: a |\n\n## 9. Stop\n";

test("uncommitted changes to the spec or anything under its tests directory are found in porcelain output", () => {
  const dirty = [
    " M docs/specs/SPEC-0042-x.md",
    "?? docs/specs/SPEC-0042-x.tests/",
    "?? docs/specs/SPEC-0042-x.tests2/other.ts",
    " M lib/a.ts",
    "R  docs/specs/old.md -> docs/specs/SPEC-0042-x.tests/b.test.ts",
    "A  docs/specs/SPEC-0042-x.tests/c.test.ts",
  ];
  assert.deepEqual(uncommittedSpecPaths(dirty, PATHS), [
    "docs/specs/SPEC-0042-x.md",
    "docs/specs/SPEC-0042-x.tests/",
    "docs/specs/SPEC-0042-x.tests/b.test.ts",
    "docs/specs/SPEC-0042-x.tests/c.test.ts",
  ]);
  assert.deepEqual(uncommittedSpecPaths([" M lib/a.ts", "?? notes.md"], PATHS), []);
  // git collapses an untracked directory to its top-most untracked ancestor.
  assert.deepEqual(uncommittedSpecPaths(["?? docs/"], PATHS), ["docs/"]);
  assert.deepEqual(uncommittedSpecPaths(["?? docs/specs/"], PATHS), ["docs/specs/"]);
  assert.deepEqual(uncommittedSpecPaths(["?? docs/other/"], PATHS), []);
});

test("preflight blocks a run whose spec or tests are uncommitted, naming them, and still only warns for other paths", () => {
  const p = preflight({ specText: SPEC, hasTestsDir: true, held: false, dirty: ["?? docs/specs/SPEC-0042-x.tests/", " M lib/a.ts"], specPaths: PATHS });
  assert.equal(p.blocking.length, 1);
  assert.match(p.blocking[0], /uncommitted/);
  assert.ok(p.blocking[0].includes("docs/specs/SPEC-0042-x.tests/"));
  assert.ok(!p.blocking[0].includes("lib/a.ts"));
  assert.equal(p.warnings.length, 1);
  const clean = preflight({ specText: SPEC, hasTestsDir: true, held: false, dirty: [" M lib/a.ts"], specPaths: PATHS });
  assert.deepEqual(clean.blocking, []);
});

test("preflight is unchanged when it is not told the spec's paths", () => {
  assert.deepEqual(preflight({ specText: SPEC, hasTestsDir: true, held: false, dirty: [] }), { checks: 1, blocking: [], warnings: [] });
  assert.deepEqual(preflight({ specText: SPEC, hasTestsDir: true, held: false, dirty: [" M docs/specs/SPEC-0042-x.md"] }).blocking, []);
});

test("a changed verification count is not something a plan repair can fix", () => {
  assert.equal(gateRepairable(["verification count changed"]), false);
  assert.equal(gateRepairable(["verification count changed", "UNMAPPED_VERIFY 11"]), false);
  assert.equal(gateRepairable(["UNMAPPED_VERIFY 11", "T03: missing acceptance test"]), true);
  assert.equal(gateRepairable([]), true);
});
