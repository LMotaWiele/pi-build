# SPEC-0001 run record

Reports moved here from `.agent/explain/` on 2026-09-29, verbatim.

## Moved from `.agent/explain/2026-09-22-ab-results.md`

# Delegation measurement — 2026-09-22

The numbers below are copied from the local telemetry databases. Those files stay where the runs wrote them. This file is the record.

| Run | Database | Commit | What it is |
|---|---|---|---|
| Void pair before §4.0 | void-pair telemetry database | `bd51f93` | Two trials, both void. See SPEC §4.3a. |
| Six at `9d81e6b` | six-trial telemetry database | `9d81e6b` | Full set. Rule 0: `VOID`. |
| Re-run, stopped | stopped re-run telemetry database | `f8edcd2` | Two trials. Not a set of six. Not scored. |
| Six at `78ce7cb` | thirty-minute telemetry database | `78ce7cb` | Full set. Rule 0: `VOID`. |
| Six at `4384c58` | peak-rule telemetry database | `4384c58` | Full set. Peak rule: `VOID`. |

The database directories are listed in `docs/README.md`. This file does not repeat them: the notes check rejects the repository name under `.agent/`.

Catalog dollars are the §1.2 card (codex Sol 5 / 0.50 / 30). They are not the Grok tripwire. Pi rows are the measurement.

## Six at 9d81e6b

Arm B has 0 non-void trials. Rule 0 matches. Rules 1–6 do not run.

Each arm B child was `explore`. `implement` was installed and was not named. Children hit `no progress: 6 reads and 0 edits`. The parent then edited the fixture. Parent and child were both `gpt-5.6-sol`.

| Trial | Arm | Completed | Bound | Prompt tokens | Cache share | Cost | Peak parent | Wall | Idle gap |
|---|---|---|---|---|---|---|---|---|---|
| 1 | A | yes | — | 145802 | 0.8551 | 0.242506 | 19991 | 403.486 | — |
| 2 | B | void | — | 236547 | 0.6304 | 0.739925 | 15166 | 500.672 | 1.041 |
| 3 | A | yes | — | 158841 | 0.7664 | 0.326259 | 20077 | 411.887 | 1.060 |
| 4 | B | void | — | 241799 | 0.6580 | 0.701437 | 16818 | 499.713 | 1.042 |
| 5 | A | no | no progress: 6 reads and 0 edits | 16385 | 0.4375 | 0.061489 | 9086 | 142.475 | 1.043 |
| 6 | B | void | — | 169329 | 0.7106 | 0.520395 | 16102 | 516.602 | 1.045 |

Trials 1 and 3 each edited all six fixture files. Trial 5 is a real miss, not a void: the bound is no-progress, not three consecutive tool failures.

Same-arm spacing was inside the 1800s cache TTL: about 502s and 501s before arm A's later trials, and about 404s, 413s, and 144s before arm B's. Arm A's two finished runs show a higher cache-read share than arm B. That column was not used to change the order or the rules.

## Re-run at f8edcd2, stopped after trial 2

The arm B prompt named `implement` and told the parent not to read, edit, or write the fixture files. The runner stopped because it marked trial 2 void. That mark does not hold.

| Trial | Arm | What the runner recorded | What the rows show |
|---|---|---|---|
| 1 | A | completed, 403.754s, 12 calls | Parent edited all six fixture files. |
| 2 | B | void: 0 child edits; parent wrote a fixture file. Bound `wall clock 645510ms >= 600000ms`. | The outer session dispatched `implement`, then hit the wall clock. It did not edit. A nested `pi` the parent started from bash did dispatch `implement`, and those children edited all six fixture files. Their `parent_turn_id` is `16157b26-f216-4ee9-aa9b-197807c24c98`, not the outer turn `30c6db7f-4f6b-461a-ae53-f46be07f114b`. The runner only joined the outer id, so it counted 0 child edits. The parent-wrote flag came from bash commands whose text contains `tests/fixtures/ab/`, including `find`. |

This is not a completed set of six. Rule 0 is not applied to it. The join has to follow a nested session before another six would be interpretable.

## Not decided

§6.A and §6.B were not applied to the sets above. INDEX row 12 stays open: child cache on a real delegated edit was not measured on an attributable turn.

## Six at 78ce7cb

Shared head `78ce7cb`. Turn budget 1800000 ms on both arms. Every inference row is `escalate` / `gpt-5.6-sol`. No orphan rows, and every turn resolves to its trial. Catalog total $2.99 across 125 inference calls. That is the measurement ledger.

| Trial | Arm | Completed | Void | Bound | Prompt tokens | Cache share | Completion | Cost | Peak parent | Wall | Idle gap |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | A | yes | — | — | 103511 | 0.7593 | 2321 | 0.233521 | 16679 | 399.316 | — |
| 2 | B | no | 0 child edits | no progress: 6 reads and 0 edits | 223605 | 0.7339 | 11605 | 0.727743 | 20659 | 494.499 | 1.067 |
| 3 | A | yes | — | — | 123664 | 0.7763 | 1868 | 0.242360 | 13439 | 391.611 | 1.066 |
| 4 | B | no | 0 child edits | no progress: 6 reads and 0 edits | 308594 | 0.7151 | 9084 | 0.822466 | 18296 | 413.060 | 1.042 |
| 5 | A | yes | — | — | 229684 | 0.9045 | 2752 | 0.296132 | 19878 | 427.775 | 1.053 |
| 6 | B | no | 0 child edits; parent wrote a fixture file | no progress: 6 reads and 0 edits | 224671 | 0.7047 | 6711 | 0.665933 | 16809 | 489.718 | 1.042 |

Voids, kept out of the tallies and out of the medians:

- Trials 2, 4, and 6 each dispatched `explore`. That definition has `read`, `grep`, `find`, and `ls`. The children recorded no `edit` or `write`. Several of them stopped on `no progress: 6 reads and 0 edits` inside about 30s. `implement` was installed, has `edit` and `write`, and was not named in the prompt. The §4.0 check passed before the set; the agent that ran was still the read-only one.
- Trial 6's parent then edited the fixture itself. The successful `edit` paths are `src/types.ts`, `src/parse.ts`, `src/format.ts`, `src/store.ts`, `src/report.test.ts`, and `src/validate.ts`. Trials 2 and 4's parents did not.
- Trial 4's dispatch text asked for `gpt-5.6-terra` and `gpt-5.6-luna`. Every inference row for that trial is still `gpt-5.6-sol`.

Arm A, three non-void trials. Median is the middle value.

| Metric | Values | Median | Range |
|---|---|---|---|
| Prompt tokens | 103511, 123664, 229684 | 123664 | 103511–229684 |
| Cache share | 0.7593, 0.7763, 0.9045 | 0.7763 | 0.7593–0.9045 |
| Completion tokens | 2321, 1868, 2752 | 2321 | 1868–2752 |
| Cost | 0.233521, 0.242360, 0.296132 | 0.242360 | 0.233521–0.296132 |
| Wall | 399.316, 391.611, 427.775 | 399.316 | 391.611–427.775 |
| Peak parent | 16679, 13439, 19878 | 16679 | 13439–19878 |

Arm A median peak 16679 / 272000 = 6.1% of the window. Arm B has no non-void trials, so it has no median.

Rule 0: arm A has 3 non-void trials, arm B has 0. The verdict is `VOID`. Rules 1–6 do not run. §6.A and §6.B were not applied.

Same-arm spacing, read against cache share and not used to change the order: about 497s and 415s before arm A's later trials, and about 394s and 430s before arm B's. All of those sit inside the 1800s cache TTL. The recorded idle gap between consecutive runs is about 1s. Arm A's cache share rose to 0.9045 on trial 5; arm B's fell from 0.7339 to 0.7047.

The 600s finding stands from the earlier measurement, where arm B reached 645s once children edited. In this set the children did no work, and arm B's walls were 494s, 413s, and 490s, under both the old bound and the 1800000 ms bound.

A repeat of this prompt would dispatch the same read-only child. The set is not re-run until the child that is actually dispatched can write.

## Six at 4384c58

Shared head `4384c58`. Turn budget 1800000 ms on both arms. No orphan rows. 108 inference calls, catalog $1.91. That is the measurement ledger.

Every trial completed. No trial row is void: the gate passed, no bound fired, and each arm B trial recorded 6 child edits. The set is void because the median parent peaks differ by 13%, under the 20% peak rule. Those rows stay out of the §6 completion tallies.

| Trial | Arm | Completed | Void | Bound | Prompt tokens | Cache share | Completion | Cost | Peak parent | Wall | Idle gap |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | A | yes | — | — | 115704 | 0.6925 | 2503 | 0.293034 | 13058 | 153.354 | — |
| 2 | B | yes | — | — | 160574 | 0.6688 | 3590 | 0.395065 | 11239 | 152.608 | 1.081 |
| 3 | A | yes | — | — | 83912 | 0.7337 | 2163 | 0.207394 | 13642 | 127.652 | 1.081 |
| 4 | B | yes | — | — | 138989 | 0.6262 | 3281 | 0.349083 | 11867 | 142.586 | 1.065 |
| 5 | A | yes | — | — | 127083 | 0.8944 | 2457 | 0.227717 | 18224 | 123.213 | 1.069 |
| 6 | B | yes | — | — | 166888 | 0.6481 | 3559 | 0.434104 | 12415 | 156.105 | 1.045 |

Set void, kept out of the tallies:

- Arm A median peak is 13642. That is 13642 / 272000 = 5.0% of the window. Arm B median peak is 11867. The absolute difference is 13.0% of arm A's median. The peak rule voids the set.
- The arm B prompt dispatched implement on all three trials. Each trial ran six children. Each child edited one fixture file. The parent recorded no edit or write under the fixture. The prompt is not the defect. A parent holding about 5% of the window cannot drop 20% by handing files to children. This prompt is not re-run on this fixture to chase that gap.
- Rules 1–6 do not run. §6.A and §6.B were not applied.

The parent was gpt-5.6-sol on every trial. Of 18 child turns, 12 were gpt-5.6-sol at escalate and 6 were gpt-5.6-terra at work. Two children in each arm B trial stayed on the work tier. A child model differed from the parent, so a token comparison would have replaced dollars in rules 4 and 5. Those rules were not applied.

Child cache, on turns that edited a fixture file and are tied to the trial root. One Sol child in trial 2: the first two calls cached nothing, at 3841 and 3985 prompt tokens; the third read 3712 cached tokens against 410 prompt tokens; the fourth read 3968 against 306. One Terra child in trial 2: each of three calls read 3584 cached tokens, with prompt tokens 247, 435, and 605. INDEX row 12 is closed on that measurement.

The read-only user agent was held aside for the set, so a live session could not dispatch it. It is restored afterward.

Same-arm spacing sat inside the 1800s cache TTL: about 154s and 144s before arm A's later trials, and about 129s and 124s before arm B's. The recorded idle gap between consecutive runs is about 1s. Arm A's cache share rose from 0.6925 to 0.8944. Arm B stayed between 0.6262 and 0.6688. That column was not used to change the order.

The earlier 645s wall was a writing child whose walkthrough sat until its timeout. In this set every trial finished between 123s and 156s, inside both the 600s default and the 1800000 ms host bound.

## Moved from `.agent/explain/2026-09-22-diagnosis.md`

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
