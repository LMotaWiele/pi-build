import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildHandoff, renderHandoff } from "../scripts/handoff.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function task(id: string): { repo_path: string; parent_sha: string; prompt: string } {
  const rows = fs.readFileSync(path.join(root, "tests/routing-suite/tasks.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { id: string; repo_path: string; parent_sha: string; prompt: string });
  const found = rows.find((row) => row.id === id);
  if (!found) throw new Error(`missing task ${id}`);
  return found;
}

function handoff(id: string) {
  const row = task(id);
  return buildHandoff(row.repo_path, row.parent_sha, row.prompt);
}

test("a named path that does not exist at the parent is missing, not implicated", () => {
  const built = handoff("a2c7c72");
  assert.deepEqual(built.named, []);
  assert.deepEqual(built.missing, ["extensions/bounds.ts"]);
  assert.deepEqual(built.implicated, []);
});

test("a model id is not a file path", () => {
  const built = handoff("690b685");
  assert.equal(built.missing.some((file: string) => file.includes("gpt-5.6")), false);
  assert.deepEqual(built.named, ["lib/telemetry.ts"]);
});

test("a bare filename the prompt names is recorded", () => {
  const built = handoff("bd51f93");
  assert.deepEqual(built.missing, [
    "known.md",
    "lib/settings-keys.ts",
    "tests/fixtures/ab/src/format.ts",
    "tests/fixtures/ab/src/parse.ts",
    "tests/fixtures/ab/src/store.ts",
    "tests/fixtures/ab/src/types.ts",
    "tests/fixtures/ab/src/validate.ts",
  ]);
});

test("section keys named in the prompt are shared surfaces", () => {
  const one = handoff("59c9121");
  assert.ok(one.surfaces.includes("section pi_build_memory prompt"));
  const two = handoff("49d5a83");
  assert.ok(two.surfaces.includes("section pi_build_memory prompt"));
  assert.ok(two.surfaces.includes("section pi_build_tools prompt"));
});

test("s13 names the files that exist, counts importers, and stays inside the state budget", () => {
  const built = handoff("s13-hard");
  assert.ok(built.named.includes("lib/telemetry.ts"));
  assert.ok(built.named.includes("extensions/routing.ts"));
  assert.ok(built.missing.includes("extensions/bounds.ts"));
  assert.ok(built.missing.includes("scripts/report-hooks.sql"));
  assert.ok(built.implicated.includes("extensions/memory-gate.ts"));
  assert.ok(built.fanIn.length > 0);
  assert.ok(built.fanIn.every((row: { outside: number }) => row.outside === 0));
  assert.ok(built.surfaces.includes("section pi_build_memory prompt"));
  assert.ok(built.surfaces.includes("hook before_agent_start extensions/routing.ts"));
  assert.equal(built.surfaces.some((row: string) => row.startsWith("hook data ")), false);
  assert.equal(built.surfaces.some((row: string) => row.startsWith("hook exit ")), false);
  assert.ok(renderHandoff(built).length / 4 < 4000);
});
