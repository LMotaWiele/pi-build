# SPEC-0010 run (interactive pi)

Start revision: `ad28fa1`. Spec revision 2. `SPEC-0010` was free; the untracked NNNN spec, reference, tests and smoke fixture, Stage 1 edits, and generated explanations predated this continuation. No unrelated work was incorporated. `.agents/notes/index.md` was absent.

## Step 0

The grounding rows describing `ad28fa1` matched that revision, except the omitted `tests/read-guard.test.ts` assertion about loop depth, which Lucas explicitly authorized changing. The current worktree is post-Stage 1: four proxy bounds are gone and the requested budgets are 50 million tokens/$30. Pi 0.87.1 print mode calls `session.prompt()` then returns after that call and disposes; `agent_end` messages are not drained there, so the `pi-build-continue-needed` entry is used. Runner previously set `PI_BUILD_RETRY=0` for Luna and used a Node-only grader. The baseline doctor failure at `ad28fa1` matched the revision-2 neutrality finding; this continuation's initial `./doctor.sh --offline` had only the baseline memory-structure failures (additional generated explain files were affected). The updated Stage 4 exemption eliminates them.

## Stage 1 — runtime gates

Completed in the previous interactive session. V1 `stuck.test.ts`: 10 passed; V2 `continuation.test.ts`: 4 passed; V3 `quota-action.test.ts`: 7 passed and protected `quota.test.ts` passed; V4 `bounds.test.ts`: 3 passed; V5 `tests/bounds-split.test.ts`: passed. V6: a new pi session started; `./doctor.sh --offline` reported only baseline memory-structure failures, permitted by revision 2. No repair round in this continuation. Lucas authorized `tests/read-guard.test.ts` to stop requiring the removed proxy bounds and raised the budget to 50M tokens/$30. No Stage 1 commit was made.

## Stage 2 — shared decisions

V7 `verify-count.test.ts`, V8 `specs.test.ts` and `tests/pi-rework.test.ts`, V9 `pipeline.test.ts`, V10 protected `plan.test.ts` all passed (`node --experimental-strip-types --test ...`): 48 passed in the Stage 2/4 combined run. `countVerifyChecks` returned 7 for SPEC-0008, 13 for SPEC-0009, 16 for SPEC-0010. `./doctor.sh --offline` passed after Stage 4's independent neutrality fix. Exit: passed. Repair rounds: 0.

## Stage 3 — entry point and runner

V11 `bin/pi-implement 9 --dry-run`: exit 0; printed paths, 13 checks, Sol/high, Luna/medium and the Node test command, with no model call. V12 `bin/pi-implement 7 --dry-run`: exit 2, named missing verification and tests. V13 with `PI_BUILD_QUOTA_HOLD` pointing to a temporary weekly hold: exit 75. V14 repair round 1: baseline `715cd8c`, scratch fixture commit `ce735d0`. The pipeline gate passed, Luna T1/T2 and integration ran, and final Node and Python spec tests plus plan tests passed (`grade.json`). Handoff failed: pi generated `.agent/explain/` changes in both worktrees; runner's `git add -A` committed generated files, and fast-forward refused to overwrite branch-local generated files. Repair commit `1f99bd8`: exclude `.agent/` from runner commits, and restore/clean only `.agent/` in the pipeline's branch worktree immediately before fast-forward.

V14 retry: scratch fixture commit `15fccbf` from `1f99bd8`; run directory `/home/george-contis/var/pipeline-runs/SPEC-9001-add-smoke-double/2026-09-29T19-01-01-924Z`. Sol plan gate passed with 2 checks and 2 Luna tasks. T1 passed (7 rounds, $0.00161536); T2 passed (6 rounds, $0.00192778). Integration ran (8 rounds, $0.1045704); planner ran 12 rounds ($0.1514808). Final `grade.json`: spec tests exit 0, both Node `double.test.ts` and `uv` `test_smoke_double.py` passed; plan tests exit 0. Protected diff empty. The handed-off branch `pipeline/SPEC-9001-add-smoke-double-2026-09-29T19-01-01-924Z` carried `docs/specs/SPEC-9001-run.md` headed `Implemented by: pi pipeline`, the plan, two implementation files, and `docs/specs/SPEC-9001-add-smoke-double.plan/report.md`; `report.md` also exists in the run directory. Quota snapshots: 5-hour 28% at T1 and 29% at T2/integration; weekly 31% throughout (planner snapshot not available). Recorded task cost $0.00354314; planner + integration + tasks total $0.25959434. `main` remained at `1f99bd8` during smoke. Both scratch worktrees and both scratch and pipeline branches were removed after verification; run artifacts retained. Stage 3 exit: passed, 1 repair round.

## Stage 4 — index and docs

V15 `index.test.ts`: passed. V16 `./doctor.sh --offline` and `./doctor.sh --project .`: both exit 0; README section present. Stage 4 exit: passed. Repair rounds: 0.

## Integrated acceptance

`node --experimental-strip-types --test docs/specs/SPEC-0010-make-pi-ready-for-spec-development.tests/*.test.ts docs/specs/SPEC-0006-translate-specs-with-sol.tests/{plan,quota}.test.ts tests/{bounds-split,pi-rework,read-guard,plan}.test.ts`: 85 passed, 0 failed. Both doctor checks exit 0. V14 evidence is above. Final-commit acceptance is recorded below after the final run. O1/O2: Stage 1 gates and V1–V6; O3: V7–V10; O4: V11–V14 including a live delegated run; O5: V15–V16. §7 paths exercised by unit tests include stuck patterns, budgets, quota decisions, compaction decisions and dry-run preflight; live quota exhaustion was not exercised; the pipeline smoke was exercised.

## Final-commit acceptance

At implementation commit `918b06f`, `node --experimental-strip-types --test docs/specs/SPEC-0010-make-pi-ready-for-spec-development.tests/*.test.ts docs/specs/SPEC-0006-translate-specs-with-sol.tests/{plan,quota}.test.ts tests/{bounds-split,pi-rework,read-guard,plan}.test.ts` passed 85/85. `./doctor.sh --offline` and `./doctor.sh --project .` both exited 0. The final run-record-only commit was followed by the same checks at its tip; no production or protected files changed after `918b06f`.

## Deviations and handoff

The no-commit rule was real: note_update's promptGuidelines in extensions/memory-gate.ts ended with 'Do not commit.', which pi renders into the developer message's <rules>. Lucas removed it before this continuation; the fresh session could not see it and wrongly recorded it as a misattribution. Stage commits were collapsed into the first implementation commit because Stage 1 preceded this continuation. The V14 smoke did not merge into `main`; it used scratch branches and retained only artifacts in the run directory.
