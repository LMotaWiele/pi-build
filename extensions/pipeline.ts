import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { findHarnessRoot, implementArgs, STOP_AND_REPORT, targetRepo, testEnv } from "../lib/pipeline.ts";
import { initialProgress, parseProgressLine, progressSummary, reduceProgress, renderProgress } from "../lib/progress.ts";

export default async function pipelineExtension(pi: ExtensionAPI, options: { harnessRoot?: string } = {}): Promise<void> {
  const moduleFile = fileURLToPath(import.meta.url);
  const harness = options.harnessRoot ?? findHarnessRoot(moduleFile);
  const { Type } = await import("typebox");
  pi.registerTool({
    name: "implement_spec",
    label: "Implement spec",
    description: "Implement a spec from /docs/specs through the delegated pipeline — Sol plans, Luna implements each task, Sol integrates — streaming progress into the chat. A passing run fast-forwards the branch you started on if it has not moved; otherwise it leaves a review branch. If it fails: " + STOP_AND_REPORT,
    exposure: "direct",
    parameters: Type.Object({
      spec: Type.String({ description: "Spec ID, slug or path, or a downloaded .md or .zip to install and then run" }),
      planOnly: Type.Optional(Type.Boolean({ description: "Plan without implementing" })),
      resume: Type.Optional(Type.Boolean({ description: "Resume a held or interrupted run" })),
    }),
    async execute(_id, params, signal, onUpdate, ctx) {
      let state = initialProgress(params.spec);
      if (!harness || !existsSync(join(harness, "bin", "pi-implement"))) return {
        content: [{ type: "text" as const, text: `No pipeline runner found ${harness ? `in ${harness}` : `above ${moduleFile}`}.\n${STOP_AND_REPORT}` }],
        details: state,
        isError: true,
      };
      const target = targetRepo(ctx.cwd);
      if (!target) return {
        content: [{ type: "text" as const, text: `implement_spec needs a git repository; ${ctx.cwd} is not inside one.\n${STOP_AND_REPORT}` }],
        details: state,
        isError: true,
      };

      let stderr = "";
      let aborted = signal?.aborted ?? false;
      let spawnError: string | undefined;
      const code = await new Promise<number | null>((resolveExit) => {
        if (aborted) { resolveExit(130); return; }
        const child = spawn(join(harness, "bin", "pi-implement"), implementArgs({ ...params, repo: target }), {
          cwd: target,
          env: testEnv(process.env),
          stdio: ["ignore", "pipe", "pipe"],
        });
        let buffer = "";
        const line = (text: string) => {
          const event = parseProgressLine(text.trim());
          if (!event) return;
          state = reduceProgress(state, event);
          onUpdate?.({ content: [{ type: "text", text: progressSummary(state) }], details: state });
        };
        child.stdout.on("data", (data: Buffer) => {
          buffer += data.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const item of lines) line(item);
        });
        child.stderr.on("data", (data: Buffer) => { stderr = (stderr + data.toString()).slice(-16_384); });
        const abort = () => { aborted = true; child.kill("SIGTERM"); };
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
        child.on("error", (error) => { spawnError = error.message; });
        child.on("close", (exitCode) => {
          signal?.removeEventListener("abort", abort);
          if (buffer.trim()) line(buffer);
          resolveExit(exitCode);
        });
      });

      const handedOff = !aborted && code === 0 && state.done?.ok === true && Boolean(state.done.branch || state.done.landed) && Boolean(state.done.runRecord);
      const planned = Boolean(params.planOnly) && !aborted && code === 0 && state.done?.ok === true && Boolean(state.done.branch) && !state.done.runRecord;
      const succeeded = handedOff || planned;
      let text = progressSummary(state);
      if (planned) text += `\nPlan gate passed on \`${state.done!.branch}\`. To implement it, call implement_spec again with resume: true.`;
      if (code === 75) text += "\nHeld by the quota gate: run `bin/pi-continue`, then call again with `resume: true`";
      else if (code === 2) {
        // Preflight can fail before it has emitted a done event; preserve the runner's diagnostics.
        const reasons = state.done?.summary || stderr.trim() || "Preflight blocked.";
        if (!text.includes(reasons)) text += `\nPreflight: ${reasons}`;
      } else if (aborted) text += "\nAborted; call again with `resume: true`.";
      else if (!succeeded && (spawnError || stderr.trim())) text += `\n${spawnError ?? stderr.trim()}`;
      if (!succeeded && !state.done && code !== 2 && code !== 75 && !aborted) text += `\nRunner exited ${code ?? "without a status"} without handoff.`;
      if (!succeeded) text += `\n${STOP_AND_REPORT}`;
      return { content: [{ type: "text", text }], details: state, isError: !succeeded };
    },
    renderCall(args, theme) {
      return new Text(theme.fg("toolTitle", theme.bold("implement_spec ")) + theme.fg("accent", args.spec), 0, 0);
    },
    renderResult(result, { expanded }, theme) {
      const lines = result.details ? renderProgress(result.details, expanded) :
        result.content.filter((part) => part.type === "text").map((part) => part.text);
      if (result.isError) {
        const message = result.content.find((part) => part.type === "text");
        if (message?.type === "text") {
          for (const line of message.text.split("\n")) {
            if (!lines.some((shown) => shown.includes(line))) lines.push(line);
          }
        }
      }
      return new Text(lines.map((line) => theme.fg(result.isError ? "error" : "toolOutput", line)).join("\n"), 0, 0);
    },
  });
}
