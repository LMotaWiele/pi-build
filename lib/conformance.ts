// lib/conformance.ts — mechanical checks of one task's diff against its brief.
// No model involved. These cover what a script can decide; Jev covers text
// comparisons a script cannot.

import type { PlanTask } from "./plan.ts";

export interface DiffFile {
  path: string;
  status: "added" | "modified" | "deleted";
  addedLines: string[];
  removedLines: string[];
}

export interface ConformanceResult {
  outOfScope: string[]; // files changed other than the task's own file and tests/
  protectedTouched: string[]; // files the implementer may not edit
  undeclaredExports: string[]; // exports added to the task file that the brief does not declare
  removedExports: string[]; // exports removed from any file and not re-added
  newNumericLiterals: string[]; // integers >= 1000 added to the task file and absent from the brief
}

const EXPORT_DECL =
  /^\s*export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/;
const EXPORT_LIST = /^\s*export\s*\{([^}]*)\}/;

function exportNames(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const d = line.match(EXPORT_DECL);
    if (d) {
      out.push(d[1]);
      continue;
    }
    const l = line.match(EXPORT_LIST);
    if (l) {
      for (const part of l[1].split(",")) {
        const segs = part.trim().split(/\s+as\s+/);
        const name = (segs[1] ?? segs[0]).trim();
        if (name) out.push(name);
      }
    }
  }
  return out;
}

function normalizeNumber(s: string): string {
  return s.replace(/[_,]/g, "").replace(/^0+(?=\d)/, "");
}

function numbersIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d[\d_,]*\d|\d/g)) out.add(normalizeNumber(m[0]));
  return out;
}

function isComment(line: string): boolean {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

function isProtected(path: string, protectedPaths: string[]): boolean {
  return protectedPaths.some((p) => (p.endsWith("/") ? path.startsWith(p) : path === p));
}

export function checkConformance(task: PlanTask, diff: DiffFile[], protectedPaths: string[]): ConformanceResult {
  const outOfScope = diff
    .map((f) => f.path)
    .filter((p) => p !== task.file && !p.startsWith("tests/") && !isProtected(p, protectedPaths))
    .sort();

  const protectedTouched = diff
    .map((f) => f.path)
    .filter((p) => isProtected(p, protectedPaths))
    .sort();

  const own = diff.find((f) => f.path === task.file);
  const declared = new Set(task.interfaces.filter((i) => i.path === task.file).flatMap((i) => i.exports));
  const undeclaredExports = own
    ? [...new Set(exportNames(own.addedLines).filter((n) => !declared.has(n)))].sort()
    : [];

  const removed = new Set<string>();
  for (const f of diff) {
    const added = new Set(exportNames(f.addedLines));
    for (const n of exportNames(f.removedLines)) if (!added.has(n)) removed.add(n);
  }

  const briefNumbers = numbersIn(task.brief);
  const literals = new Set<string>();
  if (own) {
    for (const line of own.addedLines) {
      if (isComment(line)) continue;
      for (const m of line.matchAll(/\b\d[\d_]*\b/g)) {
        const n = normalizeNumber(m[0]);
        if (Number(n) >= 1000 && !briefNumbers.has(n)) literals.add(n);
      }
    }
  }

  return {
    outOfScope,
    protectedTouched,
    undeclaredExports,
    removedExports: [...removed].sort(),
    newNumericLiterals: [...literals].sort(),
  };
}

// Minimal parser for `git diff` output.
export function parseUnifiedDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let cur: DiffFile | null = null;
  for (const line of text.split("\n")) {
    const head = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (head) {
      cur = { path: head[2], status: "modified", addedLines: [], removedLines: [] };
      files.push(cur);
      continue;
    }
    if (!cur) continue;
    if (line.startsWith("new file mode")) cur.status = "added";
    else if (line.startsWith("deleted file mode")) {
      cur.status = "deleted";
    } else if (line.startsWith("+++ ") || line.startsWith("--- ")) {
      if (line === "--- /dev/null") cur.status = "added";
      if (line === "+++ /dev/null") cur.status = "deleted";
    } else if (line.startsWith("+")) cur.addedLines.push(line.slice(1));
    else if (line.startsWith("-")) cur.removedLines.push(line.slice(1));
  }
  return files;
}
