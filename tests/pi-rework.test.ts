import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const command = join(root, "bin", "pi-rework");

function run(cwd: string, log: string, args: string[]) {
  return spawnSync(command, args, {
    cwd,
    env: { ...process.env, PI_BUILD_REWORK: log },
    encoding: "utf8",
  });
}

test("pi-rework resolves numbered specs by ID, slug, and path", () => {
  const project = mkdtempSync(join(tmpdir(), "pi-rework-numbered-"));
  const specs = join(project, "docs", "specs");
  const log = join(project, "state", "rework.jsonl");
  execFileSync("git", ["init", "-q"], { cwd: project });
  mkdirSync(join(specs, "SPEC-0001-alpha.plan"), { recursive: true });
  writeFileSync(join(specs, "SPEC-0001-alpha.md"), "# alpha\n");
  writeFileSync(join(specs, "SPEC-0001-alpha.plan", "plan.json"), JSON.stringify({ tasks: [{ id: "T1" }] }));
  writeFileSync(join(specs, "SPEC-0002-beta.md"), "# beta\n");

  for (const spec of ["0001", "alpha", "docs/specs/SPEC-0001-alpha.md"]) {
    const result = run(project, log, [spec, "T1", "redo"]);
    assert.equal(result.status, 0, result.stderr);
  }
  const rows = readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.spec === "alpha"));

  const unknown = run(project, log, ["missing", "*", "redo"]);
  assert.equal(unknown.status, 1);
  assert.match(`${unknown.stdout}\n${unknown.stderr}`, /Candidates:.*0001 alpha.*0002 beta/);
});
