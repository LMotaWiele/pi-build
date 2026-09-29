import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkSpecIndex } from "../scripts/check-spec-index.mjs";

function fixture(title: string, header: string, status: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spec-index-"));
  fs.writeFileSync(path.join(dir, "index.md"), `| ID | Title | Status |\n|---|---|---|\n| 0010 | Example | ${status} |\n`);
  fs.writeFileSync(path.join(dir, "SPEC-0010-example.md"), `# ${title}\n\n| Field | Value |\n|---|---|\n| Status | ${header} |\n`);
  return dir;
}

test("accepts matching statuses and a numbered title", () => {
  const dir = fixture("SPEC-0010: Example", "landed", "landed");
  try { assert.deepEqual(checkSpecIndex(dir), []); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("rejects NNNN in a spec title and an index/header status mismatch", () => {
  const dir = fixture("SPEC-NNNN: Example", "landed", "ready");
  try {
    const errors = checkSpecIndex(dir);
    assert.equal(errors.length, 2);
    assert.match(errors[0], /title contains NNNN/);
    assert.match(errors[1], /index status.*differs from header/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
