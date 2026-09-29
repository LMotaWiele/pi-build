// The seam between pi and the harness validator on defaultModel.
// Pi reads defaultModel as a bare id under defaultProvider. The harness
// validator (resolveRouting) resolves "provider/id". defaultModelRef composes
// the two so both sides accept the same host file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultModelRef, resolveRouting } from "../../../lib/models.ts";

const catalog = [
  { provider: "openai-codex", id: "gpt-6-sol", name: "GPT-6 Sol" },
  { provider: "openai", id: "gpt-6-sol", name: "GPT-6 Sol" },
  { provider: "openai-codex", id: "gpt-6-luna", name: "GPT-6 Luna" },
];

test("defaultModelRef composes a bare id with its provider", () => {
  assert.equal(defaultModelRef({ defaultProvider: "openai-codex", defaultModel: "gpt-6-sol" }), "openai-codex/gpt-6-sol");
});

test("defaultModelRef passes a prefixed id through, and a bare id without a provider as is", () => {
  assert.equal(defaultModelRef({ defaultProvider: "openai-codex", defaultModel: "openai-codex/gpt-6-sol" }), "openai-codex/gpt-6-sol");
  assert.equal(defaultModelRef({ defaultModel: "gpt-6-sol" }), "gpt-6-sol");
});

test("defaultModelRef is undefined when there is no default model", () => {
  assert.equal(defaultModelRef({}), undefined);
  assert.equal(defaultModelRef({ defaultProvider: "openai-codex", defaultModel: "" }), undefined);
  assert.equal(defaultModelRef({ defaultModel: 7 as unknown as string }), undefined);
});

test("the validator accepts a bare default once composed", () => {
  const plan = resolveRouting({
    tiers: {
      scout: "openai-codex/gpt-6-luna",
      work: "openai-codex/gpt-6-sol",
      escalate: "openai-codex/gpt-6-sol",
      explain: "openai-codex/gpt-6-luna",
    },
    catalog,
    routingEnabled: true,
    defaultModel: defaultModelRef({ defaultProvider: "openai-codex", defaultModel: "gpt-6-sol" }),
  });
  assert.equal(plan.fatal, false, plan.refusals.join("; "));
});

test("the validator still refuses a raw bare id, which is why callers compose it", () => {
  const plan = resolveRouting({ tiers: {}, catalog, routingEnabled: true, defaultModel: "gpt-6-sol" });
  assert.equal(plan.fatal, true);
});
