# Host traps

**Status:** sealed
**Topic:** host
**Last updated:** 2026-09-26

## Current claim

The live host uses provider `openai-codex`. Codex login resolves `gpt-5.6-luna`, `gpt-5.6-terra`, and `gpt-5.6-sol`. The API provider has no key. Routing is off. Scout and explain are luna, work is terra, escalate is sol. Thinking is minimal, low, and high. The default model is terra. Cache warming is off. `defaultProjectTrust` is `always`. `agent/models.json` sets `contextWindow` 272000 and `promptCache` short and long of 1800, with no dollar overrides. The printed Sol card is 5 / 0.50 / 30. A Grok session cost is `costUsdTicks` divided by 1e10. `extensions/jev/` is `adapter.ts`, `questions.ts`, and `state-builder.ts`, with no `index.ts`, so it is not loaded. Both explore agent definitions list read, grep, find, ls, edit, and write. The host pins `pi-web-access` at v0.30.0, `pi-subagent` at `ce26a686f2571188d2e2b4d586e15a82606a7b72`, `pi-context-usage`, and `pi-smart-router` at 0.8.0.

## Ruled out / confounds

- The 2026-09-21 credentials line. Codex OAuth is the live login, and the API provider remains without a key.
- An escalate tier of `openai/gpt-5.6-terra`. The host file maps escalate to `openai-codex/gpt-5.6-sol`.
- A read-only explore. Both definitions include edit and write.
- The Sol promo card 4 / 0.40 / 20. The printed cost is the catalog card, and Sol has no dollar override.

## Evidence (pointers only)

- Host file: `settings/hosts/machina.json`.
- Model overrides: `agent/models.json`.
- Unloaded adapter: `extensions/jev/`.
- Tick divisor: `.agent/explain/2026-09-22-diagnosis.md`.

## Pre-committed criteria

| If | Then |
|---|---|
| The host file changes provider, tier ids, or the trust value | Supersede this note |
| A dollar override is added for Sol | Supersede this note and correct the printed-card claim |

## Do not

- Do not set `defaultProjectTrust` to `trusted`. The accepted values are `ask`, `always`, and `never`.
- Do not add a top-level key to `models.json` besides `providers`, and do not redeclare a built-in GPT-5.6 model.
- Do not install the kcosr extension list or the enhansome list. The `subagent` block in the host file is not read by the pinned package. `maxDepth` 2 is a CLI flag.
- Do not treat a dispatched child as able to select its own model. A child inherits the parent session model.
- Do not divide `costUsdTicks` by 1e9.

## Chronology

These corrections were queued on 2026-09-21 and 2026-09-22. They are sealed here so the queue can drop them.
