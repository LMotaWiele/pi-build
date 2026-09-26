// lib/tiers.ts — where a bound-stopped turn retries, and whether it may.

export type Family = "luna" | "terra" | "sol";

export interface RetryTarget {
  model: string;
  thinking: "medium" | "high";
}

export const CODEX = {
  terra: "openai-codex/gpt-5.6-terra",
  sol: "openai-codex/gpt-5.6-sol",
} as const;

// Family by model name, whatever the provider prefix.
export function familyOf(model: string): Family | null {
  const m = model.match(/gpt-5\.6-(luna|terra|sol)$/);
  return m ? (m[1] as Family) : null;
}

// One tier up, on the subscription only. If Terra does not resolve on the
// subscription, Luna goes to Sol rather than to a per-token provider.
// Sol and unknown models do not retry.
export function nextTier(model: string, resolves: (id: string) => boolean): RetryTarget | null {
  const f = familyOf(model);
  if (f === "luna") {
    if (resolves(CODEX.terra)) return { model: CODEX.terra, thinking: "medium" };
    if (resolves(CODEX.sol)) return { model: CODEX.sol, thinking: "high" };
    return null;
  }
  if (f === "terra") return resolves(CODEX.sol) ? { model: CODEX.sol, thinking: "high" } : null;
  return null;
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
