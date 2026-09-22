/**
 * Notes enter the cached prefix. Raw reads of `.agent/notes/` are rejected
 * when memoryGate.blockRawNotesReads is true. A parse error fails open.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import fs from "node:fs";
import path from "node:path";
import {
  type NoteFrontMatter,
  type ParsedIndex,
  ParseError,
  appendQueue,
  applyNoteUpdate,
  explainWriteName,
  formatIndexInjection,
  gateNoteOpen,
  parseIndex,
  parseNote,
  resolveTopic,
  unifiedDiff,
  wrapMemory,
} from "../lib/markdown.ts";
import { findProjectRoot, gateRawNotesRead, scaffoldProject, templatesDirFromSettings } from "../lib/scaffold.ts";
import {
  annotateCall,
  attachTelemetry,
  estimateTokens,
  extensionEnabled,
  getOpenNote,
  notePrompt,
  readPiSettings,
  recordToolCall,
  setIndexTopics,
  setMemoryBlock,
  setOpenNote,
  settingsBlock,
} from "../lib/telemetry.ts";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

const TOOL_INJECTION = `Pi tools for this project:
- note_open(topic, depth?, override?) opens one indexed note. A second note in the same task needs override:true, and that override is logged.
- note_update(path, field, value) patches one front-matter field and leaves the rest of the file unchanged.
- queue_append(item, source) appends one queue entry in the file's existing format.
- explain_write(slug, body) writes a walkthrough under .agent/explain/.
- memory_bootstrap() creates any missing memory files and never overwrites an existing file.
Raw reads of .agent/notes/ under this project are rejected. Pass force:true on a read to log an exception. memoryGate.enabled: false is the kill switch.`;

function frontMatterView(note: NoteFrontMatter): Record<string, unknown> {
  return {
    title: note.title,
    status: note.status,
    topic: note.topic,
    lastUpdated: note.lastUpdated,
    currentClaim: note.currentClaim,
    ruledOut: note.ruledOut,
    evidence: note.evidence,
    preCommitted: note.preCommitted,
    doNot: note.doNot,
    bodyOffset: note.bodyOffset,
  };
}

export default async function memoryGateExtension(pi: ExtensionAPI): Promise<void> {
  try {
    const settings = readPiSettings();
    if (!extensionEnabled(settings, "memoryGate")) return;
    attachTelemetry(pi as unknown as Parameters<typeof attachTelemetry>[0]);
    const block = settingsBlock(settings, "memoryGate");
    const blockReads = block["blockRawNotesReads"] === true;
    const autoScaffold = block["autoScaffold"] !== false;
    const injectIndex = block["injectIndexOnSessionStart"] !== false;
    const notesPerTask = typeof block["notesPerTask"] === "number" && block["notesPerTask"] > 0 ? block["notesPerTask"] : 1;
    const indexRel = typeof block["indexPath"] === "string" ? block["indexPath"] : ".agent/notes/INDEX.md";
    const notesRel = typeof block["notesDir"] === "string" ? block["notesDir"] : ".agent/notes";
    const explainRel = typeof block["explainDir"] === "string" ? block["explainDir"] : ".agent/explain";
    const templatesDir = templatesDirFromSettings(process.env.PI_BUILD_SETTINGS);
    let parsed: ParsedIndex | null = null;
    let parseFailed = false;
    const failedNotes = new Set<string>();

    const loadIndex = (cwd: string): string | null => {
      const file = path.resolve(cwd, indexRel);
      const raw = readText(file);
      if (raw === null) {
        parsed = null;
        console.debug(`[memory-gate] no INDEX at ${file}; inert for injection`);
        return null;
      }
      try {
        parsed = parseIndex(raw);
        parseFailed = false;
        setIndexTopics(parsed.notes.map((row) => row.topic));
        const injection = formatIndexInjection(parsed, estimateTokens, 2000);
        if (injection.truncated) {
          console.error(`[memory-gate] INDEX injection truncated at ${injection.tokens} tokens`);
        }
        const marked = wrapMemory(injection.text);
        setMemoryBlock(marked);
        return marked;
      } catch (err) {
        parseFailed = true;
        parsed = null;
        const message = err instanceof ParseError ? err.message : String(err);
        console.error(`[memory-gate] ${message}. Raw notes reads are permitted.`);
        return null;
      }
    };

    const bootstrap = (cwd: string) => {
      const root = findProjectRoot(cwd);
      if (!autoScaffold) return root;
      const result = scaffoldProject(root, templatesDir);
      for (const line of result.logs) console.error(`[memory-gate] ${line}`);
      return root;
    };

    pi.on("session_start", (_event, ctx) => {
      const root = bootstrap(ctx.cwd);
      loadIndex(root);
      if (parsed) console.error(`[memory-gate] schema v${parsed.schemaVersion} root=${root}`);
    });

    pi.on("before_agent_start", (event, ctx) => {
      notePrompt(ctx.sessionManager.getSessionId(), event.prompt);
      const root = findProjectRoot(ctx.cwd);
      const marked = loadIndex(root);
      if (marked && injectIndex) event.systemPromptOptions.sections.pi_build_memory = marked;
      event.systemPromptOptions.sections.pi_build_tools = TOOL_INJECTION;
    });

    pi.on("tool_call", (event, ctx) => {
      if (event.toolName !== "read") return;
      const input = event.input as { path?: string; force?: boolean };
      if (!input.path) return;
      const root = findProjectRoot(ctx.cwd);
      const resolved = path.resolve(ctx.cwd, input.path);
      const decision = gateRawNotesRead({
        filePath: resolved,
        projectRoot: root,
        blockReads,
        force: input.force === true,
        parseFailed: parseFailed || failedNotes.has(resolved),
      });
      if (decision.action === "ignore") return;
      if (decision.action === "warn" || decision.action === "pass") {
        if (decision.message) console.error(`[memory-gate] ${decision.message}`);
        return;
      }
      const topic = parsed?.notes.find((row) => path.resolve(root, notesRel, row.file) === resolved)?.topic;
      const reason = decision.message ?? "";
      const withTopic = topic && !reason.includes(topic) ? `${reason} Topic: ${topic}.` : reason;
      annotateCall(event.toolCallId, { outcome: "blocked", blockedBy: "memory-gate", path: resolved, resultBytes: withTopic.length });
      recordToolCall({
        toolCallId: event.toolCallId,
        toolName: "read",
        arguments: event.input,
        path: resolved,
        resultBytes: withTopic.length,
        outcome: "blocked",
        blockedBy: "memory-gate",
      });
      console.error(`[memory-gate] blocked ${resolved}: ${withTopic}`);
      return { block: true, reason: withTopic };
    });

    const { Type } = await import("typebox");

    pi.registerTool({
      name: "note_open",
      label: "Open note",
      description: "Open one indexed note. Defaults to front-matter. A second open in the same task needs override:true.",
      promptSnippet: "Open one indexed note by topic",
      promptGuidelines: [
        "Use note_open for a file under .agent/notes/. Do not read INDEX.md or README.md; they are already in context.",
      ],
      parameters: Type.Object({
        topic: Type.String({ description: "Index topic, file path, or a unique substring of the topic or one-liner" }),
        depth: Type.Optional(Type.Union([Type.Literal("frontmatter"), Type.Literal("full")])),
        override: Type.Optional(Type.Boolean({ description: "Open a second note in this task. Logged." })),
      }),
      async execute(_id, params, _signal, _onUpdate, ctx) {
        const cwd = findProjectRoot(ctx.cwd);
        const indexFile = path.resolve(cwd, indexRel);
        const raw = readText(indexFile);
        if (raw === null) {
          return { content: [{ type: "text", text: `No INDEX at ${indexFile}. This extension is inert. Do not search the filesystem for notes.` }], isError: true };
        }
        let index: ParsedIndex;
        try {
          index = parseIndex(raw);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[memory-gate] ${message}`);
          return { content: [{ type: "text", text: `${message}. Raw reads of this file are permitted.` }], isError: true };
        }
        parsed = index;
        const resolved = resolveTopic(index.notes, params.topic);
        if (resolved.ambiguous) {
          const lines = resolved.ambiguous.map((row) => `- ${row.topic} (${row.file})`).join("\n");
          return { content: [{ type: "text", text: `Ambiguous topic "${params.topic}". Candidates:\n${lines}` }], isError: true };
        }
        if (!resolved.match) {
          const table = index.notes.map((row) => `- ${row.topic} | ${row.file} | ${row.status}`).join("\n");
          return {
            content: [{ type: "text", text: `Topic "${params.topic}" is not indexed. Notes table:\n${table || "(empty)"}` }],
            isError: true,
          };
        }
        const notePath = path.resolve(cwd, notesRel, resolved.match.file);
        const gate = gateNoteOpen(getOpenNote()?.path ?? null, notePath, params.override === true, notesPerTask);
        if (!gate.allow) {
          return { content: [{ type: "text", text: gate.reason ?? "rejected" }], isError: true };
        }
        if (gate.loggedOverride) console.error(`[memory-gate] protocol override note_open ${notePath}`);
        const body = readText(notePath);
        if (body === null) {
          return { content: [{ type: "text", text: `Indexed file is missing: ${notePath}` }], isError: true };
        }
        let note: NoteFrontMatter;
        try {
          note = parseNote(body);
        } catch (err) {
          failedNotes.add(notePath);
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[memory-gate] ${message}. Raw reads of ${notePath} are permitted.`);
          try {
            ctx.ui.notify(message, "error");
          } catch {
            /* headless */
          }
          return { content: [{ type: "text", text: message }], isError: true };
        }
        const depth = params.depth ?? "frontmatter";
        if (depth === "full") console.error(`[memory-gate] note_open full ${notePath}`);
        setOpenNote({
          path: notePath,
          topic: resolved.match.topic,
          currentClaim: note.currentClaim,
          preCommitted: note.preCommitted,
        });
        const payload = {
          path: notePath,
          frontmatter: frontMatterView(note),
          ...(depth === "full" ? { body: body.slice(note.bodyOffset) } : {}),
        };
        return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
      },
    });

    pi.registerTool({
      name: "note_update",
      label: "Update note",
      description: "Patch one front-matter field. Preserves the rest of the file. Rejects sealed notes.",
      promptSnippet: "Patch one note front-matter field",
      promptGuidelines: ["Use note_update for front-matter. Do not edit a sealed note. Do not commit."],
      parameters: Type.Object({
        path: Type.String({ description: "Note path returned by note_open" }),
        field: Type.String({ description: "Front-matter field name" }),
        value: Type.String({ description: "Replacement value for that field" }),
      }),
      async execute(_id, params) {
        const file = params.path;
        const raw = readText(file);
        if (raw === null) return { content: [{ type: "text", text: `Missing note: ${file}` }], isError: true };
        try {
          const next = applyNoteUpdate(raw, params.field as keyof NoteFrontMatter, params.value, today());
          fs.writeFileSync(file, next);
          const diff = unifiedDiff(file, raw, next);
          if (getOpenNote()?.path === file) {
            const note = parseNote(next);
            setOpenNote({ path: file, topic: note.topic, currentClaim: note.currentClaim, preCommitted: note.preCommitted });
          }
          return { content: [{ type: "text", text: JSON.stringify({ diff }) }] };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[memory-gate] ${message}`);
          return { content: [{ type: "text", text: message }], isError: true };
        }
      },
    });

    pi.registerTool({
      name: "queue_append",
      label: "Append queue",
      description: "Append one row to INDEX § Active next. The only write path to the queue.",
      promptSnippet: "Append one Active next row",
      promptGuidelines: ["Use queue_append to change what happens next. Do not edit the queue by hand."],
      parameters: Type.Object({
        item: Type.String({ description: "One line: what happens next" }),
        source: Type.String({ description: "Note path, or the literal human" }),
      }),
      async execute(_id, params, _signal, _onUpdate, ctx) {
        const file = path.resolve(findProjectRoot(ctx.cwd), indexRel);
        const raw = readText(file);
        if (raw === null) return { content: [{ type: "text", text: `Missing INDEX: ${file}` }], isError: true };
        try {
          const next = appendQueue(raw, params.item, params.source, today());
          fs.writeFileSync(file, next);
          const diff = unifiedDiff(file, raw, next);
          const marked = loadIndex(findProjectRoot(ctx.cwd));
          if (marked) setMemoryBlock(marked);
          return { content: [{ type: "text", text: JSON.stringify({ diff }) }] };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[memory-gate] ${message}`);
          return { content: [{ type: "text", text: message }], isError: true };
        }
      },
    });

    pi.registerTool({
      name: "explain_write",
      label: "Write explanation",
      description: "Write a walkthrough under .agent/explain/. Never touches INDEX.",
      promptSnippet: "Write an explanation for the human",
      promptGuidelines: ["Use explain_write for walkthroughs. Never put an explanation in .agent/notes/ or INDEX."],
      parameters: Type.Object({
        slug: Type.String({ description: "Short kebab-case slug" }),
        body: Type.String({ description: "Markdown walkthrough" }),
      }),
      async execute(_id, params, _signal, _onUpdate, ctx) {
        const dir = path.resolve(findProjectRoot(ctx.cwd), explainRel);
        const name = explainWriteName(params.slug, today());
        const file = path.join(dir, name);
        const relative = path.relative(dir, file);
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
          return { content: [{ type: "text", text: "explain_write refuses paths outside .agent/explain/" }], isError: true };
        }
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, params.body.endsWith("\n") ? params.body : `${params.body}\n`);
        return { content: [{ type: "text", text: JSON.stringify({ path: file }) }] };
      },
    });

    pi.registerTool({
      name: "memory_bootstrap",
      label: "Bootstrap memory",
      description: "Create missing project memory files from templates. Never overwrites an existing file.",
      promptSnippet: "Create any missing memory files",
      promptGuidelines: ["Use memory_bootstrap when the notes index is missing. It does not overwrite files and it does not create source trees."],
      parameters: Type.Object({}),
      async execute(_id, _params, _signal, _onUpdate, ctx) {
        const root = findProjectRoot(ctx.cwd);
        const result = scaffoldProject(root, templatesDir);
        for (const line of result.logs) console.error(`[memory-gate] ${line}`);
        loadIndex(root);
        return { content: [{ type: "text", text: JSON.stringify({ root, created: result.created, logs: result.logs }) }] };
      },
    });

  } catch (err) {
    console.error("[memory-gate] failed to load; other extensions continue", err);
  }
}
