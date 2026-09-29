// The cleanup, as a checkable state of the repository.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { knownPath } from "../../../lib/explain.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const at = (p: string) => resolve(ROOT, p);
const files = (p: string) => (existsSync(at(p)) ? readdirSync(at(p)) : []);

test(".agent/explain holds walkthroughs only; the known list moved to the reader's file", () => {
  const stray = files(".agent/explain").filter((f) => !/^\d{4}-\d{2}-\d{2}-turn-[A-Za-z0-9-]+\.md$/.test(f));
  assert.deepEqual(stray, []);
});

test("session recaps live in .agent/recaps", () => {
  const stray = files(".agent/recaps").filter((f) => !/^\d{4}-\d{2}-\d{2}-session-\d+\.md$/.test(f));
  assert.deepEqual(stray, []);
});

test("the stale snapshot and the design directory are gone", () => {
  assert.equal(existsSync(at("docs/reference")), false);
  assert.deepEqual(files("docs/design").filter((f) => f.endsWith(".md")), []);
});

function indexStatuses(): Map<string, string> {
  const lines = readFileSync(at("docs/specs/index.md"), "utf8").split("\n").filter((l) => l.startsWith("|"));
  const cells = (l: string) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const header = cells(lines[0]);
  const s = header.findIndex((h) => h.toLowerCase() === "status");
  return new Map(lines.slice(2).map(cells).map((r) => [(r[0].match(/\d{4}/) ?? [""])[0], r[s]]));
}

test("reference trees remain only for specs not yet implemented", () => {
  const status = indexStatuses();
  for (const d of files("docs/specs").filter((f) => f.endsWith(".reference") && statSync(at(`docs/specs/${f}`)).isDirectory())) {
    const id = d.match(/^SPEC-(\d{4})/)?.[1] ?? "";
    assert.ok(["ready", "draft"].includes(status.get(id) ?? ""), `${d} belongs to a spec with status ${status.get(id)}`);
  }
});

test("every spec whose reports moved has a run record", () => {
  for (const id of ["0001", "0002", "0003", "0004", "0006", "0008", "0009", "0010"]) {
    assert.ok(existsSync(at(`docs/specs/SPEC-${id}-run.md`)), `SPEC-${id}-run.md`);
  }
});

test("the two v0.1 specs are indexed", () => {
  const index = readFileSync(at("docs/specs/index.md"), "utf8");
  assert.match(index, /docs\/design\/build-spec-pi-v0\.1\.md/);
  assert.match(index, /docs\/design\/fix-spec-pi-v0\.1-interop\.md/);
});

test("the reader's known list keeps pi and TypeScript entries and drops basics and repo names", () => {
  const known = readFileSync(knownPath(process.env), "utf8").split("\n").map((l) => l.trim());
  for (const keep of ["ui.setFooter", "tui.requestRender", "pi.appendEntry", "discriminated unions"]) assert.ok(known.includes(keep), keep);
  for (const drop of ["Array.find", "setTimeout", "try/finally", "Array.some", "Array.map", "for...of iteration", "object spread override", "DEFAULT_BOUNDS test expectations", "provider/model reference composition"]) {
    assert.ok(!known.includes(drop), drop);
  }
});

test("Lucas's reader is host configuration, not code", () => {
  const machina = JSON.parse(readFileSync(at("settings/hosts/machina.json"), "utf8"));
  const example = JSON.parse(readFileSync(at("settings/hosts/example.json"), "utf8"));
  assert.match(machina.explain?.reader ?? "", /Lucas/);
  assert.doesNotMatch(example.explain?.reader ?? "", /Lucas/);
});
