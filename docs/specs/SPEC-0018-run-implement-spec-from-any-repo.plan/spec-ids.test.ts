import { test } from "node:test";
import assert from "node:assert/strict";
import { listSpecs, markImplemented, resolveSpec, specPaths } from "../../../lib/specs.ts";

const files = [
  "index.md", "SPEC-0007-build-codebase-map.md", "SPEC-0014-complete-the-map.md",
  "SPEC-00B1-wire-the-thing.md", "SPEC-00B1-run.md", "SPEC-abc123-another.md",
  "SPEC-12345-long-number.md", "SPEC-00B1-wire-the-thing.tests", "SPEC--invalid.md",
];

function resolved(query: string) {
  const result = resolveSpec(files, query);
  assert.ok(result.ok, result.ok ? query : result.error);
  return result.spec;
}

test("listSpecs accepts arbitrary nonempty alphanumeric IDs, preserving IDs and excluding run records", () => {
  const specs = listSpecs(files);
  assert.deepEqual(specs.map((s) => s.id), ["0007", "0014", "00B1", "12345", "abc123"]);
  assert.deepEqual(specs.find((s) => s.id === "00B1"), {
    id: "00B1", slug: "wire-the-thing", file: "SPEC-00B1-wire-the-thing.md",
  });
  assert.deepEqual(listSpecs(["SPEC-Z-brief.md", "SPEC-Z-run.md"]).map((s) => s.id), ["Z"]);
});

test("every alphanumeric query form resolves case-insensitively on the ID", () => {
  for (const query of ["00B1", "00b1", "SPEC-00B1", "spec-00b1", "SPEC-00b1-wire-the-thing",
    "SPEC-00b1-wire-the-thing.md", "/repo/docs/specs/SPEC-00B1-wire-the-thing.md", "wire-the-thing", " 00b1 "]) {
    assert.equal(resolved(query).id, "00B1", query);
  }
  assert.equal(resolved("ABC123").id, "abc123");
  assert.equal(resolved("12345").id, "12345");
});

test("legacy numeric padding, prefixed IDs, slugs and file/path forms retain their results", () => {
  for (const query of ["7", "0007", "SPEC-7", "SPEC-0007", "build-codebase-map",
    "SPEC-0007-build-codebase-map", "SPEC-0007-build-codebase-map.md", "docs/specs/SPEC-0007-build-codebase-map.md"]) {
    assert.equal(resolved(query).id, "0007", query);
  }
  assert.equal(resolved("14").id, "0014");
  // Existing resolution extracts the ID from a spec-shaped filename, rather than requiring its slug to match.
  assert.equal(resolved("SPEC-0007-old-slug.md").id, "0007");
  assert.deepEqual(specPaths(resolved("00b1")), {
    spec: "SPEC-00B1-wire-the-thing.md", tests: "SPEC-00B1-wire-the-thing.tests",
    plan: "SPEC-00B1-wire-the-thing.plan", runRecord: "SPEC-00B1-run.md",
  });
});

test("duplicate IDs differing in case and ambiguous slugs name every hit; unknown errors retain their form", () => {
  const duplicate = resolveSpec(["SPEC-00B1-one.md", "SPEC-00b1-two.md"], "00b1");
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.match(duplicate.error, /matches more than one spec:/);
    assert.ok(duplicate.error.includes("00B1"));
    assert.ok(duplicate.error.includes("00b1"));
  }
  const slug = resolveSpec(["SPEC-0007-shared.md", "SPEC-00B1-shared.md"], "shared");
  assert.equal(slug.ok, false);
  if (!slug.ok) assert.match(slug.error, /0007.*00B1/);
  assert.deepEqual(resolveSpec([], "missing"), { ok: false, error: 'No spec "missing". Specs: none' });
  const unknown = resolveSpec(files, "00C3");
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.match(unknown.error, /^No spec "00C3"\. Specs: /);
});

test("markImplemented matches an alphanumeric first cell case-insensitively and preserves unrelated text", () => {
  const index = "Intro\n\n| ID | Title | Status | Implemented by |\n|---|---|---|---|\n| 00A9 | A | ready | — |\n| 00b1 | B | ready | — |\n| 00B1-x | Not an ID | ready | — |\n\nTail\n";
  const spec = "# B\n\n| Field | Value |\n|---|---|\n| Status | ready |\n\n## 1. Intent\n| Status | leave this alone |\n";
  const out = markImplemented(index, spec, "00B1", "pi pipeline");
  assert.equal(out.index, index.replace("| 00b1 | B | ready | — |", "| 00b1 | B | implemented | pi pipeline |"));
  assert.equal(out.spec, spec.replace("| Status | ready |", "| Status | implemented |"));
  assert.throws(() => markImplemented(index, spec, "00C3", "pi pipeline"), /Expected exactly one index row for 00C3/);
  const doubled = index + "| 00B1 | Duplicate | ready | — |\n";
  assert.throws(() => markImplemented(doubled, spec, "00B1", "pi pipeline"), /Expected exactly one index row for 00B1/);
});

test("numeric status updates and missing-header behaviour are unchanged", () => {
  const index = "| 0007 | S | ready | — |\n";
  assert.deepEqual(markImplemented(index, "# No header\n", "0007", "pi pipeline"), {
    index: "| 0007 | S | implemented | pi pipeline |\n", spec: "# No header\n",
  });
});
