# SPEC — harness setup, measured on the real workload

**Place at `docs/SPEC-harness-setup.md`.**

**Status:** open
**Executor:** Grok Build
**Written:** 2026-09-23
**Supersedes:** `SPEC-context-500k.md` and `SPEC-extension-coordination.md`. Both are kept for their history and are not executed. `SPEC-delegation-ab.md` §1–§3 remain committed; its §4–§6 stay withdrawn.

---

## 0. What this spec does

It builds the harness you will actually use, one change at a time, and measures each change on the same real workload. It does not compare architectures on a fixture.

### 0.1 Facts carried in

Everything below rests on these. Do not re-derive them.

| Fact | Source |
|---|---|
| Tool results are **67.6%** of peak context. Reasoning 19.7%, tool calls 8.6%, system prompt and tool definitions 4.0%. | `.agent/explain/2026-09-22-context-baseline.md` |
| Within-turn reasoning is 91% encrypted and must return to the provider verbatim. Zero prior-turn reasoning reaches the request. **Reasoning is not addressable by any extension.** | same |
| Cache share on the baseline turn was **0.978**. Cached reads were 71% of provider cost. | same |
| The baseline turn stopped at `max loop depth 60` after 1,235s, at 73.8% of the window, with **zero compactions**. Real work runs out of rounds before it runs out of context. | same |
| Stored provider cost matches the promo card **4 / 0.40 / 20**. The catalog cost line overstates by ~28%. **Report provider cost.** | same |
| `memory-gate.ts` and `recap.ts` both write `sections.pi_build_memory` in `before_agent_start`. Recap's value is the superset and must win. Load order decides, and is not declared. | source |
| The parent dispatched `explore` twice during ordinary work. Both children returned nothing. | baseline |
| An unpinned `implement` child runs `selectTier` on its own prompt. | 4384c58 set |
| The Grok-reported "~75% reasoning" is reasoning's share of **output**, not of context. Reasoning is 0.6% of all Grok tokens. | Grok ledger, 2026-09-23 |

### 0.2 The pruning break-even

A context rewrite sends everything after the rewrite point uncached once, at (uncached − cached) / cached = **9x** its cached cost. That ratio is the same on Sol and Terra and on list and promo cards. Each call afterwards saves one cached read of what was removed. A prune removing R tokens, with T tokens after the rewrite point and N calls remaining, pays back only when:

**R × N > 9 × T**

Prune large and rare, or not at all.

### 0.3 Executor, budget, rules

Grok Build edits this repository and runs `pi` as a subprocess. `telemetry.db` rows are the measurement and never count against Grok's tripwire: **$25 or 250 Grok calls for the whole run.** Commit after each stage and continue. Two things stop the run: the tripwire, and a §12 row that says stop.

**Do not** install two extensions in one stage. **Do not** run two routers. **Do not** vendor an upstream extension into `extensions/`. **Do not** tune an extension after seeing its result on the benchmark and then keep that result — re-run it.

### 0.4 The benchmark

One real spec, replayed headless on a throwaway copy of the repository at each stage, from the same starting tree. Use the baseline's own workload — the prompt that asked for §6.1, §6.2 and §6.3 of the context spec — so stage 0 is the existing baseline and is not re-run.

Every stage reports, against **both** the previous stage and stage 0:

| Metric | Note |
|---|---|
| Rounds, completed, bound that fired | |
| Total prompt tokens, cached tokens, `cache_read_share` | |
| Provider cost | Not catalog. |
| **Cost per round and prompt tokens per round** | Stage 2 changes how long the turn runs. Totals stop being comparable from that point; per-round figures stay comparable. |
| Peak context, compactions | |
| Prefix invalidation points per turn | From §1's hook trace. |
| Test result on the copy: passed / failed / skipped | The quality signal. Baseline: 49 / 0 / 1. A cheaper stage that fails more tests is reverted. |
| Tool errors, longest consecutive run | Baseline: 7, longest run 2. |

**Re-baseline after §2.** Changing the bounds changes the length and shape of the turn, so §2's result becomes the reference that §4 onward measure against. Also check whether 0.978 cache share holds — it may be this turn's shape rather than pi's steady state.

---

## 1. Instrument — no model calls

### 1.1 Hook trace

Add a `hook_touches` table to `lib/telemetry.ts`: `session_id`, `turn_id`, `event`, `extension`, `seq`, `key_or_tool`, `bytes_before`, `bytes_after`, one row per extension per event. `attachTelemetry` already runs inside each of your extensions and can name them; record third-party touches as `unknown:<seq>` and attribute by elimination.

Add `scripts/report-hooks.sql` returning per-event order and per-turn invalidation points.

### 1.2 Fix the collision you already have

Give recap ownership of `pi_build_memory`: memory-gate skips the key when recap is enabled. Add a test that loads both in each order and asserts the assembled prompt contains the current claim and the pre-committed criteria.

This is the pattern for every later collision: declare an owner for the key, do not rely on order.

---

## 2. Bounds — split out, then fix

**The most urgent stage.** The baseline turn died at round 60 mid-spec.

### 2.1 Split `routing.ts`

Move the bounds, `fireBound`, and the §3.1 checkpoint into `extensions/bounds.ts`. Leave tier selection and `jev/` in `routing.ts`. After the split, disabling routing must leave the bounds running; add a test for exactly that.

Nothing else in this spec can be decided cleanly until this lands, because §4 may replace tier selection and the bounds must survive that.

### 2.2 Retry on bound

When `fireBound` trips with `writtenFiles().length > 0`, re-dispatch the turn at `escalate` with the checkpoint row as the prompt. One retry per original prompt. The checkpoint already exists; this uses it.

### 2.3 Budget-shaped bounds

Add `maxTurnPromptTokens` and `maxTurnCostUsd` to `BoundConfig`, checked in `boundReason` from the turn usage already in the telemetry bag. Use provider cost. Keep `maxLoopDepth` 60 as a backstop, not the primary control.

Set the budgets from the benchmark: the baseline turn was 9.27M prompt tokens and $5.08 provider over 60 rounds. Pick values that would have let it finish its three sections, and record the reasoning in INDEX.

### 2.4 Measure, then re-baseline

Run the benchmark. The expected change is that it completes instead of stopping at round 60. That result becomes the reference for §4 onward.

---

## 3. Housekeeping — cheap, no measurement needed

- **3.1** Move `.pi/agents/explore.md` aside permanently, or give it `edit` and `write`. A read-only child in a coding harness costs a dispatch and returns nothing.
- **3.2** Cap the injected INDEX to `## Active next` and `## Do not`. The baseline logged the injection truncating at 650 tokens; record the before and after.
- **3.3** Add the INDEX row for the bash escape: a parent can start a nested `pi` from `bash` and escape every bound. Not fixed here — §9 fixes it if delegation is built.

---

## 4. Router — replace or keep tier selection

`routing.ts` after §2 is only tier selection. This stage decides whether it survives.

### 4.1 Candidates

- **Loosened `selectTier`.** `spec_exists && reversible` → `work`, `needs_repo_reasoning` still escalating. One function change. Puts most multi-file specs on Terra at 2 / 0.20 / 12 instead of Sol at 5 / 0.50 / 30.
- **`pi-smart-router`** (0.8.0). Cache-aware with session pinning, explicitly not a turn-by-turn switcher.
- **`@yeliu84/pi-model-router`** (0.1.0). Per-turn tiers, optional LLM intent classifier, session cost budgeting, thinking control.

### 4.2 Order

Loosened `selectTier` first: it is the cheapest change and gives the reference number. Then `pi-smart-router` with `routing.ts` disabled. Then the other router only if the first did not beat the loosened selector.

Before measuring an adopted router, map its tier signal onto the telemetry `tier` column. Assert no inference row has a null tier.

### 4.3 Verdict

Keep whichever has the lowest provider cost per round **with test results no worse than the reference**. If a router wins on cost but fails tests, the cheaper tier was doing less work than the spec needed; revert.

If an adopted router wins, delete `routing.ts` and `jev/` rather than disabling them — and first record in INDEX any decision `jev` made that the router cannot express.

**Pin the child model** in `.pi/agents/implement.md` to whatever tier this stage settles on, so children stop routing themselves.

---

## 5. Pruning — one extension, configured to batch

Tool results are 67.6% of peak context, so this is where context savings live. §0.2 decides everything here.

### 5.1 Configure before measuring

Set the candidate to prune rarely and in large batches before its first benchmark run. A per-turn default measures a configuration that cannot beat a 9x rewrite cost at 0.978 cache share, and would condemn an extension that works when configured properly.

### 5.2 Candidates, one at a time

1. `npm:pi-context-prune` — summarizes completed tool-call batches, keeps originals retrievable through `context_tree_query`.
2. `tool-output-truncation` (qduc) — mechanical head/tail bounding at ingest, full output to an artifact, `inspect_tool_output` for bounded reads.
3. `pi-context-pruning` — only if the first proves unstable.

### 5.3 Keep threshold

Provider cost per round falls, invalidation points per turn rise by at most 1, test results no worse, `read-guard` interaction clean (a deduped read is not also pruned into a misleading excerpt), and the agent actually uses the escape hatch when it needs an original.

Stack two only if each passed alone, and measure the stack as its own case with its hook order recorded. If truncation and pruning are both kept, record which runs first and why: truncate-first means the pruner summarizes excerpts; prune-first can leave the truncator inert.

---

## 6. Additive and compaction

- `npm:pi-context-usage` — already installed, kept.
- `npm:pi-context-tools` — `context_info` and `compact_context`, so the agent can compact at a phase boundary it chooses.
- An undo/rewind extension, for recovering from a wrong turn without re-feeding context.

**Compaction thresholds are probably moot.** The baseline never compacted. Revisit `reserveTokens` only if a post-§4 benchmark run reaches 255,616 — the line where it would fire.

Each of these still gets a hook-trace check. "Additive" is a prediction.

---

## 7. Session-level — measured over a working day, not the benchmark

**Cache warming** only matters across gaps between prompts, and a headless benchmark turn has none. Turn `cacheWarming` on for one ordinary working session and compare its provider cost against a comparable session with it off. Revert if the warming calls cost more than the cold re-entries they prevent.

---

## 8. The coordination contract

Once §4–§6 settle, write `agent/EXTENSIONS.md` and keep it accurate:

1. Every section key has one named owner.
2. Declared order for each shared event, with the reason.
3. One context rewriter per seam, unless a stack was measured as its own case.
4. A maximum of prefix invalidation points per turn. `doctor.sh --offline` fails when the hook trace exceeds it.
5. Patches under `patches/`, one file per upstream extension, applied by `install.sh`, each naming the seam. A second patch to the same extension is the signal to reconsider adopting it.

---

## 9. Delegation — conditional

Run only if a post-§5 benchmark still drives the parent past the compaction line. The baseline peaked at 73.8% with no compaction, so this is not expected to run. If it does not, close INDEX row 12 with that reasoning.

If it does: dispatch seam in `routing.ts` or the adopted router, child bounds reusing `explain.ts`'s `execFileAsync` pattern, the bash escape from §3.3 fixed in the same change.

---

## 10. What stays

Not removed while adopting, because nothing published does the same job:

- `memory-gate.ts` as an enforcement layer — blocked raw reads, one note per task, `queue_append` as the only queue write, `doctor.sh --project` failing on a status mismatch.
- The claim and pre-committed-criteria layer, re-injected after compaction.
- `explain.ts` and the `known.md` accumulation.
- `extensions/bounds.ts` after §2.
- `lib/telemetry.ts`, now with `hook_touches`.

Any of the first three may be dropped later **on measured cost against measured use**. Not because an adopted extension has a similar name.

---

## 11. Verify

1. `./doctor.sh --offline` and `./doctor.sh --project .` exit 0 after every stage.
2. One commit per stage, naming the change and its keep/revert verdict.
3. `.agent/explain/2026-09-23-harness-setup.md` holds one table: every stage's metrics from §0.4, against stage 0 and against the previous stage.
4. No section key written twice in one `before_agent_start`, tested in both load orders.
5. No inference row has a null tier.
6. `agent/EXTENSIONS.md` matches the live hook trace.
7. `extensions/` contains no vendored upstream extension.
8. INDEX carries one row per extension kept or reverted, with its effect on provider cost per round and cache share.

---

## 12. Pre-committed next

| If | Then |
|---|---|
| §2's benchmark still stops on a bound | Report which one. If it is `maxTurnCostUsd` or `maxTurnPromptTokens`, the budgets were set too low — raise them once, with the reason in INDEX, and re-run. If it is `maxLoopDepth`, the backstop is doing the work the budgets should; lower the budgets until they fire first. |
| §2's re-baseline shows cache share well below 0.978 | 0.978 was the baseline turn's shape, not pi's steady state. Recompute §0.2's arithmetic on the new figure before §5; the break-even moves. |
| A §4 router cuts cost but test results fall | Revert. The cheaper tier did less work than the spec needed. |
| Neither router beats loosened `selectTier` | Keep `routing.ts`. Record that in INDEX: it is the reason to maintain a router. |
| A §5 extension needs tuning after its first run | Retune, then re-run from the same tree. Never keep a result measured before the tune. |
| Any stage raises invalidation points by more than 1 | Revert regardless of token savings. |
| An adopted extension needs a patch | Write it under `patches/`, name the seam, continue. Stop and report at a second patch to the same extension. |
| The whole run finishes with provider cost per round under half of stage 0's and tests unchanged | Stop adding extensions. The remaining candidates are chasing a smaller share of a smaller number. |
