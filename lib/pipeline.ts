// lib/pipeline.ts — decisions the pipeline makes before and during a run.

import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { countVerifyChecks } from "./plan.ts";

const TEST_ENV_KEYS = ["PI_BUILD_PIPELINE", "PI_BUILD_SUBAGENT_ROLE", "PI_BUILD_TELEMETRY_DB"] as const;

export const STOP_AND_REPORT = "Report this result to the user and ask how to proceed. Implement the spec another way only if the user says so.";

export function findHarnessRoot(fromPath: string): string | null {
  try {
    const real = realpathSync(fromPath);
    let current = statSync(real).isDirectory() ? real : dirname(real);
    while (true) {
      if (existsSync(join(current, "bin/pi-implement"))) return realpathSync(current);
      const parent = dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  } catch { return null; }
}

export function targetRepo(cwd: string): string | null {
  try {
    const top = execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return top ? realpathSync(top) : null;
  } catch { return null; }
}

function sameIdentity(a: string, b: string): boolean {
  try { return realpathSync(a) === realpathSync(b); }
  catch { return resolve(a) === resolve(b); }
}

export function pythonProjectFor(input: { target: string; harnessRoot: string; settings: unknown }): string | null {
  try {
    const config = JSON.parse(readFileSync(join(input.target, ".pi/pipeline.json"), "utf8")) as { pythonProject?: unknown };
    if (typeof config?.pythonProject === "string" && config.pythonProject.length > 0) return config.pythonProject;
  } catch { /* absent or unusable target config */ }
  if (sameIdentity(input.target, input.harnessRoot)) {
    const project = (input.settings as { pipeline?: { pythonProject?: unknown } } | null)?.pipeline?.pythonProject;
    return typeof project === "string" && project.length > 0 ? project : "tools/map";
  }
  return existsSync(join(input.target, "pyproject.toml")) ? "." : null;
}

export function runDirBase(input: { runRoot: string; target: string; harnessRoot: string; id: string; slug: string }): string {
  const name = `SPEC-${input.id}-${input.slug}`;
  return sameIdentity(input.target, input.harnessRoot)
    ? join(input.runRoot, name)
    : join(input.runRoot, basename(input.target), name);
}

export function planPrompt(input: { spec: string; planDir: string; checks: number; harnessRoot: string }): string {
  return `Read ${input.spec} and the repository. Write an implementation plan to ${input.planDir}/plan.json following the Plan interface in ${input.harnessRoot}/lib/plan.ts, and one acceptance test per Luna task in ${input.planDir}/.\n\nMap each verification V-number, 1 through ${input.checks}, to verifyMap key without the V (V3 is key "3"). Order tasks by the spec's stages. List every requirement and map every V-number to requirement ids or "process". Split tasks into one file each; assign to Luna only tasks needing no cross-file reasoning or open design decision; assign the rest to Sol. Each Luna brief must stand alone, with exact interfaces, constants, reading and forbidden edits. Tests import only declared interfaces and assert behaviour. Run validatePlan and undeclaredImports, confirm every acceptance test fails before implementation. Do not implement anything.`;
}

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

export function implementArgs(input: { spec: string; planOnly?: boolean; resume?: boolean; repo?: string }): string[] {
  return [
    input.spec,
    "--progress", "json",
    ...(input.planOnly ? ["--plan-only"] : []),
    ...(input.resume ? ["--resume"] : []),
    ...(input.repo !== undefined ? ["--repo", input.repo] : []),
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
  specPaths?: { spec: string; tests: string };
  specText: string;
  hasTestsDir: boolean;
  writeTests?: boolean;
  held: boolean;
  dirty: string[]; // uncommitted paths in the repository
  testFiles?: string[];
  pythonProject?: string | null;
}

export interface Preflight {
  checks: number | null;
  blocking: string[];
  warnings: string[];
}

export function uncommittedSpecPaths(dirty: string[], paths: { spec: string; tests: string }): string[] {
  const matches: string[] = [];
  for (const line of dirty) {
    const status = line.slice(0, 2);
    const rawPath = line.slice(3);
    let destination = 0;
    if (status.includes("R")) {
      let quoted = false;
      for (let i = 0; i < rawPath.length; i++) {
        if (quoted && rawPath[i] === "\\") { i++; continue; }
        if (rawPath[i] === '"') quoted = !quoted;
        else if (!quoted && rawPath.startsWith(" -> ", i)) destination = i + 4;
      }
    }
    let path = rawPath.slice(destination);
    // Git C-quotes paths with spaces/control characters, and may octal-escape
    // UTF-8 bytes. Decode before checking the tests-directory boundary.
    if (path.startsWith('"') && path.endsWith('"')) {
      const chunks: Buffer[] = [];
      const escapes: Record<string, string> = { a: "\u0007", b: "\b", t: "\t", n: "\n", v: "\v", f: "\f", r: "\r" };
      for (const part of path.slice(1, -1).matchAll(/\\([0-7]{1,3}|.)|([^\\]+)/g)) {
        chunks.push(part[2] !== undefined ? Buffer.from(part[2]) : /^[0-7]+$/.test(part[1])
          ? Buffer.from([parseInt(part[1], 8)]) : Buffer.from(escapes[part[1]] ?? part[1]));
      }
      path = Buffer.concat(chunks).toString("utf8");
    }
    const exact = path === paths.spec || path === paths.tests || path === `${paths.tests}/`;
    const descendant = path.startsWith(`${paths.tests}/`);
    const untrackedDirectory = status === "??" && path.endsWith("/") &&
      (paths.spec.startsWith(path) || paths.tests.startsWith(path));
    if (exact || descendant || untrackedDirectory) matches.push(path);
  }
  return matches;
}

export function gateRepairable(errors: string[]): boolean {
  return !errors.includes("verification count changed");
}

export function landReviewBranch(input: {
  target: string;
  branch: string;
  base: string;
  baseBranch: string | null;
  enabled: boolean;
}): { landed: boolean; onto?: string; reason: string } {
  if (!input.enabled) return { landed: false, reason: "Landing disabled" };
  if (input.baseBranch === null) return { landed: false, reason: "Base branch is detached" };

  let currentBranch: string | null;
  let currentBase: string;
  try {
    currentBranch = execFileSync("git", ["-C", input.target, "symbolic-ref", "--short", "-q", "HEAD"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }).trim() || null;
  } catch (error) {
    if ((error as { status?: number }).status === 1) currentBranch = null;
    else return { landed: false, reason: "Unable to read target HEAD state" };
  }
  if (currentBranch !== input.baseBranch) {
    return { landed: false, reason: `Target is on ${currentBranch ?? "detached HEAD"}, not ${input.baseBranch}` };
  }
  try {
    currentBase = execFileSync("git", ["-C", input.target, "rev-parse", input.baseBranch], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return { landed: false, reason: "Unable to read target base state" };
  }
  if (currentBase !== input.base) return { landed: false, reason: "Base branch moved" };

  try {
    execFileSync("git", ["-C", input.target, "merge", "--ff-only", input.branch], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = (error as { stderr?: Buffer | string }).stderr;
    const firstErrorLine = (Buffer.isBuffer(stderr) ? stderr.toString("utf8") : String(stderr ?? ""))
      .split(/\r?\n/).find((line) => line.trim().length > 0) ?? "git merge failed";
    return { landed: false, reason: `fast-forward failed: ${firstErrorLine}` };
  }
  try {
    execFileSync("git", ["-C", input.target, "branch", "-d", input.branch], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
  } catch { /* landing succeeded; branch cleanup is best-effort */ }
  return { landed: true, onto: input.baseBranch, reason: `Successfully landed on ${input.baseBranch}` };
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
  if (!input.hasTestsDir && !input.writeTests) blocking.push("spec has no .tests/ directory: the pipeline grades against the spec's tests");
  if (input.held) blocking.push("quota hold in place: run bin/pi-continue first");
  if (input.pythonProject === null && (input.testFiles ?? []).some((file) => PY_TEST.test(file))) {
    blocking.push("Python tests but no Python project; add .pi/pipeline.json with pythonProject");
  }
  if (input.dirty.length) {
    warnings.push(`${input.dirty.length} uncommitted path(s) are not part of the run, which starts from HEAD: ${input.dirty.slice(0, 5).join(", ")}`);
  }
  if (input.specPaths) {
    const matches = uncommittedSpecPaths(input.dirty, input.specPaths);
    if (matches.length) {
      blocking.push(`uncommitted changes to ${input.specPaths.spec} relative to HEAD: ${matches.join(", ")}`);
    }
  }
  return { checks, blocking, warnings };
}
