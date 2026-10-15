import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildSummary } from "../../../lib/run-summary.ts";

function telemetry(file: string, rows: Array<[number, number, number]>) {
  const db = new DatabaseSync(file);
  db.exec("CREATE TABLE inference_calls (cost_usd REAL, prompt_tokens INTEGER, completion_tokens INTEGER, subagent_role TEXT)");
  const insert = db.prepare("INSERT INTO inference_calls VALUES (?, ?, ?, 'planner')");
  for (const row of rows) insert.run(...row);
  db.close();
}

function runDir(t: any): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spec19-run-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "pipeline.json"), JSON.stringify({
    branch: "pipeline/SPEC-0042-x-2026", spec: "docs/specs/SPEC-0042-x.md", stamp: "2026", startedAt: "2026-10-15T12:06:36.023Z",
    base: "3ff1666fa71d72ccadf238568fb83d5ef14e38da", baseBranch: "main",
  }));
  fs.writeFileSync(path.join(dir, "gate-0.log"), "verification count changed");
  fs.writeFileSync(path.join(dir, "gate-1.log"), "verification count changed\nUNMAPPED_VERIFY 11");
  telemetry(path.join(dir, "planner-telemetry.db"), [[0.3, 50000, 2000], [0.17, 34183, 1000]]);
  telemetry(path.join(dir, "repair-1-telemetry.db"), [[0.11, 40211, 500]]);
  return dir;
}

test("a failed run's summary says what failed, every gate round, each session's cost and what to do next", (t) => {
  const dir = runDir(t);
  const text = buildSummary({ runDir: dir, outcome: { ok: false, stage: "gate", reason: "plan gate failed after two repairs", next: "Commit the spec, then call implement_spec again." } });
  for (const want of [
    "SPEC-0042", "Failed", "gate", "plan gate failed after two repairs", "Commit the spec, then call implement_spec again.",
    "3ff1666", "main", "Gate round 1", "Gate round 2", "UNMAPPED_VERIFY 11",
    "planner", "repair-1", "$0.47", "$0.11", "$0.58", "84183", "40211",
  ]) assert.ok(text.includes(want), `missing ${want}\n${text}`);
  assert.match(text, /grade[^\n]*not reached/i);
  assert.ok(!/report\.md/.test(text), "no report link when integration never ran");
});

test("a finished run's summary carries the grade, the tasks, the landing and the integration report", (t) => {
  const dir = runDir(t);
  fs.writeFileSync(path.join(dir, "gate.json"), JSON.stringify({ result: "pass", checks: 11 }));
  fs.writeFileSync(path.join(dir, "results.jsonl"),
    JSON.stringify({ id: "L01-ids", acceptance: "pass", model: "gpt-6-luna", rounds: 7, providerCost: 0.004 }) + "\n");
  fs.writeFileSync(path.join(dir, "grade.json"), JSON.stringify({ specTests: { code: 0 }, planTests: { code: 0 }, typecheck: { code: null } }));
  fs.writeFileSync(path.join(dir, "report.md"), "# report\n");
  const text = buildSummary({ runDir: dir, outcome: { ok: true, stage: "handoff", reason: "spec pass, plan pass", landed: "main" } });
  for (const want of ["Landed on main", "L01-ids", "gpt-6-luna", "spec tests: pass", "plan tests: pass", "typecheck: not run", path.join(dir, "report.md")]) {
    assert.ok(text.includes(want), `missing ${want}\n${text}`);
  }
});

test("a run directory with nothing in it still yields a summary", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spec19-empty-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const text = buildSummary({ runDir: dir, outcome: { ok: false, stage: "plan", reason: "planning failed" } });
  assert.match(text, /planning failed/);
  assert.match(text, /\$0\.00/);
});
