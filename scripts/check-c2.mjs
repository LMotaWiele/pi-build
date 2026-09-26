// Section 13 C2. One Jev call per prompt line that states a requirement.
// The call sees that line and the model's added text. It does not see hidden tests.

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { addedText } from "./check-c1.mjs";

const REPO = path.resolve(import.meta.dirname, "..");
const SUITE = path.join(REPO, "tests/routing-suite/tasks.jsonl");
const RUNS = "/home/george-contis/var/routing-runs/luna";
const URL = "https://openrouter.ai/api/alpha/decisions";
const MODEL = "typesafe/jev-1.13";

export const COVERAGE_QUESTION = {
  instructions: "Does the added text implement this requirement? Answer no if the requirement is absent from the added text, or if a number in the requirement differs from the number the added text sets.",
  yes: "The added text implements the requirement, including any number it states.",
  no: "The requirement is missing, or a stated number differs.",
};

export function requirementsOf(prompt) {
  return prompt.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("Declared interface"));
}

export function coverageState(requirement, added) {
  const body = added.length > 12000 ? `${added.slice(0, 12000)}\n…` : added;
  return `requirement:\n${requirement}\n\nadded:\n${body || "(none)"}`;
}

function addedOf(taskId) {
  const dbPath = path.join(RUNS, taskId, "telemetry.db");
  const db = new DatabaseSync(dbPath, { readOnly: true, timeout: 2000 });
  try {
    const rows = db.prepare(`
      SELECT arguments FROM tool_calls
      WHERE session_id != 's' AND tool_name IN ('edit', 'write')
    `).all();
    return rows.map((row) => addedText(row.arguments)).filter(Boolean).join("\n");
  } finally {
    db.close();
  }
}

async function once(state, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  const started = Date.now();
  try {
    const response = await fetch(URL, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        state,
        questions: {
          C2: {
            type: "noul",
            instructions: COVERAGE_QUESTION.instructions,
            criteria: { true: COVERAGE_QUESTION.yes, false: COVERAGE_QUESTION.no },
          },
        },
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let body = raw;
    try { body = JSON.parse(raw); } catch { body = { detail: raw }; }
    return { status: response.status, body, ms: Date.now() - started };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { transport: true, message: aborted ? "timeout" : String(err?.message || err), ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function costOf(body) {
  const usage = body && typeof body === "object" ? body.usage : null;
  if (usage && typeof usage.cost === "number") return usage.cost;
  if (typeof body?.cost === "number") return body.cost;
  return 0;
}

async function ask(state, apiKey) {
  let attempt = await once(state, apiKey);
  const retryable = attempt.transport ? attempt.message !== "timeout" : attempt.status === 408 || attempt.status === 429 || attempt.status >= 500;
  if (retryable) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    attempt = await once(state, apiKey);
  }
  if (attempt.transport || attempt.status < 200 || attempt.status >= 300) {
    return { error: attempt.transport ? attempt.message : `http ${attempt.status}`, cost: 0 };
  }
  const noul = attempt.body?.answers?.C2?.noul;
  if (typeof noul !== "number") return { error: "missing noul", cost: costOf(attempt.body) };
  return { noul, answer: noul >= 0.5, cost: costOf(attempt.body) };
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    process.stderr.write("OPENROUTER_API_KEY is unset\n");
    process.exit(1);
  }
  const tasks = fs.readFileSync(SUITE, "utf8").trim().split("\n").map((line) => JSON.parse(line))
    .filter((task) => task.requirement_split?.survives);
  const selected = [];
  for (const task of tasks) {
    const result = JSON.parse(fs.readFileSync(path.join(RUNS, task.id, "result.json"), "utf8"));
    if (result.stopped || result.grade_only) continue;
    selected.push({ task, result, added: addedOf(task.id), requirements: requirementsOf(task.prompt) });
  }
  const jobs = [];
  for (const item of selected) {
    for (const requirement of item.requirements) {
      jobs.push({ id: item.task.id, className: item.result.class, requirement, state: coverageState(requirement, item.added) });
    }
  }
  const answers = new Array(jobs.length);
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const index = cursor;
      cursor += 1;
      const job = jobs[index];
      answers[index] = { ...job, ...(await ask(job.state, apiKey)) };
      const row = answers[index];
      console.log(`${row.id} ${row.error ? `ERROR ${row.error}` : `${row.answer ? "yes" : "no"} ${row.noul}`} ${row.requirement.slice(0, 80)}`);
    }
  }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  const byTask = new Map();
  for (const row of answers) {
    if (!byTask.has(row.id)) byTask.set(row.id, { id: row.id, className: row.className, yes: 0, no: 0, error: 0, cost: 0 });
    const bucket = byTask.get(row.id);
    bucket.cost += row.cost || 0;
    if (row.error) bucket.error += 1;
    else if (row.answer) bucket.yes += 1;
    else bucket.no += 1;
  }
  let silent = 0;
  let silentFlagged = 0;
  let passes = 0;
  let passFlagged = 0;
  let loud = 0;
  let loudFlagged = 0;
  let cost = 0;
  for (const bucket of byTask.values()) {
    cost += bucket.cost;
    const flagged = bucket.no > 0;
    if (bucket.className === "Silent fail") { silent += 1; if (flagged) silentFlagged += 1; }
    if (bucket.className === "Pass") { passes += 1; if (flagged) passFlagged += 1; }
    if (bucket.className === "Loud fail") { loud += 1; if (flagged) loudFlagged += 1; }
    console.log(`TASK ${bucket.id} ${bucket.className} yes=${bucket.yes} no=${bucket.no} error=${bucket.error}`);
  }
  const summary = {
    silent: [silentFlagged, silent],
    passFlagged: [passFlagged, passes],
    loudFlagged: [loudFlagged, loud],
    cost,
    answers: answers.map(({ state, ...row }) => row),
  };
  const out = "/home/george-contis/var/routing-runs/c2";
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "results.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`silent ${silentFlagged}/${silent} pass-flagged ${passFlagged}/${passes} loud-flagged ${loudFlagged}/${loud} cost=${cost}`);
  if (answers.some((row) => row.error)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
