/**
 * Rebuilds the codebase map (tools/map) after a turn that touched the project.
 * The build runs in the background and never delays other agent_end handlers.
 * /map builds now and prints the page; /map open also opens it.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findProjectRoot } from "../lib/scaffold.ts";
import {
  attachTelemetry,
  explainOneShot,
  extensionEnabled,
  readPiSettings,
  settingsBlock,
  telemetryPath,
  turnSnapshot,
  writtenFiles,
} from "../lib/telemetry.ts";

export const MAP_TIMEOUT_MS = 60_000;

export interface MapSettings {
  outDir: string;
  windowDays: number;
  uv: string;
  toolDir: string;
}

/** tools/map beside this file's real location; the installer links extensions/ into the agent dir. */
export function defaultToolDir(file = fileURLToPath(import.meta.url)): string {
  let real = file;
  try {
    real = fs.realpathSync(file);
  } catch {
    // keep the given path
  }
  return path.resolve(path.dirname(real), "..", "tools", "map");
}

export function mapSettings(block: Record<string, unknown>, toolDir = defaultToolDir()): MapSettings {
  const days = block["windowDays"];
  return {
    outDir: typeof block["outDir"] === "string" && block["outDir"] ? block["outDir"] : ".agent/map",
    windowDays: typeof days === "number" && days > 0 ? days : 7,
    uv: typeof block["uv"] === "string" && block["uv"] ? block["uv"] : "uv",
    toolDir: typeof block["toolDir"] === "string" && block["toolDir"] ? block["toolDir"] : toolDir,
  };
}

export function mapCommand(
  settings: MapSettings,
  input: { root: string; telemetry: string; turn?: string },
): { bin: string; args: string[] } {
  const args = [
    "run", "--project", settings.toolDir, "python", "-m", "map_build",
    "--repo", input.root,
    "--out", path.resolve(input.root, settings.outDir),
    "--telemetry", input.telemetry,
    "--window-days", String(settings.windowDays),
  ];
  if (input.turn) args.push("--turn", input.turn);
  return { bin: settings.uv, args };
}

/** A path from a tool call is the project's when it resolves inside the root. */
export function touchesProject(paths: string[], root: string): boolean {
  const base = path.resolve(root);
  return paths.some((p) => {
    const full = path.resolve(base, p);
    return full === base || full.startsWith(base + path.sep);
  });
}

export type Runner = (command: { bin: string; args: string[] }, cwd: string) => Promise<number>;

/** One build at a time. A request during a build marks the state dirty and runs once more after it. */
export class SingleFlight {
  private running: Promise<void> | null = null;
  private pending: { bin: string; args: string[]; cwd: string } | null = null;
  private readonly runner: Runner;
  runs = 0;

  constructor(runner: Runner) {
    this.runner = runner;
  }

  get busy(): boolean {
    return this.running !== null;
  }

  request(command: { bin: string; args: string[] }, cwd: string): Promise<void> {
    if (this.running) {
      this.pending = { ...command, cwd };
      return this.running;
    }
    this.running = this.loop({ ...command, cwd });
    return this.running;
  }

  private async loop(first: { bin: string; args: string[]; cwd: string }): Promise<void> {
    let next: typeof first | null = first;
    try {
      while (next) {
        const current = next;
        this.pending = null;
        this.runs += 1;
        try {
          await this.runner({ bin: current.bin, args: current.args }, current.cwd);
        } catch (err) {
          console.error(`[map] build failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        next = this.pending;
      }
    } finally {
      this.running = null;
    }
  }
}

export function spawnRunner(timeoutMs = MAP_TIMEOUT_MS): Runner {
  return (command, cwd) =>
    new Promise((resolve) => {
      const child = spawn(command.bin, command.args, { cwd, stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      child.stderr?.on("data", (chunk: Buffer) => {
        if (stderr.length < 4000) stderr += chunk.toString("utf8");
      });
      const timer = setTimeout(() => {
        console.error(`[map] build exceeded ${timeoutMs / 1000}s; killed`);
        child.kill("SIGKILL");
      }, timeoutMs);
      child.on("error", (err) => {
        clearTimeout(timer);
        console.error(`[map] could not start ${command.bin}: ${err.message}`);
        resolve(-1);
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        if (code !== 0 && code !== null) console.error(`[map] build exited ${code}: ${stderr.trim().split("\n").pop() ?? ""}`);
        resolve(code ?? -1);
      });
    });
}

export function uvAvailable(uv: string): boolean {
  try {
    return spawnSync(uv, ["--version"], { stdio: "ignore", timeout: 10_000 }).status === 0;
  } catch {
    return false;
  }
}

function openCommand(file: string): { bin: string; args: string[] } {
  if (process.platform === "darwin") return { bin: "open", args: [file] };
  if (process.platform === "win32") return { bin: "cmd", args: ["/c", "start", "", file] };
  return { bin: "xdg-open", args: [file] };
}

export default function mapExtension(pi: ExtensionAPI): void {
  try {
    if (explainOneShot()) return;
    const settings = readPiSettings();
    if (!extensionEnabled(settings, "map")) return;
    attachTelemetry(pi as unknown as Parameters<typeof attachTelemetry>[0], "map");
    const config = mapSettings(settingsBlock(settings, "map"));
    const builds = new SingleFlight(spawnRunner());
    let uvChecked: boolean | null = null;
    const ready = (): boolean => {
      if (uvChecked === null) {
        uvChecked = uvAvailable(config.uv);
        if (!uvChecked) console.error(`[map] ${config.uv} not found; the map stays off this session`);
      }
      return uvChecked;
    };
    const touched: string[] = [];

    pi.on("tool_result", (event) => {
      const input = event.input as { path?: unknown } | undefined;
      if (input && typeof input.path === "string") touched.push(input.path);
    });

    const build = (cwd: string): Promise<void> | null => {
      if (!ready()) return null;
      const root = findProjectRoot(cwd);
      const command = mapCommand(config, { root, telemetry: telemetryPath(), turn: turnSnapshot().turnId || undefined });
      return builds.request(command, root);
    };

    pi.on("agent_end", (_event, ctx) => {
      const root = findProjectRoot(ctx.cwd);
      const paths = [...touched, ...writtenFiles()];
      touched.length = 0;
      if (!touchesProject(paths, root)) return;
      void build(ctx.cwd);
    });

    pi.registerCommand("map", {
      description: "Build the codebase map now; `/map open` also opens it",
      handler: async (args, ctx) => {
        const pending = build(ctx.cwd);
        if (!pending) {
          ctx.ui.notify(`[map] ${config.uv} not found`, "warning");
          return;
        }
        await pending;
        const page = path.resolve(findProjectRoot(ctx.cwd), config.outDir, "index.html");
        if (!fs.existsSync(page)) {
          ctx.ui.notify("[map] build produced no page; see stderr", "warning");
          return;
        }
        ctx.ui.notify(page, "info");
        if (String(args ?? "").trim() === "open") {
          const opener = openCommand(page);
          spawn(opener.bin, opener.args, { detached: true, stdio: "ignore" }).on("error", () => undefined).unref();
        }
      },
    });
  } catch (err) {
    console.error("[map] failed to load; other extensions continue", err);
  }
}
