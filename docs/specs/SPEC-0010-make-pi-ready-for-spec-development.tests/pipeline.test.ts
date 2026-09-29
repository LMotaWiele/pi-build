import { test } from "node:test";
import assert from "node:assert/strict";
import { preflight, testCommands } from "../../../lib/pipeline.ts";

const opts = { pythonProject: "tools/map" };

test("Node and Python tests each run with their own runner, in one command each", () => {
  const cmds = testCommands(
    ["b/x.test.ts", "a/test_views.py", "a/y.test.mjs", "a/helpers.ts", "a/conftest.py", "a/views_test.py", "README.md"],
    opts,
  );
  assert.deepEqual(cmds, [
    { cmd: "node", args: ["--experimental-strip-types", "--test", "a/y.test.mjs", "b/x.test.ts"] },
    { cmd: "uv", args: ["run", "--project", "tools/map", "pytest", "-q", "a/test_views.py", "a/views_test.py"] },
  ]);
});

test("a directory of Python tests alone never goes to Node", () => {
  const cmds = testCommands(["t/test_a.py", "t/test_b.py"], opts);
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].cmd, "uv");
});

test("no test files, no commands", () => {
  assert.deepEqual(testCommands(["a/helpers.ts", "notes.md"], opts), []);
});

const TEMPLATE = "# SPEC-0001: x\n\n## 8. Verification\n| O | C | Check ID: condition |\n|---|---|---|\n| O1 | §6.1 | V1: a |\n| O1 | §6.1 | V2: b |\n\n## 9. Stop\n";

test("a ready spec passes preflight with its check count", () => {
  assert.deepEqual(preflight({ specText: TEMPLATE, hasTestsDir: true, held: false, dirty: [] }), { checks: 2, blocking: [], warnings: [] });
});

test("a spec without verification, without tests, or under a quota hold is blocked before any model call", () => {
  const p = preflight({ specText: "# S\n\n## 1. Intent\n", hasTestsDir: false, held: true, dirty: [] });
  assert.equal(p.checks, null);
  assert.equal(p.blocking.length, 3);
});

test("uncommitted changes warn but do not block", () => {
  const p = preflight({ specText: TEMPLATE, hasTestsDir: true, held: false, dirty: ["lib/a.ts"] });
  assert.deepEqual(p.blocking, []);
  assert.equal(p.warnings.length, 1);
});
