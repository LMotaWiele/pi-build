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
