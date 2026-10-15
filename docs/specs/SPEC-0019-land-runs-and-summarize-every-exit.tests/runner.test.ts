import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";

const PI_BUILD = fs.realpathSync(path.resolve(import.meta.dirname, "../../.."));
const IMPLEMENT = path.join(PI_BUILD, "bin", "pi-implement");
const SPEC = "# S\n\n| Field | Value |\n|---|---|\n| Status | ready |\n\n## 8. Verification\n| O | C | Check ID: condition |\n|---|---|---|\n| O1 | §6.1 | V1: a |\n\n## 9. Stop\n";
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

function tmp(t: any, prefix: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function hermetic(t: any) {
  const dir = tmp(t, "spec19-env-");
  const runRoot = path.join(dir, "runs");
  const settings = path.join(dir, "settings.json");
  fs.writeFileSync(settings, JSON.stringify({
    routing: { tiers: { escalate: "openai-codex/gpt-6.1-sol", scout: "openai-codex/gpt-6-luna" } },
    pipeline: { runRoot },
  }));
  const env: Record<string, string | undefined> = { ...process.env, PI_BUILD_SETTINGS: settings, PI_BUILD_QUOTA_HOLD: path.join(dir, "no-hold.json") };
  delete env.PI_BUILD_PIPELINE; delete env.PI_BUILD_SUBAGENT_ROLE; delete env.PI_BUILD_TELEMETRY_DB;
  // A pi on PATH that fails loudly: any model call in these tests is a defect.
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "pi"), "#!/bin/sh\necho 'pi must not be called' >&2\nexit 99\n", { mode: 0o755 });
  env.PATH = `${bin}${path.delimiter}${env.PATH}`;
  return { env, runRoot };
}

function target(t: any, commitSpec: boolean): string {
  const repo = tmp(t, "spec19-target-");
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@t"); git(repo, "config", "user.name", "t");
  fs.writeFileSync(path.join(repo, "README.md"), "");
  git(repo, "add", "."); git(repo, "commit", "-q", "-m", "base");
  fs.mkdirSync(path.join(repo, "docs/specs/SPEC-0042-demo.tests"), { recursive: true });
  fs.writeFileSync(path.join(repo, "docs/specs/SPEC-0042-demo.md"), SPEC);
  fs.writeFileSync(path.join(repo, "docs/specs/SPEC-0042-demo.tests/a.test.ts"), "");
  if (commitSpec) { git(repo, "add", "."); git(repo, "commit", "-q", "-m", "spec"); }
  return repo;
}

const run = (args: string[], env: Record<string, string | undefined>) =>
  spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", IMPLEMENT, ...args], { cwd: PI_BUILD, env, encoding: "utf8" });

test("a run whose spec and tests are uncommitted is refused before any branch, run directory or model call", (t) => {
  const { env, runRoot } = hermetic(t);
  const repo = target(t, false);
  const result = run(["42", "--repo", repo], env);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /uncommitted/);
  assert.match(result.stderr, /SPEC-0042-demo/);
  assert.doesNotMatch(result.stderr, /pi must not be called/);
  assert.equal(git(repo, "branch", "--list", "pipeline/*"), "");
  assert.equal(fs.existsSync(runRoot), false);
});

test("a dry run only warns about an uncommitted spec, so a draft can still be inspected", (t) => {
  const { env } = hermetic(t);
  const repo = target(t, false);
  const result = run(["42", "--repo", repo, "--dry-run"], env);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /uncommitted/);
  assert.equal(JSON.parse(result.stdout).checks, 1);
});

test("a committed spec passes preflight; the run records where it started, then reaches planning", (t) => {
  const { env, runRoot } = hermetic(t);
  const repo = target(t, true);
  const base = git(repo, "rev-parse", "HEAD");
  const result = run(["42", "--repo", repo], env);
  assert.notEqual(result.status, 2, result.stderr);
  assert.match(result.stderr, /planning failed|pi must not be called/);
  const runs = path.join(runRoot, path.basename(repo), "SPEC-0042-demo");
  const [stamp] = fs.readdirSync(runs);
  const meta = JSON.parse(fs.readFileSync(path.join(runs, stamp, "pipeline.json"), "utf8"));
  assert.equal(meta.base, base);
  assert.equal(meta.baseBranch, "main");
  const summary = fs.readFileSync(path.join(runs, stamp, "summary.md"), "utf8");
  assert.match(summary, /Failed/);
  assert.match(summary, /plan/);
  assert.equal(git(repo, "rev-parse", "main"), base, "a failed run never moves main");
  git(repo, "worktree", "remove", "--force", path.join(runs, stamp, "branch"));
});

function zipFile(t: any, entries: Record<string, string>): string {
  const file = path.join(tmp(t, "spec19-zip-"), "download.zip");
  execFileSync("python3", ["-c",
    "import sys, json, zipfile\nz = zipfile.ZipFile(sys.argv[1], 'w')\nfor k, v in json.loads(sys.argv[2]).items(): z.writestr(k, v)\nz.close()",
    file, JSON.stringify(entries)]);
  return file;
}

function bareTarget(t: any): string {
  const repo = tmp(t, "spec19-bare-");
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@t"); git(repo, "config", "user.name", "t");
  fs.writeFileSync(path.join(repo, "README.md"), "");
  git(repo, "add", "."); git(repo, "commit", "-q", "-m", "base");
  return repo;
}

test("given a downloaded zip, a dry run reports the install and changes nothing", (t) => {
  const { env } = hermetic(t);
  const repo = bareTarget(t);
  const head = git(repo, "rev-parse", "HEAD");
  const source = zipFile(t, { "docs/specs/SPEC-NNNN-demo.md": SPEC, "docs/specs/SPEC-NNNN-demo.tests/a.test.ts": "" });
  const result = run([source, "--repo", repo, "--dry-run"], env);
  assert.equal(result.status, 0, result.stderr);
  const out = JSON.parse(result.stdout);
  assert.equal(out.install.id, "0001");
  assert.equal(out.install.spec, "docs/specs/SPEC-0001-demo.md");
  assert.equal(git(repo, "rev-parse", "HEAD"), head);
  assert.equal(git(repo, "status", "--porcelain"), "");
});

test("given a downloaded zip under ~, a real run installs and commits it, then runs from that commit", (t) => {
  const { env, runRoot } = hermetic(t);
  const repo = bareTarget(t);
  const home = tmp(t, "spec19-home-");
  fs.mkdirSync(path.join(home, "Downloads"));
  fs.copyFileSync(zipFile(t, { "SPEC-NNNN-demo.md": SPEC, "SPEC-NNNN-demo.tests/a.test.ts": "" }), path.join(home, "Downloads", "s.zip"));
  const result = run(["~/Downloads/s.zip", "--repo", repo], { ...env, HOME: home });
  assert.notEqual(result.status, 2, result.stderr);
  assert.match(result.stderr, /planning failed|pi must not be called/);
  assert.match(git(repo, "log", "-1", "--format=%s", "main"), /SPEC-0001/);
  const installed = git(repo, "rev-parse", "main");
  const runs = path.join(runRoot, path.basename(repo), "SPEC-0001-demo");
  const [stamp] = fs.readdirSync(runs);
  assert.equal(JSON.parse(fs.readFileSync(path.join(runs, stamp, "pipeline.json"), "utf8")).base, installed);
});
