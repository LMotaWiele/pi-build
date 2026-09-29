# SPEC-0011 run record

Start revision: `94a893c`. Revision 2 of the spec was copied into the numbered `SPEC-0011` path, preserving §1–§10 except the authorized revision-2 changes and header numbering. IDs 0011, 0012 and 0013 were free. `/.agents/notes/index.md` was absent. Pre-existing uncommitted changes: `.agent/explain/known.md` and generated `.agent/explain/` reports/turn files; the first attempted Stage 1 left edits in the extension, template, host, README and test paths. These generated files are not committed as Stage 1 source changes.

## Step 0

The grounding rows matched the start revision's code and layout: five-section explain prompt, every edit turn explained, failure text written as a walkthrough, recap under explain, `explain_write` tool, four landed reference trees, two unindexed v0.1 design specs, and no code importing the reference trees. `docs/reference/` is a five-file stale snapshot. Pi's extensions and host settings are symlinked to this checkout. The many non-walkthrough files in `.agent/explain/` are assigned by the §6.2 table or its name-based rules; their per-file disposition is recorded at Stage 2. Revision 2 explicitly defers validation of their filenames until after Stage 2 cleanup.

## Stage 1: explain, recaps, one writer

V1 `node --experimental-strip-types --test docs/specs/SPEC-0011-make-explain-a-learning-aid-again.tests/explain.test.ts`: 11 passed. V2 `node --experimental-strip-types --test tests/*.test.ts`: passed after one repair round: the new memory-gate registry test initially failed because bare Node could not resolve pi's bundled `typebox`; it now checks the extension's registered tool declarations and injected tool text at the source seam. V5 `tests/pipeline-explain.test.ts` verifies the planner, Luna and integration child envs carry `PI_BUILD_PIPELINE=1`. V6 `./doctor.sh --offline`: passed.

V3/V4 fresh session: `pi --model openai-codex/gpt-6-luna --thinking low --approve -p 'Use the edit tool to change only basic.js: change the + 1 to + 2...'` in `/tmp/spec11-live-Xzi0nS` exited 0. The edit succeeded; no `.agent/explain/` file was written; shutdown wrote `.agent/recaps/2026-09-29-session-1.md`. The prompt used only basic JavaScript arithmetic. This is a fresh pi print-mode session on the new extensions, not an interactive TUI. Stage 1 exit: passed, with one V2 repair round. V10's template half passed; its validator half is deferred to Stage 2 by revision 2.

## Stage 2

Pending.
