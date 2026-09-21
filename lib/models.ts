/**
 * Model ids come from settings. Nothing here names a provider's catalog.
 * Exact means the configured string equals provider/id, case-sensitive.
 * A partial hit is a mismatch. No hit is missing. An empty catalog is missing.
 */

export interface CatalogModel {
  provider: string;
  id: string;
  name?: string;
}

export type Resolution =
  | { kind: "exact"; configured: string; provider: string; id: string }
  | {
      kind: "mismatch";
      configured: string;
      expectedProvider: string;
      resolvedProvider: string;
      resolvedId: string;
    }
  | { kind: "missing"; configured: string; expectedProvider: string };

export interface ResolvedTier {
  tier: string;
  configured: string;
  modelId: string;
  provider: string;
  id: string;
  /** Set when this tier's own id did not resolve and a lower tier did. */
  fallbackFrom?: string;
  warning?: string;
}

export interface RoutingPlan {
  fatal: boolean;
  refusals: string[];
  warnings: string[];
  tiers: Partial<Record<string, ResolvedTier>>;
}

const FALLBACK: Record<string, string[]> = {
  escalate: ["escalate", "work", "scout"],
  work: ["work", "scout"],
  scout: ["scout"],
  explain: ["explain", "scout", "work"],
};

const THINKING = new Set(["off", "minimal", "low", "medium", "high", "xhigh"]);

export function splitModelRef(configured: string): { provider: string; id: string } {
  const slash = configured.indexOf("/");
  if (slash < 0) return { provider: "", id: configured };
  return { provider: configured.slice(0, slash), id: configured.slice(slash + 1) };
}

function partialHit(configured: string, model: CatalogModel): boolean {
  const needle = configured.toLowerCase();
  if (!needle) return false;
  const canonical = `${model.provider}/${model.id}`.toLowerCase();
  if (canonical === needle) return true;
  const id = model.id.toLowerCase();
  const name = (model.name ?? "").toLowerCase();
  return id.includes(needle) || name.includes(needle);
}

/** The model a fuzzy CLI match would pick: aliases first, then the highest id. */
function pickPartial(configured: string, catalog: CatalogModel[]): CatalogModel | undefined {
  const hits = catalog.filter((model) => partialHit(configured, model));
  if (hits.length === 0) return undefined;
  const aliases = hits.filter((model) => !/\d{4}-\d{2}-\d{2}/.test(model.id) && !/\d{8}/.test(model.id));
  const pool = (aliases.length > 0 ? aliases : hits).slice().sort((a, b) => b.id.localeCompare(a.id));
  return pool[0];
}

export function resolutionOf(configured: string, catalog: CatalogModel[]): Resolution {
  const trimmed = configured.trim();
  const expected = splitModelRef(trimmed);
  const exact = catalog.find((model) => `${model.provider}/${model.id}` === trimmed);
  if (exact) return { kind: "exact", configured: trimmed, provider: exact.provider, id: exact.id };
  if (catalog.length === 0) return { kind: "missing", configured: trimmed, expectedProvider: expected.provider };
  const partial = pickPartial(trimmed, catalog);
  if (!partial) return { kind: "missing", configured: trimmed, expectedProvider: expected.provider };
  return {
    kind: "mismatch",
    configured: trimmed,
    expectedProvider: expected.provider,
    resolvedProvider: partial.provider,
    resolvedId: partial.id,
  };
}

export function mismatchLine(tier: string, resolution: Extract<Resolution, { kind: "mismatch" }>): string {
  return `refuse to start: tier ${tier} configured ${resolution.configured} expected provider ${resolution.expectedProvider} resolved ${resolution.resolvedProvider}/${resolution.resolvedId}`;
}

/**
 * Mismatch on any configured tier, or on defaultModel, refuses the session.
 * A missing tier falls back escalate → work → scout (explain → scout → work)
 * when routing is on. A missing tier only warns when routing is off.
 * An empty catalog cannot show a mismatch, so it warns and does not refuse.
 */
export function resolveRouting(opts: {
  tiers: Record<string, string>;
  catalog: CatalogModel[];
  routingEnabled: boolean;
  defaultModel?: string;
}): RoutingPlan {
  const refusals: string[] = [];
  const warnings: string[] = [];
  const tiers: RoutingPlan["tiers"] = {};
  const configured = Object.entries(opts.tiers).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0);

  if (opts.catalog.length === 0 && (configured.length > 0 || opts.defaultModel)) {
    warnings.push("[routing] model catalog is empty; resolution check skipped");
    return { fatal: false, refusals, warnings, tiers };
  }

  const byTier = new Map<string, Resolution>();
  for (const [tier, id] of configured) {
    const resolution = resolutionOf(id, opts.catalog);
    byTier.set(tier, resolution);
    if (resolution.kind === "mismatch") refusals.push(mismatchLine(tier, resolution));
  }
  if (opts.defaultModel) {
    const resolution = resolutionOf(opts.defaultModel, opts.catalog);
    if (resolution.kind === "mismatch") refusals.push(mismatchLine("defaultModel", resolution));
  }
  if (refusals.length > 0) return { fatal: true, refusals, warnings, tiers };

  const pick = (tier: string): ResolvedTier | undefined => {
    const chain = FALLBACK[tier] ?? [tier];
    for (const candidate of chain) {
      const id = opts.tiers[candidate];
      if (!id) continue;
      const resolution = byTier.get(candidate) ?? resolutionOf(id, opts.catalog);
      if (resolution.kind !== "exact") continue;
      const fallbackFrom = candidate === tier ? undefined : tier;
      const warning = fallbackFrom
        ? `[routing] tier ${tier} model ${opts.tiers[tier] ?? "(unset)"} did not resolve; using ${candidate} ${resolution.configured}`
        : undefined;
      return {
        tier,
        configured: opts.tiers[tier] ?? id,
        modelId: resolution.configured,
        provider: resolution.provider,
        id: resolution.id,
        fallbackFrom,
        warning,
      };
    }
    return undefined;
  };

  if (!opts.routingEnabled) {
    for (const [tier, id] of configured) {
      const resolution = byTier.get(tier);
      if (resolution?.kind === "missing") warnings.push(`[routing] tier ${tier} model ${id} is not in the registry; routing is disabled`);
    }
    const explain = pick("explain");
    if (explain) {
      tiers.explain = explain;
      if (explain.warning) warnings.push(explain.warning);
    } else if (opts.tiers.explain) {
      warnings.push(`[routing] explain model ${opts.tiers.explain} did not resolve; explain will be skipped`);
    }
    return { fatal: false, refusals, warnings, tiers };
  }

  const required = ["scout", "work", "escalate", "explain"].filter((tier) => tier === "work" || tier === "escalate" || Boolean(opts.tiers[tier]));
  for (const tier of required) {
    const chosen = pick(tier);
    if (!chosen) {
      refusals.push(`refuse to start: tier ${tier} resolves to nothing`);
      continue;
    }
    tiers[tier] = chosen;
    if (chosen.warning) warnings.push(chosen.warning);
  }
  return { fatal: refusals.length > 0, refusals, warnings, tiers };
}

export function fallbackChain(tier: string): string[] {
  return (FALLBACK[tier] ?? [tier]).slice();
}

/**
 * The session model is a mismatch when it is not the configured id but a fuzzy
 * match would still claim it. An exact `provider/id` is not a clash.
 */
export function sessionClash(
  configured: string,
  session: CatalogModel | undefined,
): Extract<Resolution, { kind: "mismatch" }> | null {
  if (!session) return null;
  if (`${session.provider}/${session.id}` === configured.trim()) return null;
  const resolution = resolutionOf(configured, [session]);
  return resolution.kind === "mismatch" ? resolution : null;
}

export function unselectableLine(tier: string, configured: string, session?: CatalogModel): string {
  const expected = splitModelRef(configured.trim()).provider || "(none)";
  const where = session ? `${session.provider}/${session.id}` : "(none)";
  return `refuse to start: tier ${tier} configured ${configured} expected provider ${expected} setModel refused; session model is ${where}`;
}

export function thinkingLevelFor(modelId: string, levels: Record<string, unknown>): string | undefined {
  const value = levels[modelId];
  if (typeof value !== "string" || !THINKING.has(value)) return undefined;
  return value;
}

export function selectExplainModel(opts: {
  tiers: Record<string, string>;
  catalog: CatalogModel[];
  routingEnabled: boolean;
  defaultModel?: string;
}): { model?: string; warnings: string[] } {
  const plan = resolveRouting(opts);
  if (plan.fatal) return { warnings: plan.refusals };
  const chosen = plan.tiers.explain;
  if (!chosen) return { warnings: [...plan.warnings, "explain model did not resolve; skipping"] };
  return { model: chosen.modelId, warnings: chosen.warning ? [...plan.warnings, chosen.warning] : plan.warnings };
}

export function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") out[key] = item;
  }
  return out;
}
