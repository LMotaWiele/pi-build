# SPEC — context management for 500k-token specs

**Place at the repository root of `pi-build`. Supersedes `SPEC-delegation-ab.md` §4–§6.**

**Status:** open
**Executor:** Grok Build
**Written:** 2026-09-22

---

## 0. Why this replaces the A/B measurement

`SPEC-delegation-ab.md` measured delegation on a six-file fixture whose parent peaked at 13,642 tokens — 5.0% of the 272,000 window. Real work on this machine runs 500,000+ tokens on one spec and compacts more than once. The fixture cannot reach that regime, so its `MONOLITHIC` result says nothing about it and is not carried forward.

§1–§3 of that spec are committed and stay. §4, §5 and §6 are withdrawn. The fixture, `implement.md` and `scripts/report-ab.sql` stay on disk; they become the smoke harness in §6, not a verdict machine.

**The governing fact, from the Grok Build ledger:** roughly 75% of context at depth is retained reasoning, not tool output. 398 calls produced 446,464 output tokens — about 1,121 per call — and a 184-call turn therefore accumulates ~206k of reasoning against a ~118k average prompt. Of 46,998,477 input tokens, 41,424,768 were cache reads, so most of that reasoning is billed at the cached rate rather than full price.

Two consequences. Tool-result pruning targets the wrong quarter of the context. And reasoning is what buys the reliability — cutting how much the model thinks is a quality change, not an efficiency one.

### 0.1 Generated reasoning and retained reasoning are different things

The model reasons on every call. Whether it re-reads its own earlier reasoning on later calls is a separate question, and it is the one worth attacking.

- **Generated reasoning** is controlled by `modelThinkingLevels`. Cutting it makes the model think less. That is the reliability trade, and it is not free.
- **Retained reasoning** is the old traces still sitting in the transcript. A reasoning block that already produced a tool call whose result is in the transcript is largely redundant — the conclusion is visible in what happened next. Dropping it costs nothing in how well the model thinks now.

**Stage 3 attacks retained reasoning. Stage 2 touches generated reasoning only where the task is routine.** Do not conflate them, and do not report a token cut from one as if it were the other.

Delegation is a third substitute for the same problem and stays last, for the same reason as before: it costs a routing seam, child bounds and a scorer, against one install.

### 0.2 The one real risk: prefix cache

Every context-rewriting extension here invalidates the prefix cache at the point it rewrites. Measured cache-read share on this machine is 0.73 to 0.88, and cached input is 10x cheaper than uncached on both cards. **An extension that cuts 30% of tokens and drops cache share from 0.85 to 0.50 loses money.**

So every stage below reports `cache_read_share` before and after, and a stage that lowers it without a larger token cut is reverted. This is not optional and it is the reason the stages are ordered cheapest-to-riskiest rather than biggest-first.

### 0.3 Executor and budget

Grok Build edits this repository and runs `pi` as a subprocess. Rows in `telemetry.db` are the measurement, on the Codex subscription, and never count against Grok's own tripwire: **$25 or 250 Grok calls for the whole run.**

**Do not** install two extensions in one stage. **Do not** skip a stage's measurement because the next one looks more interesting. **Do not** raise `maxTurnWallClockMs`, `maxLoopDepth`, `noProgressReads`, or `maxConsecutiveToolFailures` to make a run finish.

---

## 1. Baseline — measure one real 500k spec

The breakdown is known in outline — ~75% reasoning — so this stage confirms it on **pi** rather than on Grok Build, and measures the split that decides stage 3.

Install only `npm:pi-context-usage`, which breaks down current context by category — system prompt, user messages, tool calls, tool results. It changes no behaviour.

```bash
pi install npm:pi-context-usage
```

Run one real spec of the kind that hits 500k. Record, from `telemetry.db` and the usage panel:

| Metric | Why |
|---|---|
| Total prompt tokens for the spec | The number every stage below moves |
| `cache_read_share` | The baseline that stages 3–5 must not damage |
| Peak context before each compaction | Whether compaction fires at the threshold or from overflow |
| Number of compactions | The count stage 5 must reduce |
| Context breakdown at peak: system / user / tool calls / tool results / **reasoning** | The decision input. Reasoning may not be its own category in the panel — if not, derive it as the residual after the four named ones. |
| Whether prior-turn reasoning blocks appear in the outgoing request | **The decision input for stage 3.** Inspect the assembled request, not the session file. |
| Tokens spent re-establishing after each compaction | Compaction's true cost, usually undercounted |
| Cost, catalog | |

**Pre-committed reading of the breakdown:**

| If… | Then |
|---|---|
| Reasoning is over 50% of peak context **and** prior-turn reasoning is re-sent | Stage 3 is the main event. Stages 4 and 5 are secondary. |
| Reasoning is over 50% but prior reasoning is **not** re-sent | Stage 3 has nothing to drop. The accumulation is within-turn and only compaction (stage 5) reaches it. |
| Tool results are over 50% | The Grok profile did not transfer to pi. Run stage 4 as originally written and treat stage 3 as secondary. |
| No category exceeds 40% | Nothing here is a big lever. Ship stage 2 and §6, and stop. |

---

## 2. Tier routing — 2.5x, free, independent

This lands regardless of what stage 1 shows, and it is the largest single lever measured on this machine.

`selectTier` currently returns `work` only for a reversible single-file edit with a spec, so every multi-file spec escalates to Sol at 5 / 0.50 / 30 instead of Terra at 2 / 0.20 / 12.

```ts
if (answers.needs_repo_reasoning || answers.unfamiliar_stack) return "escalate";
if (answers.spec_exists && answers.reversible) return "work";
return "escalate";
```

`needs_repo_reasoning` still catches the cases where multi-file means genuinely cross-cutting. Update the `selectTier` test.

Then re-run the stage 1 spec and record the tier mix and cost. Expected: most of the spec on Terra, cost down roughly 2.5x on the tokens that move.

**Thinking level rides along with the tier and is the larger effect.** `modelThinkingLevels` puts Sol at high, Terra at low, Luna at minimal. Moving a spec from Sol-at-high to Terra-at-low cuts the price 2.5x *and* cuts how much reasoning is generated in the first place. On a workload that is 75% reasoning, the second is the bigger number.

That is also the risk. The reliability you get from Grok Build is bought with that reasoning. So:

- Record retries, consecutive tool failures, aborted turns, and whether the spec completed — not just tokens and dollars.
- **If quality degrades, revert.** A cheap run that needs re-running is not cheap, and at these prices one failed 500k spec costs more than the saving on several successful ones.
- If Terra-at-low is too weak but Sol-at-high is more than needed, try Terra at medium before concluding the tier is wrong. The thinking level is a finer control than the tier and the two are configured separately.

---

## 3. Stop re-sending stale reasoning

Run this if stage 1 found prior-turn reasoning blocks in the outgoing request. It is the only lever here that cuts context without cutting how well the model thinks.

### 3.1 Establish what pi does

Inspect the assembled request at depth, not the session file. Determine:

1. Are reasoning blocks from **previous turns** included? Those are the safe target.
2. Are reasoning blocks from **earlier rounds of the current turn** included? Providers differ on whether these are required for a coherent tool-use sequence, and dropping them mid-turn can break the chain. Treat within-turn reasoning as off-limits until proven otherwise.
3. Does the provider **require** prior reasoning to be echoed back? Some reasoning APIs do for multi-step tool use. If Codex does, this stage closes and stage 5 becomes the only lever.

Record the answer in INDEX before writing any code. A wrong assumption here breaks tool-calling in a way that looks like model degradation.

### 3.2 Implement

Pi exposes a context hook that transforms the assembled request without touching the session file — the same seam `pi-context-prune` uses to drop tool outputs while keeping them retrievable. Write a small extension that strips reasoning blocks from assistant messages belonging to **completed prior turns**, leaving the assistant's text and tool calls intact.

Keep it in `extensions/`, not an install. This is ~50 lines against a hook you already use in four extensions, and no published package does exactly this.

### 3.3 Cache

Dropping content rewrites the prefix. Do it **once at a turn boundary**, where the prefix changes anyway, never mid-turn. A rewrite that lands between rounds of the same turn destroys the cache that is currently absorbing 88% of these tokens, which would cost more than the reasoning does.

Re-run the stage 1 spec. **Keep it if** total prompt tokens fall and `cache_read_share` does not fall by more than 0.05. Revert on any change in tool-call behaviour, regardless of the token number.

---

## 4. Prune stale tool outputs

**Secondary on this workload.** The Grok ledger puts tool results well under the reasoning share, so this stage is worth running only if stage 1's pi measurement contradicts that, or if stage 3 closed because reasoning could not be dropped.

Two candidates, and they do the same job. **Install one.**

- `npm:pi-context-prune` — summarizes completed tool-call batches, prunes raw outputs from future context, and keeps every original in a session-backed index retrievable via `context_tree_query`. The session file is never modified; only the next request's context build changes. Its `PRUNING.md` covers the prefix-cache interaction directly, which is why this is the default choice.
- `pi-context-pruning` — a simpler port of OpenCode's algorithm, pruning after every turn, toggled by `contextPruning.enabled`. Error results are never pruned. Take this one only if the first proves unstable.

```bash
pi install npm:pi-context-prune
```

This is the stage most likely to fail §0.2. Pruning rewrites the assembled context, so the prefix changes and the cache misses. Measure carefully:

| Verdict | Condition |
|---|---|
| Keep | Total prompt tokens for the spec fall by more than the cache loss costs. Compute both in dollars, not percentages. |
| Keep, retuned | Tokens fall but cache share drops sharply — raise the prune trigger so pruning happens less often and in larger batches. Larger, rarer rewrites preserve more cache than small frequent ones. |
| Revert | Cost rises, or the agent starts re-reading pruned files and `context_tree_query` is not being used. |

Record whether the agent actually uses the escape hatch. A pruner whose recovery path is ignored converts saved tokens into repeated reads.

---

## 5. Compaction

Only if the spec still compacts more than once after stages 2 and 3.

**Compaction is the one lever that reaches within-turn reasoning.** Summarizing a transcript discards reasoning traces along with everything else, which on a 75%-reasoning workload is most of what it recovers. If stage 3 closed because prior reasoning is not re-sent or is required by the provider, this section is the whole remaining plan and should be run in full.

Pi compacts when `contextTokens > contextWindow - reserveTokens`. With `contextWindow` 272000 and a 16384 reserve that is ~255,600, about 94% fill. Two levers, in order:

**5.1 Lower the threshold, do not raise the window.** Raising `contextWindow` to whatever the model advertises optimizes for the wrong thing — it also raises pi's real request limit and its generation clamp. Compacting at 60–70% fill instead of 94% means each compaction summarizes less and the model works in a cleaner window. Try `reserveTokens` at 80000, measure, and keep it only if the spec's total token count falls.

**5.2 Give the agent `compact_context`.** `npm:pi-context-tools` adds `context_info` and `compact_context`, letting the agent inspect its own usage and compact on demand rather than waiting for the automatic trigger — described by its author as useful for orchestration agents running long multi-step workflows. At a phase boundary the agent chooses, a compaction loses far less than one that fires mid-edit at 94%.

**5.3 Replacing compaction entirely is a last resort.** `pi-better-compact` substitutes a cache-aware DP model for the default strategy and requires `compaction.enabled: false` in settings. It is the highest-risk install here: it replaces a core path, and your recap and explain extensions both hook around turn boundaries. Take it only if 5.1 and 5.2 measurably fail, and install it alone.

**The number to watch across all of 5:** tokens spent re-establishing context after each compaction, from stage 1. If compaction count falls but re-establishment cost per compaction rises to match, nothing was gained.

---

## 6. Carry-over from the withdrawn sections

These were specified in `SPEC-delegation-ab.md` §6.B and never applied. They do not depend on any measurement above.

**6.1 Retry on bound.** When `fireBound` trips with `writtenFiles().length > 0`, re-dispatch the turn at `escalate` with the §3.1 checkpoint as the prompt. The checkpoint already exists; this uses it.

**6.2 Budget-shaped bounds.** Add `maxTurnPromptTokens` and `maxTurnCostUsd` to `BoundConfig` and `boundReason`, computed from the turn usage already in the telemetry bag. Keep `maxLoopDepth` 60 as a backstop. A round count is a proxy for a budget you can now measure directly.

**6.3 Cap the injected INDEX.** `injectIndexOnSessionStart` puts the whole index in every cached prefix, the index is past 26 rows, and every run adds more. Your own rule says the queue is not a log. Inject the `## Active next` queue and the `## Do not` block only; leave the notes table to `note_open`. Measure the preamble before and after — it was 8,749 tokens on 2026-09-21.

**6.4 Cache warming.** `cacheWarming` is `off` and the TTL is 1800s, so any gap over 30 minutes re-pays the preamble cold. Turn it on and measure across a normal working session. Revert if the warming calls cost more than the cold re-entries they prevent.

**6.5 Record the bash escape.** A parent can start a nested `pi` from `bash` and escape every bound, since all four live in the parent process. Add the INDEX row. Fix it in §7 if §7 runs; otherwise leave it recorded.

---

## 7. Delegation — only if the parent still saturates

Run this **only** if, after stages 2 through 5, a real spec still drives the parent past the compaction threshold more than once.

If it does not, delegation has nothing to remove and this section closes unbuilt. Record that outcome; it is the answer, not a gap.

If it does:

1. Pin the child model in `.pi/agents/implement.md`. An unpinned child runs `selectTier` on its own prompt — at 4384c58 that gave 12 Sol children and 6 Terra, against an all-Sol parent. Check the pi-subagent schema at `ce26a686` for the key.
2. Add the dispatch seam: `escalate` spawns a file-scoped child, parent holds the spec and the open note, child returns a diff.
3. Give children bounds, reusing the `execFileAsync` pattern from `explain.ts` — wall-clock timeout, max children per turn, child failure counted toward the parent's `maxConsecutiveToolFailures`. A child with no bound is not shippable, and §6.5 is the same hole.
4. Measure against the same real spec, not the fixture. The crossover computed from this machine's own numbers is roughly **15,000 tokens of avoided parent context per dispatch batch**; a 500k spec clears it, a 100k one may not.

---

## 8. Verify

1. `./doctor.sh --offline` and `./doctor.sh --project .` exit 0 after every stage.
2. One commit per stage, message naming the stage and its keep/revert verdict.
3. `.agent/explain/2026-09-22-context-baseline.md` holds stage 1's breakdown.
4. Every stage from 2 onward records total prompt tokens, `cache_read_share`, compaction count, and cost against the stage 1 baseline, on the same spec.
5. No stage is kept whose `cache_read_share` fell more than 0.05 without a larger dollar saving.
6. INDEX carries: the bash escape (§6.5), the preamble size before and after §6.3, and one row per extension kept or reverted with its measured effect.

## 9. Pre-committed next

| If | Then |
|---|---|
| Stage 1 shows prior-turn reasoning is required by the provider or already absent | Stage 3 closes. Stage 5 in full becomes the plan, and §7 moves up in priority, since delegation keeps reasoning out of the parent by construction. |
| Stage 3 lands and tool-call behaviour changes in any way | Revert immediately, whatever the token saving. A broken tool chain reads as model degradation and will cost days to attribute. |
| Stage 2 cuts tokens but the spec stops completing reliably | The reasoning was load-bearing. Revert to Sol-at-high and record it; the 2.5x is not available on this workload. |
| Stage 2 degrades quality | Revert and record. Cheap output that needs re-running is not cheap. |
| Stage 3 and stage 4 both hold, but cache share falls below 0.60 | Stop adding context rewriters. The prefix has been fragmented; consolidate to one and re-measure. |
| Stage 5.1 and 5.2 leave compaction count unchanged | Do not reach for `pi-better-compact` reflexively. Re-read stage 1's breakdown first — a compaction count that will not move usually means the growth is in a category none of these tools touch. |
| After stages 2–5 the parent no longer saturates | §7 does not run. Close INDEX row 12 with that reasoning and stop. |
| Any extension needs a patch to work here | Stop and report. A forked extension is a maintenance obligation, and the whole point of this stage list is that each item is one install and one measurement. |
