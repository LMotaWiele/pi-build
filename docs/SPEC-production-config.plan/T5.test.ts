import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const command = path.join(repository, "scripts/pi-rework.ts");

function run(cwd: string, log: string, args: string[]) {
  return spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", command, ...args], {
    cwd,
    env: { ...process.env, PI_BUILD_REWORK: log },
    encoding: "utf8",
  });
}

test("pi-rework records validated findings and lists only the current repository", () => {
  const project = mkdtempSync(path.join(tmpdir(), "pi-rework-command-"));
  const otherProject = mkdtempSync(path.join(tmpdir(), "pi-rework-other-"));
  const log = path.join(project, "state", "rework.jsonl");

  for (const root of [project, otherProject]) {
    assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
    mkdirSync(path.join(root, "docs"));
    writeFileSync(path.join(root, "docs", "SPEC-demo.md"), "# demo\n");
    mkdirSync(path.join(root, "docs", "SPEC-demo.plan"));
    writeFileSync(
      path.join(root, "docs", "SPEC-demo.plan", "plan.json"),
      JSON.stringify({ tasks: [{ id: "T1" }] }),
    );
  }

  const empty = run(project, log, ["--list", "demo"]);
  assert.equal(empty.status, 0, empty.stderr);
  assert.match(empty.stdout, /No rework recorded\./);

  const recorded = run(project, log, ["docs/SPEC-demo.md", "T1", "needs", "another", "pass"]);
  assert.equal(recorded.status, 0, recorded.stderr);
  assert.match(recorded.stdout, /demo/);
  assert.match(recorded.stdout, /T1/);

  const rows = readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].spec, "demo");
  assert.equal(rows[0].task, "T1");
  assert.equal(rows[0].reason, "needs another pass");
  assert.equal(rows[0].project, project);
  assert.equal(new Date(rows[0].at).toISOString(), rows[0].at);

  const rejected = [
    run(project, log, ["missing", "T1", "no spec"]),
    run(project, log, ["demo", "T1", "   "]),
    run(project, log, ["demo", "T9", "not joinable"]),
  ];
  for (const result of rejected) assert.equal(result.status, 1);
  assert.match(`${rejected[2].stdout}\n${rejected[2].stderr}`, /T1/);
  assert.match(`${rejected[2].stdout}\n${rejected[2].stderr}`, /\*/);
  assert.equal(readFileSync(log, "utf8").trim().split("\n").length, 1);

  writeFileSync(path.join(project, "docs", "SPEC-no-plan.md"), "# no plan\n");
  const noPlanTask = run(project, log, ["no-plan", "T1", "cannot join"]);
  assert.equal(noPlanTask.status, 1);
  const wholeSpec = run(project, log, ["no-plan", "*", "integration incomplete"]);
  assert.equal(wholeSpec.status, 0, wholeSpec.stderr);

  writeFileSync(path.join(project, "docs", "SPEC-broken.md"), "# broken\n");
  mkdirSync(path.join(project, "docs", "SPEC-broken.plan"));
  writeFileSync(path.join(project, "docs", "SPEC-broken.plan", "plan.json"), "{not json\n");
  const malformed = run(project, log, ["broken", "T1", "cannot bypass validation"]);
  assert.equal(malformed.status, 1);

  writeFileSync(path.join(project, "docs", "SPEC-second.md"), "# second\n");
  mkdirSync(path.join(project, "docs", "SPEC-second.plan"));
  writeFileSync(path.join(project, "docs", "SPEC-second.plan", "plan.json"), JSON.stringify({ tasks: [{ id: "T1" }] }));
  assert.equal(run(project, log, ["second", "T1", "second finding"]).status, 0);

  const other = run(otherProject, log, ["demo", "*", "other repository"]);
  assert.equal(other.status, 0, other.stderr);

  const listed = run(project, log, ["--list", "SPEC-demo"]);
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /needs another pass/);
  assert.doesNotMatch(listed.stdout, /integration incomplete|second finding|other repository/);

  const usage = run(project, log, ["demo", "T1"]);
  assert.equal(usage.status, 2);
  assert.match(`${usage.stdout}\n${usage.stderr}`, /--list/);
});
