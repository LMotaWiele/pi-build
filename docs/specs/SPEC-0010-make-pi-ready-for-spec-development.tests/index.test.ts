// /docs/specs/index.md records which harness built each spec, so rework
// findings keyed by spec ID can be compared across harnesses from ordinary use.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SPECS = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HARNESS = /^(Grok Build|pi|pi pipeline|Claude cloud|—|unknown)( \([^()]+\))?$/;

function table(md: string): { header: string[]; rows: string[][] } {
  const lines = md.split("\n").filter((l) => l.trim().startsWith("|"));
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const header = cells(lines[0]);
  const rows = lines.slice(2).map(cells).filter((r) => r.length === header.length);
  return { header, rows };
}

const { header, rows } = table(readFileSync(resolve(SPECS, "index.md"), "utf8"));
const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

test("the index has an Implemented by column", () => {
  assert.ok(col("Implemented by") >= 0, `columns: ${header.join(", ")}`);
});

test("every Implemented by value uses the fixed vocabulary", () => {
  const i = col("Implemented by");
  for (const r of rows) {
    for (const part of r[i].split(";").map((s) => s.trim())) {
      assert.match(part, HARNESS, `row ${r[0]}: "${r[i]}"`);
    }
  }
});

test("every spec file has exactly one index row", () => {
  const ids = readdirSync(SPECS)
    .map((f) => f.match(/^SPEC-(\d{4})-[a-z0-9-]+\.md$/))
    .filter((m): m is RegExpMatchArray => m !== null && !m[0].endsWith("-run.md"))
    .map((m) => m[1]);
  const indexed = rows.map((r) => (r[0].match(/(\d{4})/) ?? [])[1]);
  for (const id of ids) assert.equal(indexed.filter((x) => x === id).length, 1, `SPEC-${id}`);
});
