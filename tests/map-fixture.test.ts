import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keeper = path.join(repo, "tools/map/fixtures/keeper");
const ledger = path.join(repo, "tools/map/fixtures/telemetry.db");

const PACKAGES = ["agent", "config", "core", "environment", "goals", "memory", "scripts", "tg", "tools"];
const FILES = [
  "agent/__init__.py",
  "agent/runner.py",
  "config/__init__.py",
  "config/settings.py",
  "core/__init__.py",
  "core/loop.py",
  "environment/__init__.py",
  "environment/grounding.py",
  "goals/__init__.py",
  "goals/system.py",
  "main.py",
  "memory/__init__.py",
  "memory/working.py",
  "scripts/__init__.py",
  "scripts/diag_common.py",
  "tg/__init__.py",
  "tg/bot.py",
  "tools/__init__.py",
  "tools/memory_tools.py",
];

test("the keeper fixture is the closed package layout", () => {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = path.relative(keeper, full).split(path.sep).join("/");
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (rel.endsWith(".py")) found.push(rel);
    }
  };
  walk(keeper);
  found.sort();
  assert.deepEqual(found, FILES);
  for (const name of PACKAGES) assert.equal(fs.statSync(path.join(keeper, name, "__init__.py")).isFile(), true);
  assert.equal(fs.existsSync(path.join(keeper, "data/state/instance.json")), true);
});

test("the ledger fixture joins loops and an explain child, and stores no prompt text", () => {
  const db = new DatabaseSync(ledger, { readOnly: true });
  const tables = ["tool_calls", "inference_calls", "hook_touches", "ab_trials"];
  for (const table of tables) {
    const names = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((row) => row.name);
    assert.equal(names.some((name) => name === "prompt" || name.endsWith("_prompt")), false);
  }
  const toolCols = (db.prepare("PRAGMA table_info(tool_calls)").all() as { name: string }[]).map((row) => row.name);
  assert.ok(toolCols.includes("turn_id"));
  assert.ok(toolCols.includes("loop_index"));
  assert.ok(toolCols.includes("parent_turn_id"));
  const multi = db.prepare(
    `SELECT COUNT(*) AS n FROM (
       SELECT turn_id FROM tool_calls GROUP BY turn_id HAVING COUNT(DISTINCT loop_index) >= 2
     )`,
  ).all() as { n: number }[];
  assert.ok(multi[0].n >= 1);
  const spawn = db.prepare(
    `SELECT COUNT(*) AS n FROM inference_calls i
     WHERE i.parent_turn_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM inference_calls p WHERE p.turn_id = i.parent_turn_id)`,
  ).all() as { n: number }[];
  assert.ok(spawn[0].n >= 1);
  const leaked = db.prepare(
    `SELECT COUNT(*) AS n FROM tool_calls
     WHERE arguments LIKE '%Create hello.txt%' OR arguments LIKE '%Bearer %' OR arguments LIKE '%sk-%'`,
  ).all() as { n: number }[];
  assert.equal(leaked[0].n, 0);
  db.close();
});
