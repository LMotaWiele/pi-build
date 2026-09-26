#!/usr/bin/env node
// Section 12.2 and 12.3. No model call.
// Appends declared signatures to prompts that failed the audit, and records
// the visible/hidden split. A second run does not append the interface twice.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { auditTask, chooseSplit, renderInterface } from "./audit-graders.mjs";

const SUITE = path.resolve(import.meta.dirname, "../tests/routing-suite/tasks.jsonl");
const MARKER = "Declared interface, names and signatures only:";

const EXTRAS = {
  bd51f93: [
    { file: "tests/fixtures/ab/src/types.ts", signature: "export interface Batch { readings: Reading[] }" },
    {
      file: "lib/telemetry.ts",
      signature: "export interface TierAnswers { single_file_edit: boolean; needs_repo_reasoning: boolean; unfamiliar_stack: boolean; spec_exists: boolean; reversible: boolean }",
    },
  ],
  "59c9121": [
    {
      file: "lib/telemetry.ts",
      signature: "type HookHandler = (event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown",
    },
  ],
  "s13-hard": [
    {
      file: "lib/telemetry.ts",
      signature: "type HookHandler = (event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown",
    },
  ],
};

const PARSED = `{
  notes: [{ topic: "t", file: "t.md", status: "open", oneLiner: "x".repeat(9000) }],
  activeNext: Array.from({ length: 12 }, (_, i) => ({ n: String(i + 1), item: "q".repeat(200), source: "human", added: "2026-09-21" })),
  doNot: ["stay"],
  glossary: { Mode: "a label" },
  raw: "",
  schemaVersion: 1,
}`;

const INDEX_IMPORTS = `import assert from "node:assert/strict";
import test from "node:test";
import { formatIndexInjection } from "../lib/markdown.ts";
import { estimateTokens } from "../lib/telemetry.ts";

const parsed = ${PARSED};
`;

const INDEX_VISIBLE = `${INDEX_IMPORTS}
test("injected index omits the notes table and the glossary", () => {
  const capped = formatIndexInjection(parsed, estimateTokens, 2000);
  assert.equal(capped.text.includes("Notes:"), false);
  assert.equal(capped.text.includes("Glossary"), false);
  assert.equal(capped.text.includes("x".repeat(20)), false);
  assert.match(capped.text, /Active next/);
  assert.match(capped.text, /Do not:\\n- stay/);
});
`;

const TIER_IMPORTS = `import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readSmartRouterTier } from "../lib/telemetry.ts";
`;

const TIER_VISIBLE = `${TIER_IMPORTS}
test("readSmartRouterTier is null when the file is absent", () => {
  const missing = fs.mkdtempSync(path.join(os.tmpdir(), "pi-router-tier-missing-"));
  assert.equal(readSmartRouterTier(missing), null);
});
`;

const TIER_HIDDEN = `import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { readSmartRouterTier } from "../lib/telemetry.ts";

test("readSmartRouterTier copies the latest dataset tier", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-router-tier-"));
  const state = path.join(dir, ".pi-smart-router");
  fs.mkdirSync(state);
  const db = new DatabaseSync(path.join(state, "state.db"));
  db.exec("CREATE TABLE dataset (id INTEGER PRIMARY KEY AUTOINCREMENT, tier TEXT NOT NULL)");
  db.prepare("INSERT INTO dataset (tier) VALUES (?)").run("economical-cloud");
  db.prepare("INSERT INTO dataset (tier) VALUES (?)").run("frontier-cloud");
  db.close();
  assert.equal(readSmartRouterTier(dir), "frontier-cloud");
});
`;

const INDEX_HIDDEN = `${INDEX_IMPORTS}
test("a tight cap still omits the notes table", () => {
  const big = formatIndexInjection(parsed, estimateTokens, 100);
  assert.equal(big.truncated, true);
  assert.match(big.text, /more queue rows omitted/);
  assert.equal(big.text.includes("Notes:"), false);
});
`;

function groupsFor(task, report) {
  const map = new Map();
  for (const row of report.undeclared) {
    const file = row.kind === "path" ? row.name : (row.atCommit || row.specifier);
    if (!map.has(file)) map.set(file, []);
    if (row.kind === "symbol" && row.signature) {
      map.get(file).push(row.signature.replace(/\s+/g, " ").trim());
    }
  }
  for (const extra of EXTRAS[task.id] || []) {
    if (!map.has(extra.file)) map.set(extra.file, []);
    map.get(extra.file).push(extra.signature);
  }
  return [...map.entries()].map(([file, signatures]) => ({ file, signatures: [...new Set(signatures)] }));
}

function splitFor(task, report) {
  if (task.id === "9e26310") {
    return {
      survives: false,
      rule: "The held-out change is one assertion inside an existing test, so it cannot be split into a visible failure and a held-out failure.",
      visible: [],
      hidden: [],
    };
  }
  if (task.id === "690b685") {
    return {
      survives: true,
      rule: "The bounds and checkpoint edits still pass at the parent, so they grade nothing. The new tier test is split into a visible absence check and a hidden latest-row check.",
      visible: [{ file: "tests/routing-visible.test.ts", name: "readSmartRouterTier is null when the file is absent" }],
      hidden: [{ file: "tests/routing-heldout.test.ts", name: "readSmartRouterTier copies the latest dataset tier" }],
      inline: { "tests/routing-visible.test.ts": TIER_VISIBLE, "tests/routing-heldout.test.ts": TIER_HIDDEN },
    };
  }
  if (task.id === "4704b4f") {
    return {
      survives: true,
      rule: "The single changed test was split into its two new assertion groups before any run. The notes-and-glossary checks are visible. The tight-cap checks stay hidden.",
      visible: [{ file: "tests/routing-visible.test.ts", name: "injected index omits the notes table and the glossary" }],
      hidden: [{ file: "tests/routing-heldout.test.ts", name: "a tight cap still omits the notes table" }],
      inline: { "tests/routing-visible.test.ts": INDEX_VISIBLE, "tests/routing-heldout.test.ts": INDEX_HIDDEN },
    };
  }
  const chosen = chooseSplit(report.requirements);
  return {
    survives: chosen.survives,
    rule: "Changed tests alternate visible then hidden in suite order. A value check stays hidden.",
    visible: chosen.visible,
    hidden: chosen.hidden,
  };
}

function repair(tasks) {
  return tasks.map((task) => {
    const report = auditTask(task);
    const next = { ...task, requirement_split: splitFor(task, report) };
    const groups = groupsFor(task, report);
    if (groups.length && !next.prompt.includes(MARKER)) {
      next.prompt = `${next.prompt}\n\n${renderInterface(groups)}`;
      next.prompt_changed = true;
    } else if (!Object.hasOwn(next, "prompt_changed")) {
      next.prompt_changed = false;
    }
    return next;
  });
}

function main() {
  const tasks = fs.readFileSync(SUITE, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  const next = repair(tasks);
  fs.writeFileSync(SUITE, `${next.map((task) => JSON.stringify(task)).join("\n")}\n`);
  for (const task of next) {
    const changed = task.prompt_changed ? "prompt" : "same";
    const split = task.requirement_split;
    console.log(`${task.id} ${changed} visible=${split.visible.length} hidden=${split.hidden.length} survives=${split.survives}`);
  }
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) main();

export { repair };
