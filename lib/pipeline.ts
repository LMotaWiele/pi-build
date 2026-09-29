// lib/pipeline.ts — decisions the pipeline makes before and during a run.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { countVerifyChecks } from "./plan.ts";

const TEST_ENV_KEYS = ["PI_BUILD_PIPELINE", "PI_BUILD_SUBAGENT_ROLE", "PI_BUILD_TELEMETRY_DB"] as const;

export function childPiArgs(input: {
  model: string;
  thinking: string;
  prompt: string;
  sessionDir: string;
  continuing?: boolean;
}): string[] {
  return [
    "--mode", "json",
    "--model", input.model,
    "--thinking", input.thinking,
    "--session-dir", input.sessionDir,
    ...(input.continuing ? ["--continue"] : []),
    "--approve",
    "-p", input.prompt,
  ];
}

export function implementArgs(input: { spec: string; planOnly?: boolean; resume?: boolean }): string[] {
  return [
    input.spec,
    "--progress", "json",
    ...(input.planOnly ? ["--plan-only"] : []),
    ...(input.resume ? ["--resume"] : []),
  ];
}

export function testEnv(base: Record<string, string | undefined>): Record<string, string | undefined> {
  const env = { ...base };
  for (const key of TEST_ENV_KEYS) delete env[key];
  return env;
}

export function costByRole(rows: { role: string | null; cost: number | null }[]): {
  planner: number;
  editor: number;
  integration: number;
  other: number;
  total: number;
} {
  const totals = { planner: 0, editor: 0, integration: 0, other: 0, total: 0 };
  for (const row of rows) {
    const cost = typeof row.cost === "number" && Number.isFinite(row.cost) ? row.cost : 0;
    const role = row.role === "planner" || row.role === "editor" || row.role === "integration" ? row.role : "other";
    totals[role] += cost;
    totals.total += cost;
  }
  return totals;
}

export function childEnv(
  base: Record<string, string | undefined>,
  role: "planner" | "editor" | "integration",
  telemetryDb: string,
): Record<string, string | undefined> {
  return {
    ...base,
    PI_BUILD_PIPELINE: "1",
    PI_BUILD_SUBAGENT_ROLE: role,
    PI_BUILD_TELEMETRY_DB: telemetryDb,
  };
}

export function pipelineRunRoot(settings: unknown, home: string): string {
  const pipeline = (settings as { pipeline?: { runRoot?: unknown } } | null)?.pipeline;
  return typeof pipeline?.runRoot === "string" && pipeline.runRoot.length > 0
    ? pipeline.runRoot
    : join(home, "var/pipeline-runs");
}

export function pipelineTelemetryDbs(root: string): string[] {
  const found: string[] = [];
  function visit(dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && (entry.name === "telemetry.db" || entry.name.endsWith("-telemetry.db"))) {
        if (statSync(path).isFile()) found.push(path);
      }
    }
  }
  visit(root);
  return found.sort();
}

export interface Command {
  cmd: string;
  args: string[];
}

const NODE_TEST = /\.test\.(?:ts|mts|js|mjs)$/;
const PY_TEST = /(?:^|\/)(?:test_[^/]*|[^/]*_test)\.py$/;

// One command per runner: all Node test files together, all Python test files together.
// Files matching neither are ignored.
export function testCommands(files: string[], opts: { pythonProject: string }): Command[] {
  const node = files.filter((f) => NODE_TEST.test(f)).sort();
  const py = files.filter((f) => PY_TEST.test(f)).sort();
  const out: Command[] = [];
  if (node.length) out.push({ cmd: "node", args: ["--experimental-strip-types", "--test", ...node] });
  if (py.length) out.push({ cmd: "uv", args: ["run", "--project", opts.pythonProject, "pytest", "-q", ...py] });
  return out;
}

export interface PreflightInput {
  specText: string;
  hasTestsDir: boolean;
  held: boolean;
  dirty: string[]; // uncommitted paths in the repository
}

export interface Preflight {
  checks: number | null;
  blocking: string[];
  warnings: string[];
}

// Everything that must hold before the first model call.
export function preflight(input: PreflightInput): Preflight {
  const blocking: string[] = [];
  const warnings: string[] = [];
  let checks: number | null = null;
  try {
    checks = countVerifyChecks(input.specText);
  } catch (err) {
    blocking.push(`spec: ${(err as Error).message}`);
  }
  if (!input.hasTestsDir) blocking.push("spec has no .tests/ directory: the pipeline grades against the spec's tests");
  if (input.held) blocking.push("quota hold in place: run bin/pi-continue first");
  if (input.dirty.length) {
    warnings.push(`${input.dirty.length} uncommitted path(s) are not part of the run, which starts from HEAD: ${input.dirty.slice(0, 5).join(", ")}`);
  }
  return { checks, blocking, warnings };
}
