/**
 * Tier selection once per user prompt, before the first inference.
 * Bounds abort the turn. They do not prompt. Mid-loop model switches are not done here.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { decide } from "./jev/adapter.ts";
import { tierSelectQuestions } from "./jev/questions.ts";
import { buildState, decisionSupplements } from "./jev/state-builder.ts";
import { findProjectRoot } from "../lib/scaffold.ts";
import {
  fallbackChain,
  mismatchLine,
  resolveRouting,
  sessionClash,
  stringMap,
  thinkingLevelFor,
  unselectableLine,
  type ResolvedTier,
  type RoutingPlan,
} from "../lib/models.ts";
import {
  activeTierName,
  attachTelemetry,
  extensionEnabled,
  getOpenNote,
  explainOneShot,
  notePrompt,
  readPiSettings,
  selectTier,
  setActiveTier,
  settingsBlock,
  type TierAnswers,
} from "../lib/telemetry.ts";

type SessionModel = { provider: string; id: string; name?: string };

function halt(ctx: { shutdown?: () => void }, lines: string[]): never {
  for (const line of lines) console.error(line.startsWith("[routing]") ? line : `[routing] ${line}`);
  try {
    ctx.shutdown?.();
  } catch (err) {
    console.error("[routing] shutdown failed", err);
  }
  // Print, json, and rpc do not stop the prompt on shutdown. Exit before any inference.
  process.exit(1);
}

function sessionOf(ctx: { model?: SessionModel }): SessionModel | undefined {
  const model = ctx.model;
  if (!model || typeof model.provider !== "string" || typeof model.id !== "string") return undefined;
  return { provider: model.provider, id: model.id, name: model.name };
}

const ESCALATE_DEFAULTS: TierAnswers = {
  single_file_edit: false,
  needs_repo_reasoning: true,
  unfamiliar_stack: false,
  spec_exists: false,
  reversible: false,
};

/** "escalate" keeps the current defaults. "work" is the boolean inverse. */
export function uncertaintyDefaults(mode: unknown): TierAnswers {
  if (mode === "work") {
    return {
      single_file_edit: !ESCALATE_DEFAULTS.single_file_edit,
      needs_repo_reasoning: !ESCALATE_DEFAULTS.needs_repo_reasoning,
      unfamiliar_stack: !ESCALATE_DEFAULTS.unfamiliar_stack,
      spec_exists: !ESCALATE_DEFAULTS.spec_exists,
      reversible: !ESCALATE_DEFAULTS.reversible,
    };
  }
  return { ...ESCALATE_DEFAULTS };
}

export function formatTierSection(tiers: Partial<Record<string, { modelId: string }>>): string {
  const lines = ["This session sets its model with setModel. Resolved tiers:"];
  for (const [name, tier] of Object.entries(tiers)) {
    if (!tier) continue;
    lines.push(`- ${name}: ${tier.modelId}`);
  }
  return lines.join("\n");
}

function asBool(value: unknown): boolean {
  return value === true;
}

export default async function routingExtension(pi: ExtensionAPI): Promise<void> {
  try {
    const settings = readPiSettings();
    const routingOn = extensionEnabled(settings, "routing");
    if (!routingOn) return;
    attachTelemetry(pi as unknown as Parameters<typeof attachTelemetry>[0], "routing");
    const routingBlock = settingsBlock(settings, "routing");
    const tiers = stringMap(routingBlock["tiers"]);
    const stateBudget = numberOr(routingBlock["stateBudgetTokens"], 4000);
    const uncertain = uncertaintyDefaults(routingBlock["defaultOnUncertain"]);
    let decidedPrompt = "";
    let plan: RoutingPlan | null = null;
    let lastCwd = process.cwd();
    const thinkingLevels = (settings["modelThinkingLevels"] ?? {}) as Record<string, unknown>;
    const keyEnv = typeof routingBlock["decisionApiKeyEnv"] === "string" && routingBlock["decisionApiKeyEnv"]
      ? routingBlock["decisionApiKeyEnv"]
      : "OPENROUTER_API_KEY";
    const jevUrl = typeof routingBlock["decisionEndpoint"] === "string" ? routingBlock["decisionEndpoint"] : undefined;
    const jevModel = typeof routingBlock["decisionModel"] === "string" ? routingBlock["decisionModel"] : undefined;

    const resolvePlan = async (ctx: { modelRegistry: { getAll: () => { provider: string; id: string; name?: string }[]; refresh?: () => Promise<unknown> }; shutdown: () => void }): Promise<RoutingPlan> => {
      try {
        if (typeof ctx.modelRegistry.refresh === "function") await ctx.modelRegistry.refresh();
      } catch (err) {
        console.error("[routing] model registry refresh failed", err);
      }
      const catalog = ctx.modelRegistry.getAll().map((model) => ({ provider: model.provider, id: model.id, name: model.name }));
      const next = resolveRouting({
        tiers,
        catalog,
        routingEnabled: routingOn,
        defaultModel: typeof settings["defaultModel"] === "string" ? settings["defaultModel"] : undefined,
      });
      if (next.fatal) halt(ctx, next.refusals);
      for (const line of next.warnings) console.error(line);
      return next;
    };

    const trySelect = async (ctx: { modelRegistry: { find: (provider: string, id: string) => unknown } }, chosen: ResolvedTier): Promise<boolean> => {
      const model = ctx.modelRegistry.find(chosen.provider, chosen.id);
      if (!model) return false;
      try {
        return (await pi.setModel(model as never)) === true;
      } catch (err) {
        console.error("[routing] model switch failed", err);
        return false;
      }
    };

    const refuseUnselectable = (ctx: { shutdown?: () => void; model?: SessionModel }, tier: string, configured: string): never => {
      const session = sessionOf(ctx);
      const lines: string[] = [];
      const clash = sessionClash(configured, session);
      if (clash) lines.push(mismatchLine(tier, clash));
      lines.push(unselectableLine(tier, configured, session));
      halt(ctx, lines);
    };

    pi.on("session_start", async (_event, ctx) => {
      lastCwd = ctx.cwd;
      plan = await resolvePlan(ctx);
      if (!routingOn || !plan || plan.fatal) return;
      const seen = new Set<string>();
      for (const chosen of Object.values(plan.tiers)) {
        if (!chosen || seen.has(chosen.modelId)) continue;
        seen.add(chosen.modelId);
        if (await trySelect(ctx, chosen)) return;
      }
      if (seen.size === 0) return;
      const session = sessionOf(ctx);
      const lines: string[] = [];
      const reported = new Set<string>();
      for (const [tier, chosen] of Object.entries(plan.tiers)) {
        if (!chosen || reported.has(chosen.modelId)) continue;
        reported.add(chosen.modelId);
        const clash = sessionClash(chosen.modelId, session);
        if (clash) lines.push(mismatchLine(tier, clash));
        lines.push(unselectableLine(tier, chosen.modelId, session));
      }
      halt(ctx, lines);
    });

    pi.on("before_agent_start", async (event, ctx) => {
        if (explainOneShot()) return;
        lastCwd = ctx.cwd;
        if (!plan) plan = await resolvePlan(ctx);
        if (plan && !plan.fatal) {
          event.systemPromptOptions.sections.pi_build_tiers = formatTierSection(plan.tiers);
        }
        notePrompt(ctx.sessionManager.getSessionId(), event.prompt);
        if (event.prompt === decidedPrompt) return;
        decidedPrompt = event.prompt;
        const note = getOpenNote();
        const extra = decisionSupplements(findProjectRoot(ctx.cwd));
        const state = buildState({
          userPrompt: event.prompt,
          loopIndex: 0,
          elapsedMs: 0,
          tier: activeTierName(),
          tools: [],
          filesWritten: [],
          filesRead: extra.filesRead,
          indexRow: extra.indexRow,
          currentClaim: note?.currentClaim,
          lastToolResult: extra.lastToolResult,
        }, stateBudget);
        const apiKey = process.env[keyEnv] || process.env.OPENROUTER_API_KEY || "";
        const answers = await decide(state, tierSelectQuestions(), {
          defaults: uncertain,
          url: jevUrl,
          model: jevModel,
          apiKey,
        });
        const tier = selectTier({
          single_file_edit: asBool(answers.single_file_edit),
          needs_repo_reasoning: asBool(answers.needs_repo_reasoning),
          unfamiliar_stack: asBool(answers.unfamiliar_stack),
          spec_exists: asBool(answers.spec_exists),
          reversible: asBool(answers.reversible),
        });
        if (!plan) plan = await resolvePlan(ctx);
        if (plan.fatal) return;
        const chosen = plan.tiers[tier];
        if (!chosen) {
          console.error(`[routing] tier ${tier} resolves to nothing; leaving the session model`);
          return;
        }
        let selected = chosen;
        let usedFallback = false;
        let ok = await trySelect(ctx, chosen);
        if (!ok) {
          for (const candidate of fallbackChain(tier)) {
            if (candidate === tier) continue;
            const alt = plan.tiers[candidate];
            if (!alt || alt.modelId === chosen.modelId) continue;
            if (await trySelect(ctx, alt)) {
              selected = alt;
              usedFallback = true;
              ok = true;
              break;
            }
          }
        }
        if (!ok) refuseUnselectable(ctx, tier, chosen.modelId);
        if (usedFallback) {
          console.error(`[routing] tier ${tier} model ${chosen.configured} setModel refused; using ${selected.tier} ${selected.modelId}`);
        } else if (chosen.warning) {
          console.error(chosen.warning);
        }
        const level = thinkingLevelFor(selected.modelId, thinkingLevels);
        if (level) pi.setThinkingLevel(level as "low");
        else console.error(`[routing] no thinking level for ${selected.modelId}; leaving the current level`);
        setActiveTier(tier, selected.modelId);
        console.error(`[routing] tier=${tier} model=${selected.modelId}`);
    });
  } catch (err) {
    console.error("[routing] failed to load; other extensions continue", err);
  }
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
