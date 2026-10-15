import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { stripTypeScriptTypes } from "node:module";

const NODE_TEST = /\.test\.(?:ts|mts|js|mjs)$/;
const PY_TEST = /(?:^|\/)(?:test_[^/]*|[^/]*_test)\.py$/;

export function isTestFile(file: string): boolean {
  return NODE_TEST.test(file) || PY_TEST.test(file);
}

export function checksNamed(file: string): number[] {
  const base = path.posix.basename(file.replaceAll("\\", "/"));
  return [...base.matchAll(/(?:^|[^a-z0-9])v(\d+)(?!\d)/gi)].map((m) => Number(m[1]));
}

export function manualEntries(text: string | null): { check: string; reason: string }[] {
  if (text === null) return [];
  const entries: { check: string; reason: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^(?:[-*]\s*)?V(\d+)\s*:\s*(.*)$/i);
    const reason = match?.[2].trim();
    if (match && reason) entries.push({ check: `V${Number(match[1])}`, reason });
  }
  return entries;
}

export function specTestsGate(input: { checks: number; files: string[]; manual: string | null; syntaxErrors: string[]; before: { file: string; passed: boolean }[] }): string[] {
  const tests = input.files.filter(isTestFile);
  const covered = new Set<number>(manualEntries(input.manual).map((entry) => Number(entry.check.slice(1))));
  for (const file of tests) {
    for (const n of checksNamed(file)) {
      if (n < 1 || n > input.checks) continue;
      covered.add(n);
    }
  }
  const errors: string[] = [];
  for (let n = 1; n <= input.checks; n++) if (!covered.has(n)) errors.push(`V${n}: no test file and no MANUAL.md entry`);
  for (const file of tests) for (const n of checksNamed(file)) {
    if (n < 1 || n > input.checks) errors.push(`${file}: names V${n}, but the spec has V1–V${input.checks}`);
  }
  if (tests.length === 0) errors.push("no automated checks: add at least one test file");
  errors.push(...input.syntaxErrors);
  if (input.before.length > 0 && input.before.every((entry) => entry.passed)) errors.push("all automated checks pass before implementation");
  return errors;
}

function decodePorcelainPath(value: string): string {
  if (value.startsWith('"')) {
    try { return JSON.parse(value); } catch { return value.slice(1, -1); }
  }
  return value;
}

export function pathsOutside(dirty: string[], dir: string): string[] {
  const root = dir.replace(/\/$/, "");
  const outside: string[] = [];
  for (const line of dirty) {
    if (line.length < 4) continue;
    const raw = line.slice(3);
    const split = raw.lastIndexOf(" -> ");
    const file = decodePorcelainPath(split >= 0 ? raw.slice(split + 4) : raw);
    if (file.startsWith(".agent/")) continue;
    if (file === root || file.startsWith(`${root}/`)) continue;
    outside.push(file);
  }
  return outside;
}

export function specTestsPrompt(input: { spec: string; testsDir: string; checks: number; pythonProject: string | null; errors?: string[] }): string {
  const checks = Array.from({ length: input.checks }, (_, i) => `V${i + 1}`).join(", ");
  const runners = `Run Node tests with: node --experimental-strip-types --test${input.pythonProject ? `\nRun Python tests with: uv run --project ${input.pythonProject} pytest` : ""}`;
  return `Write tests for the specification at ${input.spec}. Put all files in ${input.testsDir}.\n\nChecks to cover individually: ${checks || "(none)"}. Name automated test files with the check number, using v<digits> (for example v01-check.test.ts); V1 and V10 are distinct. For any check that cannot be automated, add a MANUAL.md line such as V2: needs a model-driven run, with a non-empty reason.\n\n${runners}\n\nTests for newly required behaviour must fail before implementation; tests for preserved behaviour may pass. At least one test must fail. Use temporary directories for filesystem tests. Use no models and no network. Read the spec and repository only; do not read a plan. Do not edit outside ${input.testsDir}. Do not implement anything.${input.errors?.length ? `\n\nThe previous attempt was rejected for these reasons:\n${input.errors.map((e) => `- ${e}`).join("\n")}` : ""}`;
}

export function parseErrors(root: string, files: string[]): string[] {
  const errors: string[] = [];
  let scratch: string | undefined;
  try {
    for (const file of files) {
      if (!isTestFile(file)) continue;
      const full = path.resolve(root, file);
      const ext = path.extname(file).toLowerCase();
      let command: string;
      let args: string[];
      if (ext === ".ts" || ext === ".mts") {
        try {
          const stripped = stripTypeScriptTypes(fs.readFileSync(full, "utf8"));
          scratch = path.join(os.tmpdir(), `spec-tests-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
          fs.writeFileSync(scratch, stripped);
          command = process.execPath;
          args = ["--check", scratch];
        } catch (error) {
          const line = String(error).split(/\r?\n/, 1)[0];
          errors.push(`${file}: syntax error: ${line}`);
          continue;
        }
      } else if (ext === ".js" || ext === ".mjs") {
        command = process.execPath;
        args = ["--check", full];
      } else {
        command = "python3";
        args = ["-m", "py_compile", full];
      }
      const result = spawnSync(command, args, { encoding: "utf8" });
      if (result.error || result.status !== 0) {
        const output = result.stderr || result.stdout || String(result.error ?? "syntax check failed");
        errors.push(`${file}: syntax error: ${output.split(/\r?\n/, 1)[0]}`);
      }
      if (scratch) { fs.rmSync(scratch, { force: true }); scratch = undefined; }
    }
  } finally {
    if (scratch) fs.rmSync(scratch, { force: true });
  }
  return errors;
}
