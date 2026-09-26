#!/usr/bin/env node
// Section 12.6a. One arm, one task list.
// Pins the model, runs pi in a worktree at parent_sha, restores the
// declared visible and hidden tests after the process exits, grades
// both, and appends one outcome-matrix row.
// A finished result.json is not run again. s13-hard waits until the
// other tasks in the list have finished.

import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { splitSources } from "./audit-graders.mjs";

const REPO = path.resolve(import.meta.dirname, "..");
const SUITE = path.join(REPO, "tests/routing-suite/tasks.jsonl");
const MATRIX = path.join(REPO, ".agent/explain/2026-09-24-outcome-matrix.md");
const RUNS = "/home/george-contis/var/routing-runs";
const PY = "/home/george-contis/Documents/agent-orchestration-harness/.venv/bin/python";
const GRADE_TIMEOUT_S = "180";
const FIXTURE_MODELS = ["provider/model", "work", "unknown"];

const ARMS = {
  luna: { model: "openai-codex/gpt-5.6-luna", thinking: null, cap: 0.5, wallS: 2400, allowed: ["gpt-5.6-luna"] },
  sol: { model: "openai-codex/gpt-5.6-sol", thinking: "high", cap: null, wallS: 2400, allowed: ["gpt-5.6-sol"] },
  // The live catalog is openai-codex. The API provider has no key, so the
  // spec's openai/ pin would not be a Terra result.
  terra: { model: "openai-codex/gpt-5.6-terra", thinking: "medium", cap: 2, wallS: 2400, allowed: ["gpt-5.6-terra"] },
  "terra-low": { model: "openai-codex/gpt-5.6-terra", thinking: "low", cap: 2, wallS: 2400, allowed: ["gpt-5.6-terra"] },
};

function loadTasks() {
  return fs.readFileSync(SUITE, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function countOf(text, pattern) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : 0;
}

function runGrade(dir, files) {
  if (!files.length) return { code: 1, pass: 0, fail: 0, out: "no files\n" };
  const python = files.some((file) => file.endsWith(".py"));
  const args = python
    ? [GRADE_TIMEOUT_S, PY, "-m", "pytest", "-q", "--tb=line", ...files]
    : [GRADE_TIMEOUT_S, process.execPath, "--experimental-strip-types", "--test", ...files];
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

export function classify(visible, hidden, stopped) {
  if (stopped) return "censored";
  const vis = visible.code === 0 && visible.pass > 0;
  const hid = hidden.code === 0 && hidden.pass > 0;
  if (vis && hid) return "Pass";
  if (!vis && !hid) return "Loud fail";
  if (vis && !hid) return "Silent fail";
  return "Odd";
}

function tally(result) {
  if (result.pass === 0 && result.fail === 0) return `0 pass, 0 fail, exit ${result.code}`;
  return `${result.pass} pass, ${result.fail} fail`;
}

function writeSources(dir, sources) {
  for (const source of sources) {
    const dest = path.join(dir, source.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, source.text);
  }
}

function ensureWorktree(task, dir) {
  if (!fs.existsSync(path.join(dir, ".git"))) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    execFileSync("git", ["-C", task.repo_path, "worktree", "add", "--detach", dir, task.parent_sha], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
  execFileSync("git", ["-C", dir, "checkout", "--force", "--detach", task.parent_sha], { stdio: ["ignore", "pipe", "pipe"] });
  execFileSync("git", ["-C", dir, "clean", "-fd"], { stdio: ["ignore", "pipe", "pipe"] });
}

function queryDb(dbPath) {
  if (!fs.existsSync(dbPath)) return { cost: 0, parentCost: 0, rounds: 0, models: [], reads: 0 };
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const models = db.prepare(`
      SELECT DISTINCT model FROM inference_calls
      WHERE session_id != 's' AND model NOT IN ('provider/model', 'work', 'unknown')
    `).all().map((row) => row.model);
    const total = db.prepare(`
      SELECT COALESCE(SUM(cost_usd), 0) AS cost, COUNT(*) AS n FROM inference_calls
      WHERE session_id != 's' AND model NOT IN ('provider/model', 'work', 'unknown')
    `).get();
    const parent = db.prepare(`
      SELECT COALESCE(SUM(cost_usd), 0) AS cost, COUNT(*) AS n FROM inference_calls
      WHERE session_id != 's' AND parent_turn_id IS NULL
        AND model NOT IN ('provider/model', 'work', 'unknown')
    `).get();
    const tools = db.prepare(`
      SELECT tool_name, path FROM tool_calls
      WHERE session_id != 's' AND parent_turn_id IS NULL
      ORDER BY ts, id
    `).all();
    const seen = new Set();
    let reads = 0;
    for (const tool of tools) {
      if (tool.tool_name === "edit" || tool.tool_name === "write") break;
      if (tool.tool_name === "read" && tool.path && !seen.has(tool.path)) {
        seen.add(tool.path);
        reads += 1;
      }
    }
    return { cost: total.cost, parentCost: parent.cost, rounds: parent.n, models, reads };
  } finally {
    db.close();
  }
}

function killGroup(child) {
  if (!child.pid) return;
  try { process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ }
  setTimeout(() => {
    try { process.kill(-child.pid, "SIGKILL"); } catch { /* already gone */ }
  }, 5000).unref();
}

function runPi(task, arm, work, dbPath, sessionDir, logPath) {
  const args = ["-p", "--", task.prompt, "--model", arm.model, "--approve", "--session-dir", sessionDir];
  if (arm.thinking) args.push("--thinking", arm.thinking);
  const env = { ...process.env };
  delete env.PI_OFFLINE;
  delete env.SMART_ROUTER_DATASET;
  env.PI_BUILD_TELEMETRY_DB = dbPath;
  const log = fs.openSync(logPath, "w");
  const started = Date.now();
  const child = spawn("pi", args, {
    cwd: work,
    env,
    detached: true,
    stdio: ["ignore", log, log],
  });
  return new Promise((resolve) => {
    let stopped = null;
    const timer = setInterval(() => {
      const stats = queryDb(dbPath);
      const foreign = stats.models.filter((model) => !arm.allowed.includes(model) && !FIXTURE_MODELS.includes(model));
      if (foreign.length) stopped = "pin";
      else if (arm.cap != null && stats.cost > arm.cap) stopped = "cost-cap";
      else if ((Date.now() - started) / 1000 > arm.wallS) stopped = "wall";
      if (stopped) {
        clearInterval(timer);
        killGroup(child);
      }
    }, 5000);
    child.on("error", (err) => {
      clearInterval(timer);
      fs.closeSync(log);
      resolve({ code: 127, stopped: "spawn", wallS: (Date.now() - started) / 1000, error: String(err) });
    });
    child.on("close", (code) => {
      clearInterval(timer);
      fs.closeSync(log);
      resolve({ code: code ?? 1, stopped, wallS: (Date.now() - started) / 1000 });
    });
  });
}

function gradeSide(work, task, side) {
  const sources = splitSources(task, side);
  writeSources(work, sources);
  const graded = runGrade(work, sources.map((source) => source.file));
  return { sources, graded };
}

function appendRow(armName, row) {
  const lock = `${MATRIX}.lock`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const fd = fs.openSync(lock, "wx");
      fs.closeSync(fd);
      break;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  try {
    let text = fs.readFileSync(MATRIX, "utf8");
    const header = `## Section 12 Phase B — ${armName}`;
    if (!text.includes(header)) {
      text += `\n${header}\n\nRun trees are under \`/home/george-contis/var/routing-runs/${armName}\`. A cost-cap stop is censored.\n\n| Task | Class | Visible | Held-out | Provider $ | Parent $ | Rounds | Wall s | Reads | Stop |\n|---|---|---|---|---|---|---|---|---|---|\n`;
    }
    const section = text.slice(text.indexOf(header));
    const line = `| ${row.id} | ${row.class} | ${row.visible} | ${row.heldout} | ${row.provider} | ${row.parent} | ${row.rounds} | ${row.wall} | ${row.reads} | ${row.stopped || ""} |\n`;
    if (!section.includes(`| ${row.id} |`)) text += line;
    fs.writeFileSync(MATRIX, text);
  } finally {
    fs.rmSync(lock, { force: true });
  }
}

function money(value) {
  return Number(value || 0).toFixed(8);
}

async function runTask(task, armName, arm, gradeOnly) {
  const root = path.join(RUNS, armName, task.id);
  const work = path.join(root, "work");
  const resultPath = path.join(root, "result.json");
  fs.mkdirSync(root, { recursive: true });
  if (fs.existsSync(resultPath)) {
    const prior = JSON.parse(fs.readFileSync(resultPath, "utf8"));
    if (prior.class && !prior.grade_only) return prior;
  }
  console.log(`${task.id} start`);
  if (!task.prompt || (task.historical_prompt && task.prompt === task.historical_prompt)) {
    throw new Error(`${task.id} prompt is empty or equal to historical_prompt`);
  }
  ensureWorktree(task, work);
  const visible = splitSources(task, "visible");
  const hidden = splitSources(task, "hidden");
  writeSources(work, visible);
  const restore = [];
  restore.push(`${new Date().toISOString()} visible-placed ${visible.map((source) => `${source.file} ${sha256(source.text)}`).join(" ")}`);
  for (const source of hidden) {
    const dest = path.join(work, source.file);
    const covered = visible.some((item) => item.file === source.file);
    if (!covered && fs.existsSync(dest) && fs.readFileSync(dest, "utf8") === source.text) {
      throw new Error(`${task.id} hidden file ${source.file} is already the declared text`);
    }
  }
  const dbPath = path.join(root, "telemetry.db");
  const sessionDir = path.join(root, "sessions");
  fs.mkdirSync(sessionDir, { recursive: true });
  let pi = { code: null, stopped: null, wallS: 0 };
  if (!gradeOnly) {
    restore.push(`${new Date().toISOString()} pi-start`);
    fs.appendFileSync(path.join(root, "restore.log"), `${restore.join("\n")}\n`);
    pi = await runPi(task, arm, work, dbPath, sessionDir, path.join(root, "pi.log"));
    restore.length = 0;
    restore.push(`${new Date().toISOString()} pi-exit ${pi.code} ${pi.stopped || ""}`);
  }
  for (const source of hidden) {
    const dest = path.join(work, source.file);
    const before = fs.existsSync(dest) ? sha256(fs.readFileSync(dest)) : "absent";
    restore.push(`${new Date().toISOString()} hidden-before ${source.file} ${before}`);
  }
  const visibleGrade = gradeSide(work, task, "visible");
  restore.push(`${new Date().toISOString()} visible-restored ${visibleGrade.sources.map((source) => source.file).join(" ")}`);
  const hiddenGrade = gradeSide(work, task, "hidden");
  restore.push(`${new Date().toISOString()} hidden-overlaid ${hiddenGrade.sources.map((source) => `${source.file} ${sha256(source.text)}`).join(" ")}`);
  fs.writeFileSync(path.join(root, "visible-grade.txt"), visibleGrade.graded.out);
  fs.writeFileSync(path.join(root, "hidden-grade.txt"), hiddenGrade.graded.out);
  fs.appendFileSync(path.join(root, "restore.log"), `${restore.join("\n")}\n`);
  const stats = gradeOnly ? { cost: 0, parentCost: 0, rounds: 0, models: [], reads: 0 } : queryDb(dbPath);
  const stopped = pi.stopped;
  const result = {
    id: task.id,
    arm: armName,
    class: classify(visibleGrade.graded, hiddenGrade.graded, stopped),
    visible: tally(visibleGrade.graded),
    heldout: tally(hiddenGrade.graded),
    provider_cost: stats.cost,
    parent_cost: stats.parentCost,
    rounds: stats.rounds,
    wall_s: Number(pi.wallS.toFixed(3)),
    reads: stats.reads,
    stopped,
    pi_exit: pi.code,
    models: stats.models,
    grade_only: gradeOnly,
  };
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  if (!gradeOnly) {
    appendRow(armName, {
      id: result.id,
      class: result.class,
      visible: result.visible,
      heldout: result.heldout,
      provider: money(result.provider_cost),
      parent: money(result.parent_cost),
      rounds: result.rounds,
      wall: result.wall_s.toFixed(3),
      reads: result.reads,
      stopped: result.stopped,
    });
  }
  console.log(`${result.id} ${result.class} ${money(result.provider_cost)} ${result.visible} ${result.heldout}`);
  return result;
}

async function pool(items, limit, fn) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift());
  });
  await Promise.all(workers);
}

async function main() {
  const armName = process.argv[2];
  const listPath = process.argv[3];
  const gradeOnly = process.env.RUN_ARM_GRADE_ONLY === "1";
  const arm = ARMS[armName];
  if (!arm || !listPath) {
    process.stderr.write("usage: scripts/run-arm.sh <luna|sol|terra|terra-low> <task-list>\n");
    process.exitCode = 2;
    return;
  }
  const wanted = fs.readFileSync(listPath, "utf8").split("\n").map((line) => line.replace(/#.*/, "").trim()).filter(Boolean);
  const tasks = loadTasks();
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const selected = [];
  for (const id of wanted) {
    const task = byId.get(id);
    if (!task) throw new Error(`unknown task ${id}`);
    if (!task.requirement_split?.survives) {
      console.log(`${id} skipped`);
      continue;
    }
    selected.push(task);
  }
  const last = selected.filter((task) => task.id === "s13-hard");
  const first = selected.filter((task) => task.id !== "s13-hard");
  const limit = Number(process.env.RUN_ARM_CONCURRENCY || 3);
  const results = [];
  await pool(first, limit, async (task) => {
    try {
      results.push(await runTask(task, armName, arm, gradeOnly));
    } catch (err) {
      console.log(`${task.id} ERROR ${err.message}`);
      results.push({ id: task.id, class: null, error: String(err) });
    }
  });
  for (const task of last) {
    try {
      results.push(await runTask(task, armName, arm, gradeOnly));
    } catch (err) {
      console.log(`${task.id} ERROR ${err.message}`);
      results.push({ id: task.id, class: null, error: String(err) });
    }
  }
  const bad = results.filter((result) => !result.class);
  const status = path.join(RUNS, armName, "status.txt");
  fs.mkdirSync(path.dirname(status), { recursive: true });
  if (bad.length) {
    fs.writeFileSync(status, `FAILED ${bad.map((result) => result.id).join(" ")}\n`);
    process.exitCode = 1;
  } else {
    fs.writeFileSync(status, `DONE ${results.length}\n`);
  }
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) main();
