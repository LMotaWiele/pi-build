/**
 * Every turn that wrote a file gets a walkthrough from a scout subagent.
 * The subagent is read-only. The parent writes under .agent/explain/.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { selectExplainModel, stringMap } from "../lib/models.ts";
import { explainWriteName, unifiedDiff } from "../lib/markdown.ts";
import { findProjectRoot } from "../lib/scaffold.ts";
import {
  attachTelemetry,
  explainCommand,
  extensionEnabled,
  knownEntriesFromExplanation,
  mergeKnown,
  noteWrittenFile,
  readPiSettings,
  settingsBlock,
  sawRunAborted,
  writtenFiles,
} from "../lib/telemetry.ts";
import { extractAssistantText } from "./recap.ts";

const execFileAsync = promisify(execFile);

export const EXPLAIN_CONTRACT = `Write five sections, in this order, for a competent programmer who is new to this stack:

1. **What changed** — files, one sentence of purpose each.
2. **Unfamiliar surface** — every language feature, stdlib call, or library API used that is not already in known.md: what it does, why it appears here. If nothing is unfamiliar, say so explicitly. End the section with one \`known: <name>\` line per new idiom or API.
3. **The alternative** — the idiomatic other option and why this one won.
4. **Verify by hand** — the two or three things tests do not cover.
5. **To modify this yourself** — what to understand first.

Do not write any file. The parent records the walkthrough.`;

export function shouldExplain(files: string[]): boolean {
  return files.length > 0;
}

/** An aborted turn has nothing finished to narrate. */
export function explainAfterTurn(files: string[], aborted: boolean): boolean {
  return shouldExplain(files) && !aborted;
}

export default function explainExtension(pi: ExtensionAPI): void {
  try {
    const settings = readPiSettings();
    if (!extensionEnabled(settings, "explain")) return;
    attachTelemetry(pi as unknown as Parameters<typeof attachTelemetry>[0]);
    const block = settingsBlock(settings, "explain");
    const explainRel = typeof block["explainDir"] === "string" ? block["explainDir"] : ".agent/explain";
    const diffs: string[] = [];

    pi.on("tool_result", (event) => {
      if (event.isError) return;
      if (event.toolName !== "edit" && event.toolName !== "write") return;
      const input = event.input as {
        path?: string;
        content?: string;
        edits?: { oldText: string; newText: string }[];
      };
      if (!input.path) return;
      noteWrittenFile(input.path);
      if (event.toolName === "write") {
        diffs.push(unifiedDiff(input.path, "", input.content ?? ""));
        return;
      }
      for (const edit of input.edits ?? []) diffs.push(unifiedDiff(input.path, edit.oldText, edit.newText));
    });

    pi.on("agent_end", async (_event, ctx) => {
      const files = writtenFiles();
      if (!explainAfterTurn(files, sawRunAborted())) return;
      const routing = settingsBlock(settings, "routing");
      const registry = (ctx as { modelRegistry?: { getAll: () => { provider: string; id: string; name?: string }[] } }).modelRegistry;
      const catalog = registry?.getAll().map((model) => ({ provider: model.provider, id: model.id, name: model.name })) ?? [];
      const selected = selectExplainModel({
        tiers: stringMap(routing["tiers"]),
        catalog,
        routingEnabled: extensionEnabled(settings, "routing"),
        defaultModel: typeof settings["defaultModel"] === "string" ? settings["defaultModel"] : undefined,
      });
      for (const line of selected.warnings) console.error(`[explain] ${line}`);
      if (!selected.model) return;
      const dir = path.resolve(findProjectRoot(ctx.cwd), explainRel);
      const knownPath = path.join(dir, "known.md");
      const known = fs.existsSync(knownPath) ? fs.readFileSync(knownPath, "utf8") : "";
      const diff = diffs.join("\n").slice(0, 48_000);
      diffs.length = 0;
      const prompt = `${EXPLAIN_CONTRACT}\n\nAlready known:\n${known || "(none)"}\n\nTouched files:\n${files.join("\n")}\n\nDiff:\n${diff}`;
      const command = explainCommand(prompt, selected.model);
      let body = "";
      try {
        const result = await execFileAsync(command.bin, command.args, {
          cwd: ctx.cwd,
          timeout: 180_000,
          maxBuffer: 8_000_000,
        });
        body = extractAssistantText(result.stdout);
      } catch (err) {
        body = `Explanation subagent failed: ${err instanceof Error ? err.message : String(err)}\n\nTouched:\n${files.join("\n")}\n`;
        console.error(`[explain] ${body}`);
      }
      if (!body.trim()) return;
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, explainWriteName("turn", new Date().toISOString().slice(0, 10)));
      const target = fs.existsSync(file) ? file.replace(/\.md$/, `-${Date.now()}.md`) : file;
      fs.writeFileSync(target, body.endsWith("\n") ? body : `${body}\n`);
      const entries = knownEntriesFromExplanation(body);
      if (entries.length) fs.writeFileSync(knownPath, mergeKnown(known, entries));
      console.error(`[explain] wrote ${target}`);
    });
  } catch (err) {
    console.error("[explain] failed to load; other extensions continue", err);
  }
}
