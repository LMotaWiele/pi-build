/**
 * Copied from Rmnlly/pi-config@ac0bb8edccfa07e78e6ab06b6b0538f1572c2d6e
 * extensions/post-edit-typecheck.ts
 * Import rewritten from @mariozechner/pi-coding-agent to @earendil-works/pi-coding-agent.
 * That repository publishes no license. The MIT License at the repository
 * root does not grant rights to this file. See NOTICE.
 * Disable with settings postEditTypecheck.enabled = false.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { attachTelemetry, extensionEnabled, readPiSettings } from "../lib/telemetry.ts";

export const TYPECHECK_DEBOUNCE_MS = 3000;
export const TYPECHECK_TIMEOUT_MS = 120000;
export const TYPECHECK_OUTPUT_LINES = 30;
const TYPECHECK_OK_CLEAR_MS = 5000;
const COMPILER_ARGS = ["--noEmit", "--pretty"];

export type CompilerResult = {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  /** Arrival-order stdout and stderr. When set, this is what the hook truncates. */
  output?: string;
  timedOut?: boolean;
  spawnError?: string;
};

export type CompilerRequest = {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
};

export type CompilerRunner = (request: CompilerRequest) => Promise<CompilerResult>;

export type TypecheckClass = {
  kind: "ok" | "errors" | "did-not-run";
  reason: string;
  code: number | null;
  lines: string[];
};

export type TypecheckProject = {
  dir: string;
  bin: string | null;
};

type TypecheckUi = {
  setStatus: (key: string, text: string | undefined) => void;
  setWidget: (key: string, content: string[] | undefined) => void;
};

const EDIT_TOOLS = new Set(["edit", "write"]);

export function tailLines(text: string, limit: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const lines = trimmed.split("\n");
  return lines.length > limit ? lines.slice(lines.length - limit) : lines;
}

export function classifyCompilerResult(result: CompilerResult): TypecheckClass {
  const text = result.output !== undefined ? result.output : result.stdout + result.stderr;
  const lines = tailLines(text, TYPECHECK_OUTPUT_LINES);
  if (result.timedOut) {
    return { kind: "did-not-run", reason: "timeout", code: result.code, lines };
  }
  if (result.spawnError) {
    return { kind: "did-not-run", reason: result.spawnError, code: result.code, lines };
  }
  if (result.signal) {
    return { kind: "did-not-run", reason: `signal ${result.signal}`, code: result.code, lines };
  }
  if (result.code === 0) {
    return { kind: "ok", reason: "", code: 0, lines };
  }
  if (result.code === null) {
    return { kind: "did-not-run", reason: "no exit status", code: null, lines };
  }
  return { kind: "errors", reason: "", code: result.code, lines };
}

/** Walk from cwd to the filesystem root. The directory that holds tsconfig.json is the project. */
export function findTypecheckProject(cwd: string): TypecheckProject | null {
  let dir = cwd;
  while (dir !== "/") {
    if (existsSync(resolve(dir, "tsconfig.json"))) {
      return { dir, bin: resolveCompilerBin(dir) };
    }
    const parent = resolve(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function resolveCompilerBin(start: string): string | null {
  let dir = start;
  while (dir !== "/") {
    const candidate = resolve(dir, "node_modules", ".bin", "tsc");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function withTimeout(work: Promise<CompilerResult>, timeoutMs: number): Promise<CompilerResult> {
  return new Promise((resolveResult) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolveResult({ code: null, signal: null, stdout: "", stderr: "", timedOut: true });
    }, timeoutMs);
    work.then(
      (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolveResult(result);
      },
      (err: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolveResult({
          code: null,
          signal: null,
          stdout: "",
          stderr: "",
          spawnError: err instanceof Error ? err.message : String(err),
        });
      },
    );
  });
}

/** Spawn the compiler with an argument array. A timeout wins over a later exit code. */
export function spawnCompiler(request: CompilerRequest): Promise<CompilerResult> {
  return new Promise((resolveResult) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    let output = "";
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (result: CompilerResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolveResult(result);
    };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(request.command, request.args, {
        cwd: request.cwd,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      finish({
        code: null,
        signal: null,
        stdout: "",
        stderr: "",
        spawnError: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
        // The process is already gone.
      }
      finish({ code: null, signal: "SIGTERM", stdout, stderr, output, timedOut: true });
    }, request.timeoutMs);
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
      output += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
      output += chunk;
    });
    child.on("error", (err) => {
      finish({ code: null, signal: null, stdout, stderr, output, spawnError: err.message });
    });
    child.on("close", (code, signal) => {
      finish({ code, signal, stdout, stderr, output });
    });
  });
}

export function createPostEditTypecheck(pi: ExtensionAPI, options?: { run?: CompilerRunner }): void {
  try {
    if (!extensionEnabled(readPiSettings(), "postEditTypecheck")) return;
    attachTelemetry(pi as unknown as Parameters<typeof attachTelemetry>[0], "post-edit-typecheck");
    const run = options?.run ?? spawnCompiler;
    let phase: "idle" | "waiting" | "running" = "idle";
    let dirty = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    let cwd = "";
    let ui: TypecheckUi | null = null;

    const cancelClear = () => {
      if (!clearTimer) return;
      clearTimeout(clearTimer);
      clearTimer = null;
    };

    const show = (target: TypecheckUi, classified: TypecheckClass) => {
      cancelClear();
      if (classified.kind === "ok") {
        target.setWidget("typecheck", undefined);
        target.setStatus("typecheck", "Types OK");
        clearTimer = setTimeout(() => {
          clearTimer = null;
          target.setStatus("typecheck", "");
        }, TYPECHECK_OK_CLEAR_MS);
        return;
      }
      if (classified.kind === "errors") {
        target.setWidget("typecheck", ["Type errors:", ...classified.lines]);
        target.setStatus("typecheck", "Type errors found");
        return;
      }
      target.setWidget("typecheck", ["Type check did not run:", classified.reason]);
      target.setStatus("typecheck", `Type check did not run: ${classified.reason}`);
    };

    const finish = () => {
      if (dirty) {
        dirty = false;
        phase = "waiting";
        if (timer) clearTimeout(timer);
        // One follow-up after this run, not another full debounce window.
        timer = setTimeout(() => {
          timer = null;
          void start();
        }, 0);
        return;
      }
      phase = "idle";
    };

    const start = async () => {
      if (phase === "running") return;
      phase = "running";
      dirty = false;
      cancelClear();
      const target = ui;
      const project = findTypecheckProject(cwd);
      if (!target || !project) {
        finish();
        return;
      }
      if (!project.bin) {
        show(target, { kind: "did-not-run", reason: "compiler not found", code: null, lines: [] });
        finish();
        return;
      }
      target.setStatus("typecheck", "Running type check...");
      let result: CompilerResult;
      try {
        result = await withTimeout(
          run({ command: project.bin, args: COMPILER_ARGS, cwd: project.dir, timeoutMs: TYPECHECK_TIMEOUT_MS }),
          TYPECHECK_TIMEOUT_MS,
        );
      } catch (err) {
        result = {
          code: null,
          signal: null,
          stdout: "",
          stderr: "",
          spawnError: err instanceof Error ? err.message : String(err),
        };
      }
      show(target, classifyCompilerResult(result));
      finish();
    };

    const schedule = (nextCwd: string, nextUi: TypecheckUi) => {
      cwd = nextCwd;
      ui = nextUi;
      if (phase === "running") {
        dirty = true;
        return;
      }
      phase = "waiting";
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void start();
      }, TYPECHECK_DEBOUNCE_MS);
    };

    pi.on("tool_result", async (event, ctx) => {
      if (!EDIT_TOOLS.has(event.toolName)) return;
      if (event.isError) return;
      const filePath = (event.input as { path?: string })?.path ?? "";
      if (!filePath.match(/\.(ts|tsx)$/)) return;
      if (!ctx.ui) return;
      schedule(ctx.cwd, ctx.ui);
    });
  } catch (err) {
    console.error("[post-edit-typecheck] failed to load; other extensions continue", err);
  }
}

export default function postEditTypecheck(pi: ExtensionAPI): void {
  createPostEditTypecheck(pi);
}
