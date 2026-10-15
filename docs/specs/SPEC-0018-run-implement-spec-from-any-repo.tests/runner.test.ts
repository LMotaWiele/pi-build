import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";

const PI_BUILD = fs.realpathSync(path.resolve(import.meta.dirname, "../../.."));
const IMPLEMENT = path.join(PI_BUILD, "bin", "pi-implement");
const RUN_PLAN = path.join(PI_BUILD, "scripts", "run-plan.mjs");
const SPEC = "# S\n\n| Field | Value |\n|---|---|\n| Status | ready |\n\n## 8. Verification\n| O | C | Check ID: condition |\n|---|---|---|\n| O1 | §6.1 | V1: a |\n\n## 9. Stop\n";

function tmp(t: any, prefix: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// A hermetic environment: no quota hold, fixed settings, no pipeline markers.
function hermetic(t: any): Record<string, string | undefined> {
  const dir = tmp(t, "spec18-env-");
  const settings = path.join(dir, "settings.json");
  fs.writeFileSync(settings, JSON.stringify({
    routing: { tiers: { escalate: "openai-codex/gpt-6.1-sol", scout: "openai-codex/gpt-6-luna" } },
    pipeline: { pythonProject: "tools/map", runRoot: path.join(dir, "runs") },
  }));
  const env: Record<string, string | undefined> = { ...process.env, PI_BUILD_SETTINGS: settings, PI_BUILD_QUOTA_HOLD: path.join(dir, "no-hold.json") };
  delete env.PI_BUILD_PIPELINE; delete env.PI_BUILD_SUBAGENT_ROLE; delete env.PI_BUILD_TELEMETRY_DB;
  return env;
}

function target(t: any, files: Record<string, string>): string {
  const repo = tmp(t, "spec18-target-");
  execFileSync("git", ["init", "-q", repo]);
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), body);
  }
  return repo;
}

const run = (args: string[], cwd: string, env: Record<string, string | undefined>) =>
  spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", IMPLEMENT, ...args], { cwd, env, encoding: "utf8" });

test("a dry run against another repository resolves everything in that repository", (t) => {
  const env = hermetic(t);
  const repo = target(t, {
    "docs/specs/SPEC-00B1-demo.md": SPEC,
    "docs/specs/SPEC-00B1-demo.tests/a.test.ts": "",
  });
  const viaFlag = run(["00B1", "--repo", repo, "--dry-run"], PI_BUILD, env);
  assert.equal(viaFlag.status, 0, viaFlag.stderr);
  const out = JSON.parse(viaFlag.stdout);
  assert.equal(out.target, repo);
  assert.equal(out.harnessRoot, PI_BUILD);
  assert.equal(out.spec, "docs/specs/SPEC-00B1-demo.md");
  assert.equal(out.checks, 1);
  assert.ok(JSON.stringify(out.commands).includes("docs/specs/SPEC-00B1-demo.tests/a.test.ts"));
  assert.ok(out.runDir.endsWith(path.join(path.basename(repo), "SPEC-00B1-demo")), out.runDir);

  const fromInside = run(["00B1", "--dry-run"], repo, env);
  assert.equal(fromInside.status, 0, fromInside.stderr);
  assert.deepEqual(JSON.parse(fromInside.stdout), out);
});

test("a dry run on pi-build itself keeps pi-build as both harness and target, and the old run directory", (t) => {
  const env = hermetic(t);
  const result = run(["15", "--dry-run"], PI_BUILD, env);
  assert.equal(result.status, 0, result.stderr);
  const out = JSON.parse(result.stdout);
  assert.equal(out.target, PI_BUILD);
  assert.equal(out.harnessRoot, PI_BUILD);
  assert.match(out.spec, /^docs\/specs\/SPEC-0015-/);
  assert.equal(path.dirname(out.runDir), JSON.parse(fs.readFileSync(env.PI_BUILD_SETTINGS!, "utf8")).pipeline.runRoot);
});

test("a repository without /docs/specs is refused with exit 2 and a reason", (t) => {
  const repo = target(t, { "README.md": "" });
  const result = run(["00B1", "--repo", repo, "--dry-run"], PI_BUILD, hermetic(t));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /docs\/specs/);
});

test("Python spec tests with no Python project are refused before any model call", (t) => {
  const repo = target(t, {
    "docs/specs/SPEC-00B1-demo.md": SPEC,
    "docs/specs/SPEC-00B1-demo.tests/test_a.py": "",
  });
  const result = run(["00B1", "--repo", repo, "--dry-run"], PI_BUILD, hermetic(t));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /\.pi\/pipeline\.json/);
});

test("run-plan treats --repo as the repository", (t) => {
  const repo = target(t, { "plan.json": "{}" });
  const inside = path.join(repo, "run");
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", RUN_PLAN,
    "--repo", repo, "--plan", path.join(repo, "plan.json"), "--run-dir", inside], { encoding: "utf8", env: hermetic(t) });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /run-dir must sit outside the repository/);
});
