import test from "node:test";
import assert from "node:assert/strict";
import { familyOf, nextTier, retryAllowed } from "../../../lib/tiers.ts";

const TERRA = "openai-codex/gpt-5.6-terra";
const SOL = "openai-codex/gpt-5.6-sol";

test("model families are provider-independent but exact", () => {
  assert.equal(familyOf("openai-codex/gpt-5.6-luna"), "luna");
  assert.equal(familyOf("openai/gpt-5.6-terra"), "terra");
  assert.equal(familyOf("gpt-5.6-sol"), "sol");
  assert.equal(familyOf("openai-codex/gpt-5.6-luna-preview"), null);
  assert.equal(familyOf("smart-router/auto"), null);
});

test("Luna prefers subscription Terra and falls back only to subscription Sol", () => {
  const seen: string[] = [];
  const terra = nextTier("openai/gpt-5.6-luna", (id) => {
    seen.push(id);
    return true;
  });
  assert.deepEqual(terra, { model: TERRA, thinking: "medium" });
  assert.deepEqual(seen, [TERRA]);

  const fallbackSeen: string[] = [];
  const sol = nextTier("openai-codex/gpt-5.6-luna", (id) => {
    fallbackSeen.push(id);
    return id === SOL;
  });
  assert.deepEqual(sol, { model: SOL, thinking: "high" });
  assert.deepEqual(fallbackSeen, [TERRA, SOL]);
});

test("Terra advances to subscription Sol while Sol, unknown, and unresolved models stop", () => {
  assert.deepEqual(nextTier("openai/gpt-5.6-terra", (id) => id === SOL), {
    model: SOL,
    thinking: "high",
  });
  assert.equal(nextTier("openai-codex/gpt-5.6-sol", () => true), null);
  assert.equal(nextTier("smart-router/auto", () => true), null);
  assert.equal(nextTier("openai-codex/gpt-5.6-luna", () => false), null);
  assert.equal(nextTier("openai-codex/gpt-5.6-terra", () => false), null);
});

test("every selected target is a subscription model", () => {
  for (const running of [
    "openai-codex/gpt-5.6-luna",
    "openai/gpt-5.6-luna",
    "openai-codex/gpt-5.6-terra",
  ]) {
    const target = nextTier(running, () => true);
    if (target) assert.match(target.model, /^openai-codex\//);
  }
});

test("retry gate enforces the switch, hold, and one-retry limit", () => {
  const open = { env: {}, held: false, alreadyRetried: false };
  assert.equal(retryAllowed(open), true);
  assert.equal(retryAllowed({ ...open, env: { PI_BUILD_RETRY: "0" } }), false);
  assert.equal(retryAllowed({ ...open, env: { PI_BUILD_RETRY: "1" } }), true);
  assert.equal(retryAllowed({ ...open, held: true }), false);
  assert.equal(retryAllowed({ ...open, alreadyRetried: true }), false);
});
