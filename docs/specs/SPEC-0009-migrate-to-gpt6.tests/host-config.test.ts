// The live configuration after migration: what fresh sessions, the retry,
// explain, and the pipeline will actually run on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const json = (rel: string) => JSON.parse(readFileSync(resolve(ROOT, rel), "utf8"));
const host = json("settings/hosts/machina.json");

const SOL = "openai-codex/gpt-6-sol";
const LUNA = "openai-codex/gpt-6-luna";
const ASTRA = "openai-codex/gpt-6-astra";

function allStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => allStrings(x, out));
  return out;
}

// Pi resolves the default with getModel(defaultProvider, defaultModel), an exact
// match on the bare id. A provider-prefixed defaultModel never resolves, and pi
// then falls back to enabledModels[0]. Both are set so either path gives Sol.
test("fresh sessions open on GPT-6 Sol: bare default id, in scope, and first", () => {
  assert.equal(host.defaultProvider, "openai-codex");
  assert.equal(host.defaultModel, "gpt-6-sol", "defaultModel is the bare id, without the provider prefix");
  assert.ok(!host.defaultModel.includes("/"), "a provider-prefixed defaultModel never resolves");
  assert.ok(host.enabledModels.includes(`${host.defaultProvider}/${host.defaultModel}`), "the default is in scope");
  assert.equal(host.enabledModels[0], SOL, "the fallback is also Sol");
  assert.ok(host.enabledModels.includes(LUNA));
  assert.ok(host.enabledModels.includes(ASTRA));
  assert.ok(!host.enabledModels.some((m: string) => m.includes("gpt-5.6")), "no GPT-5.6 model in the cycle list");
});

test("thinking levels: Sol and Luna at medium, Astra at high", () => {
  assert.equal(host.modelThinkingLevels[SOL], "medium");
  assert.equal(host.modelThinkingLevels[LUNA], "medium");
  assert.equal(host.modelThinkingLevels[ASTRA], "high");
});

test("routing tiers name GPT-6 ids", () => {
  assert.deepEqual(host.routing.tiers, { scout: LUNA, work: SOL, escalate: SOL, explain: LUNA });
});

test("the pipeline plans and integrates at high whatever the interactive level", () => {
  assert.equal(host.pipeline?.plannerThinking, "high");
  assert.equal(host.pipeline?.editorThinking, "medium");
});

test("GPT-5.6 Terra has no remaining role in the host configuration", () => {
  assert.ok(!allStrings(host).some((s) => s.endsWith("gpt-5.6-terra")));
});

test("the example host keeps the same invariant", () => {
  const ex = json("settings/hosts/example.json");
  if (typeof ex.defaultModel === "string" && ex.defaultModel) {
    assert.ok(!ex.defaultModel.includes("/"), "example defaultModel is a bare id");
    if (Array.isArray(ex.enabledModels) && ex.enabledModels.length && ex.defaultProvider) {
      assert.ok(ex.enabledModels.includes(`${ex.defaultProvider}/${ex.defaultModel}`));
    }
  }
});

test("the implement agent is pinned to GPT-6 Luna", () => {
  const md = readFileSync(resolve(ROOT, ".pi/agents/implement.md"), "utf8");
  const m = md.match(/^model:\s*(\S+)\s*$/m);
  assert.equal(m?.[1], LUNA);
});

test("model overrides cover the GPT-6 ids, with no dollar overrides", () => {
  const codex = json("agent/models.json").providers["openai-codex"].modelOverrides;
  for (const id of ["gpt-6-sol", "gpt-6-luna"]) {
    assert.equal(codex[id]?.contextWindow, 272000, id);
    assert.deepEqual(codex[id]?.promptCache, { short: 1800, long: 1800 }, id);
  }
  for (const [id, o] of Object.entries(codex)) assert.ok(!("cost" in (o as object)), `${id} carries a cost override`);
});
