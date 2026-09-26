// Section 13 C1. Checklist reconciliation, no model call.
// A requirement is checkable when the prompt names a symbol, a path, or a
// number. It is covered when that token appears in the model's added text
// or in a visible test. Hidden tests are not an input.

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { splitSources } from "./audit-graders.mjs";

const REPO = path.resolve(import.meta.dirname, "..");
const SUITE = path.join(REPO, "tests/routing-suite/tasks.jsonl");
const RUNS = "/home/george-contis/var/routing-runs/luna";

export function symbolsOf(text) {
  const found = new Set();
  for (const match of text.matchAll(/`([^`]{2,80})`/g)) found.add(match[1]);
  for (const match of text.matchAll(/\b[A-Za-z][A-Za-z0-9]*[A-Z_][A-Za-z0-9]*\b/g)) found.add(match[0]);
  for (const match of text.matchAll(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/g)) found.add(match[0]);
  for (const match of text.matchAll(/[\w./-]+\.(?:ts|tsx|py|sql|md|json)\b/g)) found.add(match[0]);
  for (const match of text.matchAll(/\b\d{2,}\b/g)) found.add(match[0]);
  return [...found];
}

export function checklistOf(prompt) {
  return prompt.split("\n").map((line) => line.trim()).filter((line) => {
    if (!line) return false;
    if (line.startsWith("Declared interface")) return false;
    return symbolsOf(line).length > 0;
  });
}

export function addedText(argumentsJson) {
  let parsed;
  try { parsed = JSON.parse(argumentsJson); } catch { return ""; }
  if (typeof parsed.content === "string") return parsed.content;
  if (typeof parsed.contents === "string") return parsed.contents;
  if (typeof parsed.text === "string") return parsed.text;
  const edits = Array.isArray(parsed.edits) ? parsed.edits : [];
  return edits.map((edit) => edit.newText || edit.new_string || "").join("\n");
}

export function uncovered(requirements, evidence) {
  const hay = evidence.toLowerCase();
  const flags = [];
  for (const requirement of requirements) {
    const symbols = symbolsOf(requirement);
    const hit = symbols.some((symbol) => hay.includes(symbol.toLowerCase()));
    if (!hit) flags.push({ requirement, symbols });
  }
  return flags;
}

function evidenceOf(task) {
  const visible = splitSources(task, "visible").map((source) => source.text).join("\n");
  const dbPath = path.join(RUNS, task.id, "telemetry.db");
  if (!fs.existsSync(dbPath)) return visible;
  const db = new DatabaseSync(dbPath, { readOnly: true, timeout: 2000 });
  try {
    const rows = db.prepare(`
      SELECT arguments FROM tool_calls
      WHERE session_id != 's' AND tool_name IN ('edit', 'write')
    `).all();
    return `${visible}\n${rows.map((row) => addedText(row.arguments)).join("\n")}`;
  } finally {
    db.close();
  }
}

function main() {
  const tasks = fs.readFileSync(SUITE, "utf8").trim().split("\n").map((line) => JSON.parse(line))
    .filter((task) => task.requirement_split?.survives);
  let silent = 0;
  let silentFlagged = 0;
  let passes = 0;
  let passFlagged = 0;
  let loud = 0;
  let loudFlagged = 0;
  for (const task of tasks) {
    const resultPath = path.join(RUNS, task.id, "result.json");
    if (!fs.existsSync(resultPath)) continue;
    const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
    if (result.grade_only || result.stopped) {
      console.log(`${task.id} skipped ${result.stopped || "grade_only"}`);
      continue;
    }
    const requirements = checklistOf(task.prompt);
    const flags = uncovered(requirements, evidenceOf(task));
    const flagged = flags.length > 0;
    if (result.class === "Silent fail") { silent += 1; if (flagged) silentFlagged += 1; }
    if (result.class === "Pass") { passes += 1; if (flagged) passFlagged += 1; }
    if (result.class === "Loud fail") { loud += 1; if (flagged) loudFlagged += 1; }
    console.log(`${task.id} ${result.class} requirements=${requirements.length} uncovered=${flags.length}${flagged ? "" : " clear"}`);
    for (const flag of flags.slice(0, 4)) console.log(`  - ${flag.requirement.slice(0, 140)}`);
  }
  console.log(`silent ${silentFlagged}/${silent} pass-flagged ${passFlagged}/${passes} loud-flagged ${loudFlagged}/${loud}`);
}

import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
