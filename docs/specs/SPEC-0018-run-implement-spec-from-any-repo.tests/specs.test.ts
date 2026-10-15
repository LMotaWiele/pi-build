import { test } from "node:test";
import assert from "node:assert/strict";
import { listSpecs, markImplemented, resolveSpec } from "../../../lib/specs.ts";

const PI_BUILD = [
  "index.md",
  "SPEC-0007-build-codebase-map.md",
  "SPEC-0007-run.md",
  "SPEC-0014-complete-the-codebase-map.md",
  "SPEC-0014-complete-the-codebase-map.tests",
];
const OTHER = ["index.md", "SPEC-00A9-first.md", "SPEC-00B1-wire-the-thing.md", "SPEC-00B1-run.md", "SPEC-00B1-wire-the-thing.tests"];

const id = (files: string[], query: string) => {
  const r = resolveSpec(files, query);
  assert.ok(r.ok, `${query}: ${!r.ok ? r.error : ""}`);
  return r.ok ? r.spec.id : "";
};

test("alphanumeric IDs are listed, and run records are not specs", () => {
  assert.deepEqual(listSpecs(OTHER).map((s) => [s.id, s.slug]), [["00A9", "first"], ["00B1", "wire-the-thing"]]);
});

test("an alphanumeric ID resolves by ID, prefixed ID, any case, file name, path and slug", () => {
  for (const q of ["00B1", "SPEC-00B1", "spec-00b1", "00b1", "SPEC-00B1-wire-the-thing", "SPEC-00B1-wire-the-thing.md",
    "/repo/docs/specs/SPEC-00B1-wire-the-thing.md", "wire-the-thing"]) {
    assert.equal(id(OTHER, q), "00B1", q);
  }
});

test("every form that resolved before still resolves to the same spec", () => {
  for (const q of ["7", "0007", "SPEC-0007", "build-codebase-map", "SPEC-0007-build-codebase-map.md", "docs/specs/SPEC-0007-build-codebase-map.md"]) {
    assert.equal(id(PI_BUILD, q), "0007", q);
  }
  assert.equal(id(PI_BUILD, "14"), "0014");
});

test("an ID shared by two specs is an error naming both; an unknown ID is an error", () => {
  const r = resolveSpec(["SPEC-00B1-one.md", "SPEC-00b1-two.md"], "00B1");
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.error, /one|00B1/);
    assert.match(r.error, /two|00b1/);
  }
  assert.equal(resolveSpec(OTHER, "00C3").ok, false);
});

test("markImplemented updates the row of an alphanumeric ID", () => {
  const index = "| ID | Title | Status | Implemented by |\n|---|---|---|---|\n| 00A9 | A | ready | — |\n| 00B1 | B | ready | — |\n";
  const spec = "# S\n\n| Field | Value |\n|---|---|\n| Status | ready |\n\n## 1. Intent\n";
  const out = markImplemented(index, spec, "00B1", "pi pipeline");
  assert.match(out.index, /\| 00B1 \| B \| implemented \| pi pipeline \|/);
  assert.match(out.index, /\| 00A9 \| A \| ready \| — \|/);
  assert.match(out.spec, /\| Status \| implemented \|/);
});
