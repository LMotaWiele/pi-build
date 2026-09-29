/**
 * Memory files for the active project. Creation is additive.
 * An existing file is never overwritten.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ParsedIndex,
  appendQueue,
  classifyNotesPath,
  convertIndexToV1,
  convertNoteToV1,
  detectSchema,
  notesReadRejection,
  parseIndex,
  parseNote,
  unifiedDiff,
} from "./markdown.ts";
import { renderSkill } from "./skill.ts";

export const SCHEMA_VERSION = 1;

const warnedSchema = new Set<string>();

export function schemaMarkerValue(text: string): number | null {
  const match = text.match(/<!--\s*agent-memory-schema:\s*(\d+)\s*-->/);
  if (!match) return null;
  return Number(match[1]);
}

export function findProjectRoot(start: string): string {
  let dir = path.resolve(start);
  let agentFallback: string | null = null;
  const filesystemRoot = path.parse(dir).root;
  while (true) {
    if (fs.existsSync(path.join(dir, "AGENTS.md"))) return dir;
    if (!agentFallback && fs.existsSync(path.join(dir, ".agent"))) agentFallback = dir;
    if (dir === filesystemRoot) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return agentFallback ?? path.resolve(start);
}

export function owningRoot(filePath: string): string {
  return findProjectRoot(path.dirname(path.resolve(filePath)));
}

export function gateRawNotesRead(args: {
  filePath: string;
  projectRoot: string;
  blockReads: boolean;
  force: boolean;
  parseFailed: boolean;
}): { action: "ignore" | "pass" | "warn" | "block"; message?: string } {
  const kind = classifyNotesPath(args.filePath);
  if (!kind) return { action: "ignore" };
  if (args.force) return { action: "pass", message: `force:true read ${args.filePath}` };
  if (args.parseFailed) return { action: "pass" };
  const owner = owningRoot(args.filePath);
  if (path.resolve(owner) !== path.resolve(args.projectRoot)) {
    return {
      action: "warn",
      message: `notes path ${args.filePath} is under ${owner}; active project root is ${args.projectRoot}. Passing the read through.`,
    };
  }
  if (!args.blockReads) return { action: "pass", message: `would block ${args.filePath}` };
  return { action: "block", message: notesReadRejection(kind) };
}

export function templatesDirFromSettings(settingsPath?: string): string {
  if (process.env.PI_BUILD_TEMPLATES) return process.env.PI_BUILD_TEMPLATES;
  try {
    const here = path.dirname(fs.realpathSync(fileURLToPath(import.meta.url)));
    const beside = path.resolve(here, "../templates/agent-memory");
    if (fs.existsSync(path.join(beside, "INDEX.md"))) return beside;
  } catch {
    /* the loader path may not exist */
  }
  if (settingsPath && fs.existsSync(settingsPath)) {
    try {
      const real = fs.realpathSync(settingsPath);
      const fromHost = path.resolve(path.dirname(real), "../..", "templates/agent-memory");
      if (fs.existsSync(path.join(fromHost, "INDEX.md"))) return fromHost;
    } catch {
      /* not a readable settings file */
    }
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../templates/agent-memory");
}

const COPIED: { rel: string; template: string }[] = [
  { rel: "AGENTS.md", template: "AGENTS.md" },
  { rel: ".agent/notes/INDEX.md", template: "INDEX.md" },
  { rel: ".agent/notes/README.md", template: "notes/README.md" },
];

export interface ScaffoldResult {
  created: string[];
  logs: string[];
  parseErrors: string[];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function schemaWarning(root: string, rel: string, text: string): string | null {
  const found = schemaMarkerValue(text);
  if (found === null || found >= SCHEMA_VERSION) return null;
  const key = `${root}\0${rel}`;
  if (warnedSchema.has(key)) return null;
  warnedSchema.add(key);
  return `${rel} schema ${found} is older than ${SCHEMA_VERSION}. Run migrate-notes. Not migrating.`;
}

export function scaffoldProject(root: string, templatesDir = templatesDirFromSettings()): ScaffoldResult {
  const created: string[] = [];
  const logs: string[] = [];
  const parseErrors: string[] = [];
  const project = path.resolve(root);

  for (const file of COPIED) {
    const dest = path.join(project, file.rel);
    const source = path.join(templatesDir, file.template);
    if (fs.existsSync(dest)) {
      const text = fs.readFileSync(dest, "utf8");
      const warning = schemaWarning(project, file.rel, text);
      if (warning) logs.push(warning);
      if (file.rel.endsWith("INDEX.md")) {
        try {
          parseIndex(text);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          parseErrors.push(message);
          logs.push(`parse error ${file.rel}: ${message}. Raw reads of this file are permitted.`);
        }
      }
      continue;
    }
    if (!fs.existsSync(source)) {
      logs.push(`template missing: ${source}`);
      continue;
    }
    const text = fs.readFileSync(source, "utf8");
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, text);
    created.push(file.rel);
    const diff = unifiedDiff(file.rel, "", text);
    if (diff) logs.push(diff.trimEnd());
  }

  const readmePath = path.join(project, ".agent/notes/README.md");
  const skillRel = ".agent/skills/notes-protocol/SKILL.md";
  const skillPath = path.join(project, skillRel);
  if (!fs.existsSync(skillPath) && fs.existsSync(readmePath)) {
    const skill = renderSkill(fs.readFileSync(readmePath, "utf8"));
    fs.mkdirSync(path.dirname(skillPath), { recursive: true });
    fs.writeFileSync(skillPath, skill);
    created.push(skillRel);
    const diff = unifiedDiff(skillRel, "", skill);
    if (diff) logs.push(diff.trimEnd());
  }

  const indexPath = path.join(project, ".agent/notes/INDEX.md");
  if (fs.existsSync(indexPath)) {
    let raw = fs.readFileSync(indexPath, "utf8");
    let parsed: ParsedIndex | null = null;
    try {
      parsed = parseIndex(raw);
    } catch {
      parsed = null;
    }
    if (parsed) {
      for (const row of parsed.notes) {
        if (!row.file || row.file === "README.md") continue;
        const notePath = path.join(project, ".agent/notes", row.file);
        if (!fs.existsSync(notePath)) continue;
        try {
          parseNote(fs.readFileSync(notePath, "utf8"));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          parseErrors.push(`${row.file}: ${message}`);
          logs.push(`parse error ${row.file}: ${message}. Raw reads of this file are permitted.`);
          const item = `correction: ${row.file} did not parse`;
          if (!parsed.activeNext.some((entry) => entry.item === item)) {
            const next = appendQueue(raw, item, "human", today());
            fs.writeFileSync(indexPath, next);
            raw = next;
            parsed = parseIndex(next);
            logs.push(`appended a correction row for ${row.file}`);
          }
        }
      }
    }
  }

  return { created, logs, parseErrors };
}

export interface ValidationReport {
  ok: boolean;
  lines: string[];
}

const NEUTRAL = /note_open|memoryGate|\.pi\/|pi-build/;

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export function validateProject(root: string, templatesDir = templatesDirFromSettings()): ValidationReport {
  const project = path.resolve(root);
  const lines: string[] = [];
  let ok = true;
  const fail = (message: string) => {
    ok = false;
    lines.push(`FAIL: ${message}`);
  };
  const pass = (message: string) => lines.push(`ok: ${message}`);

  const required = [
    "AGENTS.md",
    ".agent/notes/INDEX.md",
    ".agent/notes/README.md",
    ".agent/skills/notes-protocol/SKILL.md",
  ];
  for (const rel of required) {
    if (!fs.existsSync(path.join(project, rel))) fail(`missing ${rel}`);
    else pass(rel);
  }
  if (!ok) return { ok, lines };

  const marked = ["AGENTS.md", ".agent/notes/INDEX.md", ".agent/notes/README.md"];
  for (const rel of marked) {
    const text = fs.readFileSync(path.join(project, rel), "utf8");
    const found = schemaMarkerValue(text);
    if (found !== SCHEMA_VERSION) {
      fail(`${rel} schema marker is ${found === null ? "missing" : found}; current template is ${SCHEMA_VERSION}. Run migrate-notes.`);
    } else pass(`schema ${rel}`);
  }

  let index: ParsedIndex;
  try {
    index = parseIndex(fs.readFileSync(path.join(project, ".agent/notes/INDEX.md"), "utf8"));
    pass("INDEX parses");
  } catch (err) {
    fail(`INDEX parse: ${err instanceof Error ? err.message : String(err)}`);
    return { ok, lines };
  }

  for (const row of index.notes) {
    if (!row.file || row.file === "README.md") continue;
    const notePath = path.join(project, ".agent/notes", row.file);
    if (!fs.existsSync(notePath)) {
      fail(`linked note missing: ${row.file}`);
      continue;
    }
    let status = "";
    try {
      status = parseNote(fs.readFileSync(notePath, "utf8")).status.trim();
      pass(`note parses ${row.file}`);
    } catch (err) {
      fail(`note parse ${row.file}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    if (status !== row.status.trim()) fail(`status drift ${row.file}: index says ${row.status.trim()} and the note says ${status}`);
    else pass(`status ${row.file}`);
  }

  const readme = fs.readFileSync(path.join(project, ".agent/notes/README.md"), "utf8");
  const skillPath = path.join(project, ".agent/skills/notes-protocol/SKILL.md");
  const expected = renderSkill(readme);
  const actual = fs.readFileSync(skillPath, "utf8");
  if (actual !== expected) fail("notes-protocol skill has drifted from .agent/notes/README.md");
  else pass("skill matches README");

  const agentDir = path.join(project, ".agent");
  // The harness's own notes may name its paths; other projects must stay neutral.
  const harnessRoot = path.resolve(path.dirname(fs.realpathSync(fileURLToPath(import.meta.url))), "..");
  if (fs.realpathSync(project) !== harnessRoot) {
    // Generated map and explanations are output, not project memory.
    const outputDirs = ["map", "explain"].map((name) => path.join(agentDir, name) + path.sep);
    for (const file of walkFiles(agentDir)) {
      if (outputDirs.some((dir) => file.startsWith(dir))) continue;
      const text = fs.readFileSync(file, "utf8");
      if (NEUTRAL.test(text)) fail(`harness name in ${path.relative(project, file)}`);
    }
  }
  if (!lines.some((line) => line.startsWith("FAIL: harness name"))) pass("neutrality");

  void templatesDir;
  void detectSchema;
  return { ok, lines };
}

/**
 * Write v1 siblings next to a v0 tree and print diffs.
 * A v1 index is left untouched. Nothing is renamed.
 */
export function migrateProject(root: string): number {
  const project = path.resolve(root);
  const indexPath = path.join(project, ".agent/notes/INDEX.md");
  if (!fs.existsSync(indexPath)) {
    console.error(`missing ${indexPath}`);
    return 1;
  }
  const raw = fs.readFileSync(indexPath, "utf8");
  if (detectSchema(raw) === 1) {
    console.log(`${indexPath} is already schema v1; nothing written`);
    return 0;
  }
  const nextIndex = convertIndexToV1(raw);
  const indexDest = path.join(project, ".agent/notes/INDEX.v1.md");
  fs.writeFileSync(indexDest, nextIndex.endsWith("\n") ? nextIndex : `${nextIndex}\n`);
  console.log(unifiedDiff(indexPath, raw, fs.readFileSync(indexDest, "utf8")));
  const notesDir = path.join(project, ".agent/notes");
  for (const name of fs.readdirSync(notesDir)) {
    if (!name.endsWith(".md") || name === "INDEX.md" || name.endsWith(".v1.md")) continue;
    const notePath = path.join(notesDir, name);
    const body = fs.readFileSync(notePath, "utf8");
    const converted = convertNoteToV1(body);
    if (converted === body) continue;
    const dest = notePath.replace(/\.md$/, ".v1.md");
    fs.writeFileSync(dest, converted);
    console.log(unifiedDiff(notePath, body, converted));
  }
  return 0;
}

function isDirectRun(): boolean {
  const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return entry.endsWith(`${path.sep}scaffold.ts`) || entry.endsWith(`${path.sep}scaffold.js`);
}

if (isDirectRun()) {
  const command = process.argv[2];
  if (command === "--validate") {
    const target = process.argv[3];
    if (!target) {
      console.error("usage: scaffold.ts --validate <project>");
      process.exit(2);
    }
    const report = validateProject(path.resolve(target));
    for (const line of report.lines) console.log(line);
    process.exit(report.ok ? 0 : 1);
  }
  if (command === "--migrate") {
    const target = process.argv[3];
    if (!target) {
      console.error("usage: scaffold.ts --migrate <project>");
      process.exit(2);
    }
    process.exit(migrateProject(path.resolve(target)));
  }
}
