# Harness setup — 2026-09-23

Stage 1 made no model call. Stage 2 is the first measured turn, so its previous stage is stage 0. Prompt tokens are uncached input plus cache reads, the same sum stage 0 reports. Stored cost is the provider cost. The database path is in `docs/README.md`.

The stage 2 turn finished the three sections. No bound fired. Loop depth stopped at 49, under the backstop of 60, and under the 20,000,000-token and $12 budgets. Cache read share is 0.971 against stage 0's 0.978. That is the same shape, so the 9× prune break-even stays. Peak context is 200,990 of 272,000, still under the 255,616 compaction line, with 0 compactions. Wall time between the first and last parent call was 1,000s.

Copy tests, re-run after the turn: 47 passed, 0 failed, 1 skipped. Stage 0's copy reported 49 / 0 / 1. Failures stayed at 0.

| Metric | Stage 0 | Stage 1 | Stage 2 | Against stage 0 | Against previous |
|---|---|---|---|---|---|
| Rounds, completed, bound | 60, no, max loop depth 60 | no model call | 49, yes, none | finished inside the backstop | same, stage 1 had no call |
| Prompt tokens | 9,271,183 | | 7,543,847 | −1,727,336 | same |
| Cached tokens | 9,070,336 | | 7,328,768 | −1,741,568 | same |
| Cache read share | 0.9783 | | 0.9715 | −0.0068 | same |
| Provider cost | $5.077842 | | $4.232003 | −$0.845839 | same |
| Cost per round | $0.084631 | | $0.086367 | +$0.001736 | same |
| Prompt tokens per round | 154,520 | | 153,955 | −565 | same |
| Peak context, compactions | 200,730, 0 | | 200,990, 0 | +260, still 0 | same |
| Invalidation points per turn | not traced | | 3 | first measured figure | same |
| Tests passed / failed / skipped | 49 / 0 / 1 | | 47 / 0 / 1 | failures unchanged at 0 | same |
| Tool errors, longest run | 7, 2 | | 3, 1 | fewer errors | same |
