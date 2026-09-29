// What every project gets: the scaffold's instructions, and the validator doctor runs on any project.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scaffoldProject, validateProject } from "../../../lib/scaffold.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const TEMPLATES = join(ROOT, "templates", "agent-memory");

test("scaffolded projects are not told to write explanations by hand", () => {
  const agents = readFileSync(join(TEMPLATES, "AGENTS.md"), "utf8");
  const notes = readFileSync(join(TEMPLATES, "notes", "README.md"), "utf8");
  for (const [name, text] of [["AGENTS.md", agents], ["notes/README.md", notes]] as const) {
    assert.doesNotMatch(text, /land in `\.agent\/explain\//, name);
    assert.doesNotMatch(text, /it goes in `\.agent\/explain\/`/, name);
  }
  assert.match(agents, /run record/);
});

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), "proj-"));
  writeFileSync(join(dir, "AGENTS.md"), "# project\n");
  scaffoldProject(dir, TEMPLATES);
  mkdirSync(join(dir, ".agent", "explain"), { recursive: true });
  return dir;
}

const strays = (dir: string) => validateProject(dir, TEMPLATES).lines.filter((l) => l.includes("not a walkthrough"));

test("any project: walkthroughs in .agent/explain pass", () => {
  const dir = project();
  writeFileSync(join(dir, ".agent", "explain", "2026-09-29-turn-1790675857539.md"), "## Unfamiliar surface\nx\n");
  assert.deepEqual(strays(dir), []);
});

test("any project: a report, a recap or a slug-named note in .agent/explain fails validation", () => {
  const dir = project();
  for (const f of ["2026-09-22-ab-results.md", "2026-09-29-session-1.md", "2026-09-29-turn.md"]) {
    writeFileSync(join(dir, ".agent", "explain", f), "x\n");
  }
  const s = strays(dir);
  assert.equal(s.length, 3, s.join("\n"));
  assert.ok(s.every((l) => l.startsWith("FAIL: not a walkthrough: .agent/explain/")), s.join("\n"));
});

test("any project: a legacy known.md in .agent/explain is tolerated", () => {
  const dir = project();
  writeFileSync(join(dir, ".agent", "explain", "known.md"), "ui.setFooter\n");
  assert.deepEqual(strays(dir), []);
});
