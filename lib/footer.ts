import path from "node:path";
import type { QuotaWindow } from "./quota.ts";

export type UsageLike = {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  cost?: { total?: number };
};

export type FooterUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  latestCacheHitRate?: number;
};

export function formatFooterTokens(count: number): string {
  if (!Number.isFinite(count) || count < 0) return "?";
  if (count < 1_000) return Math.round(count).toString();
  if (count < 10_000) return `${(count / 1_000).toFixed(1)}k`;
  if (count < 1_000_000) return `${Math.round(count / 1_000)}k`;
  if (count < 10_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  return `${Math.round(count / 1_000_000)}M`;
}

export function contextTokenText(tokens: number | null | undefined, contextWindow: number): string {
  return `${tokens === null || tokens === undefined ? "?" : formatFooterTokens(tokens)}/${formatFooterTokens(contextWindow)}`;
}

function percentText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

export function quotaFooterParts(windows: QuotaWindow[]): string[] {
  const parts: string[] = [];
  for (const label of ["5h", "weekly"] as const) {
    const window = windows.find((candidate) => candidate.label === label);
    if (window) parts.push(`${label} ${percentText(window.usedPercent)}%`);
  }
  return parts;
}

function addUsage(total: FooterUsage, usage: UsageLike | undefined): void {
  if (!usage) return;
  total.input += usage.input ?? 0;
  total.output += usage.output ?? 0;
  total.cacheRead += usage.cacheRead ?? 0;
  total.cacheWrite += usage.cacheWrite ?? 0;
  total.cost += usage.cost?.total ?? 0;
}

export function collectFooterUsage(entries: Array<Record<string, unknown>>): FooterUsage {
  const total: FooterUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
  for (const entry of entries) {
    if (entry.type === "usage") {
      addUsage(total, entry.usage as UsageLike | undefined);
      continue;
    }
    if (entry.type === "message") {
      const message = entry.message as { role?: string; usage?: UsageLike } | undefined;
      if (message?.role === "assistant") {
        addUsage(total, message.usage);
        const prompt = (message.usage?.input ?? 0) + (message.usage?.cacheRead ?? 0) + (message.usage?.cacheWrite ?? 0);
        if (prompt > 0) total.latestCacheHitRate = ((message.usage?.cacheRead ?? 0) / prompt) * 100;
      } else if (message?.role === "toolResult") {
        addUsage(total, message.usage);
      }
      continue;
    }
    if (entry.type === "branch_summary" || entry.type === "compaction") {
      addUsage(total, entry.usage as UsageLike | undefined);
    }
  }
  return total;
}

export function formatFooterCwd(cwd: string, home: string | undefined): string {
  if (!home) return cwd;
  const relative = path.relative(path.resolve(home), path.resolve(cwd));
  if (relative === "") return "~";
  if (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    return `~${path.sep}${relative}`;
  }
  return cwd;
}
