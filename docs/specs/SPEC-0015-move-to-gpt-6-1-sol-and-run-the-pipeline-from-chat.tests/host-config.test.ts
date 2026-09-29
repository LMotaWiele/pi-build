// The live configuration on GPT-6.1 Sol. Supersedes SPEC-0009's host-config test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const json = (rel: string) => JSON.parse(readFileSync(resolve(ROOT, rel), "utf8"));
const host = json("settings/hosts/machina.json");
const SOL = "openai-codex/gpt-6.1-sol";
const LUNA = "openai-codex/gpt-6-luna";
const ASTRA = "openai-codex/gpt-6-astra";

test("fresh sessions open on GPT-6.1 Sol: bare default id, in scope, and first", () => {
  assert.equal(host.defaultProvider, "openai-codex");
  assert.equal(host.defaultModel, "gpt-6.1-sol");
  assert.equal(host.enabledModels[0], SOL);
  assert.ok(host.enabledModels.includes(LUNA) && host.enabledModels.includes(ASTRA));
});

test("thinking levels and tiers name GPT-6.1 Sol", () => {
  assert.equal(host.modelThinkingLevels[SOL], "medium");
  assert.equal(host.modelThinkingLevels[LUNA], "medium");
  assert.equal(host.modelThinkingLevels[ASTRA], "high");
  assert.deepEqual(host.routing.tiers, { scout: LUNA, work: SOL, escalate: SOL, explain: LUNA });
});

test("the pipeline still plans and integrates at high and edits at medium", () => {
  assert.equal(host.pipeline?.plannerThinking, "high");
  assert.equal(host.pipeline?.editorThinking, "medium");
});

test("model overrides cover GPT-6.1 Sol, with no dollar overrides", () => {
  const codex = json("agent/models.json").providers["openai-codex"].modelOverrides;
  assert.equal(codex["gpt-6.1-sol"]?.contextWindow, 272000);
  assert.deepEqual(codex["gpt-6.1-sol"]?.promptCache, { short: 1800, long: 1800 });
  for (const [id, o] of Object.entries(codex)) assert.ok(!("cost" in (o as object)), id);
});
