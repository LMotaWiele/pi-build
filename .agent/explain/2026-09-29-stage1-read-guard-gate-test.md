# Stage 1 read-guard test adjustment

`tests/read-guard.test.ts` now asserts that long, read-heavy, failure-heavy turns are not bounded; prompt-token and cost budgets remain the only `boundReason` backstops. This replaces the historical assertion that the four removed proxy bounds fire.

Validation: `node --experimental-strip-types --test tests/*.test.ts` — 101 passed, 1 skipped, 0 failed. Stage 1's fresh-session/doctor exit is still unverified; the offline doctor baseline fails on pre-existing memory-structure/harness-name findings in `.agent/notes/INDEX.md` and `.agent/explain/`.
