import { test } from "node:test";
import assert from "node:assert/strict";
import { gateRepairable, preflight, uncommittedSpecPaths } from "../../../lib/pipeline.ts";

const paths = { spec: "docs/specs/SPEC-0042-demo.md", tests: "docs/specs/SPEC-0042-demo.tests" };
const specText = "# Demo\n\n## 8. Verification\n| Outcome | Change | Check |\n|---|---|---|\n| O1 | change | V1: works |\n";
const input = { specText, hasTestsDir: true, held: false, dirty: [] as string[] };

test("porcelain matching preserves order, selects rename destinations and respects directory boundaries", () => {
  const dirty = [
    " M docs/specs/SPEC-0042-demo.md",
    "?? docs/specs/SPEC-0042-demo.tests/",
    "A  docs/specs/SPEC-0042-demo.tests/nested/a.test.ts",
    "R  docs/old.md -> docs/specs/SPEC-0042-demo.tests/b.test.ts",
    "R  docs/specs/SPEC-0042-demo.md -> docs/elsewhere.md",
    " M docs/specs/SPEC-0042-demo.tests2/a.ts",
    "?? docs/specs/SPEC-0042-demo.md.backup",
    "?? docs/other/",
    " M lib/other.ts",
    "?? docs/specs/",
    "?? docs/",
    " M docs/specs/SPEC-0042-demo.tests",
  ];
  assert.deepEqual(uncommittedSpecPaths(dirty, paths), [
    paths.spec, `${paths.tests}/`, `${paths.tests}/nested/a.test.ts`, `${paths.tests}/b.test.ts`,
    "docs/specs/", "docs/", paths.tests,
  ]);
  assert.deepEqual(uncommittedSpecPaths([" M docs/", "?? other/", "?? notes.md"], paths), []);
  assert.deepEqual(uncommittedSpecPaths([], paths), []);
});

test("preflight adds one HEAD blocker naming the spec and all matching paths, retaining existing warnings", () => {
  const dirty = ["?? docs/", `A  ${paths.tests}/nested/a.test.ts`, " M lib/other.ts"];
  const before = preflight({ ...input, dirty });
  const after = preflight({ ...input, dirty, specPaths: paths });
  assert.equal(after.checks, 1);
  assert.equal(after.blocking.length, 1);
  assert.match(after.blocking[0], /uncommitted/);
  assert.ok(after.blocking[0].includes(paths.spec));
  assert.match(after.blocking[0], /HEAD/);
  assert.ok(after.blocking[0].includes("docs/"));
  assert.ok(after.blocking[0].includes(`${paths.tests}/nested/a.test.ts`));
  assert.ok(!after.blocking[0].includes("lib/other.ts"));
  assert.deepEqual(after.warnings, before.warnings);
  assert.deepEqual(before.blocking, []);
  assert.deepEqual(preflight({ ...input, dirty: [" M lib/other.ts"], specPaths: paths }),
    preflight({ ...input, dirty: [" M lib/other.ts"] }));
  assert.deepEqual(preflight(input), { checks: 1, blocking: [], warnings: [] });
});

test("existing preflight blockers are not replaced by the new blocker", () => {
  const oldInput = { ...input, hasTestsDir: false, held: true, pythonProject: null,
    testFiles: ["test_feature.py"], dirty: [` M ${paths.spec}`] };
  const before = preflight(oldInput);
  const after = preflight({ ...oldInput, specPaths: paths });
  assert.equal(after.blocking.length, before.blocking.length + 1);
  for (const reason of before.blocking) assert.ok(after.blocking.includes(reason));
  assert.deepEqual(after.warnings, before.warnings);
});

test("only the exact verification-count error disables gate repair", () => {
  assert.equal(gateRepairable([]), true);
  assert.equal(gateRepairable(["UNMAPPED_VERIFY 13", "missing acceptance test"]), true);
  assert.equal(gateRepairable(["verification count changed"]), false);
  assert.equal(gateRepairable(["missing test", "verification count changed"]), false);
  assert.equal(gateRepairable(["Verification count changed", "verification count changed later"]), true);
});
