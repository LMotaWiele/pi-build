// GPT-6.1 Sol joins the ladder; any Sol version is still a Sol, so escalation never silently turns off.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CODEX, familyOf, nextTier } from "../../../lib/tiers.ts";

const all = () => true;

test("the ladder's Sol is GPT-6.1 Sol, falling back to GPT-6 Sol, then GPT-5.6 Sol", () => {
  assert.equal(CODEX.sol, "openai-codex/gpt-6.1-sol");
  assert.equal(CODEX.solFallback, "openai-codex/gpt-6-sol");
  assert.equal((CODEX as any).solLegacy, "openai-codex/gpt-5.6-sol");
  assert.equal(CODEX.luna, "openai-codex/gpt-6-luna");
});

test("the family is read from any version number, so a new release cannot switch escalation off", () => {
  assert.equal(familyOf("openai-codex/gpt-6.1-sol"), "sol");
  assert.equal(familyOf("gpt-6.2-luna"), "luna");
  assert.equal(familyOf("openai-codex/gpt-6-sol"), "sol");
  assert.equal(familyOf("openai-codex/gpt-5.6-terra"), "terra");
  assert.equal(familyOf("smart-router/auto"), null);
});

test("Luna escalates to GPT-6.1 Sol at medium; Sol below high to GPT-6.1 Sol at high; Sol at high stops", () => {
  assert.deepEqual(nextTier(CODEX.luna, "medium", all), { model: CODEX.sol, thinking: "medium" });
  assert.deepEqual(nextTier(CODEX.sol, "medium", all), { model: CODEX.sol, thinking: "high" });
  assert.deepEqual(nextTier("openai-codex/gpt-6-sol", "medium", all), { model: CODEX.sol, thinking: "high" });
  assert.equal(nextTier(CODEX.sol, "high", all), null);
});

test("when a Sol does not resolve, the next one down the chain is used; with none, no retry", () => {
  const no61 = (id: string) => id !== CODEX.sol;
  const noSol = (id: string) => !id.endsWith("-sol") || id === (CODEX as any).solLegacy;
  assert.deepEqual(nextTier(CODEX.luna, "medium", no61), { model: CODEX.solFallback, thinking: "high" });
  assert.deepEqual(nextTier(CODEX.luna, "medium", noSol), { model: (CODEX as any).solLegacy, thinking: "high" });
  assert.equal(nextTier(CODEX.luna, "medium", () => false), null);
});
