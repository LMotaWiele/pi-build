import { test } from "node:test";
import assert from "node:assert/strict";
import { familyOf, nextTier, retryAllowed, CODEX } from "../../../lib/tiers.ts";

const all = () => true;
const noSol6 = (id: string) => id !== CODEX.sol;
const none = () => false;

test("family is read from GPT-5.6 and GPT-6 ids, whatever the provider", () => {
  assert.equal(familyOf("openai-codex/gpt-6-luna"), "luna");
  assert.equal(familyOf("openai-codex/gpt-6-sol"), "sol");
  assert.equal(familyOf("openai-codex/gpt-6-astra"), "astra");
  assert.equal(familyOf("openai-codex/gpt-5.6-terra"), "terra");
  assert.equal(familyOf("gpt-5.6-luna"), "luna");
  assert.equal(familyOf("smart-router/auto"), null);
});

test("luna retries on GPT-6 Sol at medium", () => {
  assert.deepEqual(nextTier(CODEX.luna, "medium", all), { model: CODEX.sol, thinking: "medium" });
  assert.deepEqual(nextTier("openai-codex/gpt-5.6-luna", "low", all), { model: CODEX.sol, thinking: "medium" });
});

test("sol below high retries on GPT-6 Sol at high; sol at high or above does not retry", () => {
  assert.deepEqual(nextTier(CODEX.sol, "medium", all), { model: CODEX.sol, thinking: "high" });
  assert.deepEqual(nextTier(CODEX.sol, undefined, all), { model: CODEX.sol, thinking: "high" });
  for (const t of ["high", "xhigh", "max"]) assert.equal(nextTier(CODEX.sol, t, all), null, t);
});

test("a resumed GPT-5.6 Terra session retries on GPT-6 Sol at high", () => {
  assert.deepEqual(nextTier("openai-codex/gpt-5.6-terra", "low", all), { model: CODEX.sol, thinking: "high" });
});

test("astra and unknown models do not retry", () => {
  assert.equal(nextTier(CODEX.astra, "high", all), null);
  assert.equal(nextTier("smart-router/auto", "medium", all), null);
});

test("when GPT-6 Sol does not resolve, the fallback is GPT-5.6 Sol at high; with nothing resolving, no retry", () => {
  assert.deepEqual(nextTier(CODEX.luna, "medium", noSol6), { model: CODEX.solFallback, thinking: "high" });
  assert.deepEqual(nextTier(CODEX.sol, "medium", noSol6), { model: CODEX.solFallback, thinking: "high" });
  assert.equal(nextTier(CODEX.luna, "medium", none), null);
});

test("a retry never targets a per-token provider", () => {
  const models = [CODEX.luna, CODEX.sol, "openai-codex/gpt-5.6-terra", "openai/gpt-6-luna", "openai/gpt-5.6-sol"];
  for (const m of models) for (const t of ["low", "medium", undefined]) for (const r of [all, noSol6]) {
    const target = nextTier(m, t, r);
    if (target) assert.ok(target.model.startsWith("openai-codex/"), `${m} -> ${target.model}`);
  }
});

test("retry is blocked by the switch, by a quota hold, and after one retry", () => {
  const base = { env: {}, held: false, alreadyRetried: false };
  assert.equal(retryAllowed(base), true);
  assert.equal(retryAllowed({ ...base, env: { PI_BUILD_RETRY: "0" } }), false);
  assert.equal(retryAllowed({ ...base, held: true }), false);
  assert.equal(retryAllowed({ ...base, alreadyRetried: true }), false);
});
