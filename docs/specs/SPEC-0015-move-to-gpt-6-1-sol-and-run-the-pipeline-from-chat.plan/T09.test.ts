import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
test("index closes only the two completed specs with their implementers", () => {
  const index = readFileSync(resolve(import.meta.dirname, "../index.md"), "utf8");
  const row = (id: string) => index.split("\n").find((line) => line.startsWith(`| ${id} |`));
  assert.match(row("0011") ?? "", /\| implemented \| pi \|/);
  assert.match(row("0014") ?? "", /\| implemented \| pi pipeline \|/);
  assert.match(row("0010") ?? "", /\| landed \| pi \|/);
});
