# SPEC-0003 run record

Reports moved here from `.agent/explain/` on 2026-09-29, verbatim.

## Moved from `.agent/explain/2026-09-23-harness-setup.md`

# Harness setup — 2026-09-23

Stage 1 made no model call. Stage 2 is the first measured turn, so its previous stage is stage 0. Prompt tokens are uncached input plus cache reads, the same sum stage 0 reports. Stored cost is the provider cost. The database path is in `docs/README.md`.

The stage 2 turn finished the three sections. No bound fired. Loop depth stopped at 49, under the backstop of 60, and under the 20,000,000-token and $12 budgets. Cache read share is 0.971 against stage 0's 0.978. That is the same shape, so the 9× prune break-even stays. Peak context is 200,990 of 272,000, still under the 255,616 compaction line, with 0 compactions. Wall time between the first and last parent call was 1,000s.

Copy tests, re-run after the turn: 47 passed, 0 failed, 1 skipped. Stage 0's copy reported 49 / 0 / 1. Failures stayed at 0.

Stage 3 made no model call. The index injection on the baseline index was 650 tokens. After the cap to Active next and Do not, the same ten queue rows are 614 tokens.

Stage 4 kept the loosened `selectTier`. The decision still chose escalate and `gpt-5.6-sol`, so the lower cost is this turn's smaller context, not a move to Terra. The turn finished in 40 rounds with no bound fired. Copy tests, re-run after the turn: 49 passed, 0 failed, 1 skipped. No inference row has a null tier. Invalidation points stayed at 3. Peak context is 163,680, still with 0 compactions.

Stage 4b kept `pi-smart-router` 0.8.0. Routing stayed disabled, so the two routers did not run together. Every parent row is `economical-cloud` on `gpt-5.6-luna`. The turn finished in 46 rounds, no bound fired, and peak context is 61,890 with 0 compactions. Provider cost per round is $0.001489 against stage 4's $0.068158 and stage 0's $0.084631. Cache read share is 0.9535 against 0.9613 and 0.9783. That is still the same high-cache shape, so the 9× prune break-even stays. Parent invalidation points are 2. One child session is excluded from the parent totals. No inference row has a null tier.

The copy's suite is 47 passed, 1 failed, 0 skipped. The failure is the `f44a938` assertion that the delegation databases exist, and those files are not on this machine. Stage 4's copy reads 49 / 0 / 1 because that replay edited the same assertion into a skip. The tests for the three requested sections passed.

Provider cost per round is under half of stage 0. Sections 5 and 6 stay uninstalled. One patch, `patches/pi-smart-router.patch`, names the pi 0.87 registry bootstrap seam. `routing.ts` and `jev/` are removed. `implement` is pinned to `openai-codex/gpt-5.6-luna`.

Stage 8 made no model call. `agent/EXTENSIONS.md` names one owner per section key. The offline replay of one `before_agent_start` records 2 invalidation points, under the maximum of 3. Provider cost per round stays $0.001489 and cache read share stays 0.9535.

Section 9 did not run. Peak context on the stage 4b turn was 61,890 with 0 compactions, under 255,616 and under the router's 183,616 line. The bash escape stays on index row 42. Cache warming stays off. It is a working-day measurement, and this run did not include one.

| Metric | Stage 0 | Stage 2 | Stage 4 | Stage 4b | Stage 4b against stage 0 | Stage 4b against stage 4 |
|---|---|---|---|---|---|---|
| Rounds, completed, bound | 60, no, max loop depth 60 | 49, yes, none | 40, yes, none | 46, yes, none | finished inside the backstop | 6 more rounds, still finished |
| Prompt tokens | 9,271,183 | 7,543,847 | 4,322,116 | 2,054,426 | −7,216,757 | −2,267,690 |
| Cached tokens | 9,070,336 | 7,328,768 | 4,154,880 | 1,958,912 | −7,111,424 | −2,195,968 |
| Cache read share | 0.9783 | 0.9715 | 0.9613 | 0.9535 | −0.0248 | −0.0078 |
| Provider cost | $5.077842 | $4.232003 | $2.726336 | $0.068493 | −$5.009349 | −$2.657843 |
| Cost per round | $0.084631 | $0.086367 | $0.068158 | $0.001489 | −$0.083142 | −$0.066669 |
| Prompt tokens per round | 154,520 | 153,955 | 108,053 | 44,661 | −109,859 | −63,392 |
| Peak context, compactions | 200,730, 0 | 200,990, 0 | 163,680, 0 | 61,890, 0 | −138,840, still 0 | −101,790, still 0 |
| Invalidation points per turn | not traced | 3 | 3 | 2 | first measured figure was 3 | −1 |
| Tests passed / failed / skipped | 49 / 0 / 1 | 47 / 0 / 1 | 49 / 0 / 1 | 47 / 1 / 0 | the failure is the missing delegation databases | requested-section tests passed |
| Tool errors, longest run | 7, 2 | 3, 1 | 2, 1 | 5, 2 | fewer errors, same longest run | three more errors |

## Section 13

The held-out grader is `tests/holdout/sections-6.test.ts`, written once against the stage 2 reconstruction and committed at `8ed1f71`. Each replay starts from `f44a938`. Restoring all of HEAD `tests/` onto that tree would import modules the copy does not have, so the frozen tree is the `f44a938` suite, with HEAD's skipping `tests/score-ab.test.ts` and the held-out file copied in. That snapshot is restored again before the held-out file runs. The replay's own edits under `tests/` are the diff, and they are not graded.

The Luna arm is `pi-smart-router` as adopted, launched with `--model smart-router/auto`. The Sol arm is pinned with `--model openai-codex/gpt-5.6-sol --thinking high`. On that pin the tier column is the string `unassigned`. The null-tier count on every parent session is 0. Every run exited 0, fired no bound, compacted 0 times, and recorded 2 parent invalidation points.

| Metric | Luna 1 | Luna 2 | Luna 3 | Sol 1 | Sol 2 | Sol 3 |
|---|---|---|---|---|---|---|
| Rounds, completed, bound | 36, yes, none | 40, yes, none | 25, yes, none | 44, yes, none | 35, yes, none | 30, yes, none |
| Model, tier | gpt-5.6-luna, economical-cloud | gpt-5.6-luna, economical-cloud | gpt-5.6-luna, economical-cloud | gpt-5.6-sol, unassigned | gpt-5.6-sol, unassigned | gpt-5.6-sol, unassigned |
| Prompt tokens | 1,257,947 | 1,363,794 | 988,353 | 4,252,013 | 3,163,832 | 2,597,036 |
| Cached tokens | 1,187,328 | 1,284,608 | 906,752 | 4,098,560 | 3,027,840 | 2,468,096 |
| Cache read share | 0.9439 | 0.9419 | 0.9174 | 0.9639 | 0.9570 | 0.9504 |
| Provider cost | $0.044332 | $0.050199 | $0.041583 | $2.657196 | $2.091964 | $1.795638 |
| Cost per round | $0.001231 | $0.001255 | $0.001663 | $0.060391 | $0.059770 | $0.059855 |
| Prompt tokens per round | 34,943 | 34,095 | 39,534 | 96,637 | 90,395 | 86,568 |
| Peak context, compactions | 51,329, 0 | 55,009, 0 | 58,290, 0 | 137,909, 0 | 130,990, 0 | 124,789, 0 |
| Invalidation points | 2 | 2 | 2 | 2 | 2 | 2 |
| Held-out passed / failed / skipped | 3 / 0 / 0 | 3 / 0 / 0 | 3 / 0 / 0 | 3 / 0 / 0 | 3 / 0 / 0 | 3 / 0 / 0 |
| Lines added / removed under tests/ | 3 / 2 | 3 / 2 | 7 / 2 | 72 / 22 | 51 / 13 | 42 / 8 |
| Files read before the first edit | 9 | 8 | 8 | 17 | 19 | 21 |
| Source diff against stage 2, files, added, removed | 5, 64, 83 | 5, 61, 83 | 5, 61, 88 | 5, 135, 133 | 6, 38, 49 | 6, 27, 37 |
| Tool errors, longest run | 2, 1 | 1, 1 | 2, 1 | 2, 1 | 2, 1 | 2, 1 |

Mean provider cost per round is $0.001383 on Luna, from $0.001231 to $0.001663, and $0.060005 on Sol, from $0.059770 to $0.060391. The Sol mean is 43.4 times the Luna mean. Per run the ratios are 49.0, 47.6, and 36.0. Mean cache read share is 0.9344 on Luna and 0.9571 on Sol. Three Luna runs cost $0.136115. Three Sol runs cost $6.544798.

Luna passed the held-out suite on all three runs and matched Sol's pass count, so stage 4b stands for this benchmark. The same review shows what the three assertions leave out. Luna's default `maxTurnPromptTokens` was 100,000, 250,000, and 400,000, and the host files omit the keys. Sol wrote 20,000,000 and $12, then 5,000,000 and $5, into the host files. The stage 2 reconstruction uses 10,000,000 and $5 with those keys present. The held-out check requires the defaults to be positive and a supplied config to fire before loop depth. Luna read 9, 8, and 8 files before the first edit. Sol read 17, 19, and 21. The source diff against the stage 2 reconstruction is 147, 144, and 149 lines on Luna and 268, 87, and 64 lines on Sol. Luna's diff is smaller on the first Sol run and larger on the other two.

The prompt told each replay to update the tests that cover the three sections. Every tests diff is in those files. `tests/holdout/sections-6.test.ts` is unchanged in all six. Index row 48 names the files and the line counts.

The hard spec asked for harness sections 1 and 2 on a fresh `f44a938` copy, launched with `--model smart-router/auto`. All 46 parent calls are `economical-cloud` on `gpt-5.6-luna`. Provider cost is $0.074132, $0.001612 per round, cache read share 0.9491, peak context 62,409, 0 compactions. `hook_touches`, `scripts/report-hooks.sql`, `extensions/bounds.ts`, and defaults of 20,000,000 tokens and $12 are present. Memory-gate skips `pi_build_memory` when the recap extension is enabled, and recap writes that key. The prompt also required a test that loads both extensions in each order, and a test that bounds keep running when routing is disabled. The tree has neither. `tests/routing-checkpoint.test.ts` only moves its import to `bounds.ts`. `runBoundAbort` checkpoints and aborts. The retry send lives inside the extension and has no test. `boundReason` reads the process-global turn usage, and the existing backstop test never sets that usage.

Stage 4b stands for the section 6 benchmark. A prompt that adds a file under `extensions/`, or that names two or more harness stages, is pinned to `openai-codex/gpt-5.6-sol` at launch. The router package has no file-count knob. It already carries one patch, and this run leaves the package as it is. Sections 5 and 6 stay unrun.
