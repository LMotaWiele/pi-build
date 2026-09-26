#!/usr/bin/env node
// Section 13 C4. Sol reviews the added text against the checklist.
// The review runs in the same sandbox as the blind test, so it cannot
// see either repository or a held-out file. A missing answer is not a flag.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { requirementsOf } from "./check-c2.mjs";
import { runSandboxed, sessionStats } from "./check-c3.mjs";
import { addedText } from "./check-c1.mjs";
import { DatabaseSync } from "node:sqlite";

const REPO = path.resolve(import.meta.dirname, "..");
const SUITE = path.join(REPO, "tests/routing-suite/tasks.jsonl");
const LUNA_RUNS = "/home/george-contis/var/routing-runs/luna";
const C4 = "/home/george-contis/var/routing-runs/c4";

export const SOL = {
  model: "openai-codex/gpt-5.6-sol",
  thinking: "high",
  cap: 0.5,
  wallS: 400,
  allowed: ["gpt-5.6-sol"],
};

// The two silent fails C1, C2, and the signature-constrained C3 all left
// unflagged, then the first two held-out passes in the Phase B Luna table.
export const C4_IDS = ["78ce7cb", "59c9121", "a0043ca", "4384c58"];

export function reviewPrompt(requirements, added) {
  const body = added.length > 12000 ? `${added.slice(0, 12000)}\n…` : added;
  const lines = requirements.map((requirement, index) => `${index + 1}. ${requirement}`);
  return [
    "Review the added text against each requirement.",
    "Do not use tools. Do not edit a file. Do not search.",
    "Reply with one line per requirement, in order, and no other lines.",
    "Start each line with MISSING or PRESENT.",
    "MISSING means the added text does not implement the requirement, or a number in the requirement differs from the number the added text sets.",
    "PRESENT means the added text implements the requirement, including any number it states.",
    "",
    "Requirements:",
    ...lines,
    "",
    "Added text:",
    body || "(none)",
  ].join("\n");
}

export function reviewVerdict(text) {
  const marks = [];
  for (const line of String(text || "").split("\n")) {
    const match = line.trim().match(/^(?:\d+[.)]\s*)?(MISSING|PRESENT)\b/i);
    if (match) marks.push(match[1].toUpperCase());
  }
  if (!marks.length) return { flagged: false, outcome: "unparsed", missing: 0, present: 0 };
  const missing = marks.filter((mark) => mark === "MISSING").length;
  return {
    flagged: missing > 0,
    outcome: missing > 0 ? "missing" : "present",
    missing,
    present: marks.length - missing,
  };
}

function addedOf(taskId) {
  const dbPath = path.join(LUNA_RUNS, taskId, "telemetry.db");
  const db = new DatabaseSync(dbPath, { readOnly: true, timeout: 2000 });
  try {
    const rows = db.prepare(`
      SELECT arguments FROM tool_calls
      WHERE session_id != 's' AND tool_name IN ('edit', 'write')
    `).all();
    return rows.map((row) => addedText(row.arguments)).filter(Boolean).join("\n");
  } finally {
    db.close();
  }
}

function assistantText(sessionDir) {
  if (!fs.existsSync(sessionDir)) return "";
  const parts = [];
  for (const name of fs.readdirSync(sessionDir).filter((item) => item.endsWith(".jsonl"))) {
    for (const line of fs.readFileSync(path.join(sessionDir, name), "utf8").split("\n")) {
      if (!line) continue;
      let row;
      try { row = JSON.parse(line); } catch { continue; }
      if (row.type !== "message" || row.message?.role !== "assistant") continue;
      const content = row.message.content;
      if (typeof content === "string") parts.push(content);
      else if (Array.isArray(content)) {
        for (const part of content) {
          if (typeof part === "string") parts.push(part);
          else if (part?.text) parts.push(part.text);
        }
      }
    }
  }
  return parts.join("\n");
}

function loadTasks() {
  const wanted = new Set(C4_IDS);
  return fs.readFileSync(SUITE, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line))
    .filter((task) => wanted.has(task.id));
}

function loadResults() {
  const file = path.join(C4, "results.json");
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function saveResults(rows) {
  fs.mkdirSync(C4, { recursive: true });
  const file = path.join(C4, "results.json");
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(rows, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

async function runTask(task) {
  const prior = JSON.parse(fs.readFileSync(path.join(LUNA_RUNS, task.id, "result.json"), "utf8"));
  const requirements = requirementsOf(task.prompt);
  const added = addedOf(task.id);
  const root = path.join(C4, task.id);
  const gen = path.join(root, "gen");
  fs.rmSync(gen, { recursive: true, force: true });
  console.log(`${task.id} review`);
  const pi = await runSandboxed(reviewPrompt(requirements, added), gen, path.join(root, "pi.log"), SOL);
  const stats = sessionStats(path.join(gen, "sessions"));
  const verdict = pi.stopped
    ? { flagged: false, outcome: "censored", missing: 0, present: 0 }
    : reviewVerdict(assistantText(path.join(gen, "sessions")));
  const row = {
    id: task.id,
    class: prior.class,
    outcome: verdict.outcome,
    flagged: verdict.flagged,
    missing: verdict.missing,
    present: verdict.present,
    requirements: requirements.length,
    provider_cost: Number(stats.cost.toFixed(8)),
    rounds: stats.rounds,
    wall_s: Number(pi.wallS.toFixed(3)),
    pi_exit: pi.code,
    stopped: pi.stopped,
    models: stats.models,
    users: stats.users,
  };
  console.log(`${task.id} ${prior.class} ${verdict.outcome} flagged=${verdict.flagged} $${row.provider_cost}`);
  return row;
}

async function probe() {
  const gen = path.join(C4, "probe");
  fs.rmSync(gen, { recursive: true, force: true });
  const pi = await runSandboxed("Reply with the single word pong. Do not use tools.", gen, path.join(C4, "probe.log"), SOL);
  const stats = sessionStats(path.join(gen, "sessions"));
  if (pi.code !== 0 || pi.stopped || stats.users !== 1 || stats.models.some((model) => model !== "gpt-5.6-sol")) {
    throw new Error(`sandbox probe failed exit=${pi.code} stopped=${pi.stopped || ""} users=${stats.users} models=${stats.models.join(",")}`);
  }
  console.log(`probe ok $${stats.cost.toFixed(6)} users=${stats.users} model=${stats.models.join(",")}`);
}

async function main() {
  fs.mkdirSync(C4, { recursive: true });
  const status = path.join(C4, "status.txt");
  fs.rmSync(status, { force: true });
  try {
    await probe();
    const done = new Map(loadResults().map((row) => [row.id, row]));
    const selected = C4_IDS.map((id) => loadTasks().find((task) => task.id === id)).filter((task) => task && !done.has(task.id));
    let aborted = null;
    const accept = async (task) => {
      if (aborted) return;
      try {
        const row = await runTask(task);
        const foreign = row.models.some((model) => model !== "gpt-5.6-sol");
        if (row.users !== 1 || foreign || row.stopped === "spawn") {
          aborted = new Error(`${row.id} launch check failed users=${row.users} models=${row.models.join(",")} stopped=${row.stopped || ""}`);
          return;
        }
        done.set(row.id, row);
        saveResults([...done.values()]);
      } catch (err) {
        aborted = err;
        console.log(`${task.id} ERROR ${err.message}`);
      }
    };
    const queue = [...selected];
    const workers = Array.from({ length: Math.min(2, queue.length) }, async () => {
      while (queue.length && !aborted) await accept(queue.shift());
    });
    await Promise.all(workers);
    if (aborted) throw aborted;
    const rows = [...done.values()];
    const cost = rows.reduce((sum, row) => sum + (row.provider_cost || 0), 0);
    const silent = rows.filter((row) => row.class === "Silent fail");
    const passes = rows.filter((row) => row.class === "Pass");
    console.log(`silent ${silent.filter((row) => row.flagged).length}/${silent.length} pass-flagged ${passes.filter((row) => row.flagged).length}/${passes.length} cost ${cost.toFixed(6)}`);
    fs.writeFileSync(status, `DONE ${rows.length}\n`);
  } catch (err) {
    console.log(`FAILED ${err.message}`);
    fs.writeFileSync(status, `FAILED ${err.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
