#!/usr/bin/env node
// Validate catalog metadata against spec headers, without rewriting either file.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function checkSpecIndex(dir) {
  const index = fs.readFileSync(path.join(dir, "index.md"), "utf8");
  const rows = new Map();
  for (const line of index.split("\n")) {
    const cells = line.trim().split("|").slice(1, -1).map((cell) => cell.trim());
    if (/^\d{4}$/.test(cells[0] ?? "")) rows.set(cells[0], cells[2]);
  }
  const errors = [];
  for (const file of fs.readdirSync(dir).filter((name) => /^SPEC-\d{4}-(?!run\.md$)[a-z0-9-]+\.md$/.test(name))) {
    const id = file.slice(5, 9);
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    const title = text.match(/^#\s+([^\n]+)/m)?.[1] ?? "";
    if (/\bNNNN\b/.test(title)) errors.push(`${file}: title contains NNNN`);
    const headerStatus = text.match(/^\|\s*Status\s*\|\s*([^|\n]+)\s*\|/mi)?.[1]?.trim();
    if (headerStatus && rows.get(id) !== headerStatus) {
      errors.push(`${file}: index status ${JSON.stringify(rows.get(id) ?? "(missing)")} differs from header ${JSON.stringify(headerStatus)}`);
    }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, "../docs/specs"));
  const errors = checkSpecIndex(dir);
  for (const error of errors) console.error(`FAIL: ${error}`);
  if (errors.length) process.exitCode = 1;
  else console.log("ok: spec index statuses and titles");
}
