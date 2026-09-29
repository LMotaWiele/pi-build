// lib/tiers.ts — where a bound-stopped turn retries, and whether it may.
// GPT-6 ladder: Luna -> Sol (medium) -> Sol (high) -> stop. Astra is manual only.
// Subscription provider only; a retry never targets a per-token provider.

export type Family = "luna" | "terra" | "sol" | "astra";

export interface RetryTarget {
  model: string;
  thinking: "medium" | "high";
}

export const CODEX = {
  luna: "openai-codex/gpt-6-luna",
  sol: "openai-codex/gpt-6.1-sol",
  astra: "openai-codex/gpt-6-astra",
  solFallback: "openai-codex/gpt-6-sol",
  solLegacy: "openai-codex/gpt-5.6-sol",
} as const;

const HIGH_OR_ABOVE = new Set(["high", "xhigh", "max"]);

// Family by model name across GPT versions, whatever the provider prefix.
export function familyOf(model: string): Family | null {
  const m = model.match(/(?:^|\/)gpt-\d+(?:\.\d+)?-(luna|terra|sol|astra)$/);
  return m ? (m[1] as Family) : null;
}

function firstResolving(candidates: RetryTarget[], resolves: (id: string) => boolean): RetryTarget | null {
  return candidates.find((c) => resolves(c.model)) ?? null;
}

export function nextTier(
  model: string,
  thinking: string | undefined,
  resolves: (id: string) => boolean,
): RetryTarget | null {
  const f = familyOf(model);
  const solHigh: RetryTarget[] = [CODEX.sol, CODEX.solFallback, CODEX.solLegacy]
    .map((model) => ({ model, thinking: "high" }));
  // Luna's medium step applies only to the primary Sol; fallbacks run at high.
  if (f === "luna") return firstResolving([{ model: CODEX.sol, thinking: "medium" }, ...solHigh.slice(1)], resolves);
  if (f === "terra") return firstResolving(solHigh, resolves);
  if (f === "sol") return HIGH_OR_ABOVE.has(thinking ?? "") ? null : firstResolving(solHigh, resolves);
  return null; // astra and unknown models do not retry
}

export function retryAllowed(input: {
  env: Record<string, string | undefined>;
  held: boolean;
  alreadyRetried: boolean;
}): boolean {
  if (input.env.PI_BUILD_RETRY === "0") return false;
  if (input.held) return false;
  return !input.alreadyRetried;
}
