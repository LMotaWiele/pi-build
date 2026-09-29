/**
 * Held-out grader for SPEC-context-500k.md §6.1, §6.2, and §6.3.
 * Written once against the stage 2 Sol replay. A later replay's edits
 * under tests/ are restored away before this file runs.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { BoundSnapshot } from "../../lib/telemetry.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const onReplayTree = fs.existsSync(path.join(root, "extensions/routing.ts"));
const replayOnly = onReplayTree ? false : "held-out suite grades the f44a938 replay";

const INDEX = `<!-- agent-memory-schema: 1 -->
# Notes index — read this first

## Notes

| Topic | File | Status | One-liner |
|---|---|---|---|
| Private topic | [secret.md](secret.md) | open | not injected |

## Active next

| # | Item | Source | Added |
|---|---|---|---|
| 1 | keep the claim | human | 2026-09-23 |

## Do not

- do not drop the criteria

## Glossary (optional)

| Name | Means |
|---|---|
| INTERNAL | not injected |
`;

function snap(over: Partial<BoundSnapshot> & { promptTokens?: number; costUsd?: number }): BoundSnapshot {
  return {
    sessionId: "s",
    turnId: "t",
    loopIndex: 1,
    elapsedMs: 0,
    consecutiveFailures: 0,
    reads: 0,
    edits: 0,
    promptTokens: 0,
    costUsd: 0,
    ...over,
  };
}

test("§6.1 a bound with written files re-dispatches the checkpoint before abort", { skip: replayOnly }, async () => {
  const { runBoundAbort } = await import("../../extensions/routing.ts");
  const events: string[] = [];
  await runBoundAbort({
    reason: "turn cost",
    written: ["src/a.ts"],
    resumeFrom: "src/b.ts",
    queueAppend: () => {},
    setRecap: () => {},
    redispatch: (prompt: string) => events.push(prompt),
    abort: () => events.push("abort"),
  });
  assert.match(events[0] ?? "", /src\/a\.ts/);
  assert.match(events[0] ?? "", /src\/b\.ts/);
  assert.equal(events.at(-1), "abort");

  const empty: string[] = [];
  await runBoundAbort({
    reason: "loop",
    written: [],
    resumeFrom: "(unknown)",
    queueAppend: () => empty.push("queue"),
    setRecap: () => empty.push("recap"),
    redispatch: () => empty.push("retry"),
    abort: () => empty.push("abort"),
  });
  assert.deepEqual(empty, ["abort"]);
});

test("§6.2 token and cost budgets remain backstops", { skip: replayOnly }, async () => {
  const { DEFAULT_BOUNDS, boundReason } = await import("../../lib/telemetry.ts");
  assert.ok(DEFAULT_BOUNDS.maxTurnPromptTokens > 0);
  assert.ok(DEFAULT_BOUNDS.maxTurnCostUsd > 0);
  const config = {
    ...DEFAULT_BOUNDS,
    maxTurnPromptTokens: 1000,
    maxTurnCostUsd: 1,
  };
  const overTokens = boundReason(snap({ promptTokens: 123456, costUsd: 0 }), config);
  assert.match(overTokens ?? "", /123456/);
  const overCost = boundReason(snap({ promptTokens: 0, costUsd: 7.25 }), config);
  assert.match(overCost ?? "", /7\.25/);
  assert.equal(boundReason(snap({ promptTokens: 0, costUsd: 0, loopIndex: 1 }), config), null);
});

test("§6.3 the injected index is the queue and the do-not block", { skip: replayOnly }, async () => {
  const { formatIndexInjection, parseIndex } = await import("../../lib/markdown.ts");
  const parsed = parseIndex(INDEX);
  const injection = formatIndexInjection(parsed, (text: string) => Math.ceil(text.length / 4));
  assert.match(injection.text, /keep the claim/);
  assert.match(injection.text, /do not drop the criteria/);
  assert.doesNotMatch(injection.text, /Private topic/);
  assert.doesNotMatch(injection.text, /INTERNAL/);
});
