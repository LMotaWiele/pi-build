// When a spec's final grade passes, its header and index row say so — written by the pipeline, not remembered.
import { test } from "node:test";
import assert from "node:assert/strict";
import { markImplemented } from "../../../lib/specs.ts";

const INDEX = `# Specs

| ID | Title | Status | Implemented by | Date first added | Former path |
|---|---|---|---|---|---|
| 0011 | SPEC-0011: Explain | ready | — | 2026-09-29 | — |
| 0014 | SPEC-0014: Map | ready | — | 2026-09-30 | — |
`;
const SPEC = `# SPEC-0014: Map

| Field | Value |
|---|---|
| Status | ready |
| Size | staged (3 stages) |

## 1. Intent
Status of the world: ready.
`;

test("the spec's header and its index row become implemented, with who built it", () => {
  const out = markImplemented(INDEX, SPEC, "0014", "pi pipeline");
  assert.match(out.spec, /^\| Status \| implemented \|$/m);
  assert.match(out.index, /^\| 0014 \| SPEC-0014: Map \| implemented \| pi pipeline \| 2026-09-30 \| — \|$/m);
});

test("nothing else changes: other rows, other fields, and prose that says ready", () => {
  const out = markImplemented(INDEX, SPEC, "0014", "pi pipeline");
  assert.match(out.index, /^\| 0011 \| SPEC-0011: Explain \| ready \| — \|/m);
  assert.match(out.spec, /^\| Size \| staged \(3 stages\) \|$/m);
  assert.match(out.spec, /Status of the world: ready\./);
});

test("a spec missing from the index is an error, not a silent no-op", () => {
  assert.throws(() => markImplemented(INDEX, SPEC, "0099", "pi"), /0099/);
});
