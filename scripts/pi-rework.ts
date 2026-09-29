// Record rework findings against numbered specifications.
//
//   bin/pi-rework <spec> <task|*> <reason...>
//   bin/pi-rework --list [spec]

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import {
  appendRework,
  defaultReworkPath,
  normalizeSpecName,
  planTaskIds,
  readRework,
  validateRework,
} from "../lib/rework.ts";

type SpecEntry = { id: string; slug: string; file: string; stem: string };

function repoRoot(): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
  }
}

function projectSpecs(root: string): SpecEntry[] {
  const dir = join(root, "docs", "specs");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((file) => {
      const match = file.match(/^SPEC-(\d{4})-(.+)\.md$/);
      return match ? { id: match[1], slug: match[2], file: join(dir, file), stem: file.slice(0, -3) } : null;
    })
    .filter((entry): entry is SpecEntry => entry !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function selectSpec(input: string, specs: SpecEntry[]): { entry: SpecEntry | null; error: string | null } {
  const name = basename(input.trim()).replace(/\.md$/i, "");
  const key = name.replace(/^SPEC-/i, "");
  const matches = /^\d{4}$/.test(key)
    ? specs.filter((entry) => entry.id === key)
    : specs.filter((entry) => entry.slug === key || `${entry.id}-${entry.slug}` === key);
  if (matches.length === 1) return { entry: matches[0], error: null };
  const candidates = specs.map((entry) => `${entry.id} ${entry.slug}`).join(", ") || "(none)";
  return { entry: null, error: `${matches.length ? "Ambiguous" : "Unknown"} spec "${input}". Candidates: ${candidates}` };
}

const env = process.env as Record<string, string | undefined>;
const logPath = defaultReworkPath(env);
const root = repoRoot();
const args = process.argv.slice(2);
const specs = projectSpecs(root);

if (args[0] === "--list") {
  let filter: string | null = null;
  if (args[1]) {
    const selected = selectSpec(args[1], specs);
    if (!selected.entry) {
      console.error(selected.error);
      process.exit(1);
    }
    filter = selected.entry.slug;
  }
  const rows = readRework(logPath).filter((row) => row.project === root && (!filter || row.spec === filter));
  if (!rows.length) console.log("No rework recorded.");
  for (const row of rows) console.log(`${row.at}  ${row.spec}  ${row.task.padEnd(4)}  ${row.reason}`);
  process.exit(0);
}

if (args.length < 3) {
  console.error("Usage: pi-rework <spec> <task|*> <reason...>\n       pi-rework --list [spec]");
  process.exit(2);
}

const selected = selectSpec(args[0], specs);
if (!selected.entry) {
  console.error(selected.error);
  process.exit(1);
}
const entry = selected.entry;
const spec = normalizeSpecName(entry.slug);
const task = args[1];
const reason = args.slice(2).join(" ");
const planFile = join(root, "docs", "specs", `${entry.stem}.plan`, "plan.json");

let taskIds: string[] | null = null;
if (existsSync(planFile)) {
  try {
    taskIds = planTaskIds(JSON.parse(readFileSync(planFile, "utf8")));
  } catch {
    taskIds = [];
  }
}

const validation = validateRework({ spec, task, reason }, existsSync(entry.file), taskIds);
if (!validation.ok) {
  console.error(validation.error);
  process.exit(1);
}

appendRework(logPath, { spec, task, reason, at: new Date().toISOString(), project: root });
console.log(`Recorded: ${spec} ${task} — ${reason}`);
