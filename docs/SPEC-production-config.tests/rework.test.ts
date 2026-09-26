import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  normalizeSpecName,
  planTaskIds,
  validateRework,
  appendRework,
  readRework,
  defaultReworkPath,
  WHOLE_SPEC,
} from "../../lib/rework.ts";

test("spec names normalize from path, file name, or bare name", () => {
  for (const s of ["docs/SPEC-tiered-retry.md", "SPEC-tiered-retry.md", "SPEC-tiered-retry", "tiered-retry"]) {
    assert.equal(normalizeSpecName(s), "tiered-retry");
  }
});

test("task ids are read from a plan, and a malformed plan yields none", () => {
  assert.deepEqual(planTaskIds({ tasks: [{ id: "T1" }, { id: "T2" }, { nope: 1 }] }), ["T1", "T2"]);
  assert.deepEqual(planTaskIds(null), []);
  assert.deepEqual(planTaskIds({ tasks: "x" }), []);
});

test("a finding needs an existing spec and a reason", () => {
  assert.equal(validateRework({ spec: "x", task: "T1", reason: "r" }, false, ["T1"]).ok, false);
  assert.equal(validateRework({ spec: "x", task: "T1", reason: "  " }, true, ["T1"]).ok, false);
  assert.deepEqual(validateRework({ spec: "x", task: "T1", reason: "wrong default" }, true, ["T1"]), { ok: true });
});

test("an unknown task is refused with the valid ids listed", () => {
  const v = validateRework({ spec: "x", task: "T9", reason: "r" }, true, ["T1", "T2"]);
  assert.equal(v.ok, false);
  assert.ok(!v.ok && v.error.includes("T1") && v.error.includes("T2") && v.error.includes(WHOLE_SPEC));
});

test("the whole-spec sentinel is accepted with or without a plan; a task id without a plan is not", () => {
  assert.deepEqual(validateRework({ spec: "x", task: WHOLE_SPEC, reason: "r" }, true, null), { ok: true });
  assert.deepEqual(validateRework({ spec: "x", task: WHOLE_SPEC, reason: "r" }, true, ["T1"]), { ok: true });
  assert.equal(validateRework({ spec: "x", task: "T1", reason: "r" }, true, null).ok, false);
});

test("findings append as JSON lines and read back; malformed lines are skipped", () => {
  const p = join(mkdtempSync(join(tmpdir(), "rework-")), "sub", "rework.jsonl");
  assert.deepEqual(readRework(p), []);
  const a = { spec: "x", task: "T1", reason: "missed the reset path", at: "2026-09-27T10:00:00Z", project: "/repo" };
  const b = { spec: "x", task: WHOLE_SPEC, reason: "integration dropped a hook", at: "2026-09-27T11:00:00Z", project: "/repo" };
  appendRework(p, a);
  appendFileSync(p, "{broken\n\n");
  appendRework(p, b);
  assert.deepEqual(readRework(p), [a, b]);
});

test("rework path honours the environment override", () => {
  assert.equal(defaultReworkPath({ PI_BUILD_REWORK: "/x/r.jsonl" }), "/x/r.jsonl");
  assert.ok(defaultReworkPath({}).endsWith(join(".pi", "agent", "rework.jsonl")));
});
