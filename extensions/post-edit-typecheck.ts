/**
 * Copied from Rmnlly/pi-config@ac0bb8edccfa07e78e6ab06b6b0538f1572c2d6e
 * extensions/post-edit-typecheck.ts
 * Import rewritten from @mariozechner/pi-coding-agent to @earendil-works/pi-coding-agent.
 * That repository publishes no license. The MIT License at the repository
 * root does not grant rights to this file. See NOTICE.
 * Disable with settings postEditTypecheck.enabled = false.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { extensionEnabled, readPiSettings } from "../lib/telemetry.ts";

export default function postEditTypecheck(pi: ExtensionAPI): void {
  try {
    if (!extensionEnabled(readPiSettings(), "postEditTypecheck")) return;
    const EDIT_TOOLS = new Set(["edit", "write"]);
    let pendingCheck = false;
    let lastCheckTime = 0;
    const DEBOUNCE_MS = 3000;

    function detectTypeCheckCommand(cwd: string): string | null {
      let dir = cwd;
      while (dir !== "/") {
        if (existsSync(resolve(dir, "tsconfig.json"))) {
          const hasPnpm = existsSync(resolve(dir, "pnpm-lock.yaml"));
          const runner = hasPnpm ? "pnpm exec tsc" : "npx tsc";
          return `cd ${dir} && ${runner} --noEmit --pretty 2>&1 | tail -30`;
        }
        dir = resolve(dir, "..");
      }
      return null;
    }

    pi.on("tool_result", async (event) => {
      if (!EDIT_TOOLS.has(event.toolName)) return;
      if (event.isError) return;
      const filePath = (event.input as { path?: string })?.path ?? "";
      if (!filePath.match(/\.(ts|tsx)$/)) return;
      pendingCheck = true;
    });

    pi.on("turn_end", async (_event, ctx) => {
      if (!pendingCheck) return;
      pendingCheck = false;
      const now = Date.now();
      if (now - lastCheckTime < DEBOUNCE_MS) return;
      lastCheckTime = now;
      const cmd = detectTypeCheckCommand(ctx.cwd);
      if (!cmd) return;
      ctx.ui.setStatus("typecheck", "Running type check...");
      try {
        const result = await pi.exec("bash", ["-c", cmd], { timeout: 120000 });
        const output = (result.stdout + result.stderr).trim();
        if (result.code === 0) {
          ctx.ui.setStatus("typecheck", "Types OK");
          setTimeout(() => ctx.ui.setStatus("typecheck", ""), 5000);
        } else {
          const lines = output.split("\n").slice(0, 15);
          ctx.ui.setWidget("typecheck", ["Type errors:", ...lines]);
          ctx.ui.setStatus("typecheck", "Type errors found");
        }
      } catch {
        ctx.ui.setStatus("typecheck", "Type check failed");
        setTimeout(() => ctx.ui.setStatus("typecheck", ""), 5000);
      }
    });
  } catch (err) {
    console.error("[post-edit-typecheck] failed to load; other extensions continue", err);
  }
}
