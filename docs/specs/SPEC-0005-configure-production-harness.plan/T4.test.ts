import test from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  WHOLE_SPEC,
  appendRework,
  defaultReworkPath,
  normalizeSpecName,
  planTaskIds,
  readRework,
  validateRework,
} from "../../lib/rework.ts";

test("all documented spec forms normalize to one join key", () => {
  for (const input of [
    "docs/SPEC-production-config.md",
    "SPEC-production-config.md",
    "SPEC-production-config",
    "production-config",
  ]) {
    assert.equal(normalizeSpecName(input), "production-config");
  }
});

test("plan task ids are extracted defensively", () => {
  assert.deepEqual(planTaskIds({ tasks: [{ id: "T1" }, { id: "T2" }, null, { id: 3 }] }), ["T1", "T2"]);
  assert.deepEqual(planTaskIds(null), []);
  assert.deepEqual(planTaskIds({ tasks: "not-an-array" }), []);
});

test("validation rejects unjoinable findings and reports valid choices", () => {
  assert.deepEqual(validateRework({ spec: "missing", task: "T1", reason: "redo" }, false, ["T1"]), {
    ok: false,
    error: 'No spec named "missing".',
  });
  assert.equal(validateRework({ spec: "x", task: "T1", reason: "   " }, true, ["T1"]).ok, false);

  const unknown = validateRework({ spec: "x", task: "T9", reason: "redo" }, true, ["T1", "T2"]);
  assert.equal(unknown.ok, false);
  if (!unknown.ok) {
    assert.match(unknown.error, /T1/);
    assert.match(unknown.error, /T2/);
    assert.match(unknown.error, /\*/);
  }

  assert.equal(validateRework({ spec: "x", task: "T1", reason: "redo" }, true, null).ok, false);
  assert.deepEqual(validateRework({ spec: "x", task: WHOLE_SPEC, reason: "integration redo" }, true, null), {
    ok: true,
  });
});

test("the shared path is overridable and defaults under the user agent directory", () => {
  assert.equal(defaultReworkPath({ PI_BUILD_REWORK: "/tmp/custom-rework.jsonl" }), "/tmp/custom-rework.jsonl");
  assert.ok(defaultReworkPath({}).endsWith(join(".pi", "agent", "rework.jsonl")));
});

test("rows append in JSONL order and malformed lines do not destroy findings", () => {
  const file = join(mkdtempSync(join(tmpdir(), "production-rework-")), "nested", "rework.jsonl");
  const first = {
    spec: "production-config",
    task: "T2",
    reason: "retry chose the wrong tier",
    at: "2026-09-27T10:00:00.000Z",
    project: "/work/repo-a",
  };
  const second = {
    spec: "production-config",
    task: WHOLE_SPEC,
    reason: "integration was incomplete",
    at: "2026-09-30T11:00:00.000Z",
    project: "/work/repo-a",
  };

  assert.deepEqual(readRework(file), []);
  appendRework(file, first);
  appendFileSync(file, "{malformed\n\n");
  appendRework(file, second);

  assert.deepEqual(readRework(file), [first, second]);
  assert.equal(readFileSync(file, "utf8").split("\n").filter(Boolean).length, 3);
});
