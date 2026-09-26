// scripts/pi-rework.ts — log work that had to be redone.
//
//   bin/pi-rework <spec> <task|*> <reason...>   record a finding
//   bin/pi-rework --list [spec]                 show findings for this repository
//
// <spec> is the spec's name, file name, or path. <task> is a task id from the
// spec's plan, or "*" for the spec as a whole. Run from inside the repository.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendRework,
  defaultReworkPath,
  normalizeSpecName,
  planTaskIds,
  readRework,
  validateRework,
} from "../lib/rework.ts";

function repoRoot(): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
  }
}

const env = process.env as Record<string, string | undefined>;
const path = defaultReworkPath(env);
const root = repoRoot();
const args = process.argv.slice(2);

if (args[0] === "--list") {
  const filter = args[1] ? normalizeSpecName(args[1]) : null;
  const rows = readRework(path).filter((r) => r.project === root && (!filter || r.spec === filter));
  if (!rows.length) console.log("No rework recorded.");
  for (const r of rows) console.log(`${r.at}  ${r.spec}  ${r.task.padEnd(4)}  ${r.reason}`);
  process.exit(0);
}

if (args.length < 3) {
  console.error("Usage: pi-rework <spec> <task|*> <reason...>\n       pi-rework --list [spec]");
  process.exit(2);
}

const spec = normalizeSpecName(args[0]);
const task = args[1];
const reason = args.slice(2).join(" ");
const specFile = join(root, "docs", `SPEC-${spec}.md`);
const planFile = join(root, "docs", `SPEC-${spec}.plan`, "plan.json");

let taskIds: string[] | null = null;
if (existsSync(planFile)) {
  try {
    taskIds = planTaskIds(JSON.parse(readFileSync(planFile, "utf8")));
  } catch {
    taskIds = [];
  }
}

const v = validateRework({ spec, task, reason }, existsSync(specFile), taskIds);
if (!v.ok) {
  console.error(v.error);
  process.exit(1);
}

appendRework(path, { spec, task, reason, at: new Date().toISOString(), project: root });
console.log(`Recorded: ${spec} ${task} — ${reason}`);
