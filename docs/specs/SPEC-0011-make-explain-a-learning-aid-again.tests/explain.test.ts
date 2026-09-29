import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptKnown, DEFAULT_EXPLAIN_READER, explainPrompt, identifiersIn, knownPath, NOTHING_UNFAMILIAR,
  parseExplanation, RECAP_DIR, resolveReader, shouldExplain, walkthroughFileName,
} from "../../../lib/explain.ts";

test("the prompt carries the given reader and asks for exactly two sections", () => {
  const p = explainPrompt({ reader: "READER-X", known: "ui.setFooter", files: ["a.ts"], diff: "+x" });
  assert.ok(p.startsWith("READER-X"));
  assert.ok(p.includes(NOTHING_UNFAMILIAR));
  assert.match(p, /## Unfamiliar surface/);
  assert.match(p, /## To modify this yourself/);
  for (const gone of ["What changed", "The alternative", "Verify by hand"]) assert.ok(!p.includes(gone), gone);
});

test("the reader comes from host settings; the default describes nobody in particular", () => {
  assert.equal(resolveReader({ explain: { reader: "  Someone.  " } }), "Someone.");
  assert.equal(resolveReader({}), DEFAULT_EXPLAIN_READER);
  assert.equal(resolveReader({ explain: { reader: "" } }), DEFAULT_EXPLAIN_READER);
  assert.doesNotMatch(DEFAULT_EXPLAIN_READER, /Lucas/);
});

test("the known list is per reader, shared across projects", () => {
  assert.equal(knownPath({}, "/home/u"), "/home/u/.pi/agent/known.md");
  assert.equal(knownPath({ PI_BUILD_EXPLAIN_KNOWN: "/tmp/k.md" }, "/home/u"), "/tmp/k.md");
});

test("nothing unfamiliar means no walkthrough and no known lines", () => {
  assert.deepEqual(parseExplanation(`  ${NOTHING_UNFAMILIAR}\n`), { nothing: true, unfamiliar: "", modify: "", known: [] });
});

const BODY = `## Unfamiliar surface
\`pi.sendMessage\` with \`deliverAs: "steer"\` injects text into the running turn.
\`ui.setFooter\` replaces the footer.

## To modify this yourself
Start in extensions/bounds.ts.

known: pi.sendMessage with deliverAs "steer"
known: ui.setFooter
known: DEFAULT_BOUNDS test expectations
known: Array.find`;

test("sections and known lines are parsed", () => {
  const e = parseExplanation(BODY);
  assert.equal(e.nothing, false);
  assert.match(e.unfamiliar, /pi\.sendMessage/);
  assert.match(e.modify, /extensions\/bounds\.ts/);
  assert.equal(e.known.length, 4);
});

test("a known line is kept only if its item is in the unfamiliar section and is not a repo name", () => {
  const e = parseExplanation(BODY);
  const repo = identifiersIn(["export const DEFAULT_BOUNDS = {};", "export function boundReason() {}"]);
  assert.deepEqual(acceptKnown(e.known, e.unfamiliar, repo), ['pi.sendMessage with deliverAs "steer"', "ui.setFooter"]);
});

test("known lines are refused when the unfamiliar section is empty", () => {
  assert.deepEqual(acceptKnown(["ui.setFooter"], "", new Set()), []);
});

test("repo identifiers are found in TypeScript and Python", () => {
  const ids = identifiersIn(["export function nextTier() {}\nconst CODEX = {};\nexport interface Row {}", "def double(n):\n    pass\nclass Store:\n    pass"]);
  for (const id of ["nextTier", "CODEX", "Row", "double", "Store"]) assert.ok(ids.has(id), id);
});

test("no walkthrough without written files, or inside a pipeline run", () => {
  assert.equal(shouldExplain(["a.ts"], {}), true);
  assert.equal(shouldExplain([], {}), false);
  assert.equal(shouldExplain(["a.ts"], { PI_BUILD_PIPELINE: "1" }), false);
});

test("a walkthrough is named by its turn id, and refuses to be named without one", () => {
  assert.equal(walkthroughFileName("2026-09-30", "t-8a6f6b69"), "2026-09-30-turn-t-8a6f6b69.md");
  assert.throws(() => walkthroughFileName("2026-09-30", "  "), /turn id/);
});

test("recaps have their own directory", () => {
  assert.equal(RECAP_DIR, ".agent/recaps");
});
