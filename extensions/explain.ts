/** After an edit turn, teach the configured reader only genuinely unfamiliar surface. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import fs from "node:fs";
import path from "node:path";
import { defaultModelRef, selectExplainModel, stringMap } from "../lib/models.ts";
import { unifiedDiff } from "../lib/markdown.ts";
import { findProjectRoot } from "../lib/scaffold.ts";
import {
  acceptKnown, explainPrompt, identifiersIn, knownPath, parseExplanation,
  resolveReader, shouldExplain as shouldExplainTurn, walkthroughFileName,
} from "../lib/explain.ts";
import {
  attachTelemetry, explainCommand, explainExec, explainOneShot, explainSpawnEnv,
  extensionEnabled, mergeKnown, noteWrittenFile, readPiSettings, settingsBlock,
  sawRunAborted, turnSnapshot, writtenFiles,
} from "../lib/telemetry.ts";
import { extractAssistantText } from "./recap.ts";

// Kept as the public gate used by the historical bounds/one-shot tests.
export function shouldExplain(files: string[]): boolean {
  return files.length > 0;
}

export function explainAfterTurn(files: string[], aborted: boolean, env: NodeJS.ProcessEnv = process.env): boolean {
  return !explainOneShot(env) && !aborted && shouldExplainTurn(files, env);
}

export default function explainExtension(pi: ExtensionAPI): void {
  try {
    const settings = readPiSettings();
    if (!extensionEnabled(settings, "explain")) return;
    attachTelemetry(pi as unknown as Parameters<typeof attachTelemetry>[0], "explain");
    const block = settingsBlock(settings, "explain");
    const explainRel = typeof block["explainDir"] === "string" ? block["explainDir"] : ".agent/explain";
    const diffs: string[] = [];

    pi.on("tool_result", (event) => {
      if (event.isError || (event.toolName !== "edit" && event.toolName !== "write")) return;
      const input = event.input as { path?: string; content?: string; edits?: { oldText: string; newText: string }[] };
      if (!input.path) return;
      noteWrittenFile(input.path);
      if (event.toolName === "write") diffs.push(unifiedDiff(input.path, "", input.content ?? ""));
      else for (const edit of input.edits ?? []) diffs.push(unifiedDiff(input.path, edit.oldText, edit.newText));
    });

    pi.on("agent_end", async (_event, ctx) => {
      // Capture before the awaited child call: later events may begin another turn.
      const turnId = turnSnapshot().turnId;
      const files = writtenFiles();
      const diff = diffs.join("\n").slice(0, 48_000);
      diffs.length = 0;
      if (!explainAfterTurn(files, sawRunAborted())) return;
      const routing = settingsBlock(settings, "routing");
      const registry = (ctx as { modelRegistry?: { getAll: () => { provider: string; id: string; name?: string }[] } }).modelRegistry;
      const catalog = registry?.getAll().map((model) => ({ provider: model.provider, id: model.id, name: model.name })) ?? [];
      const selected = selectExplainModel({ tiers: stringMap(routing["tiers"]), catalog,
        routingEnabled: extensionEnabled(settings, "routing"), defaultModel: defaultModelRef(settings) });
      for (const line of selected.warnings) console.error(`[explain] ${line}`);
      if (!selected.model) return;
      const root = findProjectRoot(ctx.cwd);
      const dir = path.resolve(root, explainRel);
      const knownFile = knownPath(process.env);
      const known = fs.existsSync(knownFile) ? fs.readFileSync(knownFile, "utf8") : "";
      const prompt = explainPrompt({ reader: resolveReader(settings), known, files, diff });
      let body: string;
      try {
        const result = await explainExec(explainCommand(prompt, selected.model), {
          cwd: ctx.cwd, timeout: 180_000, maxBuffer: 8_000_000, env: explainSpawnEnv(),
        });
        body = extractAssistantText(result.stdout);
      } catch (err) {
        console.error("[explain] explanation call failed; no walkthrough written", err);
        return;
      }
      if (!body.trim()) return;
      const parsed = parseExplanation(body);
      if (parsed.nothing || !parsed.unfamiliar || !parsed.modify) return;
      const target = path.join(dir, walkthroughFileName(new Date().toISOString().slice(0, 10), turnId));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(target, body.endsWith("\n") ? body : `${body}\n`);
      const sources = files.flatMap((file) => {
        try { return [fs.readFileSync(path.resolve(ctx.cwd, file), "utf8")]; } catch { return []; }
      });
      const entries = acceptKnown(parsed.known, parsed.unfamiliar, identifiersIn(sources));
      if (entries.length) {
        fs.mkdirSync(path.dirname(knownFile), { recursive: true });
        fs.writeFileSync(knownFile, mergeKnown(known, entries));
      }
      console.error(`[explain] wrote ${target}`);
    });
  } catch (err) {
    console.error("[explain] failed to load; other extensions continue", err);
  }
}
