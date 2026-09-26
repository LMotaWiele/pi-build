#!/usr/bin/env node
// Section 12.1. No model call.
// A project symbol or path is derivable when the parent tree contains it
// or the prompt names it. Node and Python standard-library imports are
// not part of the task interface.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SUITE = path.resolve(import.meta.dirname, "../tests/routing-suite/tasks.jsonl");
const PY_STDLIB = new Set([
  "__future__", "abc", "asyncio", "collections", "contextlib", "copy", "dataclasses",
  "enum", "functools", "inspect", "io", "itertools", "json", "math", "os", "pathlib",
  "pytest", "re", "shutil", "sys", "time", "typing", "unittest", "warnings",
]);

function git(repo, args) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordIn(text, name) {
  return new RegExp(`\\b${escapeRegExp(name)}\\b`).test(text);
}

export function namedImports(clause) {
  const names = [];
  const brace = clause.match(/\{([\s\S]*)\}/);
  if (!brace) return names;
  for (const part of brace[1].split(",")) {
    const bit = part.trim().replace(/^type\s+/, "");
    if (!bit) continue;
    const name = bit.split(/\s+as\s+/)[0].trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) names.push(name);
  }
  return names;
}

function pythonNames(clause) {
  const names = [];
  for (const part of clause.split(",")) {
    const bit = part.trim();
    if (!bit || bit.startsWith("(")) continue;
    const name = bit.split(/\s+as\s+/)[0].trim();
    if (/^[A-Za-z_][\w]*$/.test(name)) names.push(name);
  }
  return names;
}

export function resolveTs(fromFile, specifier) {
  const rel = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  const out = [rel];
  if (rel.endsWith(".js")) out.push(rel.replace(/\.js$/, ".ts"));
  if (rel.endsWith(".mjs")) out.push(rel.replace(/\.mjs$/, ".ts"));
  if (!path.posix.extname(rel)) {
    for (const ext of [".ts", ".tsx", ".js", ".mjs", ".py"]) out.push(rel + ext);
    out.push(`${rel}/index.ts`, `${rel}/index.js`);
  }
  return out;
}

export function resolvePy(fromFile, specifier) {
  if (specifier.startsWith(".")) {
    const dots = specifier.match(/^\.*/)[0].length;
    let dir = path.posix.dirname(fromFile);
    for (let i = 1; i < dots; i += 1) dir = path.posix.dirname(dir);
    const rest = specifier.slice(dots).split(".").filter(Boolean);
    const base = rest.length ? path.posix.join(dir, ...rest) : path.posix.join(dir, "__init__");
    return [`${base}.py`, `${base}/__init__.py`];
  }
  const rel = specifier.split(".").join("/");
  if (specifier.startsWith("tests.")) return [`${rel}.py`, `${rel}/__init__.py`];
  return [`src/${rel}.py`, `src/${rel}/__init__.py`, `${rel}.py`, `${rel}/__init__.py`];
}

function pushPath(refs, fromFile, specifier, resolved) {
  refs.push({ kind: "path", name: resolved[0], specifier, resolved, fromFile });
}

function pushSymbols(refs, fromFile, specifier, resolved, names) {
  for (const name of names) refs.push({ kind: "symbol", name, specifier, resolved, fromFile });
}

export function extractReferences(source, fromFile) {
  const refs = [];
  if (fromFile.endsWith(".py")) {
    const multi = /^from\s+(\S+)\s+import\s+\(([\s\S]*?)\)/gm;
    const single = /^from\s+(\S+)\s+import\s+([^\n(]+)$/gm;
    const plain = /^import\s+([^\n]+)$/gm;
    for (const match of source.matchAll(multi)) addPy(refs, fromFile, match[1], match[2]);
    for (const match of source.matchAll(single)) addPy(refs, fromFile, match[1], match[2]);
    for (const match of source.matchAll(plain)) {
      for (const part of match[1].split(",")) {
        const mod = part.trim().split(/\s+as\s+/)[0].trim();
        if (!mod || PY_STDLIB.has(mod.split(".")[0])) continue;
        pushPath(refs, fromFile, mod, resolvePy(fromFile, mod));
      }
    }
  } else {
    const fromRe = /\b(?:import|export)\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
    for (const match of source.matchAll(fromRe)) {
      const spec = match[2];
      if (spec.startsWith("node:") || !spec.startsWith(".")) continue;
      const resolved = resolveTs(fromFile, spec);
      pushPath(refs, fromFile, spec, resolved);
      pushSymbols(refs, fromFile, spec, resolved, namedImports(match[1]));
    }
    const requireRe = /\brequire\(\s*['"](\.[^'"]+)['"]\s*\)/g;
    for (const match of source.matchAll(requireRe)) {
      pushPath(refs, fromFile, match[1], resolveTs(fromFile, match[1]));
    }
  }
  const pathRe = /['"]((?:lib|extensions|settings|scripts|src|demo_runs|agent)\/[^'"]+)['"]/g;
  for (const match of source.matchAll(pathRe)) {
    refs.push({ kind: "path", name: match[1], specifier: match[1], resolved: [match[1]], fromFile });
  }
  const seen = new Set();
  return refs.filter((ref) => {
    const key = `${ref.kind}\0${ref.name}\0${ref.fromFile}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function addPy(refs, fromFile, specifier, clause) {
  if (PY_STDLIB.has(specifier.split(".")[0])) return;
  const resolved = resolvePy(fromFile, specifier);
  pushPath(refs, fromFile, specifier, resolved);
  pushSymbols(refs, fromFile, specifier, resolved, pythonNames(clause));
}

function lineOffset(lines, index) {
  let offset = 0;
  for (let i = 0; i < index; i += 1) offset += lines[i].length + 1;
  return offset;
}

function pythonStart(lines, defIndex) {
  let i = defIndex - 1;
  while (i >= 0 && lines[i].trim() === "") i -= 1;
  if (i >= 0 && /^[ \t]/.test(lines[i])) {
    while (i >= 0 && (lines[i].trim() === "" || /^[ \t]/.test(lines[i]))) i -= 1;
  }
  if (!(i >= 0 && lines[i].startsWith("@"))) return defIndex;
  let start = i;
  i -= 1;
  while (i >= 0 && lines[i].startsWith("@")) {
    start = i;
    i -= 1;
    while (i >= 0 && lines[i].trim() === "") i -= 1;
  }
  return start;
}

function pythonEnd(lines, defIndex) {
  let end = defIndex + 1;
  while (end < lines.length && (lines[end].trim() === "" || /^[ \t]/.test(lines[end]))) end += 1;
  return end;
}

function jsTestEnd(source, start) {
  let parens = 0;
  let braces = 0;
  let brackets = 0;
  let quote = "";
  let started = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "(") {
      parens += 1;
      started = true;
    } else if (ch === ")") parens -= 1;
    else if (ch === "{") {
      braces += 1;
      started = true;
    } else if (ch === "}") braces -= 1;
    else if (ch === "[") brackets += 1;
    else if (ch === "]") brackets -= 1;
    if (started && parens <= 0 && braces <= 0 && brackets <= 0) {
      let end = i + 1;
      if (source[end] === ";") end += 1;
      return end;
    }
  }
  return source.length;
}

export function extractTestBlocks(source, file) {
  if (file.endsWith(".py")) {
    const lines = source.split("\n");
    const blocks = [];
    for (let i = 0; i < lines.length; i += 1) {
      const match = /^(?:async\s+)?def\s+(test_[A-Za-z0-9_]+)\b/.exec(lines[i]);
      if (!match) continue;
      const start = lineOffset(lines, pythonStart(lines, i));
      const end = lineOffset(lines, pythonEnd(lines, i));
      blocks.push({ name: match[1], start, end, body: source.slice(start, end).trim() });
    }
    return blocks;
  }
  const re = /^test\(\s*["'`]([^"'`]+)["'`]/gm;
  return [...source.matchAll(re)].map((match) => {
    const start = match.index;
    const end = jsTestEnd(source, start);
    return { name: match[1], start, end, body: source.slice(start, end).trim() };
  });
}

export function keepTests(source, file, names) {
  const blocks = extractTestBlocks(source, file);
  if (!blocks.length) return source.endsWith("\n") || source === "" ? source : `${source}\n`;
  const keep = new Set(names);
  let out = "";
  let cursor = 0;
  for (const block of blocks) {
    if (keep.has(block.name)) continue;
    out += source.slice(cursor, block.start);
    cursor = block.end;
  }
  out += source.slice(cursor);
  return out.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function chooseSplit(requirements) {
  const hidden = requirements.filter((req) => req.name === "value_check");
  const rest = requirements.filter((req) => req.name !== "value_check");
  const visible = [];
  rest.forEach((req, index) => {
    if (index % 2 === 0) visible.push(req);
    else hidden.push(req);
  });
  if (visible.length === 0 && hidden.length > 1) visible.push(hidden.shift());
  if (hidden.length === 0 && visible.length > 1) hidden.push(visible.pop());
  return { visible, hidden, survives: visible.length > 0 && hidden.length > 0 };
}

export function renderInterface(groups) {
  const lines = ["Declared interface, names and signatures only:"];
  for (const group of groups) {
    lines.push(group.file);
    for (const signature of group.signatures) {
      lines.push(`- ${signature.replace(/\s+/g, " ").trim()}`);
    }
  }
  return lines.join("\n");
}

export function changedTests(parentSource, commitSource, file) {
  const parent = new Map(extractTestBlocks(parentSource || "", file).map((block) => [block.name, block.body]));
  return extractTestBlocks(commitSource, file)
    .filter((block) => parent.get(block.name) !== block.body)
    .map((block) => block.name);
}

const fileCache = new Map();

function fileExists(repo, sha, file) {
  const key = `${repo}\0${sha}\0${file}`;
  if (fileCache.has(key)) return fileCache.get(key);
  let ok = false;
  try {
    git(repo, ["cat-file", "-e", `${sha}:${file}`]);
    ok = true;
  } catch {
    ok = false;
  }
  fileCache.set(key, ok);
  return ok;
}

function showFile(repo, sha, file) {
  try {
    return git(repo, ["show", `${sha}:${file}`]);
  } catch {
    return "";
  }
}

function existing(repo, sha, candidates) {
  return candidates.find((file) => fileExists(repo, sha, file)) || "";
}

function promptNames(prompt, ref) {
  if (ref.kind === "symbol") return wordIn(prompt, ref.name);
  const names = [ref.name, ref.specifier, ...ref.resolved, path.posix.basename(ref.name)];
  return names.some((name) => name && prompt.includes(name));
}

function functionSignature(lines, index) {
  let text = "";
  let parens = 0;
  let braces = 0;
  let openedParen = false;
  for (let j = index; j < Math.min(lines.length, index + 24); j += 1) {
    const row = lines[j];
    for (let k = 0; k < row.length; k += 1) {
      const ch = row[k];
      if (ch === "(") {
        parens += 1;
        openedParen = true;
      } else if (ch === ")") parens -= 1;
      else if (ch === "{") {
        const prev = text.replace(/\s+$/, "").slice(-1);
        const typeBrace = prev === ":" || prev === "<" || prev === "|" || prev === "&" || prev === "(";
        if (openedParen && parens === 0 && braces === 0 && !typeBrace) {
          return text.replace(/\s+/g, " ").trim();
        }
        braces += 1;
      } else if (ch === "}") braces -= 1;
      text += ch;
    }
    text += " ";
    if (openedParen && parens === 0 && braces === 0 && text.includes(")")) {
      const headerEnded = /:\s*$/.test(row);
      const next = (lines[j + 1] || "").trim();
      if (headerEnded || !next || next.startsWith("{") || next.startsWith("export ") || next.startsWith("/**") || next.startsWith("function ") || next.startsWith("def ") || next.startsWith("async def ")) {
        return text.replace(/\s+/g, " ").trim();
      }
    }
  }
  return text.replace(/\s+/g, " ").trim();
}

export function signatureOf(text, name) {
  if (!text || !name) return "";
  const lines = text.split("\n");
  const hit = new RegExp(`\\b${escapeRegExp(name)}\\b`);
  const def = new RegExp(`(?:function|const|let|class|type|interface|enum|def)\\s+${escapeRegExp(name)}\\b|\\b${escapeRegExp(name)}\\s*=`);
  for (let i = 0; i < lines.length; i += 1) {
    if (!hit.test(lines[i]) || !def.test(lines[i])) continue;
    const line = lines[i].trim();
    if (/\b(function|def)\b/.test(line)) return functionSignature(lines, i);
    if (/\b(interface|type|class|enum)\b/.test(line)) {
      let buf = "";
      let depth = 0;
      let started = false;
      for (let j = i; j < Math.min(lines.length, i + 16); j += 1) {
        const row = lines[j].trim();
        buf += (buf ? "\n" : "") + row;
        for (const ch of row) {
          if (ch === "{") {
            depth += 1;
            started = true;
          } else if (ch === "}") depth -= 1;
        }
        if (started && depth <= 0) break;
        if (!started && row.endsWith(":")) break;
      }
      return buf.trim();
    }
    const typed = line.match(/export\s+(?:const|let)\s+\w+\s*:\s*[^;=]+/);
    if (typed) return typed[0].trim();
    return line.split("=")[0].trim();
  }
  return "";
}

function loadTasks(file = SUITE) {
  return fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

export function splitSources(task, side) {
  const split = task.requirement_split;
  if (!split) throw new Error(`${task.id} has no requirement_split`);
  const items = split[side] || [];
  if (split.inline) {
    const seen = new Set();
    const out = [];
    for (const req of items) {
      if (seen.has(req.file)) continue;
      seen.add(req.file);
      const text = split.inline[req.file];
      if (!text) throw new Error(`${task.id} has no inline source for ${req.file}`);
      out.push({ file: req.file, text: text.endsWith("\n") ? text : `${text}\n` });
    }
    return out;
  }
  const byFile = new Map();
  for (const req of items) {
    if (!byFile.has(req.file)) byFile.set(req.file, []);
    byFile.get(req.file).push(req.name);
  }
  const out = [];
  for (const [file, names] of byFile) {
    if (file === "tests/routing-value.test.ts") {
      const text = task.heldout.value_check || "";
      if (!text) throw new Error(`${task.id} has no value check`);
      out.push({ file, text: text.endsWith("\n") ? text : `${text}\n` });
      continue;
    }
    const blob = task.heldout.blobs?.[file];
    if (!blob) throw new Error(`${task.id} has no held-out blob for ${file}`);
    const commitText = git(task.repo_path, ["cat-file", "-p", blob]);
    out.push({ file, text: keepTests(commitText, file, names) });
  }
  return out;
}

export function auditTask(task) {
  const repo = task.repo_path;
  const parent = task.parent_sha;
  const commit = task.commit_sha;
  const pieces = [];
  for (const [file, blob] of Object.entries(task.heldout.blobs || {})) {
    pieces.push({ file, text: git(repo, ["cat-file", "-p", blob]) });
  }
  if (task.heldout.value_check) {
    pieces.push({ file: "tests/routing-value.test.ts", text: task.heldout.value_check });
  }
  const refs = pieces.flatMap((piece) => extractReferences(piece.text, piece.file));
  const undeclared = [];
  const derivable = [];
  for (const ref of refs) {
    const atParent = existing(repo, parent, ref.resolved);
    const atCommit = existing(repo, commit, ref.resolved);
    // A string or import that names no file in the commit is a fixture the test creates.
    if (!atParent && !atCommit) continue;
    const named = promptNames(task.prompt, ref);
    const moduleText = ref.kind === "symbol" && atParent ? showFile(repo, parent, atParent) : "";
    const inTree = ref.kind === "symbol" ? Boolean(atParent && wordIn(moduleText, ref.name)) : Boolean(atParent);
    const row = {
      kind: ref.kind,
      name: ref.kind === "path" ? (atParent || atCommit || ref.name) : ref.name,
      from: ref.fromFile,
      specifier: ref.specifier,
      atParent: atParent || "",
    };
    if (named || inTree) {
      derivable.push(row);
      continue;
    }
    row.signature = ref.kind === "symbol" ? signatureOf(showFile(repo, commit, atCommit), ref.name) : "";
    row.atCommit = atCommit;
    undeclared.push(row);
  }
  const requirements = [];
  for (const piece of pieces) {
    if (piece.file === "tests/routing-value.test.ts") {
      requirements.push({ file: piece.file, name: "value_check" });
      continue;
    }
    const parentText = fileExists(repo, parent, piece.file) ? showFile(repo, parent, piece.file) : "";
    for (const name of changedTests(parentText, piece.text, piece.file)) {
      requirements.push({ file: piece.file, name });
    }
  }
  return { id: task.id, undeclared, derivableCount: derivable.length, requirements };
}

function render(report) {
  const lines = [];
  for (const task of report) {
    lines.push(`${task.id} undeclared=${task.undeclared.length} requirements=${task.requirements.length}`);
    for (const row of task.undeclared) {
      const sig = row.signature ? ` :: ${row.signature.replace(/\n/g, " | ")}` : "";
      lines.push(`  ${row.kind} ${row.name} from ${row.from}${sig}`);
    }
  }
  const failed = report.filter((task) => task.undeclared.length > 0).length;
  lines.push(`${failed} tasks fail the audit`);
  return lines.join("\n");
}

function main() {
  const report = loadTasks().map(auditTask);
  if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write(`${render(report)}\n`);
  if (report.some((task) => task.undeclared.length > 0)) process.exitCode = 1;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) main();
