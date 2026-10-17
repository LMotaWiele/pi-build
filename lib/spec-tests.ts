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
  return [...base.matchAll(/(?:^|[^a-zA-Z0-9])v(\d+)(?!\d)/g)].map((m) => Number(m[1]));
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
  if (!value.startsWith('"') || !value.endsWith('"')) return value;
  // Git C-quotes UTF-8 bytes as octal escapes, which JSON.parse cannot decode.
  const chunks: Buffer[] = [];
  const escapes: Record<string, string> = { a: "\u0007", b: "\b", t: "\t", n: "\n", v: "\v", f: "\f", r: "\r" };
  for (const part of value.slice(1, -1).matchAll(/\\([0-7]{1,3}|.)|([^\\]+)/g)) {
    chunks.push(part[2] !== undefined ? Buffer.from(part[2]) : /^[0-7]+$/.test(part[1])
      ? Buffer.from([parseInt(part[1], 8)]) : Buffer.from(escapes[part[1]] ?? part[1]));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function pathsOutside(dirty: string[], dir: string): string[] {
  const root = dir.replace(/\/$/, "");
  const outside: string[] = [];
  for (const line of dirty) {
    if (line.length < 4) continue;
    const raw = line.slice(3);
    let destination = 0;
    if (/[RC]/.test(line.slice(0, 2))) {
      let quoted = false;
      for (let i = 0; i < raw.length; i++) {
        if (quoted && raw[i] === "\\") { i++; continue; }
        if (raw[i] === '"') quoted = !quoted;
        else if (!quoted && raw.startsWith(" -> ", i)) destination = i + 4;
      }
    }
    const file = decodePorcelainPath(raw.slice(destination));
    if (file.startsWith(".agent/")) continue;
    if (file === root || file.startsWith(`${root}/`)) continue;
    outside.push(file);
  }
  return outside;
}

export function specTestsPrompt(input: { spec: string; testsDir: string; checks: number; pythonProject: string | null; pythonCommand?: string | null; errors?: string[] }): string {
  const checks = Array.from({ length: input.checks }, (_, i) => `V${i + 1}`).join(", ");
  const python = input.pythonCommand ?? (input.pythonProject ? `uv run --project ${input.pythonProject} pytest -q` : null);
  const runners = `Run Node tests with: node --experimental-strip-types --test${python ? `\nWrite Python tests as pytest files named test_v<digits>_<what>.py (for example test_v01_check.py) and run them with: ${python} <file>. Never wrap a Python test in a Node test.` : ""}`;
  return `Write tests for the specification at ${input.spec}. Put all files in ${input.testsDir}.\n\nChecks to cover individually: ${checks || "(none)"}. Name automated test files with the check number, using v<digits> (for example v01-check.test.ts); V1 and V10 are distinct. For any check that cannot be automated, add a MANUAL.md line such as V2: needs a model-driven run, with a non-empty reason.\n\n${runners}\n\nTests for newly required behaviour must fail before implementation; tests for preserved behaviour may pass. At least one test must fail. Use temporary directories for filesystem tests. Use no models and no network. Read the spec and repository only; do not read a plan. Do not edit outside ${input.testsDir}. Do not commit; the pipeline commits the tests. Do not implement anything.${input.errors?.length ? `\n\nThe previous attempt was rejected for these reasons:\n${input.errors.map((e) => `- ${e}`).join("\n")}` : ""}`;
}

export function parseErrors(root: string, files: string[]): string[] {
  const errors: string[] = [];
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "spec-tests-parse-"));
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
          const strippedFile = path.join(scratch, "stripped.mjs");
          fs.writeFileSync(strippedFile, stripped);
          command = process.execPath;
          args = ["--check", strippedFile];
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
      const result = spawnSync(command, args, { encoding: "utf8",
        env: { ...process.env, PYTHONPYCACHEPREFIX: path.join(scratch, "pycache") } });
      if (result.error || result.status !== 0) {
        const output = result.stderr || result.stdout || String(result.error ?? "syntax check failed");
        errors.push(`${file}: syntax error: ${output.split(/\r?\n/, 1)[0]}`);
      }
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  return errors;
}
