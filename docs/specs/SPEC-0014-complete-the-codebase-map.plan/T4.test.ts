import { test } from "node:test";
import assert from "node:assert/strict";
import { markImplemented } from "../../../lib/specs.ts";

const index = `# Specs\n\n| ID | Title | Status | Implemented by | Date first added | Former path |\n|---|---|---|---|---|---|\n| 0013 | Earlier | ready | — | now | — |\n| 0014 | Map | ready | — | now | — |\n`;
const spec = `# Map\n\n| Field | Value |\n|---|---|\n| Status | ready |\n| Size | staged |\n\n## Intent\nReady prose is unchanged.\n`;
test("write-back changes only the specified index row and header status", () => {
  const out = markImplemented(index, spec, "0014", "pi pipeline");
  assert.equal(out.index, index.replace("| 0014 | Map | ready | — |", "| 0014 | Map | implemented | pi pipeline |"));
  assert.equal(out.spec, spec.replace("| Status | ready |", "| Status | implemented |"));
  assert.throws(() => markImplemented(index, spec, "0099", "pi pipeline"), /0099/);
});
