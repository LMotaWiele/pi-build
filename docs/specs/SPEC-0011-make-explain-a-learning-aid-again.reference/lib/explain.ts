// lib/explain.ts — what a walkthrough is for, who reads it, and what it may add to known.md.
// A walkthrough teaches Lucas the unfamiliar surface of code an agent wrote, so he can change it himself.

export const NOTHING_UNFAMILIAR = "NOTHING UNFAMILIAR";
export const RECAP_DIR = ".agent/recaps";

import { homedir } from "node:os";
import { join } from "node:path";

// The reader. Anything inside the reader's baseline is never unfamiliar surface.
// Set per host in settings as explain.reader; this default describes nobody in particular.
export const DEFAULT_EXPLAIN_READER = `The reader owns this repository and knows the core syntax, built-ins and standard-library basics of its main languages. Unfamiliar surface is anything else: framework and harness APIs, third-party libraries, language features beyond the basics, and patterns specific to this codebase.`;

export function resolveReader(settings: Record<string, unknown>): string {
  const block = settings["explain"];
  const reader = block && typeof block === "object" ? (block as Record<string, unknown>)["reader"] : undefined;
  return typeof reader === "string" && reader.trim() ? reader.trim() : DEFAULT_EXPLAIN_READER;
}

// One known list per reader, shared by every project on this machine.
export function knownPath(env: Record<string, string | undefined>, home: string = homedir()): string {
  return env.PI_BUILD_EXPLAIN_KNOWN ?? join(home, ".pi", "agent", "known.md");
}

export function explainPrompt(input: { reader: string; known: string; files: string[]; diff: string }): string {
  return `${input.reader}

Read the diff. If it uses no unfamiliar surface — nothing outside what the reader already knows and nothing listed under "Already known" — reply with exactly:
${NOTHING_UNFAMILIAR}

Otherwise reply with exactly two sections:

## Unfamiliar surface
Each unfamiliar item: what it does, and why it appears here. One short paragraph each.

## To modify this yourself
What to read first, and which parts must change together.

After the two sections, one line \`known: <item>\` per unfamiliar item, naming it as it appears in the Unfamiliar surface section. Never add a known line for a name defined in this repository.

Do not write any file.

Already known:
${input.known.trim() || "(none)"}

Touched files:
${input.files.join("\n")}

Diff:
${input.diff}`;
}

export interface Explanation {
  nothing: boolean;
  unfamiliar: string;
  modify: string;
  known: string[];
}

function section(body: string, heading: string): string {
  const m = body.match(new RegExp(`^##\\s+${heading}\\s*$([\\s\\S]*?)(?=^##\\s|^known:|(?![\\s\\S]))`, "mi"));
  return m ? m[1].trim() : "";
}

export function parseExplanation(body: string): Explanation {
  const trimmed = body.trim();
  if (trimmed === NOTHING_UNFAMILIAR || trimmed.startsWith(NOTHING_UNFAMILIAR)) {
    return { nothing: true, unfamiliar: "", modify: "", known: [] };
  }
  const known = [...trimmed.matchAll(/^known:\s*(.+)$/gim)].map((m) => m[1].trim()).filter(Boolean);
  return { nothing: false, unfamiliar: section(trimmed, "Unfamiliar surface"), modify: section(trimmed, "To modify this yourself"), known };
}

// Names declared in the touched source: functions, classes, types, constants, Python defs.
export function identifiersIn(sources: string[]): Set<string> {
  const ids = new Set<string>();
  const re = /\b(?:function\*?|const|let|var|class|interface|type|enum|def)\s+([A-Za-z_$][\w$]*)/g;
  for (const src of sources) for (const m of src.matchAll(re)) ids.add(m[1]);
  return ids;
}

function head(entry: string): string {
  return entry.trim().split(/\s+/)[0].replace(/^[`"'(]+|[`"'),.:;]+$/g, "");
}

// A known line is kept only when its item appears in the Unfamiliar surface section
// and names nothing defined in this repository.
export function acceptKnown(entries: string[], unfamiliar: string, repoIdentifiers: Set<string>): string[] {
  if (!unfamiliar.trim()) return [];
  return entries.filter((e) => {
    const h = head(e);
    if (!h || !unfamiliar.includes(h)) return false;
    return !h.split(/[.#:]/).some((part) => repoIdentifiers.has(part));
  });
}

// No walkthrough without written files, or inside a pipeline run: the run writes its own report.
export function shouldExplain(files: string[], env: Record<string, string | undefined>): boolean {
  return files.length > 0 && env.PI_BUILD_PIPELINE !== "1";
}

export function walkthroughFileName(day: string, turnId: string): string {
  const id = turnId.trim().replace(/[^A-Za-z0-9-]/g, "");
  if (!id) throw new Error("a walkthrough needs a turn id");
  return `${day}-turn-${id}.md`;
}
