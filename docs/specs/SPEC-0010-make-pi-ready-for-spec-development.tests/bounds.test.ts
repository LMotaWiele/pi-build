// The only per-turn bounds left are the budget backstops. Loop depth, wall
// clock, consecutive failures and no-progress reads are removed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { boundReason, DEFAULT_BOUNDS } from "../../../lib/telemetry.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const snap = (over: Record<string, number> = {}) => ({
  sessionId: "s", turnId: "t", loopIndex: 500, elapsedMs: 10 * 3600_000, consecutiveFailures: 12,
  reads: 40, edits: 0, promptTokens: 1000, costUsd: 0.5, ...over,
});

test("long, failing, read-heavy turns within budget are never bounded", () => {
  assert.equal(boundReason(snap() as any), null);
});

test("the budget backstops still fire", () => {
  assert.match(boundReason(snap({ promptTokens: DEFAULT_BOUNDS.maxTurnPromptTokens }) as any) ?? "", /prompt tokens/);
  assert.match(boundReason(snap({ costUsd: DEFAULT_BOUNDS.maxTurnCostUsd }) as any) ?? "", /cost/);
});

test("the removed bounds are gone from the defaults and from every host file", () => {
  const removed = ["maxLoopDepth", "maxTurnWallClockMs", "maxConsecutiveToolFailures", "noProgressReads"];
  for (const k of removed) assert.ok(!(k in DEFAULT_BOUNDS), `DEFAULT_BOUNDS.${k}`);
  for (const host of ["settings/hosts/machina.json", "settings/hosts/example.json"]) {
    const b = JSON.parse(readFileSync(resolve(ROOT, host), "utf8")).bounds ?? {};
    for (const k of removed) assert.ok(!(k in b), `${host} bounds.${k}`);
  }
});
