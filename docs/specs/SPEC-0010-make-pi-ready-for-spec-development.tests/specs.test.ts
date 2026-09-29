import { test } from "node:test";
import assert from "node:assert/strict";
import { listSpecs, resolveSpec, specPaths } from "../../../lib/specs.ts";

const FILES = [
  "index.md",
  "SPEC-0007-build-codebase-map.md",
  "SPEC-0009-migrate-to-gpt6.md",
  "SPEC-0009-migrate-to-gpt6.tests",
  "SPEC-0009-run.md",
  "SPEC-0010-make-pi-ready-for-spec-development.md",
];

test("lists spec files only, sorted by ID; run records and siblings are not specs", () => {
  assert.deepEqual(listSpecs(FILES).map((s) => s.id), ["0007", "0009", "0010"]);
});

test("resolves by ID in any form, by slug, by file name and by path", () => {
  for (const q of ["7", "0007", "SPEC-0007", "build-codebase-map", "SPEC-0007-build-codebase-map.md", "docs/specs/SPEC-0007-build-codebase-map.md"]) {
    const r = resolveSpec(FILES, q);
    assert.ok(r.ok && r.spec.id === "0007", q);
  }
});

test("an unknown spec is refused with the candidates listed; a slug fragment is not a match", () => {
  for (const q of ["0042", "map", "run"]) {
    const r = resolveSpec(FILES, q);
    assert.equal(r.ok, false, q);
    assert.ok(!r.ok && r.error.includes("0007 build-codebase-map"), q);
  }
});

test("sibling paths share the spec's stem; the run record is by ID", () => {
  const r = resolveSpec(FILES, "9");
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(specPaths(r.spec), {
      spec: "SPEC-0009-migrate-to-gpt6.md",
      tests: "SPEC-0009-migrate-to-gpt6.tests",
      plan: "SPEC-0009-migrate-to-gpt6.plan",
      runRecord: "SPEC-0009-run.md",
    });
  }
});
