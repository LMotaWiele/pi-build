#!/usr/bin/env -S node --experimental-strip-types
// Run a Sol plan: one pi process per Luna task, then one Sol integration session.
// Flags stay before -p. A hold exits 75.
//
//   node --experimental-strip-types scripts/run-plan.mjs \
//     --plan docs/specs/SPEC-NNNN-<slug>.plan/plan.json \
//     --run-dir ~/var/pipeline-runs/<name>/<stamp> [--resume]

import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decide } from "../extensions/jev/adapter.ts";
import { DIFFICULTY_QUESTIONS } from "../extensions/jev/questions-difficulty.ts";
import { QUALITY_QUESTIONS } from "../extensions/jev/questions-quality.ts";
import { checkConformance, parseUnifiedDiff } from "../lib/conformance.ts";
import { countVerifyChecks, pipelineThinking, taskOrder, undeclaredImports, validatePlan } from "../lib/plan.ts";
import { testCommands } from "../lib/pipeline.ts";

const REPO = path.resolve(import.meta.dirname, "..");
const BUDGET_TOKENS = 4000;
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx"]);

function argValue(name) {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) return "";
  return process.argv[i + 1];
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function git(cwd, args, encoding = "utf8") {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 32 * 1024 * 1024,
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readSettings() {
  const dir = process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");
  const candidates = [process.env.PI_BUILD_SETTINGS, path.join(dir, "settings.json")].filter(Boolean);
  for (const file of candidates) {
    try {
      return readJson(file);
    } catch {
      continue;
    }
  }
  return {};
}

function modelId(settings, needle, tierKey) {
  const enabled = Array.isArray(settings.enabledModels) ? settings.enabledModels : [];
  const hit = enabled.find((id) => typeof id === "string" && id.includes(needle));
  if (hit) return hit;
  const tier = settings.routing?.tiers?.[tierKey];
  return typeof tier === "string" ? tier : "";
}


function readResults(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function appendResult(file, row) {
  fs.appendFileSync(file, `${JSON.stringify(row)}\n`);
}

function questionsOf(list) {
  const out = {};
  for (const question of list) {
    out[question.id] = {
      kind: "bool",
      instructions: question.text,
      yes: "Yes.",
      no: "No.",
    };
  }
  return out;
}

function answerOf(value) {
  if (typeof value === "boolean") return { answer: value, confidence: null };
  if (value && typeof value === "object" && "value" in value) {
    return { answer: value.value, confidence: value.confidence ?? null };
  }
  return { answer: value ?? null, confidence: null };
}

function fitState(kept, trailing) {
  const head = kept.filter(Boolean).join("\n\n");
  let text = trailing ? `${head}\n\n${trailing}` : head;
  let truncated = false;
  if (estimateTokens(text) > BUDGET_TOKENS) {
    truncated = true;
    const room = Math.max(0, (BUDGET_TOKENS - estimateTokens(head) - 8) * 4);
    const cut = (trailing || "").slice(0, room);
    text = cut ? `${head}\n\n${cut}` : head.slice(0, BUDGET_TOKENS * 4);
  }
  return { state: text, truncated, tokens: estimateTokens(text) };
}

async function battery(list, state) {
  const answers = await decide(state, questionsOf(list));
  const out = {};
  for (const question of list) out[question.id] = answerOf(answers[question.id]);
  return out;
}

function importedNames(source) {
  const names = new Set();
  const patterns = [
    /import\s+(?:type\s+)?([\s\S]*?)\s+from\s+["'][^"']+["']/g,
    /export\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+["'][^"']+["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const clause = match[1].replace(/\s+/g, " ").trim();
      if (clause.startsWith("{")) {
        const inner = clause.slice(1, clause.endsWith("}") ? -1 : undefined);
        for (const part of inner.split(",")) {
          const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()?.trim();
          if (name && name !== "*") names.add(name);
        }
      } else if (clause.startsWith("* as ")) {
        names.add(clause.slice(5).trim());
      } else {
        const defaultName = clause.split(",")[0].trim();
        if (defaultName && !defaultName.startsWith("{")) names.add(defaultName);
      }
    }
  }
  return names;
}

function walkCode(dir, skip, into = []) {
  if (!fs.existsSync(dir)) return into;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkCode(full, skip, into);
    else if (CODE_EXT.has(path.extname(entry.name)) && path.resolve(full) !== skip) into.push(full);
  }
  return into;
}

function outsideImports(work, task, commit) {
  const declared = new Set(
    (task.interfaces || []).filter((item) => item.path === task.file).flatMap((item) => item.exports || []),
  );
  const target = path.resolve(work, task.file);
  let exports = [...declared];
  const shown = showFile(work, commit, task.file);
  if (shown !== null) {
    const extra = shown.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g);
    for (const match of extra) exports.push(match[1]);
  }
  exports = [...new Set(exports)];
  if (!exports.length) return false;
  for (const file of walkCode(work, target)) {
    let source = "";
    try {
      source = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const imported = importedNames(source);
    if (exports.some((name) => imported.has(name))) return true;
  }
  return false;
}

function showFile(repo, commit, file) {
  try {
    return git(repo, ["show", `${commit}:${file}`]);
  } catch {
    return null;
  }
}

function difficultyAnchors(task, plan, work, commit, testSource) {
  return {
    D1: undeclaredImports(testSource, task.interfaces || []).length === 0,
    D6: outsideImports(work, task, commit),
    D9: Array.isArray(task.dependsOn) && task.dependsOn.length > 0,
    D10: plan.tasks.some((other) => other.id !== task.id && (other.dependsOn || []).includes(task.id)),
    D11: showFile(work, commit, task.file) === null,
  };
}

function q8(diffText) {
  const files = parseUnifiedDiff(diffText);
  return files.some((file) => file.addedLines.some((line) => /TODO|FIXME|stub|placeholder|not implemented/i.test(line)));
}

function taskDiff(diffText, file) {
  const parts = diffText.split(/^diff --git /m);
  const hit = parts.find((part) => part.includes(`b/${file}`) || part.startsWith(`a/${file}`));
  return hit ? `diff --git ${hit}` : "";
}

function protectedPaths(plan) {
  const specTests = plan.spec.replace(/\.md$/, ".tests");
  const paths = [specTests.endsWith("/") ? specTests : `${specTests}/`];
  for (const task of plan.tasks) if (task.acceptanceTest) paths.push(task.acceptanceTest);
  return paths;
}

function restoreProtected(work, commit, paths) {
  const files = paths.filter((item) => !item.endsWith("/"));
  const dirs = paths.filter((item) => item.endsWith("/")).map((item) => item.slice(0, -1));
  const args = [...dirs, ...files];
  if (!args.length) return;
  git(work, ["checkout", commit, "--", ...args]);
}

function collectTestFiles(cwd, files) {
  const found = [];
  const walk = (rel) => {
    const abs = path.resolve(cwd, rel);
    let stat;
    try {
      stat = fs.statSync(abs);
    } catch {
      return;
    }
    if (!stat.isDirectory()) {
      found.push(rel);
      return;
    }
    for (const name of fs.readdirSync(abs)) walk(path.join(rel, name));
  };
  for (const file of files) walk(file);
  return found;
}

function runTests(cwd, files, pythonProject) {
  const commands = testCommands(collectTestFiles(cwd, files), { pythonProject });
  if (!commands.length) return { code: 1, out: "no recognized test files\n" };
  let code = 0;
  let out = "";
  for (const command of commands) {
    try {
      out += execFileSync(command.cmd, command.args, {
        cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024,
      });
    } catch (err) {
      code = err.status ?? 1;
      out += `${err.stdout || ""}${err.stderr || ""}`;
    }
  }
  return { code, out };
}

function inferenceStats(dbPath) {
  if (!fs.existsSync(dbPath)) return { model: null, rounds: 0, cost: 0 };
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const first = db.prepare("SELECT model FROM inference_calls ORDER BY id ASC LIMIT 1").get();
    const totals = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(cost_usd), 0) AS cost FROM inference_calls").get();
    return { model: first?.model ?? null, rounds: Number(totals?.n ?? 0), cost: Number(totals?.cost ?? 0) };
  } catch {
    return { model: null, rounds: 0, cost: 0 };
  } finally {
    db.close();
  }
}

function modelMatches(stored, pin) {
  if (!stored || !pin) return false;
  const id = pin.includes("/") ? pin.slice(pin.lastIndexOf("/") + 1) : pin;
  return stored === pin || stored === id || stored.endsWith(`/${id}`);
}

function holdStatus() {
  const bin = path.join(REPO, "bin", "pi-continue");
  try {
    const out = execFileSync(bin, ["--status"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout || ""}${err.stderr || ""}` };
  }
}

function resumeCommand(planPath, runDir) {
  return `node --experimental-strip-types scripts/run-plan.mjs --plan ${planPath} --run-dir ${runDir} --resume`;
}

function stopForHold(planPath, runDir, detail) {
  console.error(detail);
  console.error(resumeCommand(planPath, runDir));
  process.exit(75);
}

function runPi(args, cwd, env, logPath, append = false) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const logFd = fs.openSync(logPath, append ? "a" : "w");
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn("pi", args, { cwd, env, stdio: ["ignore", logFd, logFd] });
    child.on("error", (err) => {
      fs.closeSync(logFd);
      resolve({ code: 127, wallS: (Date.now() - started) / 1000, error: String(err) });
    });
    child.on("close", (code) => {
      fs.closeSync(logFd);
      resolve({ code: code ?? 1, wallS: (Date.now() - started) / 1000 });
    });
  });
}

function piArgs(model, thinking, prompt, sessionDir, continuing = false) {
  return ["--model", model, "--thinking", thinking, "--session-dir", sessionDir,
    ...(continuing ? ["--continue"] : []), "--approve", "-p", prompt];
}

function continuationCount(sessionDir) {
  if (!fs.existsSync(sessionDir)) return 0;
  let count = 0;
  for (const name of fs.readdirSync(sessionDir).filter((file) => file.endsWith(".jsonl"))) {
    for (const line of fs.readFileSync(path.join(sessionDir, name), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type === "custom" && entry.customType === "pi-build-continue-needed") count++;
      } catch { /* an unfinished final line is not a recorded entry */ }
    }
  }
  return count;
}

async function runPiWithContinuation(model, thinking, prompt, work, env, logPath, sessionDir, onHold) {
  fs.mkdirSync(sessionDir, { recursive: true });
  let seen = continuationCount(sessionDir);
  let wallS = 0;
  for (let attempts = 0; attempts < 10; attempts++) {
    const run = await runPi(piArgs(model, thinking, attempts ? "continue" : prompt, sessionDir, attempts > 0),
      work, env, logPath, attempts > 0);
    wallS += run.wallS;
    if (run.code === 75) onHold();
    const recorded = continuationCount(sessionDir);
    if (recorded <= seen || run.code !== 0) return { ...run, wallS };
    seen = recorded;
  }
  throw new Error(`too many overflow continuations in ${sessionDir}`);
}

function lunaPrompt(task) {
  return `${task.brief}\n\nAcceptance test: ${task.acceptanceTest}\nyou may run this test; you may not edit it`;
}

function solPrompt(planFile, resultsFile, commands, reportPath, specPath) {
  return [
    `The plan is \`${planFile}\`; per-task results are \`${resultsFile}\`. Run the typecheck and the spec and plan acceptance tests using these commands (from the worktree):`,
    ...commands.map((command) => `${command.cmd} ${command.args.map((arg) => JSON.stringify(arg)).join(" ")}`),
    'Fix every failure, and implement every task assigned to "sol".',
    `Write \`${reportPath}\` following §10 of \`${specPath}\`, including commands, results and any deviations.`,
    "",
    "You may not edit the spec tests. You may edit a plan acceptance test only if it contradicts the spec — record each such edit and why, because it is an error in your own plan.",
  ].join("\n");
}

function ensureWorktree(runDir, commit) {
  const work = path.join(runDir, "work");
  if (!fs.existsSync(path.join(work, ".git"))) {
    fs.mkdirSync(runDir, { recursive: true });
    git(REPO, ["worktree", "add", "--detach", work, commit]);
  }
  return work;
}

function commitAll(work, message) {
  git(work, ["add", "-A"]);
  const staged = git(work, ["diff", "--cached"]);
  if (!staged.trim()) return "";
  git(work, ["commit", "-m", message]);
  return staged;
}

function writeGrade(runDir, grade) {
  fs.writeFileSync(path.join(runDir, "grade.json"), `${JSON.stringify(grade, null, 2)}\n`);
}

const planArg = argValue("--plan");
const runDirArg = argValue("--run-dir");
const resume = process.argv.includes("--resume");
if (!planArg || !runDirArg) fail("usage: scripts/run-plan.mjs --plan <plan.json> --run-dir <dir> [--resume]", 2);

const planPath = path.resolve(planArg);
const runDir = path.resolve(runDirArg);
if (runDir === REPO || runDir.startsWith(`${REPO}${path.sep}`)) fail(`run-dir must sit outside the repository: ${runDir}`, 2);
const planRel = path.relative(REPO, planPath);
if (planRel.startsWith("..")) fail(`plan is outside the repository: ${planPath}`, 2);

const plan = readJson(planPath);
const specPath = path.resolve(REPO, plan.spec);
const specText = fs.readFileSync(specPath, "utf8");
const count = countVerifyChecks(specText);
const check = validatePlan(plan, count);
if (!check.ok) fail(`validatePlan failed:\n${check.errors.join("\n")}`);

const planDir = path.dirname(planPath);
for (const task of plan.tasks) {
  if (!task.acceptanceTest) continue;
  const source = fs.readFileSync(path.resolve(REPO, task.acceptanceTest), "utf8");
  const missing = undeclaredImports(source, task.interfaces || []);
  if (missing.length) fail(`undeclaredImports ${task.id}: ${missing.join(", ")}`);
}

const commit = typeof plan.commit === "string" && plan.commit ? plan.commit : git(REPO, ["rev-parse", "HEAD"]).trim();
if (showFile(REPO, commit, planRel) === null) {
  fail(`plan file is not in commit ${commit}. Commit the plan, or set plan.commit, before running.`);
}

fs.mkdirSync(runDir, { recursive: true });
fs.writeFileSync(path.join(runDir, "commit"), `${commit}\n`);
const work = ensureWorktree(runDir, commit);
const resultsFile = path.join(runDir, "results.jsonl");
const done = new Set(readResults(resultsFile).map((row) => row.id));
const settings = readSettings();
const pythonProject = settings.pipeline?.pythonProject || "tools/map";
const luna = modelId(settings, "luna", "scout");
const sol = modelId(settings, "sol", "escalate");
if (!luna || !sol) fail("host settings have no Luna or Sol model id");
const pipelineLevels = pipelineThinking(settings);
const lunaThinking = pipelineLevels.editor;
const solThinking = pipelineLevels.planner;
const specTests = plan.spec.replace(/\.md$/, ".tests");
const protectedList = protectedPaths(plan);
let pinChecked = done.size > 0;

const ordered = taskOrder(plan)
  .map((id) => plan.tasks.find((task) => task.id === id))
  .filter((task) => task && task.assignee === "luna");

for (const task of ordered) {
  if (resume && done.has(task.id)) continue;
  const held = holdStatus();
  if (held.code === 75) stopForHold(planRel, runDir, held.out.trim() || "quota hold");

  const testAbs = path.resolve(work, task.acceptanceTest);
  if (!fs.existsSync(testAbs)) fail(`missing acceptance test ${task.acceptanceTest}`);
  const testSource = fs.readFileSync(testAbs, "utf8");
  const before = runTests(work, [task.acceptanceTest], pythonProject);
  if (before.code === 0) fail(`${task.id} acceptance test already passes at ${commit}. The plan gate failed.`);
  const anchors = {
    ...difficultyAnchors(task, plan, work, commit, testSource),
    Q8: null,
    Q10: null,
  };

  const difficultyState = fitState(
    [`brief:\n${task.brief}`, `acceptance_test:\n${testSource}`],
    "",
  );
  const difficulty = await battery(DIFFICULTY_QUESTIONS, difficultyState.state);
  const taskDir = path.join(runDir, "tasks", task.id);
  fs.mkdirSync(taskDir, { recursive: true });
  const dbPath = path.join(taskDir, "telemetry.db");
  const logPath = path.join(taskDir, "pi.log");
  const env = { ...process.env, PI_BUILD_TELEMETRY_DB: dbPath };
  delete env.PI_BUILD_RETRY;
  delete env.PI_OFFLINE;
  const run = await runPiWithContinuation(luna, lunaThinking, lunaPrompt(task), work, env, logPath,
    path.join(taskDir, "session"), () => stopForHold(planRel, runDir, `${task.id} exited 75`));

  const stats = inferenceStats(dbPath);
  if (!pinChecked) {
    pinChecked = true;
    if (!modelMatches(stats.model, luna)) {
      fail(`${task.id} first inference model is ${stats.model || "(none)"}, not ${luna}`);
    }
  }

  restoreProtected(work, commit, protectedList);
  const graded = runTests(work, [task.acceptanceTest], pythonProject);
  const stagedPreview = (() => {
    git(work, ["add", "-A"]);
    return git(work, ["diff", "--cached"]);
  })();
  const diffFiles = parseUnifiedDiff(stagedPreview);
  const conformance = checkConformance(task, diffFiles, protectedList);
  const finalOutput = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";
  const qualityState = fitState(
    [`brief:\n${task.brief}`, `final_output:\n${finalOutput}`],
    `diff:\n${taskDiff(stagedPreview, task.file)}`,
  );
  const quality = await battery(QUALITY_QUESTIONS, qualityState.state);
  anchors.Q8 = q8(stagedPreview);
  anchors.Q10 = conformance.removedExports.length > 0;
  if (stagedPreview.trim()) git(work, ["commit", "-m", `plan: ${task.id}`]);
  const row = {
    id: task.id,
    assignee: "luna",
    difficulty,
    anchors,
    acceptance: graded.code === 0 ? "pass" : "fail",
    conformance,
    quality,
    providerCost: stats.cost,
    rounds: stats.rounds,
    wallClockS: run.wallS,
    exitCode: run.code,
    model: stats.model,
    truncated: [
      difficultyState.truncated ? "difficulty" : "",
      qualityState.truncated ? "quality" : "",
    ].filter(Boolean),
    solEdited: null,
  };
  appendResult(resultsFile, row);
  fs.writeFileSync(path.join(taskDir, "row.json"), `${JSON.stringify(row, null, 2)}\n`);
}

const integrationMarker = path.join(runDir, "integration.json");
if (!(resume && fs.existsSync(integrationMarker))) {
  const held = holdStatus();
  if (held.code === 75) stopForHold(planRel, runDir, held.out.trim() || "quota hold");
  const before = git(work, ["rev-parse", "HEAD"]).trim();
  const logPath = path.join(runDir, "integration.log");
  const dbPath = path.join(runDir, "integration-telemetry.db");
  const env = { ...process.env, PI_BUILD_TELEMETRY_DB: dbPath };
  delete env.PI_OFFLINE;
  const tests = [specTests, ...plan.tasks.map((task) => task.acceptanceTest).filter(Boolean)];
  const commands = testCommands(collectTestFiles(work, tests), { pythonProject });
  const prompt = solPrompt(planRel, resultsFile, commands, path.join(runDir, "report.md"), plan.spec);
  const run = await runPiWithContinuation(sol, solThinking, prompt, work, env, logPath,
    path.join(runDir, "integration-session"), () => stopForHold(planRel, runDir, "integration exited 75"));
  commitAll(work, "plan: integration");
  const names = git(work, ["diff", "--name-only", before, "HEAD"])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const rows = readResults(resultsFile);
  for (const row of rows) {
    const task = plan.tasks.find((item) => item.id === row.id);
    row.solEdited = Boolean(task && names.includes(task.file));
  }
  fs.writeFileSync(resultsFile, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
  fs.writeFileSync(
    integrationMarker,
    `${JSON.stringify({ before, exitCode: run.code, wallClockS: run.wallS, edited: names }, null, 2)}\n`,
  );
}

const protectedDiff = (() => {
  try {
    return git(work, ["diff", commit, "--", specTests, path.dirname(planRel)]);
  } catch {
    return "";
  }
})();
fs.writeFileSync(path.join(runDir, "protected-edits.diff"), protectedDiff);
restoreProtected(work, commit, protectedList);

let typecheck = { code: null, out: "no tsconfig.json" };
if (fs.existsSync(path.join(work, "tsconfig.json"))) {
  try {
    const out = execFileSync("npx", ["tsc", "--noEmit"], {
      cwd: work,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    });
    typecheck = { code: 0, out };
  } catch (err) {
    typecheck = { code: err.status ?? 1, out: `${err.stdout || ""}${err.stderr || ""}` };
  }
}
const specResult = runTests(work, fs.existsSync(path.join(work, specTests)) ? [specTests] : [], pythonProject);
const planTests = plan.tasks.map((task) => task.acceptanceTest).filter(Boolean);
const planResult = runTests(work, planTests, pythonProject);
const grade = {
  commit,
  typecheck,
  specTests: { code: specResult.code, out: specResult.out },
  planTests: { code: planResult.code, out: planResult.out },
};
writeGrade(runDir, grade);
console.log(JSON.stringify({ commit, results: resultsFile, grade: path.join(runDir, "grade.json") }));
