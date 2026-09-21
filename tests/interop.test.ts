import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  appendQueue,
  applyNoteUpdate,
  convertIndexToV1,
  convertNoteToV1,
  detectSchema,
  parseIndex,
  parseNote,
} from "../lib/markdown.ts";
import { mismatchLine, resolutionOf, resolveRouting, sessionClash, unselectableLine } from "../lib/models.ts";
import { findProjectRoot, gateRawNotesRead, migrateProject, scaffoldProject, validateProject } from "../lib/scaffold.ts";
import {
  activeTierName,
  attachTelemetry,
  beginUserTurn,
  consumeTurnCostLine,
  recordInference,
  recordToolCall,
  resetTelemetryForTests,
  resolvedResultBytes,
  setActiveTier,
} from "../lib/telemetry.ts";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const v0Index = fs.readFileSync(path.join(repo, "tests/fixtures/v0/INDEX.md"), "utf8");
const v0Note = fs.readFileSync(path.join(repo, "tests/fixtures/v0/note.md"), "utf8");

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pi-build-interop-"));
}

test("model resolution refuses a partial provider hit and falls back only when nothing matched", () => {
  const openrouter = { provider: "openrouter", id: "openai/gpt-5.6-luna", name: "Luna" };
  const terra = { provider: "openai", id: "gpt-5.6-terra", name: "Terra" };
  const luna = { provider: "openai", id: "gpt-5.6-luna", name: "Luna" };
  const mismatch = resolutionOf("openai/gpt-5.6-luna", [openrouter]);
  assert.equal(mismatch.kind, "mismatch");
  if (mismatch.kind === "mismatch") {
    assert.equal(mismatch.expectedProvider, "openai");
    assert.equal(mismatch.resolvedProvider, "openrouter");
    assert.equal(mismatch.resolvedId, "openai/gpt-5.6-luna");
  }
  assert.equal(resolutionOf("openai/gpt-5.6-luna", []).kind, "missing");
  assert.equal(resolutionOf("openai/gpt-5.6-luna", [luna]).kind, "exact");
  assert.equal(resolutionOf("openrouter/openai/gpt-5.6-luna", [openrouter]).kind, "exact");
  assert.equal(resolutionOf("OpenAI/gpt-5.6-luna", [luna]).kind, "mismatch");

  const refused = resolveRouting({
    tiers: { scout: "openai/gpt-5.6-luna", work: "openai/gpt-5.6-terra", escalate: "openai/gpt-5.6-luna", explain: "openai/gpt-5.6-luna" },
    catalog: [openrouter, terra],
    routingEnabled: true,
  });
  assert.equal(refused.fatal, true);
  assert.match(refused.refusals.join("\n"), /refuse to start: tier scout/);
  assert.match(refused.refusals.join("\n"), /expected provider openai/);
  assert.match(refused.refusals.join("\n"), /resolved openrouter\/openai\/gpt-5.6-luna/);

  const fallback = resolveRouting({
    tiers: { scout: "openai/gpt-5.6-luna", work: "openai/gpt-5.6-terra", escalate: "openai-codex/gpt-5.6-sol", explain: "openai/gpt-5.6-luna" },
    catalog: [luna, terra],
    routingEnabled: true,
  });
  assert.equal(fallback.fatal, false);
  assert.equal(fallback.tiers.escalate?.modelId, "openai/gpt-5.6-terra");
  assert.match(fallback.tiers.escalate?.warning ?? "", /using work/);

  const dead = resolveRouting({
    tiers: { scout: "missing/a", work: "missing/b", escalate: "missing/c", explain: "missing/d" },
    catalog: [luna],
    routingEnabled: true,
  });
  assert.equal(dead.fatal, true);
  assert.match(dead.refusals.join("\n"), /resolves to nothing/);

  const disabled = resolveRouting({
    tiers: { explain: "missing/d" },
    catalog: [luna],
    routingEnabled: false,
    defaultModel: "openai/gpt-5.6-luna",
  });
  assert.equal(disabled.fatal, false);
  assert.match(disabled.warnings.join("\n"), /routing is disabled|did not resolve/);

  const session = { provider: "openrouter", id: "openai/gpt-5.6-terra", name: "Terra" };
  const clash = sessionClash("openai/gpt-5.6-terra", session);
  assert.equal(clash?.kind, "mismatch");
  if (clash?.kind === "mismatch") {
    assert.match(mismatchLine("escalate", clash), /resolved openrouter\/openai\/gpt-5.6-terra/);
    assert.match(mismatchLine("escalate", clash), /expected provider openai/);
  }
  assert.equal(sessionClash("openai/gpt-5.6-terra", { provider: "openai", id: "gpt-5.6-terra" }), null);
  assert.match(unselectableLine("escalate", "openai/gpt-5.6-terra", session), /setModel refused/);
  assert.match(unselectableLine("escalate", "openai/gpt-5.6-terra", session), /session model is openrouter\/openai\/gpt-5.6-terra/);
});

test("legacy v0 index and note parse, and queue_append keeps the bullet list", () => {
  assert.equal(detectSchema(v0Index), 0);
  const parsed = parseIndex(v0Index);
  assert.equal(parsed.schemaVersion, 0);
  assert.equal(parsed.notes.some((row) => row.file === "cancellederror-baseexception-gotchas.md"), true);
  assert.equal(parsed.activeNext.length, 2);
  assert.equal(parsed.doNot.length, 1);
  assert.equal(parsed.glossary["plain Agent"]?.includes("Non-subclassed"), true);
  assert.match(parsed.glossary["`decided_by`"] ?? "", /transfer_to/);
  const note = parseNote(v0Note);
  assert.equal(note.status, "sealed");
  assert.ok(note.preCommitted.length >= 1);

  const next = appendQueue(v0Index, "check prices", "human", "2026-09-21");
  assert.equal(detectSchema(next), 0);
  assert.match(next, /^- check prices$/m);
  assert.doesNotMatch(next, /\| check prices \|/);
  const again = parseIndex(next);
  assert.equal(again.activeNext.at(-1)?.item, "check prices");
  assert.equal(again.doNot.length, 1);
  assert.equal(again.activeNext.length, parsed.activeNext.length + 1);

  const v1 = fs.readFileSync(path.join(repo, ".agent/notes/INDEX.md"), "utf8");
  const row = appendQueue(v1, "check prices", "human", "2026-09-21");
  assert.match(row, /\| \d+ \| check prices \| human \| 2026-09-21 \|/);
  assert.equal(detectSchema(row), 1);
});

test("note_update changes one field and leaves every other line untouched", () => {
  const note = `# Mail guard
**Status:** open
**Topic:** suite mail guard
**Last updated:** 2026-09-01

## Current claim
The suite does not send mail.

## Ruled out / confounds
- clock skew

## Evidence (pointers only)
- run / artifact: \`logs/1\`

## Pre-committed next
| If | Then |
|---|---|
| a send is observed | seal |

## Do not
- do not hit production

## Chronology
later
`;
  const next = applyNoteUpdate(note, "currentClaim", "Mail is suppressed.", "2026-09-21");
  assert.equal(parseNote(next).currentClaim, "Mail is suppressed.");
  assert.match(next, /## Pre-committed next/);
  const before = note.split("\n");
  const after = next.split("\n");
  assert.equal(after.length, before.length);
  for (let i = 0; i < before.length; i++) {
    if (before[i].startsWith("## Current claim") || before[i].startsWith("**Last updated:**")) continue;
    if (before[i] === "The suite does not send mail.") {
      assert.equal(after[i], "Mail is suppressed.");
      continue;
    }
    assert.equal(after[i], before[i], `line ${i + 1}`);
  }
});

test("telemetry attaches once per process and the session total accumulates", () => {
  const dir = tempDir();
  process.env.PI_BUILD_TELEMETRY_DB = path.join(dir, "telemetry.db");
  resetTelemetryForTests();
  const events: string[] = [];
  const host = (name: string) => ({
    on(event: string) {
      events.push(`${name}:${event}`);
    },
  });
  attachTelemetry(host("a"));
  attachTelemetry(host("b"));
  assert.equal(events.filter((event) => event.endsWith(":turn_end")).length, 1);
  assert.ok(events.every((event) => event.startsWith("a:")));
  setActiveTier("escalate", "provider/model");
  const stored = (globalThis as Record<symbol, { activeTier: string }>)[Symbol.for("pi-build.telemetry")];
  assert.equal(stored.activeTier, "escalate");
  stored.activeTier = "work";
  assert.equal(activeTierName(), "work");
  beginUserTurn("session-2", "one");
  recordInference({ tier: "work", model: "provider/model", promptTokens: 10, cachedTokens: 0, completionTokens: 4, reasoningTokens: 0, costUsd: 0.1 });
  assert.match(consumeTurnCostLine("work") ?? "", /session=\$0\.1000/);
  beginUserTurn("session-2", "two");
  recordInference({ tier: "work", model: "provider/model", promptTokens: 10, cachedTokens: 0, completionTokens: 4, reasoningTokens: 0, costUsd: 0.2 });
  const second = consumeTurnCostLine(activeTierName());
  assert.match(second ?? "", /tier=work calls=1/);
  assert.match(second ?? "", /session=\$0\.3000/);
  assert.equal(consumeTurnCostLine("work"), null);
});

test("telemetry stores blocked and deduped rows and a turn cost line", () => {
  const dir = tempDir();
  process.env.PI_BUILD_TELEMETRY_DB = path.join(dir, "telemetry.db");
  resetTelemetryForTests();
  beginUserTurn("session-1", "hello");
  recordToolCall({
    toolName: "read",
    arguments: { path: ".agent/notes/x.md" },
    path: "/proj/.agent/notes/x.md",
    resultBytes: 40,
    outcome: "blocked",
    blockedBy: "memory-gate",
  });
  recordToolCall({
    toolName: "read",
    arguments: { path: "src/a.ts" },
    path: "src/a.ts",
    resultBytes: 18,
    outcome: "deduped",
    blockedBy: "read-guard",
  });
  recordInference({ tier: "work", model: "provider/model", promptTokens: 100, cachedTokens: 25, completionTokens: 10, reasoningTokens: 4, costUsd: 0.5 });
  const line = consumeTurnCostLine("work");
  assert.match(line ?? "", /tier=work calls=1 prompt=100 cache=25\.0% completion=10 reasoning=40\.0% turn=\$0\.5000 session=\$0\.5000/);
  assert.equal(resolvedResultBytes({ resultBytes: 18 }, [{ text: "x".repeat(100) }]), 18);
  const db = new DatabaseSync(process.env.PI_BUILD_TELEMETRY_DB);
  const rows = db.prepare("SELECT arguments, path, result_bytes, outcome, blocked_by FROM tool_calls ORDER BY id").all() as {
    arguments: string;
    path: string;
    result_bytes: number;
    outcome: string;
    blocked_by: string;
  }[];
  assert.equal(rows.length, 2);
  assert.match(rows[0].arguments, /\.agent\/notes\/x\.md/);
  assert.equal(rows[0].path, "/proj/.agent/notes/x.md");
  assert.equal(rows[0].result_bytes, 40);
  assert.equal(rows[0].outcome, "blocked");
  assert.equal(rows[0].blocked_by, "memory-gate");
  assert.equal(rows[1].outcome, "deduped");
  assert.equal(rows[1].result_bytes, 18);
  db.close();
  delete process.env.PI_BUILD_TELEMETRY_DB;
  resetTelemetryForTests();
});

test("scaffold never overwrites, stays neutral, and round-trips a hand edit", () => {
  const dir = tempDir();
  const first = scaffoldProject(dir);
  assert.ok(first.created.includes("AGENTS.md"));
  assert.ok(first.created.includes(".agent/notes/INDEX.md"));
  assert.equal(spawnSync("grep", ["-rE", "note_open|memoryGate|\\.pi/|pi-build", path.join(dir, ".agent")], { encoding: "utf8" }).status, 1);

  const stamped = path.join(dir, "AGENTS.md");
  fs.writeFileSync(stamped, "custom agents\n");
  fs.writeFileSync(path.join(dir, ".agent/notes/INDEX.md"), "custom index\n");
  fs.writeFileSync(path.join(dir, ".agent/notes/README.md"), "custom readme\n");
  fs.writeFileSync(path.join(dir, ".agent/skills/notes-protocol/SKILL.md"), "custom skill\n");
  const second = scaffoldProject(dir);
  assert.deepEqual(second.created, []);
  assert.equal(fs.readFileSync(stamped, "utf8"), "custom agents\n");
  assert.equal(fs.readFileSync(path.join(dir, ".agent/notes/INDEX.md"), "utf8"), "custom index\n");

  const fresh = tempDir();
  scaffoldProject(fresh);
  const noteRel = ".agent/notes/mail.md";
  const note = `# Mail guard
**Status:** open
**Topic:** suite mail guard
**Last updated:** 2026-09-01

## Current claim
The suite does not send mail.

## Ruled out / confounds
- clock skew

## Evidence (pointers only)
- logs/1

## Pre-committed criteria
| If | Then |
|---|---|
| a send is observed | seal |

## Do not
- do not hit production
`;
  fs.writeFileSync(path.join(fresh, noteRel), note);
  const indexPath = path.join(fresh, ".agent/notes/INDEX.md");
  const opened = parseNote(fs.readFileSync(path.join(fresh, noteRel), "utf8"));
  assert.equal(opened.topic, "suite mail guard");
  const patched = applyNoteUpdate(fs.readFileSync(path.join(fresh, noteRel), "utf8"), "status", "open", "2026-09-21");
  fs.writeFileSync(path.join(fresh, noteRel), patched);
  const queued = appendQueue(fs.readFileSync(indexPath, "utf8"), "review the hand edit", "human", "2026-09-21");
  fs.writeFileSync(indexPath, queued);

  const handNote = patched.replace("The suite does not send mail.", "A person edited this claim.");
  fs.writeFileSync(path.join(fresh, noteRel), handNote);
  const handIndex = fs.readFileSync(indexPath, "utf8").replace(
    "| _(add rows as findings appear)_ | | | |",
    "| suite mail guard | [mail.md](mail.md) | open | mail stays off |\n| _(add rows as findings appear)_ | | | |",
  );
  fs.writeFileSync(indexPath, handIndex);
  const reopened = parseIndex(fs.readFileSync(indexPath, "utf8"));
  const reopenedNote = parseNote(fs.readFileSync(path.join(fresh, noteRel), "utf8"));
  assert.equal(reopened.notes.some((row) => row.file === "mail.md" && row.status === "open"), true);
  assert.equal(reopenedNote.currentClaim, "A person edited this claim.");
  assert.match(fs.readFileSync(indexPath, "utf8"), /review the hand edit/);
  const report = validateProject(fresh);
  assert.equal(report.ok, true, report.lines.join("\n"));
});

test("a notes path outside the active project root is not blocked", () => {
  const dir = tempDir();
  const home = path.join(dir, "home");
  const other = path.join(dir, "other");
  fs.mkdirSync(path.join(home, ".agent/notes"), { recursive: true });
  fs.mkdirSync(path.join(other, ".agent/notes"), { recursive: true });
  fs.writeFileSync(path.join(home, "AGENTS.md"), "# home\n");
  fs.writeFileSync(path.join(other, "AGENTS.md"), "# other\n");
  const file = path.join(other, ".agent/notes/x.md");
  fs.writeFileSync(file, "# x\n");
  assert.equal(findProjectRoot(path.join(home, "src")), home);
  const decision = gateRawNotesRead({ filePath: file, projectRoot: home, blockReads: true, force: false, parseFailed: false });
  assert.equal(decision.action, "warn");
  assert.match(decision.message ?? "", new RegExp(home));
  assert.match(decision.message ?? "", new RegExp(other));
  const inside = path.join(home, ".agent/notes/y.md");
  fs.writeFileSync(inside, "# y\n");
  assert.equal(gateRawNotesRead({ filePath: inside, projectRoot: home, blockReads: true, force: false, parseFailed: false }).action, "block");
  assert.equal(classifySafe(path.join(home, ".agent/explain/z.md")), "ignore");
});

function classifySafe(filePath: string): string {
  return gateRawNotesRead({ filePath, projectRoot: path.dirname(filePath), blockReads: true, force: false, parseFailed: false }).action;
}

test("doctor --project fails when an index status disagrees with the note", () => {
  const dir = tempDir();
  scaffoldProject(dir);
  fs.writeFileSync(
    path.join(dir, ".agent/notes/mail.md"),
    `# Mail guard
**Status:** open
**Topic:** suite mail guard
**Last updated:** 2026-09-21

## Current claim
held

## Ruled out / confounds
- none

## Evidence (pointers only)
- logs/1

## Pre-committed criteria
| If | Then |
|---|---|
| a send is observed | seal |

## Do not
- do not hit production
`,
  );
  const indexPath = path.join(dir, ".agent/notes/INDEX.md");
  const index = fs.readFileSync(indexPath, "utf8").replace(
    "| _(add rows as findings appear)_ | | | |",
    "| suite mail guard | [mail.md](mail.md) | sealed | wrong |\n| _(add rows as findings appear)_ | | | |",
  );
  fs.writeFileSync(indexPath, index);
  const report = validateProject(dir);
  assert.equal(report.ok, false);
  assert.match(report.lines.join("\n"), /status drift/);
  const doctor = spawnSync("bash", [path.join(repo, "doctor.sh"), "--project", dir], { encoding: "utf8" });
  assert.notEqual(doctor.status, 0);
  assert.match(`${doctor.stdout}\n${doctor.stderr}`, /status drift/);
});

test("migrate-notes writes v1 siblings and leaves the v0 files in place", () => {
  const dir = tempDir();
  const notes = path.join(dir, ".agent/notes");
  fs.mkdirSync(notes, { recursive: true });
  fs.writeFileSync(path.join(notes, "INDEX.md"), v0Index);
  fs.writeFileSync(path.join(notes, "note.md"), v0Note);
  capture(() => assert.equal(migrateProject(dir), 0));
  const original = fs.readFileSync(path.join(notes, "INDEX.md"), "utf8");
  assert.equal(original, v0Index);
  const converted = fs.readFileSync(path.join(notes, "INDEX.v1.md"), "utf8");
  assert.equal(detectSchema(converted), 1);
  assert.equal(parseIndex(converted).activeNext.length, 2);
  const note = fs.readFileSync(path.join(notes, "note.v1.md"), "utf8");
  assert.match(note, /## Pre-committed criteria/);
  assert.equal(convertNoteToV1(v0Note).includes("## Pre-committed next"), false);
  assert.equal(fs.readFileSync(path.join(notes, "note.md"), "utf8"), v0Note);
  const already = tempDir();
  scaffoldProject(already);
  assert.match(capture(() => migrateProject(already)), /already schema v1/);
  assert.equal(fs.existsSync(path.join(already, ".agent/notes/INDEX.v1.md")), false);
});

function capture(run: () => void): string {
  const lines: string[] = [];
  const write = console.log;
  console.log = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  try {
    run();
  } finally {
    console.log = write;
  }
  return lines.join("\n");
}

void convertIndexToV1;
