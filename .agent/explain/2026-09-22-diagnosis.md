# Diagnosis — 2026-09-22

Mechanical record for SPEC-delegation-ab §1. Commands were run. Output below is transcribed, not inferred from `extensions/`.

## §1.1 Why the turn escalated to Sol

**Supported hypothesis: an uncommitted working-tree edit.**

Checked on this machine before any config edit in this run:

- The agent settings file is a symlink to `settings/hosts/machina.json` in this repository.
- `install.sh` created that symlink. It was not replaced.
- `git show 26a3137:settings/hosts/machina.json` maps `routing.tiers.escalate` to `openai/gpt-5.6-terra`. `work` and `defaultModel` in that commit are `openai/gpt-5.6-terra`.
- The working copy maps `defaultProvider` to `openai-codex`, `defaultModel` and `work` to `openai-codex/gpt-5.6-terra`, and `escalate` to `openai-codex/gpt-5.6-sol`.

`"Reply with the single word OK"` is neither a single-file edit nor a spec, so `selectTier` returns `escalate`. `setModel` then uses the id in the file pi actually loaded, which is the working copy. The fallback chain escalate → work → scout cannot produce Sol from the committed file. The printed model id matches the loaded mapping.

Two consequences, applied after this note was written:

1. Commit the retarget in `settings/hosts/machina.json`. Reconcile INDEX so row 16 does not still describe the temporary Terra mapping, and supersede row 13 in place. Row 20 already records the Sol retarget.
2. Pi reads the working tree. §4 trials require a clean `settings/hosts/machina.json`, `agent/models.json`, and `agent/AGENTS.md`.

## §1.2 What `usage.cost.total` means

The spec's two commands were run with `PI_BUILD_TELEMETRY_DB=/tmp/pi-card-probe.db`.

### Command 1 — `--model openai/gpt-5.6-terra`

```
[state-builder] tokens=50 budget=4000 dropped=none
[routing] tier=escalate model=openai-codex/gpt-5.6-sol
[cost] tier=escalate calls=1 prompt=170 cache=5044.7% completion=5 reasoning=0.0% turn=$0.0053 session=$0.0053
OK
```

Exit 0. Routing replaced the requested model before inference. This call did not reach `openai/gpt-5.6-terra`.

`inference_calls` row: model `gpt-5.6-sol`, prompt_tokens 170, cached_tokens 8576, completion_tokens 5, cost_usd 0.005288.

Pi's cost line treats `prompt_tokens` as the uncached input and `cached_tokens` as cache reads (cache reads exceed prompt tokens, so prompt tokens are not a total). Hand arithmetic on the openai-codex Sol card 5 / 0.50 / 30:

`170 × 5/1e6 + 8576 × 0.50/1e6 + 5 × 30/1e6 = 0.005288`

Exact match. The promo card 4 / 0.40 / 20 yields 0.004210, which is not the stored figure.

### Command 2 — `--model openai-codex/gpt-5.6-sol`

```
[state-builder] tokens=50 budget=4000 dropped=none
[routing] tier=escalate model=openai-codex/gpt-5.6-sol
[cost] tier=escalate calls=1 prompt=8746 cache=0.0% completion=5 reasoning=0.0% turn=$0.0439 session=$0.0439
OK
```

`inference_calls` row: model `gpt-5.6-sol`, prompt_tokens 8746, cached_tokens 0, completion_tokens 5, cost_usd 0.04388.

`8746 × 5/1e6 + 5 × 30/1e6 = 0.04388`

Exact match to 5 / 0.50 / 30. Promo 4 / 0.40 / 20 would be 0.035084.

### Card finding for `openai-codex/gpt-5.6-sol`

The printed cost is a catalog estimate at the built-in openai-codex list card **5 / 0.50 / 30** (input / cache read / output, USD per 1M tokens). It is not the promo card 4 / 0.40 / 20. It is not a charge reported by the subscription endpoint: the figure lands on the catalog formula to the sixth decimal. §5 keeps `total_cost_usd`. Rules 4 and 5 stay on dollars and tokens.

The two commands specified in §1.2 both executed as Sol, because `before_agent_start` calls `setModel` after `--model`. A follow-up with `routing.enabled` false, so `--model` stuck, priced each live tier on its own call. `PI_BUILD_SETTINGS` pointed at a copy of the host file. The repository settings were not edited for the probe.

### Follow-up — `--model openai-codex/gpt-5.6-terra` (routing off)

```
[cost] tier=unassigned calls=1 prompt=8746 cache=0.0% completion=5 reasoning=0.0% turn=$0.0176 session=$0.0176
OK
```

Row: model `gpt-5.6-terra`, prompt_tokens 8746, cached_tokens 0, completion_tokens 5, cost_usd 0.017552.

`8746 × 2/1e6 + 5 × 12/1e6 = 0.017552`

Exact match to the openai-codex Terra input and output rates (2 and 12 per 1M). Cache read was 0, so the 0.20 cache-read rate was not separately exercised. This is the work tier the host file actually runs.

### Follow-up — `--model openai/gpt-5.6-terra` (routing off)

```
[cost] tier=unassigned calls=1 prompt=3 cache=0.0% completion=5 reasoning=0.0% turn=$0.0219 session=$0.0219
OK
```

Row: model `openai/gpt-5.6-terra`, prompt_tokens 3, cached_tokens 0, completion_tokens 5, cost_usd 0.0219235.

`3 × 2/1e6 + 5 × 12/1e6 = 0.000066`, which is not the stored cost. The recorded token fields do not identify a card. The live tiers do not use the `openai/` provider. §5 dollars are the openai-codex catalog figures above.

## §1.3 Tick divisor

`~/.grok/sessions/%2Fhome%2Fgeorge-contis%2FDocuments%2Fpi_build/01a0c53d-cff1-7ce3-9b56-29cea48cd135/usage.json` is on disk.

Turns 1–7 sum to `costUsdTicks` **325,012,927,600**.

`325,012,927,600 / 1e10 = 32.50129276` ≈ $32.50.

`325,012,927,600 / 1e9 = 325.01`, which is the 10× misread.

Turn totals in that file, divided by 1e10: turn 1 $14.7758 (184 calls), turn 2 $3.5967 (51), turn 3 $12.1639 (127), turns 4–7 $1.9650 (36). That is the corrected reference. The "$13.02 session" cited from a 1e9 divisor is $1.30 under 1e10 (`13,017,950,600 / 1e10`). §2.0 writes that correction into INDEX row 3.
