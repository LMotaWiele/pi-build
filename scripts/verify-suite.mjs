#!/usr/bin/env node
// Section 12.5. No model call.
// For every surviving task: hidden tests fail at the parent and pass at
// the commit, and visible tests fail at the parent. The declared split
// is what gets graded. 9e26310 cannot be split and is reported, not run.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { splitSources } from "./audit-graders.mjs";

const SUITE = path.resolve(import.meta.dirname, "../tests/routing-suite/tasks.jsonl");
const ROOT = "/home/george-contis/var/routing-runs/verify";
const PY = "/home/george-contis/Documents/agent-orchestration-harness/.venv/bin/python";
const TIMEOUT_S = "180";

function loadTasks() {
  return fs.readFileSync(SUITE, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function ensureTree(repo) {
  const dir = path.join(ROOT, `${path.basename(repo)}-wt`);
  fs.mkdirSync(ROOT, { recursive: true });
  if (!fs.existsSync(path.join(dir, ".git"))) {
    fs.rmSync(dir, { recursive: true, force: true });
    execFileSync("git", ["-C", repo, "worktree", "add", "--detach", dir, "HEAD"], { stdio: ["ignore", "inherit", "inherit"] });
  }
  return dir;
}

function reset(dir, sha) {
  execFileSync("git", ["-C", dir, "checkout", "--force", "--detach", sha], { stdio: ["ignore", "pipe", "pipe"] });
  execFileSync("git", ["-C", dir, "clean", "-fd"], { stdio: ["ignore", "pipe", "pipe"] });
}

function writeSources(dir, sources) {
  for (const source of sources) {
    const dest = path.join(dir, source.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, source.text);
  }
}

function countOf(text, pattern) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : 0;
}

function runGrade(dir, files) {
  if (!files.length) return { code: 1, pass: 0, fail: 0, out: "no files\n" };
  const python = files.some((file) => file.endsWith(".py"));
  const args = python
    ? [TIMEOUT_S, PY, "-m", "pytest", "-q", "--tb=no", ...files]
    : [TIMEOUT_S, process.execPath, "--experimental-strip-types", "--test", ...files];
  const env = python ? { ...process.env, PYTHONPATH: "src" } : process.env;
  let code = 0;
  let out = "";
  try {
    out = execFileSync("timeout", args, { cwd: dir, env, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  } catch (err) {
    code = err.status ?? 1;
    out = `${err.stdout || ""}${err.stderr || ""}`;
  }
  const pass = python ? countOf(out, /(\d+) passed/) : countOf(out, /ℹ pass (\d+)/);
  const fail = python ? countOf(out, /(\d+) failed/) : countOf(out, /ℹ fail (\d+)/);
  return { code, pass, fail, out };
}

function grade(dir, task, sha, side) {
  reset(dir, sha);
  const sources = splitSources(task, side);
  writeSources(dir, sources);
  const result = runGrade(dir, sources.map((source) => source.file));
  const logDir = path.join(ROOT, "logs");
  fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(path.join(logDir, `${task.id}-${sha.slice(0, 7)}-${side}.txt`), result.out);
  return result;
}

function main() {
  const tasks = loadTasks();
  const rows = [];
  let bad = 0;
  for (const task of tasks) {
    if (!task.requirement_split?.survives) {
      console.log(`${task.id} dropped`);
      rows.push({ id: task.id, survives: false });
      continue;
    }
    const dir = ensureTree(task.repo_path);
    const visibleParent = grade(dir, task, task.parent_sha, "visible");
    const hiddenParent = grade(dir, task, task.parent_sha, "hidden");
    const hiddenCommit = grade(dir, task, task.commit_sha, "hidden");
    const visibleCommit = grade(dir, task, task.commit_sha, "visible");
    const ok = visibleParent.code !== 0 && hiddenParent.code !== 0 && hiddenCommit.code === 0 && hiddenCommit.pass > 0 && visibleCommit.code === 0 && visibleCommit.pass > 0;
    if (!ok) bad += 1;
    const line = [
      task.id,
      ok ? "ok" : "BAD",
      `vis-parent ${visibleParent.pass}/${visibleParent.fail} e${visibleParent.code}`,
      `hid-parent ${hiddenParent.pass}/${hiddenParent.fail} e${hiddenParent.code}`,
      `hid-commit ${hiddenCommit.pass}/${hiddenCommit.fail} e${hiddenCommit.code}`,
      `vis-commit ${visibleCommit.pass}/${visibleCommit.fail} e${visibleCommit.code}`,
    ].join(" ");
    console.log(line);
    const brief = (result) => ({ code: result.code, pass: result.pass, fail: result.fail });
    rows.push({
      id: task.id,
      survives: true,
      ok,
      visibleParent: brief(visibleParent),
      hiddenParent: brief(hiddenParent),
      hiddenCommit: brief(hiddenCommit),
      visibleCommit: brief(visibleCommit),
    });
  }
  fs.writeFileSync(path.join(ROOT, "summary.json"), `${JSON.stringify(rows, null, 2)}\n`);
  const survivors = rows.filter((row) => row.survives && row.ok).length;
  console.log(`${survivors} tasks survive, ${bad} bad`);
  if (bad > 0 || survivors < 12) process.exitCode = 1;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) main();
