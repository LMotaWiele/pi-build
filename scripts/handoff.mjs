#!/usr/bin/env node
// Deterministic half of a routing handoff. No model call.
// Implicated files are paths the prompt names that exist at the sha,
// plus files that import a symbol those files export.
// A bare filename counts only when one tree path has that basename.
// Fan-in counts importers of each exported symbol. Outside-implicated
// is the residual after that closure, which is what the blast-radius
// question reads. Importers are also listed under implicated.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SUITE = path.resolve(import.meta.dirname, "../tests/routing-suite/tasks.jsonl");
const FILE_EXT = new Set(["ts", "tsx", "js", "mjs", "cjs", "py", "sql", "json", "md", "sh", "yml", "yaml"]);
const grepCache = new Map();

function git(repo, args) {
  return execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function gitBytes(repo, args) {
  return execFileSync("git", args, {
    cwd: repo,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function listFiles(repo, sha) {
  return git(repo, ["ls-tree", "-r", "--name-only", sha]).split("\n").filter(Boolean);
}

function showText(repo, sha, file) {
  try {
    return gitBytes(repo, ["show", `${sha}:${file}`]).toString("utf8");
  } catch {
    return null;
  }
}

function namedPaths(prompt, files) {
  const found = new Set();
  const missing = new Set();
  const known = new Set(files);
  const byBase = new Map();
  for (const file of files) {
    const base = path.posix.basename(file);
    const list = byBase.get(base);
    if (list) list.push(file);
    else byBase.set(base, [file]);
  }
  const pathRe = /(?:^|[\s`'"(])((?:[\w.-]+\/)+[\w.-]+\.([A-Za-z][\w]*))/g;
  for (const match of prompt.matchAll(pathRe)) {
    if (!FILE_EXT.has(match[2])) continue;
    const rel = match[1].replace(/^\.?\//, "");
    if (known.has(rel)) found.add(rel);
    else missing.add(rel);
  }
  const bareRe = /(?:^|[\s`'"(])([A-Za-z][\w-]*\.([A-Za-z][\w]*))/g;
  for (const match of prompt.matchAll(bareRe)) {
    if (!FILE_EXT.has(match[2]) || match[1].includes("/")) continue;
    const hits = byBase.get(match[1]) || [];
    if (hits.length === 1) found.add(hits[0]);
    else if (hits.length === 0) missing.add(match[1]);
  }
  return { found: [...found].sort(), missing: [...missing].sort() };
}

function exportsOf(file, text) {
  const names = new Set();
  if (file.endsWith(".py")) {
    for (const line of text.split("\n")) {
      const fn = /^def ([A-Za-z][A-Za-z0-9_]*)/.exec(line);
      const cls = /^class ([A-Za-z][A-Za-z0-9_]*)/.exec(line);
      if (fn) names.add(fn[1]);
      if (cls) names.add(cls[1]);
    }
    return [...names];
  }
  const patterns = [
    /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g,
    /export\s+(?:abstract\s+)?class\s+([A-Za-z0-9_]+)/g,
    /export\s+(?:const|let|var|enum)\s+([A-Za-z0-9_]+)/g,
    /export\s+(?:type|interface)\s+([A-Za-z0-9_]+)/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) names.add(match[1]);
  }
  for (const match of text.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g)) {
    for (const part of match[1].split(",")) {
      const piece = part.trim();
      if (!piece) continue;
      const alias = /^(?:type\s+)?[A-Za-z0-9_]+\s+as\s+([A-Za-z0-9_]+)/.exec(piece);
      const plain = /^(?:type\s+)?([A-Za-z0-9_]+)/.exec(piece);
      names.add(alias ? alias[1] : plain[1]);
    }
  }
  return [...names];
}

function stem(file) {
  return path.posix.basename(file).replace(/\.[^.]+$/, "");
}

function grepFiles(repo, sha, pattern) {
  const key = `${repo}\0${sha}\0${pattern}`;
  if (grepCache.has(key)) return grepCache.get(key);
  let hits = [];
  try {
    hits = git(repo, ["grep", "-l", "-E", pattern, sha]).split("\n").filter(Boolean).map((line) => line.replace(`${sha}:`, ""));
  } catch (err) {
    if (err.status !== 1) throw err;
  }
  grepCache.set(key, hits);
  return hits;
}

function moduleImporters(repo, sha, file) {
  const base = stem(file);
  if (base.length < 3) return [];
  const pattern = `from ['\\\"][^'\\\"]*${base}(\\.(ts|js|mjs|py))?['\\\"]|import ${base}\\b`;
  return grepFiles(repo, sha, pattern).filter((hit) => hit !== file);
}

function symbolImporters(repo, sha, symbol) {
  if (symbol.length < 4) return [];
  const pattern = [
    `import[[:space:]]+(type[[:space:]]+)?\\{[^}]*\\b${symbol}\\b`,
    `import[[:space:]]+(type[[:space:]]+)?${symbol}\\b`,
    `from[[:space:]]+${symbol}[[:space:]]+import`,
  ].join("|");
  return grepFiles(repo, sha, pattern);
}

function sharedSurfaces(file, text) {
  const rows = [];
  for (const match of text.matchAll(/\b(pi_build_[A-Za-z0-9_]+)\b/g)) {
    rows.push(`section ${match[1]} ${file}`);
  }
  for (const match of text.matchAll(/\bpi\.on\(\s*["']([^"']+)["']/g)) {
    rows.push(`hook ${match[1]} ${file}`);
  }
  for (const match of text.matchAll(/export\s+(?:type|interface)\s+([A-Za-z0-9_]+)/g)) {
    rows.push(`type ${match[1]} ${file}`);
  }
  if (file.endsWith(".json")) {
    try {
      const value = JSON.parse(text);
      const keys = Object.keys(value);
      for (const key of keys) rows.push(`setting ${key} ${file}`);
      if (value.bounds && typeof value.bounds === "object") {
        for (const key of Object.keys(value.bounds)) rows.push(`setting bounds.${key} ${file}`);
      }
    } catch {
      /* not the settings object */
    }
  }
  return [...new Set(rows)];
}

function coveringTests(repo, sha, file, files) {
  const base = path.posix.basename(file);
  const tests = files.filter((name) => name.startsWith("tests/") && (name.endsWith(".test.ts") || name.includes("/test_") || name.startsWith("tests/test_")));
  const hits = [];
  for (const test of tests) {
    const text = showText(repo, sha, test);
    if (text && text.includes(base)) hits.push(test);
  }
  return hits;
}

function verify(repo, sha, handoff, files) {
  const known = new Set(files);
  handoff.named = handoff.named.filter((file) => known.has(file));
  handoff.implicated = handoff.implicated.filter((file) => known.has(file));
  handoff.tests = handoff.tests
    .filter((row) => known.has(row.file))
    .map((row) => ({ file: row.file, covered: row.covered.filter((file) => known.has(file)) }))
    .filter((row) => row.covered.length);
  handoff.fanIn = handoff.fanIn.filter((row) => known.has(row.file) && grepFiles(repo, sha, `\\b${row.symbol}\\b`).includes(row.file));
  handoff.surfaces = handoff.surfaces.filter((row) => {
    const file = row.split(" ").at(-1);
    return file === "prompt" || known.has(file);
  });
  return handoff;
}

export function buildHandoff(repo, sha, prompt) {
  grepCache.clear();
  const files = listFiles(repo, sha);
  const { found, missing } = namedPaths(prompt, files);
  const exports = new Map();
  for (const file of found) {
    const text = showText(repo, sha, file);
    if (text == null) continue;
    exports.set(file, exportsOf(file, text));
  }
  const importers = new Map();
  for (const file of found) {
    const hits = new Set(moduleImporters(repo, sha, file));
    for (const symbol of exports.get(file) || []) {
      for (const hit of symbolImporters(repo, sha, symbol)) hits.add(hit);
    }
    importers.set(file, [...hits].sort());
  }
  const implicated = new Set(found);
  for (const hits of importers.values()) for (const hit of hits) implicated.add(hit);

  const fanIn = [];
  for (const file of found) {
    for (const symbol of exports.get(file) || []) {
      const hits = symbolImporters(repo, sha, symbol).filter((hit) => hit !== file);
      if (!hits.length) continue;
      const outside = hits.filter((hit) => !implicated.has(hit));
      fanIn.push({ symbol, file, count: hits.length, outside: outside.length });
    }
  }
  fanIn.sort((a, b) => b.outside - a.outside || b.count - a.count || a.symbol.localeCompare(b.symbol));

  const surfaces = [];
  for (const match of prompt.matchAll(/\b(pi_build_[A-Za-z0-9_]+)\b/g)) {
    surfaces.push(`section ${match[1]} prompt`);
  }
  const tests = [];
  for (const file of [...implicated].sort()) {
    const text = showText(repo, sha, file);
    if (text == null || file.startsWith("tests/")) continue;
    surfaces.push(...sharedSurfaces(file, text));
    const covered = coveringTests(repo, sha, file, files);
    if (covered.length) tests.push({ file, covered });
  }

  return verify(repo, sha, {
    sha,
    named: found,
    missing,
    importers: Object.fromEntries(importers),
    implicated: [...implicated].sort(),
    fanIn,
    surfaces: [...new Set(surfaces)].sort(),
    tests,
  }, files);
}

export function renderHandoff(handoff) {
  const lines = ["# handoff", `sha ${handoff.sha}`];
  lines.push("named:");
  if (handoff.named.length === 0) lines.push("- (none)");
  for (const file of handoff.named) lines.push(`- ${file}`);
  if (handoff.missing.length) {
    lines.push("named-missing:");
    for (const file of handoff.missing) lines.push(`- ${file}`);
  }
  lines.push("implicated:");
  if (handoff.implicated.length === 0) lines.push("- (none)");
  for (const file of handoff.implicated) lines.push(`- ${file}`);
  lines.push("fan-in:");
  if (handoff.fanIn.length === 0) lines.push("- (none)");
  for (const row of handoff.fanIn) {
    const noun = row.count === 1 ? "importer" : "importers";
    lines.push(`- ${row.symbol} ${row.count} ${noun}, ${row.outside} outside implicated (${row.file})`);
  }
  lines.push("shared:");
  if (handoff.surfaces.length === 0) lines.push("- (none)");
  for (const row of handoff.surfaces) lines.push(`- ${row}`);
  lines.push("tests:");
  if (handoff.tests.length === 0) lines.push("- (none)");
  for (const row of handoff.tests) lines.push(`- ${row.file}: ${row.covered.join(", ")}`);
  return `${lines.join("\n")}\n`;
}

function taskById(id) {
  const rows = fs.readFileSync(SUITE, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  const task = rows.find((row) => row.id === id);
  if (!task) throw new Error(`no task ${id}`);
  return task;
}

function argsOf(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
    } else out[key] = true;
  }
  return out;
}

function main() {
  const args = argsOf(process.argv.slice(2));
  let repo = args.repo;
  let sha = args.sha;
  let prompt = args.prompt ? fs.readFileSync(args.prompt, "utf8") : null;
  if (args.task) {
    const task = taskById(args.task);
    repo = task.repo_path;
    sha = task.parent_sha;
    prompt = task.prompt;
  }
  if (!repo || !sha || prompt == null) {
    process.stderr.write("usage: handoff.mjs --task ID | --repo PATH --sha SHA --prompt FILE\n");
    process.exit(2);
  }
  const text = renderHandoff(buildHandoff(repo, sha, prompt));
  if (args.out) fs.writeFileSync(args.out, text);
  else process.stdout.write(text);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) main();
