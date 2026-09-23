/**
 * Pure INDEX and note parsers. Headings are matched verbatim.
 * A missing required heading throws; callers must fail open.
 */

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export interface IndexRow {
  topic: string;
  file: string;
  status: string;
  oneLiner: string;
}

export interface QueueRow {
  n: string;
  item: string;
  source: string;
  added: string;
}

export type SchemaVersion = 0 | 1;

export interface ParsedIndex {
  schemaVersion: SchemaVersion;
  notes: IndexRow[];
  activeNext: QueueRow[];
  doNot: string[];
  glossary: Record<string, string>;
  raw: string;
}

export interface NoteFrontMatter {
  title: string;
  status: "open" | "sealed" | string;
  topic: string;
  lastUpdated: string;
  currentClaim: string;
  ruledOut: string[];
  evidence: string[];
  preCommitted: { if: string; then: string }[];
  doNot: string[];
  bodyOffset: number;
}

const REQUIRED_INDEX_V1 = ["## Notes", "## Active next", "## Do not"] as const;
const OPTIONAL_GLOSSARY = "## Glossary (optional)";
const GLOSSARY = "## Glossary";
const CRITERIA_HEADINGS = ["## Pre-committed criteria", "## Pre-committed next"] as const;

const REQUIRED_NOTE_HEADINGS = [
  "## Current claim",
  "## Ruled out / confounds",
  "## Evidence (pointers only)",
  "## Do not",
] as const;

const PLACEHOLDER = /^_\([^)]*\)_$/;

export function isPlaceholder(cell: string): boolean {
  const t = cell.trim();
  return t.length === 0 || PLACEHOLDER.test(t);
}

/** GitHub pipe row. A backslash keeps a pipe inside a cell. A missing trailing pipe is tolerated. */
export function parsePipeRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  const cells: string[] = [];
  let current = "";
  for (let i = 1; i < trimmed.length; i++) {
    if (trimmed[i] === "\\" && trimmed[i + 1] === "|") {
      current += "|";
      i++;
      continue;
    }
    if (trimmed[i] === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += trimmed[i];
  }
  if (current.trim()) cells.push(current.trim());
  return cells;
}

function pipeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function isSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell.replace(/\s/g, "")));
}

function lineIndex(markdown: string, heading: string): number {
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === heading) return i;
  }
  return -1;
}

function sectionBody(markdown: string, heading: string): string | null {
  const lines = markdown.split("\n");
  const start = lineIndex(markdown, heading);
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}

function sectionSpan(markdown: string, heading: string): { bodyStart: number; bodyEnd: number } | null {
  const startLine = lineIndex(markdown, heading);
  if (startLine < 0) return null;
  const lines = markdown.split("\n");
  let bodyStart = 0;
  for (let i = 0; i <= startLine; i++) bodyStart += lines[i].length + 1;
  let bodyEnd = markdown.length;
  for (let i = startLine + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      bodyEnd = 0;
      for (let j = 0; j < i; j++) bodyEnd += lines[j].length + 1;
      break;
    }
  }
  return { bodyStart, bodyEnd };
}

function bullets(body: string): string[] {
  const out: string[] = [];
  for (const line of body.split("\n")) {
    const match = line.match(/^\s*-\s+(.*)$/);
    if (!match) continue;
    const text = match[1].trim();
    if (isPlaceholder(text)) continue;
    out.push(text);
  }
  return out;
}

function dataRows(body: string): string[][] {
  const rows: string[][] = [];
  let headerSeen = false;
  for (const line of body.split("\n")) {
    const cells = parsePipeRow(line);
    if (!cells) continue;
    if (!headerSeen) {
      headerSeen = true;
      continue;
    }
    if (isSeparator(cells)) continue;
    rows.push(cells);
  }
  return rows;
}

function fileCell(cell: string): string {
  const link = cell.match(/\[[^\]]*\]\(([^)]+)\)/);
  const raw = (link ? link[1] : cell).trim();
  return raw.replace(/^\.\//, "");
}

function boldValue(markdown: string, label: string): string | null {
  const pattern = new RegExp(`^\\*\\*${label}:\\*\\*\\s*(.*)$`, "m");
  const match = markdown.match(pattern);
  return match ? match[1].trim() : null;
}

function preamble(markdown: string): string {
  const lines = markdown.split("\n");
  const first = lines.findIndex((line) => line.startsWith("## "));
  return (first < 0 ? lines : lines.slice(0, first)).join("\n");
}

function glossaryHeading(markdown: string): string | null {
  if (lineIndex(markdown, OPTIONAL_GLOSSARY) >= 0) return OPTIONAL_GLOSSARY;
  if (lineIndex(markdown, GLOSSARY) >= 0) return GLOSSARY;
  return null;
}

export function criteriaHeading(markdown: string): string | null {
  for (const heading of CRITERIA_HEADINGS) {
    if (lineIndex(markdown, heading) >= 0) return heading;
  }
  return null;
}

/**
 * A pipe table under Active next, or a Notes heading, is v1.
 * Anything else that still has Active next is the legacy bullet queue.
 */
export function detectSchema(markdown: string): SchemaVersion {
  if (lineIndex(markdown, "## Notes") >= 0) return 1;
  const active = sectionBody(markdown, "## Active next");
  if (active?.split("\n").some((line) => line.trim().startsWith("|"))) return 1;
  return 0;
}

function notesFrom(body: string): IndexRow[] {
  const notes: IndexRow[] = [];
  for (const cells of dataRows(body)) {
    const topic = cells[0] ?? "";
    if (isPlaceholder(topic)) continue;
    notes.push({
      topic,
      file: fileCell(cells[1] ?? ""),
      status: cells[2] ?? "",
      oneLiner: cells[3] ?? "",
    });
  }
  return notes;
}

function queueFromTable(body: string): QueueRow[] {
  const activeNext: QueueRow[] = [];
  for (const cells of dataRows(body)) {
    const n = cells[0] ?? "";
    if (isPlaceholder(n)) continue;
    activeNext.push({
      n,
      item: cells[1] ?? "",
      source: cells[2] ?? "",
      added: cells[3] ?? "",
    });
  }
  return activeNext;
}

const DO_NOT_BULLET = /^\s*-\s+\*\*Do not:\*\*\s*(.*)$/;

function queueFromBullets(body: string): { activeNext: QueueRow[]; doNot: string[] } {
  const activeNext: QueueRow[] = [];
  const doNot: string[] = [];
  for (const line of body.split("\n")) {
    const constraint = line.match(DO_NOT_BULLET);
    if (constraint) {
      const text = constraint[1].trim();
      if (text && !isPlaceholder(text)) doNot.push(text);
      continue;
    }
    const match = line.match(/^\s*-\s+(.*)$/);
    if (!match) continue;
    const text = match[1].trim();
    if (isPlaceholder(text)) continue;
    activeNext.push({ n: String(activeNext.length + 1), item: text, source: "", added: "" });
  }
  return { activeNext, doNot };
}

function glossaryFrom(markdown: string): Record<string, string> {
  const heading = glossaryHeading(markdown);
  const glossary: Record<string, string> = {};
  if (!heading) return glossary;
  for (const cells of dataRows(sectionBody(markdown, heading) ?? "")) {
    const name = cells[0] ?? "";
    if (isPlaceholder(name)) continue;
    glossary[name] = cells[1] ?? "";
  }
  return glossary;
}

export function parseIndex(markdown: string): ParsedIndex {
  const schemaVersion = detectSchema(markdown);
  if (schemaVersion === 1) {
    const missing = REQUIRED_INDEX_V1.filter((heading) => lineIndex(markdown, heading) < 0);
    if (missing.length > 0) {
      throw new ParseError(`INDEX parse failed, missing heading(s): ${missing.join(", ")}`);
    }
  } else if (lineIndex(markdown, "## Active next") < 0) {
    throw new ParseError("INDEX parse failed, missing heading(s): ## Active next");
  }

  const notes =
    schemaVersion === 1 ? notesFrom(sectionBody(markdown, "## Notes") ?? "") : notesFrom(preamble(markdown));
  const activeBody = sectionBody(markdown, "## Active next") ?? "";
  const queued = schemaVersion === 1 ? { activeNext: queueFromTable(activeBody), doNot: bullets(sectionBody(markdown, "## Do not") ?? "") } : queueFromBullets(activeBody);

  return {
    schemaVersion,
    notes,
    activeNext: queued.activeNext,
    doNot: queued.doNot,
    glossary: glossaryFrom(markdown),
    raw: markdown,
  };
}

export function parseNote(markdown: string): NoteFrontMatter {
  const missing: string[] = [];
  if (!/^#\s+\S/m.test(markdown) || /^##\s/m.test(markdown.split("\n")[0] ?? "")) {
    const titleLine = markdown.split("\n").find((line) => line.startsWith("# "));
    if (!titleLine) missing.push("# Title");
  }
  if (boldValue(markdown, "Status") === null) missing.push("**Status:**");
  if (boldValue(markdown, "Topic") === null) missing.push("**Topic:**");
  if (boldValue(markdown, "Last updated") === null) missing.push("**Last updated:**");
  for (const heading of REQUIRED_NOTE_HEADINGS) {
    if (lineIndex(markdown, heading) < 0) missing.push(heading);
  }
  const criteria = criteriaHeading(markdown);
  if (!criteria) missing.push("## Pre-committed criteria");
  if (missing.length > 0) {
    throw new ParseError(`note parse failed, missing: ${missing.join(", ")}`);
  }

  const title = (markdown.split("\n").find((line) => line.startsWith("# ")) ?? "#").replace(/^#\s+/, "").trim();
  const preCommitted: { if: string; then: string }[] = [];
  for (const cells of dataRows(sectionBody(markdown, criteria ?? "## Pre-committed criteria") ?? "")) {
    const iff = cells[0] ?? "";
    const then = cells[1] ?? "";
    if (isPlaceholder(iff) && isPlaceholder(then)) continue;
    if (iff === "…" && then === "…") continue;
    if (!iff && !then) continue;
    preCommitted.push({ if: iff, then });
  }

  const doNotSpan = sectionSpan(markdown, "## Do not");
  return {
    title,
    status: boldValue(markdown, "Status") ?? "",
    topic: boldValue(markdown, "Topic") ?? "",
    lastUpdated: boldValue(markdown, "Last updated") ?? "",
    currentClaim: (sectionBody(markdown, "## Current claim") ?? "").trim(),
    ruledOut: bullets(sectionBody(markdown, "## Ruled out / confounds") ?? ""),
    evidence: bullets(sectionBody(markdown, "## Evidence (pointers only)") ?? ""),
    preCommitted,
    doNot: bullets(sectionBody(markdown, "## Do not") ?? ""),
    bodyOffset: doNotSpan ? doNotSpan.bodyEnd : markdown.length,
  };
}

export function classifyNotesPath(filePath: string): "index" | "readme" | "note" | null {
  const norm = filePath.replace(/\\/g, "/");
  if (norm.includes("/.agent/skills/") || norm.startsWith(".agent/skills/") || norm.includes("/docs/design/") || norm.startsWith("docs/design/")) {
    return null;
  }
  const inNotes = norm.includes("/.agent/notes/") || norm.startsWith(".agent/notes/") || norm.endsWith("/.agent/notes");
  if (!inNotes) return null;
  const base = norm.split("/").pop() ?? "";
  if (base === "INDEX.md") return "index";
  if (base === "README.md") return "readme";
  return "note";
}

export function notesReadRejection(kind: "index" | "readme" | "note", topic?: string): string {
  if (kind === "index") {
    return "INDEX.md is already in the context prefix (section pi_build_memory). Do not read it. Use the injected Notes table, Active next queue, and Do not list. Pass force:true on the read to log an exception, or set memoryGate.enabled: false to disable the gate.";
  }
  if (kind === "readme") {
    return "`.agent/notes/README.md` is the notes-protocol skill, already loaded. Do not read the file. Follow the skill. Pass force:true on the read to log an exception, or set memoryGate.enabled: false to disable the gate.";
  }
  const topicText = topic ? ` Resolve this file as topic "${topic}".` : " Pass the topic from the injected Notes table.";
  return `Notes are opened with note_open, one per task, front-matter by default.${topicText} A second note in the same task needs override:true. Pass force:true on the read to log an exception, or set memoryGate.enabled: false to disable the gate.`;
}

export interface ResolveResult {
  match?: IndexRow;
  ambiguous?: IndexRow[];
}

export function resolveTopic(notes: IndexRow[], topic: string): ResolveResult {
  const exactFile = notes.filter((row) => row.file === topic);
  if (exactFile.length === 1) return { match: exactFile[0] };
  if (exactFile.length > 1) return { ambiguous: exactFile };
  const exactTopic = notes.filter((row) => row.topic === topic);
  if (exactTopic.length === 1) return { match: exactTopic[0] };
  if (exactTopic.length > 1) return { ambiguous: exactTopic };
  const needle = topic.toLowerCase();
  const fuzzy = notes.filter(
    (row) => row.topic.toLowerCase().includes(needle) || row.oneLiner.toLowerCase().includes(needle),
  );
  if (fuzzy.length === 1) return { match: fuzzy[0] };
  if (fuzzy.length > 1) return { ambiguous: fuzzy };
  return {};
}

/** A second note_open in the same task is rejected unless override is set. */
export function gateNoteOpen(
  openPath: string | null,
  requestedPath: string,
  override: boolean,
  maxOpen = 1,
): { allow: boolean; loggedOverride: boolean; reason?: string } {
  if (openPath === null) return { allow: true, loggedOverride: false };
  if (maxOpen > 1) return { allow: true, loggedOverride: true };
  if (override) return { allow: true, loggedOverride: true };
  return {
    allow: false,
    loggedOverride: false,
    reason: `One note per task. Already open: ${openPath}. Pass override:true to open ${requestedPath}; that override is logged.`,
  };
}

function replaceBold(markdown: string, label: string, value: string): string {
  const pattern = new RegExp(`^(\\*\\*${label}:\\*\\*\\s*)(.*)$`, "m");
  if (!pattern.test(markdown)) {
    throw new ParseError(`note update failed, missing **${label}:**`);
  }
  return markdown.replace(pattern, `$1${value}`);
}

/** Replace the trimmed body of one section. Whitespace around it stays. */
function replaceTrimmed(markdown: string, heading: string, body: string): string {
  const span = sectionSpan(markdown, heading);
  if (!span) throw new ParseError(`note update failed, missing ${heading}`);
  const current = markdown.slice(span.bodyStart, span.bodyEnd);
  const trimmed = current.trim();
  const replacement = body.trim();
  if (!trimmed) {
    const lead = current.match(/^\s*/)?.[0] ?? "";
    return markdown.slice(0, span.bodyStart) + lead + replacement + current.slice(lead.length) + markdown.slice(span.bodyEnd);
  }
  const idx = current.indexOf(trimmed);
  return markdown.slice(0, span.bodyStart + idx) + replacement + markdown.slice(span.bodyStart + idx + trimmed.length);
}

function asSectionBody(field: string, value: string): string {
  if (value.includes("\n") || value.startsWith("- ") || value.startsWith("|")) return value;
  if (field === "currentClaim") return value;
  if (field === "preCommitted") return `| If | Then |\n|---|---|\n| ${value} | |`;
  return `- ${value}`;
}

export function applyNoteUpdate(
  markdown: string,
  field: keyof NoteFrontMatter,
  value: string,
  today: string,
): string {
  const parsed = parseNote(markdown);
  if (parsed.status.trim() === "sealed") {
    throw new ParseError(
      `note is sealed. Supersede it (\`Status: superseded by …\`) and open a new note. Do not edit a sealed note.`,
    );
  }
  if (field === "bodyOffset") {
    throw new ParseError("bodyOffset is derived. It is not an editable field.");
  }
  let next = markdown;
  if (field === "title") {
    next = next.replace(/^(#\s+)(.*)$/m, `$1${value}`);
  } else if (field === "status") {
    next = replaceBold(next, "Status", value);
  } else if (field === "topic") {
    next = replaceBold(next, "Topic", value);
  } else if (field === "lastUpdated") {
    next = replaceBold(next, "Last updated", value);
  } else if (field === "currentClaim") {
    next = replaceTrimmed(next, "## Current claim", asSectionBody(field, value));
  } else if (field === "ruledOut") {
    next = replaceTrimmed(next, "## Ruled out / confounds", asSectionBody(field, value));
  } else if (field === "evidence") {
    next = replaceTrimmed(next, "## Evidence (pointers only)", asSectionBody(field, value));
  } else if (field === "preCommitted") {
    const heading = criteriaHeading(next);
    if (!heading) throw new ParseError("note update failed, missing ## Pre-committed criteria");
    next = replaceTrimmed(next, heading, asSectionBody(field, value));
  } else if (field === "doNot") {
    next = replaceTrimmed(next, "## Do not", asSectionBody(field, value));
  }
  if (field !== "lastUpdated") next = replaceBold(next, "Last updated", today);
  return next;
}

function appendBullet(markdown: string, item: string): string {
  const start = lineIndex(markdown, "## Active next");
  if (start < 0) throw new ParseError("INDEX queue update failed: missing ## Active next");
  const lines = markdown.split("\n");
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  let insertAt = end;
  for (let i = start + 1; i < end; i++) {
    if (DO_NOT_BULLET.test(lines[i])) {
      insertAt = i;
      break;
    }
  }
  const bullet = `- ${item.replace(/\n/g, " ")}`;
  lines.splice(insertAt, 0, bullet);
  return lines.join("\n");
}

export function appendQueue(markdown: string, item: string, source: string, today: string): string {
  const parsed = parseIndex(markdown);
  if (parsed.schemaVersion === 0) return appendBullet(markdown, item);
  const max = parsed.activeNext.reduce((acc, row) => {
    const n = Number.parseInt(row.n, 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  const safeItem = item.replace(/\|/g, "/").replace(/\n/g, " ");
  const safeSource = source.replace(/\|/g, "/").replace(/\n/g, " ");
  const row = `| ${max + 1} | ${safeItem} | ${safeSource} | ${today} |`;
  const lines = markdown.split("\n");
  const start = lineIndex(markdown, "## Active next");
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  let placeholder = -1;
  let lastPipe = -1;
  for (let i = start + 1; i < end; i++) {
    const cells = parsePipeRow(lines[i]);
    if (!cells) continue;
    if (isSeparator(cells)) {
      lastPipe = i;
      continue;
    }
    if ((cells[0] ?? "").toLowerCase() === "#" || (cells[0] ?? "").toLowerCase() === "n") {
      lastPipe = i;
      continue;
    }
    if (isPlaceholder(cells[0] ?? "")) placeholder = i;
    lastPipe = i;
  }
  if (placeholder >= 0 && parsed.activeNext.length === 0) {
    lines[placeholder] = row;
  } else if (lastPipe >= 0) {
    lines.splice(lastPipe + 1, 0, row);
  } else {
    throw new ParseError("INDEX queue update failed: Active next has no table.");
  }
  return lines.join("\n");
}

/** Bytes in lines that were added or removed. Unchanged lines do not count. */
export function changedLineBytes(before: string, after: string): number {
  const count = new Map<string, number>();
  for (const line of before.split("\n")) count.set(line, (count.get(line) ?? 0) + 1);
  let changed = 0;
  for (const line of after.split("\n")) {
    const n = count.get(line) ?? 0;
    if (n > 0) count.set(line, n - 1);
    else changed += line.length + 1;
  }
  for (const [line, n] of count) changed += n * (line.length + 1);
  return changed;
}

export function unifiedDiff(path: string, before: string, after: string): string {
  if (before === after) return "";
  const a = before.split("\n");
  const b = after.split("\n");
  const ops = a.length * b.length > 250_000 ? fallbackOps(a, b) : lcsOps(a, b);
  return formatHunks(path, ops, 3);
}

function formatHunks(path: string, ops: DiffOp[], context: number): string {
  const rows: { kind: DiffOp["kind"]; line: string; oldNo: number; newNo: number }[] = [];
  let oldNo = 1;
  let newNo = 1;
  for (const op of ops) {
    rows.push({ kind: op.kind, line: op.line, oldNo, newNo });
    if (op.kind !== "add") oldNo++;
    if (op.kind !== "del") newNo++;
  }
  const hunks: { start: number; end: number }[] = [];
  rows.forEach((row, index) => {
    if (row.kind === "eq") return;
    const start = Math.max(0, index - context);
    const end = Math.min(rows.length - 1, index + context);
    const last = hunks[hunks.length - 1];
    if (last && start <= last.end + 1) last.end = Math.max(last.end, end);
    else hunks.push({ start, end });
  });
  if (hunks.length === 0) return "";
  const lines = [`--- ${path}`, `+++ ${path}`];
  for (const hunk of hunks) {
    const slice = rows.slice(hunk.start, hunk.end + 1);
    const oldStart = slice.find((row) => row.kind !== "add")?.oldNo ?? 0;
    const newStart = slice.find((row) => row.kind !== "del")?.newNo ?? 0;
    const oldCount = slice.filter((row) => row.kind !== "add").length;
    const newCount = slice.filter((row) => row.kind !== "del").length;
    lines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    for (const row of slice) {
      const prefix = row.kind === "eq" ? " " : row.kind === "del" ? "-" : "+";
      lines.push(prefix + row.line);
    }
  }
  return `${lines.join("\n")}\n`;
}

interface DiffOp {
  kind: "eq" | "del" | "add";
  line: string;
}

function fallbackOps(a: string[], b: string[]): DiffOp[] {
  return [...a.map((line) => ({ kind: "del" as const, line })), ...b.map((line) => ({ kind: "add" as const, line }))];
}

function lcsOps(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: "eq", line: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: "del", line: a[i] });
      i++;
    } else {
      ops.push({ kind: "add", line: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ kind: "del", line: a[i++] });
  while (j < m) ops.push({ kind: "add", line: b[j++] });
  return ops;
}

export const MEMORY_BEGIN = "<!-- pi-build:memory -->";
export const MEMORY_END = "<!-- /pi-build:memory -->";

export function wrapMemory(body: string): string {
  return `${MEMORY_BEGIN}\n${body.trim()}\n${MEMORY_END}`;
}

/** Replace an existing marked block, or append one. A second call does not duplicate. */
export function replaceMarked(existing: string, body: string): string {
  const wrapped = wrapMemory(body);
  const pattern = /<!-- pi-build:memory -->[\s\S]*?<!-- \/pi-build:memory -->/;
  if (pattern.test(existing)) return existing.replace(pattern, wrapped);
  if (!existing) return wrapped;
  return `${existing.replace(/\s*$/, "")}\n${wrapped}`;
}

export interface IndexInjection {
  text: string;
  tokens: number;
  truncated: boolean;
}

export function formatIndexInjection(parsed: ParsedIndex, estimate: (text: string) => number, budgetTokens = 2000): IndexInjection {
  const doNot = parsed.doNot.length ? parsed.doNot.map((item) => `- ${item}`).join("\n") : "- (none)";
  const queueLines = (rows: QueueRow[]) =>
    rows.length
      ? ["| # | Item | Source | Added |", "|---|---|---|---|", ...rows.map((row) => `| ${row.n} | ${row.item} | ${row.source} | ${row.added} |`)].join("\n")
      : "(empty)";

  const full = `Active next:\n${queueLines(parsed.activeNext)}\n\nDo not:\n${doNot}`;
  if (estimate(full) <= budgetTokens) {
    return { text: full, tokens: estimate(full), truncated: false };
  }
  const kept = parsed.activeNext.slice(0, 10);
  const rest = parsed.activeNext.length - kept.length;
  const truncatedQueue = `${queueLines(kept)}${rest > 0 ? `\n(${rest} more queue rows omitted)` : ""}`;
  const text = `Active next:\n${truncatedQueue}\n\nDo not:\n${doNot}`;
  return { text, tokens: estimate(text), truncated: true };
}

export function explainWriteName(slug: string, day: string): string {
  const safe = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!safe) throw new ParseError("explain_write slug is empty after sanitizing.");
  return `${day}-${safe}.md`;
}

/** Replace the legacy criteria heading. Every other byte stays. */
export function convertNoteToV1(markdown: string): string {
  return markdown.replace(/^## Pre-committed next[ \t]*$/m, "## Pre-committed criteria");
}

/** Build a v1 sibling from a parsed v0 index. A v1 file is returned unchanged. */
export function convertIndexToV1(markdown: string): string {
  if (detectSchema(markdown) === 1) return markdown;
  const parsed = parseIndex(markdown);
  const noteRows = parsed.notes.length
    ? parsed.notes.map((row) => `| ${pipeCell(row.topic)} | [${row.file}](${row.file}) | ${pipeCell(row.status)} | ${pipeCell(row.oneLiner)} |`).join("\n")
    : "| _(add rows as findings appear)_ | | | |";
  const queueRows = parsed.activeNext.length
    ? parsed.activeNext
        .map((row, index) => `| ${index + 1} | ${pipeCell(row.item)} | ${pipeCell(row.source || "human")} | ${pipeCell(row.added)} |`)
        .join("\n")
    : "| _(empty)_ | | | |";
  const doNot = parsed.doNot.length ? parsed.doNot.map((item) => `- ${item}`).join("\n") : "- _(none yet)_";
  const glossaryRows = Object.entries(parsed.glossary)
    .map(([name, means]) => `| ${pipeCell(name)} | ${pipeCell(means)} |`)
    .join("\n");
  const glossary = glossaryRows ? `\n## Glossary (optional)\n\n| Name | Means |\n|---|---|\n${glossaryRows}\n` : "";
  return `<!-- agent-memory-schema: 1 -->
# Notes index — read this first

## Notes

| Topic | File | Status | One-liner |
|---|---|---|---|
${noteRows}

## Active next

| # | Item | Source | Added |
|---|---|---|---|
${queueRows}

## Do not

${doNot}
${glossary}`;
}
