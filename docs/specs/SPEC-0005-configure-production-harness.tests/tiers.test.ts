import { test } from "node:test";
import assert from "node:assert/strict";
import { familyOf, nextTier, retryAllowed, CODEX } from "../../lib/tiers.ts";

const all = () => true;
const noTerra = (id: string) => id !== CODEX.terra;
const none = () => false;

test("family is read from the model name, whatever the provider", () => {
  assert.equal(familyOf("openai-codex/gpt-5.6-luna"), "luna");
  assert.equal(familyOf("gpt-5.6-terra"), "terra");
  assert.equal(familyOf("openai/gpt-5.6-sol"), "sol");
  assert.equal(familyOf("smart-router/auto"), null);
});

test("luna retries on subscription terra at medium", () => {
  assert.deepEqual(nextTier("openai-codex/gpt-5.6-luna", all), { model: "openai-codex/gpt-5.6-terra", thinking: "medium" });
});

test("luna falls to subscription sol when subscription terra does not resolve", () => {
  assert.deepEqual(nextTier("openai-codex/gpt-5.6-luna", noTerra), { model: "openai-codex/gpt-5.6-sol", thinking: "high" });
});

test("terra retries on subscription sol at high", () => {
  assert.deepEqual(nextTier("openai-codex/gpt-5.6-terra", all), { model: "openai-codex/gpt-5.6-sol", thinking: "high" });
});

test("sol, unknown models, and unresolvable targets do not retry", () => {
  assert.equal(nextTier("openai-codex/gpt-5.6-sol", all), null);
  assert.equal(nextTier("smart-router/auto", all), null);
  assert.equal(nextTier("openai-codex/gpt-5.6-luna", none), null);
  assert.equal(nextTier("openai-codex/gpt-5.6-terra", none), null);
});

test("a retry never targets a per-token provider", () => {
  for (const m of ["openai-codex/gpt-5.6-luna", "openai-codex/gpt-5.6-terra", "openai/gpt-5.6-luna"]) {
    for (const r of [all, noTerra]) {
      const t = nextTier(m, r);
      if (t) assert.ok(t.model.startsWith("openai-codex/"), `${m} -> ${t.model}`);
    }
  }
});

test("retry is blocked by the switch, by a quota hold, and after one retry", () => {
  const base = { env: {}, held: false, alreadyRetried: false };
  assert.equal(retryAllowed(base), true);
  assert.equal(retryAllowed({ ...base, env: { PI_BUILD_RETRY: "0" } }), false);
  assert.equal(retryAllowed({ ...base, env: { PI_BUILD_RETRY: "1" } }), true);
  assert.equal(retryAllowed({ ...base, held: true }), false);
  assert.equal(retryAllowed({ ...base, alreadyRetried: true }), false);
});
