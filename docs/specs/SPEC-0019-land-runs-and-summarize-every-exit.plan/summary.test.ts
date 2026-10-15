import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildSummary } from "../../../lib/run-summary.ts";

function fixture(t: any): string {
  const dir = mkdtempSync(join(tmpdir(), "spec19-plan-summary-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function put(dir: string, name: string, value: unknown) {
  writeFileSync(join(dir, name), typeof value === "string" ? value : JSON.stringify(value));
}
function db(file: string, rows: Array<[number, number, number]>) {
  const store = new DatabaseSync(file);
  store.exec("CREATE TABLE inference_calls (cost_usd REAL, prompt_tokens INTEGER, completion_tokens INTEGER)");
  const insert = store.prepare("INSERT INTO inference_calls VALUES (?, ?, ?)");
  for (const row of rows) insert.run(...row);
  store.close();
}
function metadata(dir: string) {
  put(dir, "pipeline.json", { spec: "docs/specs/SPEC-0042-demo.md", branch: "pipeline/review", base: "abcdef0123456789",
    baseBranch: "main", startedAt: "2026-10-15T12:00:00Z", stamp: "2026" });
}

test("failed summary is ordered and deterministic, reports missing stages and totals only real run sessions", (t) => {
  const dir = fixture(t);
  metadata(dir);
  put(dir, "gate-1.log", "T02: missing acceptance test");
  put(dir, "gate-0.log", "verification count changed");
  db(join(dir, "planner-telemetry.db"), [[0.25, 100, 10], [0.5, 200, 20]]);
  mkdirSync(join(dir, "tasks/task-one"), { recursive: true });
  db(join(dir, "tasks/task-one/editor-telemetry.db"), [[0.125, 400, 40]]);
  for (const exclude of ["branch", "work"]) {
    mkdirSync(join(dir, exclude));
    db(join(dir, exclude, `${exclude}-telemetry.db`), [[99, 99999, 99999]]);
  }
  const before = readdirSync(dir).sort();
  const metaBefore = readFileSync(join(dir, "pipeline.json"), "utf8");
  const input = { runDir: dir, outcome: { ok: false, stage: "gate", reason: "spec revision changed",
    branch: "pipeline/review", next: "Commit the spec, then start a new run." } };
  const text = buildSummary(input);
  assert.equal(buildSummary(input), text, "no clock, randomness or model output");
  for (const expected of ["SPEC-0042", "Failed", "gate", "spec revision changed", "pipeline/review", input.outcome.next,
    "docs/specs/SPEC-0042-demo.md", "abcdef0", "main", "2026-10-15T12:00:00Z", dir,
    "Gate round 1", "Gate round 2", "verification count changed", "missing acceptance test",
    "none recorded", "Grade not reached", "planner", "editor", "300", "400", "700", "70", "$0.75", "$0.13", "$0.88"]) {
    assert.ok(text.includes(expected), `missing ${expected}\n${text}`);
  }
  assert.ok(text.indexOf("Gate round 1") < text.indexOf("Gate round 2"));
  assert.ok(text.indexOf("Failed") < text.indexOf("abcdef0"));
  assert.ok(text.indexOf("abcdef0") < text.indexOf("Gate round 1"));
  assert.ok(text.indexOf("Gate round 2") < text.indexOf("none recorded"));
  assert.ok(text.indexOf("none recorded") < text.indexOf("Grade not reached"));
  assert.ok(text.indexOf("Grade not reached") < text.indexOf("$0.75"));
  assert.ok(!text.includes("99999"));
  assert.ok(!text.includes("$99.00"));
  assert.ok(!text.includes("report.md"));
  assert.deepEqual(readdirSync(dir).sort(), before, "summary builder writes nothing");
  assert.equal(readFileSync(join(dir, "pipeline.json"), "utf8"), metaBefore);
});

test("success includes passed gate, task details, all grade states, landing and absolute report path", (t) => {
  const dir = fixture(t);
  metadata(dir);
  put(dir, "gate.json", { result: "pass", checks: 13 });
  put(dir, "results.jsonl", [
    JSON.stringify({ id: "L01", acceptance: "pass", model: "editor-one", rounds: 3, providerCost: 0.25 }),
    JSON.stringify({ id: "L02", acceptance: "fail", model: "editor-two", rounds: 2, providerCost: 0.5 }), "",
  ].join("\n"));
  put(dir, "grade.json", { specTests: { code: 0 }, planTests: { code: 1 }, typecheck: { code: null } });
  put(dir, "report.md", "# Evidence package\n");
  const outcome = { ok: true, stage: "land", reason: "completed", landed: "main", branch: "pipeline/review" };
  const text = buildSummary({ runDir: dir, outcome });
  for (const expected of ["Landed on main", "Passed", "L01", "L02", "editor-one", "editor-two", "3", "2",
    "$0.25", "$0.50", "spec tests: pass", "plan tests: fail", "typecheck: not run", join(dir, "report.md")]) {
    assert.ok(text.includes(expected), `missing ${expected}\n${text}`);
  }
  assert.ok(!text.includes("Branch: pipeline/review"), "do not describe a deleted branch as kept");
  assert.ok(text.indexOf("L01") < text.indexOf("L02"));
  assert.ok(text.indexOf("spec tests: pass") < text.indexOf(join(dir, "report.md")));
  const kept = buildSummary({ runDir: dir, outcome: { ok: true, stage: "handoff", reason: "disabled", branch: "pipeline/review" } });
  assert.match(kept, /Handed off/);
  assert.match(kept, /pipeline\/review/);
  put(dir, "grade.json", { specTests: { code: 1 }, planTests: { code: 0 }, typecheck: { code: 2 } });
  const failed = buildSummary({ runDir: dir, outcome: { ok: false, stage: "grade", reason: "grade failed" } });
  for (const expected of ["spec tests: fail", "plan tests: pass", "typecheck: fail"]) assert.ok(failed.includes(expected));
});

test("empty run directory still reports missing inputs, not-reached stages and zero totals", (t) => {
  const dir = fixture(t);
  const text = buildSummary({ runDir: dir, outcome: { ok: false, stage: "plan", reason: "planning failed" } });
  assert.match(text, /planning failed/);
  assert.match(text, /missing/i);
  assert.match(text, /not reached/i);
  assert.match(text, /none recorded/);
  assert.match(text, /Grade not reached/);
  assert.match(text, /\$0\.00/);
});
