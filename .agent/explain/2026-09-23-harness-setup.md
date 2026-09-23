# Harness setup — 2026-09-23

Stage 1 made no model call. Stage 2 is the first measured turn, so its previous stage is stage 0. Prompt tokens are uncached input plus cache reads, the same sum stage 0 reports. Stored cost is the provider cost. The database path is in `docs/README.md`.

The stage 2 turn finished the three sections. No bound fired. Loop depth stopped at 49, under the backstop of 60, and under the 20,000,000-token and $12 budgets. Cache read share is 0.971 against stage 0's 0.978. That is the same shape, so the 9× prune break-even stays. Peak context is 200,990 of 272,000, still under the 255,616 compaction line, with 0 compactions. Wall time between the first and last parent call was 1,000s.

Copy tests, re-run after the turn: 47 passed, 0 failed, 1 skipped. Stage 0's copy reported 49 / 0 / 1. Failures stayed at 0.

Stage 3 made no model call. The index injection on the baseline index was 650 tokens. After the cap to Active next and Do not, the same ten queue rows are 614 tokens.

Stage 4 kept the loosened `selectTier`. The decision still chose escalate and `gpt-5.6-sol`, so the lower cost is this turn's smaller context, not a move to Terra. The turn finished in 40 rounds with no bound fired. Copy tests, re-run after the turn: 49 passed, 0 failed, 1 skipped. No inference row has a null tier. Invalidation points stayed at 3. Peak context is 163,680, still with 0 compactions.

| Metric | Stage 0 | Stage 2 | Stage 4 | Stage 4 against stage 0 | Stage 4 against stage 2 |
|---|---|---|---|---|---|
| Rounds, completed, bound | 60, no, max loop depth 60 | 49, yes, none | 40, yes, none | finished inside the backstop | 9 fewer rounds, still finished |
| Prompt tokens | 9,271,183 | 7,543,847 | 4,322,116 | −4,949,067 | −3,221,731 |
| Cached tokens | 9,070,336 | 7,328,768 | 4,154,880 | −4,915,456 | −3,173,888 |
| Cache read share | 0.9783 | 0.9715 | 0.9613 | −0.0170 | −0.0102 |
| Provider cost | $5.077842 | $4.232003 | $2.726336 | −$2.351506 | −$1.505667 |
| Cost per round | $0.084631 | $0.086367 | $0.068158 | −$0.016473 | −$0.018209 |
| Prompt tokens per round | 154,520 | 153,955 | 108,053 | −46,467 | −45,902 |
| Peak context, compactions | 200,730, 0 | 200,990, 0 | 163,680, 0 | −37,050, still 0 | −37,310, still 0 |
| Invalidation points per turn | not traced | 3 | 3 | first measured figure was 3 | +0 |
| Tests passed / failed / skipped | 49 / 0 / 1 | 47 / 0 / 1 | 49 / 0 / 1 | failures unchanged at 0 | failures unchanged at 0 |
| Tool errors, longest run | 7, 2 | 3, 1 | 2, 1 | fewer errors | one fewer error |
