import assert from "node:assert/strict";
import { accessSync, constants, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const command = path.join(repository, "bin/pi-rework");

test("bin/pi-rework forwards arguments and command status to the TypeScript CLI", () => {
  const project = mkdtempSync(path.join(tmpdir(), "pi-rework-wrapper-"));
  const log = path.join(project, "state", "rework.jsonl");
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: project }).status, 0);
  mkdirSync(path.join(project, "docs"));
  writeFileSync(path.join(project, "docs", "SPEC-wrapper.md"), "# wrapper\n");
  mkdirSync(path.join(project, "docs", "SPEC-wrapper.plan"));
  writeFileSync(
    path.join(project, "docs", "SPEC-wrapper.plan", "plan.json"),
    JSON.stringify({ tasks: [{ id: "T6" }] }),
  );

  accessSync(command, constants.X_OK);
  const recorded = spawnSync(command, ["wrapper", "T6", "reason", "with spaces"], {
    cwd: project,
    env: { ...process.env, PI_BUILD_REWORK: log },
    encoding: "utf8",
  });
  assert.equal(recorded.status, 0, recorded.stderr);
  assert.equal(JSON.parse(readFileSync(log, "utf8")).reason, "reason with spaces");

  const rejected = spawnSync(command, ["wrapper", "missing", "bad task"], {
    cwd: project,
    env: { ...process.env, PI_BUILD_REWORK: log },
    encoding: "utf8",
  });
  assert.equal(rejected.status, 1);
  assert.match(`${rejected.stdout}\n${rejected.stderr}`, /T6/);

  const listed = spawnSync(command, ["--list", "wrapper"], {
    cwd: project,
    env: { ...process.env, PI_BUILD_REWORK: log },
    encoding: "utf8",
  });
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /reason with spaces/);
  assert.doesNotMatch(listed.stderr, /ExperimentalWarning/);
});
