#!/usr/bin/env node
// Section 13 C3. Blind tests, Luna only.
// The generator runs in a sandbox that cannot see either repository.
// It writes one test from the prompt. That file is copied onto the
// finished Luna worktree, run by itself, and deleted. A missing file
// is not a flag. Hidden tests are not an input and are not executed.

import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { piArgs } from "./run-arm.mjs";

const REPO = path.resolve(import.meta.dirname, "..");
const SUITE = path.join(REPO, "tests/routing-suite/tasks.jsonl");
const LUNA_RUNS = "/home/george-contis/var/routing-runs/luna";
const C3 = "/home/george-contis/var/routing-runs/c3";
const PY = "/home/george-contis/Documents/agent-orchestration-harness/.venv/bin/python";
const NODE_BIN = path.dirname(process.execPath);
const GRADE_TIMEOUT_S = "180";

export const LUNA = {
  model: "openai-codex/gpt-5.6-luna",
  thinking: null,
  cap: 0.2,
  wallS: 600,
  allowed: ["gpt-5.6-luna"],
};

export const BLIND_REL = {
  "pi-build": "tests/routing-blind.test.ts",
  "agent-orchestration-harness": "tests/test_routing_blind.py",
};

const FILE_BINDS = [
  ["/home/george-contis/.pi/agent/auth.json", "/home/george-contis/.pi/agent/auth.json"],
  ["/home/george-contis/src/pi-build/settings/hosts/machina.json", "/home/george-contis/.pi/agent/settings.json"],
  ["/home/george-contis/src/pi-build/agent/models.json", "/home/george-contis/.pi/agent/models.json"],
  ["/home/george-contis/src/pi-build/settings/web-search.json", "/home/george-contis/.pi/agent/web-search.json"],
  ["/home/george-contis/src/pi-build/agent/AGENTS.md", "/home/george-contis/.pi/agent/AGENTS.md"],
];

export function blindPrompt(task) {
  const rel = BLIND_REL[task.repo];
  const python = task.repo === "agent-orchestration-harness";
  return [
    "Write one test file and nothing else.",
    `Create ${rel} and do not create any other file.`,
    "The implementation is not in this directory. Do not search, read, or run a command.",
    python
      ? "Use pytest. Import the declared package as agent_orchestration_harness. Do not import any other test module."
      : "Use node:test and node:assert/strict. From this file, import lib/example.ts as ../lib/example.ts, with the .ts suffix. Do not import any other test module.",
    "Assert only behaviour the prompt states, through names the prompt declares. Do not add a requirement the prompt does not state. Do not invent a number.",
    "Do not run the test.",
    "",
    task.prompt,
  ].join("\n");
}

export function sandboxArgs(genDir) {
  const args = [
    "--ro-bind", "/usr", "/usr",
    "--ro-bind", "/lib", "/lib",
    "--ro-bind", "/lib64", "/lib64",
    "--ro-bind", "/etc", "/etc",
    "--ro-bind", "/run", "/run",
    "--proc", "/proc",
    "--dev", "/dev",
    "--tmpfs", "/tmp",
    "--dir", "/home",
    "--dir", "/home/george-contis",
    "--ro-bind", "/home/george-contis/.nvm", "/home/george-contis/.nvm",
    "--dir", "/home/george-contis/.pi",
    "--dir", "/home/george-contis/.pi/agent",
    "--ro-bind", "/home/george-contis/.pi/agent/git", "/home/george-contis/.pi/agent/git",
    "--ro-bind", "/home/george-contis/.pi/agent/npm", "/home/george-contis/.pi/agent/npm",
  ];
  for (const [source, dest] of FILE_BINDS) args.push("--ro-bind", source, dest);
  args.push(
    "--bind", genDir, "/work",
    "--chdir", "/work",
    "--die-with-parent",
    "--clearenv",
    "--setenv", "HOME", "/home/george-contis",
    "--setenv", "PATH", `${NODE_BIN}:/usr/bin:/bin`,
    "--setenv", "USER", "george-contis",
    "--setenv", "LANG", "C.UTF-8",
    "--setenv", "TERM", "dumb",
  );
  return args;
}

export function importsExistingTest(text, files) {
  const bases = (files || []).map((file) => path.basename(file));
  for (const line of text.split("\n")) {
    if (!/\b(import|from|require)\b/.test(line)) continue;
    for (const base of bases) {
      if (line.includes(base)) return line.trim();
      const stem = base.replace(/\.py$/, "").replace(/\.test\.ts$/, "");
      if (stem.length >= 8 && line.includes(stem)) return line.trim();
    }
  }
  return null;
}

export function looksLikeTest(text, kind) {
  if (!text || text.trim().length < 20) return false;
  if (kind === "py") return /\bdef test_/.test(text);
  return /\b(?:test|it)\(/.test(text);
}

export function blindVerdict({ stopped, generated, grade, importedTest }) {
  if (stopped) return { flagged: false, outcome: "censored" };
  if (importedTest) return { flagged: false, outcome: "imports-tests" };
  if (!generated) return { flagged: false, outcome: "missing" };
  if (!grade || (grade.pass === 0 && grade.fail === 0 && grade.code === 0)) {
    return { flagged: false, outcome: generated && grade ? "empty" : "ungraded" };
  }
  const failed = grade.code !== 0 || grade.fail > 0 || grade.pass === 0;
  return { flagged: failed, outcome: failed ? "fail" : "pass" };
}

export function scoreChecks(rows) {
  const take = (name) => rows.filter((row) => row.class === name);
  const flagged = (list) => list.filter((row) => row.flagged).length;
  const silent = take("Silent fail");
  const pass = take("Pass");
  const loud = take("Loud fail");
  return {
    silent: [flagged(silent), silent.length],
    pass: [flagged(pass), pass.length],
    loud: [flagged(loud), loud.length],
  };
}

export function parseStatusZ(buffer) {
  const parts = buffer.toString("utf8").split("\0").filter((part) => part.length > 0);
  const files = [];
  for (let i = 0; i < parts.length; i += 1) {
    const entry = parts[i];
    const status = entry.slice(0, 2);
    const file = entry.slice(3);
    if (status.startsWith("R") || status.startsWith("C")) {
      files.push({ status, file: parts[i + 1], from: file });
      i += 1;
    } else {
      files.push({ status, file });
    }
  }
  return files;
}

function gitStatus(work) {
  return execFileSync("git", ["-C", work, "status", "--porcelain", "-z", "-uall"], { maxBuffer: 8 * 1024 * 1024 });
}

export function snapshotTree(work) {
  const files = new Map();
  for (const item of parseStatusZ(gitStatus(work))) {
    const abs = path.join(work, item.file);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) files.set(item.file, fs.readFileSync(abs));
    else files.set(item.file, null);
  }
  return files;
}

export function sameTree(before, after) {
  if (before.size !== after.size) return false;
  for (const [file, bytes] of before) {
    if (!after.has(file)) return false;
    const other = after.get(file);
    if (bytes == null || other == null) {
      if (bytes !== other) return false;
    } else if (!bytes.equals(other)) return false;
  }
  return true;
}

export function restoreTree(work, before) {
  const after = parseStatusZ(gitStatus(work));
  const seen = new Set(after.map((item) => item.file));
  for (const item of after) {
    const abs = path.join(work, item.file);
    if (!before.has(item.file)) {
      if (item.status === "??" || item.status === "!!") fs.rmSync(abs, { force: true, recursive: true });
      else execFileSync("git", ["-C", work, "checkout", "--", item.file], { stdio: ["ignore", "pipe", "pipe"] });
      continue;
    }
    writeBack(abs, before.get(item.file));
  }
  for (const [file, bytes] of before) {
    if (seen.has(file)) continue;
    writeBack(path.join(work, file), bytes);
  }
}

function writeBack(abs, bytes) {
  if (bytes == null) {
    fs.rmSync(abs, { force: true, recursive: true });
    return;
  }
  if (fs.existsSync(abs) && fs.statSync(abs).isFile() && fs.readFileSync(abs).equals(bytes)) return;
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, bytes);
}

function countOf(text, pattern) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : 0;
}

export function gradeBlind(work, rel, kind) {
  const scratch = path.join(os.tmpdir(), `c3-grade-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
  const args = kind === "py"
    ? [GRADE_TIMEOUT_S, PY, "-m", "pytest", "-q", "--tb=line", "-p", "no:cacheprovider", rel]
    : [GRADE_TIMEOUT_S, process.execPath, "--experimental-strip-types", "--test", rel];
  const env = { ...process.env, PI_BUILD_TELEMETRY_DB: scratch };
  if (kind === "py") env.PYTHONPATH = "src";
  let code = 0;
  let out = "";
  try {
    out = execFileSync("timeout", args, { cwd: work, env, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  } catch (err) {
    code = err.status ?? 1;
    out = `${err.stdout || ""}${err.stderr || ""}`;
  } finally {
    fs.rmSync(scratch, { force: true });
    fs.rmSync(`${scratch}-wal`, { force: true });
    fs.rmSync(`${scratch}-shm`, { force: true });
  }
  const pass = kind === "py" ? countOf(out, /(\d+) passed/) : countOf(out, /ℹ pass (\d+)/);
  const fail = kind === "py" ? countOf(out, /(\d+) failed/) : countOf(out, /ℹ fail (\d+)/);
  return { code, pass, fail, out };
}

function sessionStats(sessionDir) {
  const stats = { cost: 0, rounds: 0, models: [], users: 0 };
  if (!fs.existsSync(sessionDir)) return stats;
  const models = new Set();
  const files = fs.readdirSync(sessionDir).filter((name) => name.endsWith(".jsonl"));
  for (const name of files) {
    const lines = fs.readFileSync(path.join(sessionDir, name), "utf8").split("\n");
    for (const line of lines) {
      if (!line) continue;
      let row;
      try { row = JSON.parse(line); } catch { continue; }
      if (row.type !== "message") continue;
      const message = row.message || {};
      if (message.role === "user") stats.users += 1;
      if (message.role !== "assistant") continue;
      stats.rounds += 1;
      if (message.model) models.add(message.model);
      const total = message.usage?.cost?.total;
      if (typeof total === "number") stats.cost += total;
    }
  }
  stats.models = [...models];
  return stats;
}

function killGroup(child) {
  if (!child.pid) return;
  try { process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ }
  setTimeout(() => {
    try { process.kill(-child.pid, "SIGKILL"); } catch { /* already gone */ }
  }, 5000).unref();
}

function runSandboxed(prompt, genDir, logPath) {
  fs.mkdirSync(genDir, { recursive: true });
  const sessionDir = path.join(genDir, "sessions");
  fs.rmSync(sessionDir, { recursive: true, force: true });
  fs.mkdirSync(sessionDir, { recursive: true });
  const args = [...sandboxArgs(genDir), "--", "pi", ...piArgs(prompt, LUNA, "/work/sessions")];
  const log = fs.openSync(logPath, "w");
  const started = Date.now();
  const child = spawn("bwrap", args, { detached: true, stdio: ["ignore", log, log] });
  return new Promise((resolve) => {
    let stopped = null;
    const timer = setInterval(() => {
      const elapsed = (Date.now() - started) / 1000;
      if (elapsed > LUNA.wallS) stopped = "wall";
      else {
        const stats = sessionStats(sessionDir);
        const foreign = stats.models.filter((model) => !LUNA.allowed.includes(model));
        if (foreign.length) stopped = "pin";
        else if (stats.cost > LUNA.cap) stopped = "cost-cap";
      }
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

function insideWork(work, rel) {
  const root = path.resolve(work);
  const dest = path.resolve(work, rel);
  if (dest !== root && !dest.startsWith(`${root}${path.sep}`)) {
    throw new Error(`blind path escapes the worktree: ${rel}`);
  }
  return dest;
}

function existingTests(task) {
  return [...(task.visible_checks?.files || []), ...(task.heldout?.files || [])];
}

function loadResults() {
  const file = path.join(C3, "results.json");
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function saveResults(rows) {
  fs.mkdirSync(C3, { recursive: true });
  const file = path.join(C3, "results.json");
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(rows, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

async function runTask(task) {
  const kind = task.repo === "agent-orchestration-harness" ? "py" : "ts";
  const rel = BLIND_REL[task.repo];
  const root = path.join(C3, task.id);
  const gen = path.join(root, "gen");
  const work = path.join(LUNA_RUNS, task.id, "work");
  fs.rmSync(gen, { recursive: true, force: true });
  fs.mkdirSync(gen, { recursive: true });
  const prior = JSON.parse(fs.readFileSync(path.join(LUNA_RUNS, task.id, "result.json"), "utf8"));
  console.log(`${task.id} generate`);
  const pi = await runSandboxed(blindPrompt(task), gen, path.join(root, "pi.log"));
  const stats = sessionStats(path.join(gen, "sessions"));
  const generatedPath = path.join(gen, rel);
  const text = fs.existsSync(generatedPath) ? fs.readFileSync(generatedPath, "utf8") : "";
  const generated = looksLikeTest(text, kind);
  const importedTest = generated ? importsExistingTest(text, existingTests(task)) : null;
  let grade = null;
  if (!pi.stopped && generated && !importedTest) {
    if (!fs.existsSync(path.join(work, ".git")) && !fs.existsSync(work)) {
      throw new Error(`${task.id} worktree is missing`);
    }
    const dest = insideWork(work, rel);
    if (fs.existsSync(dest)) throw new Error(`${task.id} blind path already exists: ${rel}`);
    const before = snapshotTree(work);
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, text);
      grade = gradeBlind(work, rel, kind);
      fs.writeFileSync(path.join(root, "grade.txt"), grade.out);
    } finally {
      fs.rmSync(dest, { force: true });
      restoreTree(work, before);
    }
    if (!sameTree(before, snapshotTree(work))) {
      throw new Error(`${task.id} worktree changed while grading the blind test`);
    }
  }
  const verdict = blindVerdict({
    stopped: pi.stopped,
    generated,
    grade,
    importedTest,
  });
  const row = {
    id: task.id,
    class: prior.class,
    outcome: verdict.outcome,
    flagged: verdict.flagged,
    provider_cost: Number(stats.cost.toFixed(8)),
    rounds: stats.rounds,
    wall_s: Number(pi.wallS.toFixed(3)),
    pi_exit: pi.code,
    stopped: pi.stopped,
    models: stats.models,
    users: stats.users,
    grade: grade ? `${grade.pass} pass, ${grade.fail} fail, exit ${grade.code}` : null,
    imported: importedTest,
  };
  console.log(`${task.id} ${prior.class} ${verdict.outcome} flagged=${verdict.flagged} $${row.provider_cost} ${row.grade || ""}`);
  return row;
}

async function pool(items, limit, fn) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      await fn(next);
    }
  });
  await Promise.all(workers);
}

function corpus() {
  return fs.readFileSync(SUITE, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line))
    .filter((task) => task.requirement_split?.survives)
    .filter((task) => {
      const resultPath = path.join(LUNA_RUNS, task.id, "result.json");
      if (!fs.existsSync(resultPath)) return false;
      const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
      return result.class && !result.grade_only && !result.stopped;
    });
}

async function probe() {
  const gen = path.join(C3, "probe");
  fs.rmSync(gen, { recursive: true, force: true });
  const pi = await runSandboxed("Reply with the single word pong. Do not use tools.", gen, path.join(C3, "probe.log"));
  const stats = sessionStats(path.join(gen, "sessions"));
  if (pi.code !== 0 || pi.stopped || stats.users !== 1 || stats.models.some((model) => model !== "gpt-5.6-luna")) {
    throw new Error(`sandbox probe failed exit=${pi.code} stopped=${pi.stopped || ""} users=${stats.users} models=${stats.models.join(",")}`);
  }
  console.log(`probe ok $${stats.cost.toFixed(6)} users=${stats.users} model=${stats.models.join(",")}`);
}

async function main() {
  fs.mkdirSync(C3, { recursive: true });
  const status = path.join(C3, "status.txt");
  fs.rmSync(status, { force: true });
  try {
    await probe();
    const done = new Map(loadResults().map((row) => [row.id, row]));
    const selected = corpus().filter((task) => !done.has(task.id));
    const last = selected.filter((task) => task.id === "s13-hard");
    const first = selected.filter((task) => task.id !== "s13-hard");
    const limit = Number(process.env.C3_CONCURRENCY || 2);
    let aborted = null;
    const accept = async (task) => {
      if (aborted) return;
      try {
        const row = await runTask(task);
        const foreign = row.models.some((model) => model !== "gpt-5.6-luna");
        if (row.users !== 1 || foreign || row.stopped === "spawn") {
          aborted = new Error(`${row.id} launch check failed users=${row.users} models=${row.models.join(",")} stopped=${row.stopped || ""}`);
          return;
        }
        done.set(row.id, row);
        saveResults([...done.values()]);
      } catch (err) {
        aborted = err;
        console.log(`${task.id} ERROR ${err.message}`);
      }
    };
    await pool(first, limit, accept);
    if (!aborted) await pool(last, 1, accept);
    if (aborted) throw aborted;
    const rows = [...done.values()];
    const scored = scoreChecks(rows);
    const cost = rows.reduce((sum, row) => sum + (row.provider_cost || 0), 0);
    console.log(`silent ${scored.silent[0]}/${scored.silent[1]} pass-flagged ${scored.pass[0]}/${scored.pass[1]} loud-flagged ${scored.loud[0]}/${scored.loud[1]} cost ${cost.toFixed(6)}`);
    fs.writeFileSync(status, `DONE ${rows.length}\n`);
  } catch (err) {
    console.log(`FAILED ${err.message}`);
    fs.writeFileSync(status, `FAILED ${err.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
