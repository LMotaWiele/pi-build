import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ParseError,
  appendQueue,
  applyNoteUpdate,
  classifyNotesPath,
  formatIndexInjection,
  gateNoteOpen,
  notesReadRejection,
  parseIndex,
  parseNote,
  replaceMarked,
  resolveTopic,
} from "../lib/markdown.ts";
import { estimateTokens, explainCommand, mergeKnown, selectTier, shouldWriteSessionRecap } from "../lib/telemetry.ts";
import { orientationBlock, extractAssistantText } from "../extensions/recap.ts";
import { explainAfterTurn, shouldExplain } from "../extensions/explain.ts";
import { knownEntriesFromExplanation } from "../lib/telemetry.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateIndex = fs.readFileSync(path.join(root, ".agent/notes/INDEX.md"), "utf8");
const readme = fs.readFileSync(path.join(root, ".agent/notes/README.md"), "utf8");

const NOTE = `# Mail guard
**Status:** open
**Topic:** suite mail guard
**Last updated:** 2026-09-01

## Current claim
The suite does not send mail.

## Ruled out / confounds
- clock skew

## Evidence (pointers only)
- run / artifact: \`logs/1\`

## Pre-committed criteria
| If | Then |
|---|---|
| a send is observed | seal |

## Do not
- do not hit production

## Chronology
later
`;

test("parseIndex reads the repo INDEX and drops placeholders", () => {
  const parsed = parseIndex(templateIndex);
  assert.equal(parsed.notes.some((row) => row.file === "README.md" && row.topic === "How to write notes"), true);
  assert.equal(parsed.notes.some((row) => row.topic.includes("add rows")), false);
  assert.equal(parsed.doNot.some((item) => item.includes("none yet")), false);
  assert.equal(parsed.glossary["_(project-specific verdicts / modes)_"], undefined);
  assert.ok(parsed.activeNext.length >= 1);
});

test("parseIndex empty template yields empty queue and do-not", () => {
  const empty = templateIndex
    .split("\n")
    .filter((line) => !/^\| \d+ \|/.test(line))
    .join("\n")
    .replace(/^- .+$/gm, "- _(none yet)_");
  const parsed = parseIndex(empty);
  assert.deepEqual(parsed.activeNext, []);
  assert.deepEqual(parsed.doNot, []);
});

test("parseIndex fails loudly when a heading is missing", () => {
  assert.throws(() => parseIndex("# Notes index\n\n## Notes\n"), (err: unknown) => {
    assert.ok(err instanceof ParseError);
    assert.match(err.message, /Active next/);
    assert.match(err.message, /Do not/);
    return true;
  });
});

test("parseNote matches the README front-matter headings", () => {
  assert.match(readme, /## Current claim/);
  assert.match(readme, /## Pre-committed criteria/);
  const note = parseNote(NOTE);
  assert.equal(note.status, "open");
  assert.equal(note.topic, "suite mail guard");
  assert.equal(note.currentClaim, "The suite does not send mail.");
  assert.deepEqual(note.ruledOut, ["clock skew"]);
  assert.equal(note.preCommitted[0].if, "a send is observed");
  assert.equal(note.preCommitted[0].then, "seal");
  assert.ok(note.bodyOffset < NOTE.length);
  assert.match(NOTE.slice(note.bodyOffset), /## Chronology/);
});

test("parseNote fails loudly on a malformed note", () => {
  assert.throws(() => parseNote("# Title\n**Status:** open\n"), (err: unknown) => {
    assert.ok(err instanceof ParseError);
    assert.match(err.message, /Current claim/);
    return true;
  });
});

test("note_open twice is rejected; override is allowed", () => {
  const first = gateNoteOpen(null, "/n/a.md", false);
  assert.equal(first.allow, true);
  const second = gateNoteOpen("/n/a.md", "/n/b.md", false);
  assert.equal(second.allow, false);
  assert.match(second.reason ?? "", /\/n\/a.md/);
  const forced = gateNoteOpen("/n/a.md", "/n/b.md", true);
  const wider = gateNoteOpen("/n/a.md", "/n/b.md", false, 2);
  assert.equal(wider.allow, true);
  assert.equal(forced.allow, true);
  assert.equal(forced.loggedOverride, true);
});

test("note_update rejects a sealed note and patches one field", () => {
  assert.throws(() => applyNoteUpdate(NOTE.replace("**Status:** open", "**Status:** sealed"), "topic", "x", "2026-09-21"), ParseError);
  const next = applyNoteUpdate(NOTE, "currentClaim", "Mail is suppressed.", "2026-09-21");
  const parsed = parseNote(next);
  assert.equal(parsed.currentClaim, "Mail is suppressed.");
  assert.equal(parsed.lastUpdated, "2026-09-21");
  assert.equal(parsed.topic, "suite mail guard");
  assert.match(next, /## Chronology/);
});

test("read interception matches notes and ignores skills and design docs", () => {
  assert.equal(classifyNotesPath(".agent/notes/x.md"), "note");
  assert.equal(classifyNotesPath("/repo/.agent/notes/INDEX.md"), "index");
  assert.equal(classifyNotesPath("/repo/.agent/notes/README.md"), "readme");
  assert.equal(classifyNotesPath(".agent/skills/x.md"), null);
  assert.equal(classifyNotesPath("docs/design/x.md"), null);
  assert.match(notesReadRejection("index"), /prefix/);
  assert.match(notesReadRejection("readme"), /skill/);
  assert.match(notesReadRejection("note", "suite mail guard"), /note_open/);
});

test("resolveTopic does not guess when ambiguous and does not search past the index", () => {
  const notes = [
    { topic: "Alpha mail", file: "a.md", status: "open", oneLiner: "mail path" },
    { topic: "Beta mail", file: "b.md", status: "open", oneLiner: "other" },
  ];
  assert.equal(resolveTopic(notes, "a.md").match?.topic, "Alpha mail");
  assert.equal(resolveTopic(notes, "Alpha mail").match?.file, "a.md");
  assert.equal(resolveTopic(notes, "mail").ambiguous?.length, 2);
  assert.equal(resolveTopic(notes, "missing").match, undefined);
});

test("queue append numbers the next row", () => {
  const before = parseIndex(templateIndex);
  const max = before.activeNext.reduce((acc, row) => {
    const n = Number.parseInt(row.n, 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  const next = appendQueue(templateIndex, "check prices", "human", "2026-09-21");
  const parsed = parseIndex(next);
  const last = parsed.activeNext[parsed.activeNext.length - 1];
  assert.equal(last.item, "check prices");
  assert.equal(last.source, "human");
  assert.equal(last.n, String(max + 1));
  assert.equal(parsed.activeNext.length, before.activeNext.length + 1);
});

test("marked memory block is injected once across two compactions", () => {
  const once = replaceMarked("", "Notes:\n| a |");
  const twice = replaceMarked(once, "Notes:\n| a |");
  assert.equal(twice.match(/<!-- pi-build:memory -->/g)?.length, 1);
  const orient = orientationBlock({ memory: once, claim: "claim", lastRecap: "shipped it." });
  const again = orientationBlock({ memory: orient, claim: "claim", lastRecap: "shipped it." });
  assert.equal(again.match(/<!-- pi-build:memory -->/g)?.length, 1);
  assert.match(again, /claim/);
});

test("session recap predicate, explain gate, known.md, tier map", () => {
  assert.equal(shouldWriteSessionRecap("quit", false), true);
  assert.equal(shouldWriteSessionRecap("reload", true), true);
  assert.equal(shouldWriteSessionRecap("reload", false), false);
  assert.equal(shouldExplain([]), false);
  assert.equal(shouldExplain(["a.ts"]), true);
  assert.equal(explainAfterTurn(["a.ts"], true), false);
  assert.equal(explainAfterTurn(["a.ts"], false), true);
  assert.equal(explainAfterTurn([], false), false);
  const args = explainCommand("hello").args;
  assert.equal(args[args.indexOf("--thinking") + 1], "off");
  assert.equal(args[args.indexOf("--tools") + 1], "read");
  assert.equal(args.includes("write"), false);
  assert.equal(args.includes("edit"), false);
  const known = mergeKnown("alpha\n", ["alpha", "beta"]);
  assert.equal(known, "alpha\nbeta\n");
  assert.deepEqual(knownEntriesFromExplanation("known: Map\nknown: Map\n"), ["Map", "Map"]);
  assert.equal(selectTier({ single_file_edit: true, needs_repo_reasoning: false, unfamiliar_stack: false, spec_exists: true, reversible: true }), "work");
  assert.equal(selectTier({ single_file_edit: false, needs_repo_reasoning: false, unfamiliar_stack: false, spec_exists: true, reversible: true }), "work");
  assert.equal(selectTier({ single_file_edit: true, needs_repo_reasoning: true, unfamiliar_stack: false, spec_exists: true, reversible: true }), "escalate");
  assert.equal(selectTier({ single_file_edit: false, needs_repo_reasoning: false, unfamiliar_stack: false, spec_exists: false, reversible: false }), "escalate");
  const text = extractAssistantText('{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"One. Two."}]}}\n');
  assert.equal(text, "One. Two.");
  const parsed = {
    notes: [{ topic: "t", file: "t.md", status: "open", oneLiner: "x".repeat(9000) }],
    activeNext: Array.from({ length: 12 }, (_, i) => ({ n: String(i + 1), item: "q".repeat(200), source: "human", added: "2026-09-21" })),
    doNot: ["stay"],
    glossary: { Mode: "a label" },
    raw: "",
    schemaVersion: 1,
  };
  const capped = formatIndexInjection(parsed, estimateTokens, 2000);
  assert.equal(capped.text.includes("Notes:"), false);
  assert.equal(capped.text.includes("Glossary"), false);
  assert.equal(capped.text.includes("x".repeat(20)), false);
  assert.match(capped.text, /Active next/);
  assert.match(capped.text, /Do not:\n- stay/);
  const big = formatIndexInjection(parsed, estimateTokens, 100);
  assert.equal(big.truncated, true);
  assert.match(big.text, /more queue rows omitted/);
  assert.equal(big.text.includes("Notes:"), false);
});
