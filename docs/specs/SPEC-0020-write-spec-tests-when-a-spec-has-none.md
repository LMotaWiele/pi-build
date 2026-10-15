# SPEC-0020: Write a spec's tests in the pipeline when it ships none

| Field | Value |
|---|---|
| Status | implemented |
| Size | M |
| Kind | build |
| Parent | SPEC-0019 |
| Date | 2026-10-15 |

Read `/.agents/notes/index.md` if present. Record the revision you start from and any pre-existing uncommitted changes; don't fold unrelated work into this change.

## 1. Intent

The pipeline only runs specs that arrive with a `<stem>.tests/` directory. Preflight refuses a spec without one, and the final grade fails without it. Only pi-build's specs have been written that way, by a planner with the repository cloned. Specs from every other project are a single `.md` whose Verification section says what must hold, and they have all been refused. The first real one (SPEC-0004 in another project) ended there.

The fix: when a spec ships no tests, the pipeline writes them first, from the spec alone, before any plan or code exists. It gates them, then freezes them in their own commit. From then on the run is unchanged: planning, Luna's tasks and integration can't edit them (the existing `.tests/` protection), and the final grade runs them.

Agreed decisions:
- A spec that ships its own tests keeps them and skips this stage.
- The writer is a fresh Sol session at the planner's thinking level. It reads the spec and the repository, and nothing from a plan. `pipeline.testWriter` can name another model. `pipeline.writeSpecTests: false` restores today's refusal.
- Every V-check gets a test file named for its number, or a `MANUAL.md` line with a reason (for example "needs a model-driven run" or "Lucas's next real use").
- The gate checks four things:
  - every check is covered;
  - the test files parse;
  - at least one test is automated;
  - at least one test fails before implementation. If none fail, the tests don't test the change.

  Two repair rounds, as for the plan gate.
- The writer's edits outside the tests directory are discarded, not committed.
- The run record and summary say the tests were generated, by which model, which ones failed before implementation (fail-to-pass) and which passed (pass-to-pass), and which checks are manual. A review then knows the run was graded by tests from the same vendor that implemented it.

Required outcomes:
- O1: A spec without `.tests/` passes preflight. A dry run says who will write the tests.
- O2: Before planning, the run writes, gates and commits the spec's tests on the run branch in a commit of only the tests directory. Planning then runs as before.
- O3: A rejected attempt goes back to the writer with the gate's errors, up to three attempts in all. A third rejection ends the run before planning, with a summary.
- O4: A spec that ships tests never invokes the writer.
- O5: `spec-tests.json` in the run directory, the summary and the run record show the writer, the rounds, each file's fail-to-pass or pass-to-pass status and the manual checks.

## 2. Priority

Without this, the pipeline is unusable outside pi-build, and SPEC-0018/0019's work for other repositories never runs. Deferred:
- Assigning a different vendor as the test writer by default, for independence. `pipeline.testWriter` makes that a setting change once it's wanted.
- Mutation testing of generated tests.

## 3. Prior art

- **Agentless** (Xia et al., 2024) writes a reproduction test before patching and keeps it only if it fails on the original code. This is the same rule as the "at least one fails before implementation" gate.
- **SWE-bench** grades a fix with FAIL_TO_PASS tests (new behaviour) and PASS_TO_PASS tests (preserved behaviour). `spec-tests.json` records each file in those terms, so preservation tests that pass today are allowed and labelled.
- **The known pitfall** of generated tests is the oracle problem: the tests encode the model's reading of the spec. Mitigations adopted here:
  - the writer sees only the spec, before any plan or code;
  - the tests are frozen before implementation starts;
  - generated tests are labelled for review;
  - non-automatable checks are declared, not faked.
- **Two Node facts found while building the tests:**
  - `node --check` accepts a `.ts` file with a syntax error under type stripping, so the parse check strips types with `module.stripTypeScriptTypes` and then runs `--check` on the result. Imports aren't resolved, which matters because tests written first import modules that don't exist yet.
  - `node --test` sets `NODE_TEST_CONTEXT` in its children, and a nested `node --test` that inherits it reports every file as passing. The spec's runner tests clear it.

## 4. Grounding

| Fact | Expected | Tag | Source |
|---|---|---|---|
| Preflight blocks without tests | `"spec has no .tests/ directory: …"` when `hasTestsDir` is false | measured | `lib/pipeline.ts` at 09c241a |
| Protected expectation of that block | SPEC-0010's preflight test expects it when the new option is absent | measured | `docs/specs/SPEC-0010-*.tests/` |
| Run metadata | `pipeline.json` has `branch, spec, stamp, startedAt, base, baseBranch` | measured | `bin/pi-implement` |
| Stage names | validated against a fixed list in `lib/progress.ts` | measured | `STAGES` |
| Child sessions | `pi(work, model, thinking, prompt, log, db)` with role `planner` | measured | `bin/pi-implement` |
| Per-file test run | `tests(work, files, pythonProject)` returns `{ code, output }` | measured | `bin/pi-implement` |
| Final grade | runs `<stem>.tests/` through `run-plan.mjs`; protects it from edits | measured | `scripts/run-plan.mjs` |
| Summary sections | Status, Run, Plan gate, Tasks, Final grade, Sessions | measured | `lib/run-summary.ts` |
| `module.stripTypeScriptTypes` | available on the Node versions in use | agent-verify | `node -e "require('node:module').stripTypeScriptTypes"` |
| Existing failing tests | none on Lucas's machine | agent-verify | run the suite at start |

Step 0, before editing:
- Verify every row that describes repo or environment state and report expected vs actual.
- Record the failing-test baseline for `tests/*.test.ts` and every `docs/specs/*.tests/`.

If a contradiction changes the design, outcomes, scope or verification, stop and report. Otherwise record it and continue.

## 5. Scope

In:
- new `lib/spec-tests.ts`
- `lib/pipeline.ts` (preflight option)
- `lib/progress.ts` (stage name)
- `lib/run-summary.ts` (section)
- `bin/pi-implement` (the stage, dry-run field, metadata, run-record line)
- README and `agent/EXTENSIONS.md` lines about what a spec needs

Out:
- `scripts/run-plan.mjs`
- the plan prompt and plan gate
- landing and install
- the tool
- the spec-loop skill

## 6. Changes

The spec's tests in `/docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.tests/` define these interfaces by import; they are the contract.

### 6.1 Decisions: new `lib/spec-tests.ts`
Outcomes: O2, O3, O5.

- `isTestFile(file)`: the existing Node (`*.test.{ts,mts,js,mjs}`) and Python (`test_*.py`, `*_test.py`) patterns.
- `checksNamed(file): number[]`: V-numbers in the file's basename, written `v<digits>` with a non-alphanumeric character or the start of the name before it and no digit after. `v01-x.test.ts` is V1 and `test_v10_y.py` is V10; `v10` never counts as V1.
- `manualEntries(text | null): { check, reason }[]`: lines `V<n>: <reason>` (optionally bulleted) with a non-empty reason; `check` is `V<n>` without padding.
- `specTestsGate({ checks, files, manual, syntaxErrors, before }): string[]`. Empty means pass. Errors:
  - `V<n>: no test file and no MANUAL.md entry`, for each uncovered check;
  - `<file>: names V<k>, but the spec has V1–V<n>`, for out-of-range numbers;
  - `no automated checks: …`, when there's no test file;
  - every entry of `syntaxErrors`, verbatim;
  - one error containing "pass before implementation", when `before` is non-empty and every entry passed.
- `pathsOutside(dirty, dir): string[]`: porcelain lines (renames take the new path) for paths outside `dir`. Paths under `.agent/` don't count.
- `specTestsPrompt({ spec, testsDir, checks, pythonProject, errors? }): string`. It names:
  - the spec, the directory and every check `V1`…`V<n>`;
  - the naming rule and `MANUAL.md`;
  - the Node command `node --experimental-strip-types --test`, and the Python command `uv run --project <p> pytest` only when `pythonProject` isn't null;
  - that adding behaviour must fail now, preserved behaviour may pass, and at least one must fail;
  - temporary directories, no models and no network;
  - not to edit outside the directory and not to implement anything.

  With `errors`, it appends them as the reasons the previous attempt was rejected.
- `parseErrors(root, files): string[]`. For each test file, `<file>: syntax error: <first error line>`:
  - `.ts` and `.mts`: strip types with `module.stripTypeScriptTypes`, write the result to a scratch `.mjs`, then `node --check` it;
  - `.js` and `.mjs`: `node --check`;
  - `.py`: `python3 -m py_compile`.

  Imports are never resolved. Non-test files are skipped.

### 6.2 Preflight: `lib/pipeline.ts`
Outcomes: O1.

`preflight` takes optional `writeTests?: boolean`. When it's true, a missing tests directory doesn't block. Without the option, the result is exactly what it is today.

### 6.3 The stage: `bin/pi-implement`
Outcomes: O1–O5.

- **Preflight inputs.** `suppliedTests` means `<target>/<testRel>` exists. `writeTests` is `settings.pipeline?.writeSpecTests !== false`, passed to `preflight`. `testWriter` is `settings.pipeline?.testWriter`, else the planner model.
- **Dry run.** Its JSON adds `specTests`: `"supplied"`, or `"to be written by <testWriter> at <planner thinking>"`.
- **Metadata.** New runs record `specTests: "supplied" | "generated"` in `pipeline.json`.
- **When the stage runs.** After the worktree exists and before planning, when `specTests` is `generated` and `<runDir>/spec-tests.json` doesn't exist. A resumed run that finished this stage skips it. Emit stage `spec-tests`. Then up to three rounds:
  1. Run the writer through `pi(...)` with `specTestsPrompt` (the previous round's errors from round 2 on). Logs go to `spec-tests-<round>.log`, telemetry to `spec-tests-<round>-telemetry.db`. A non-zero exit ends the run (exit 1).
  2. Discard `pathsOutside` the tests directory (`checkout` tracked paths, `clean` untracked ones) and emit a notice naming them.
  3. Collect files, `MANUAL.md` and `parseErrors`. Add an error for any Python test file when there's no Python project.
  4. Run each test file alone through `tests(...)` and record pass or fail.
  5. Apply `specTestsGate` and write `spec-tests-gate-<round>.log`.
  6. On pass, stop. Otherwise emit the errors; after the third round, exit 1 with "spec tests rejected after three rounds" and the errors.
- **On pass.**
  - Commit only the tests directory, `spec tests: SPEC-<id> (written by <model>)`.
  - Write `spec-tests.json` as `{ writer, rounds, files: [{ file, before: "fail" | "pass" }], manual: manualEntries(...) }`.
  - Continue to planning. The plan's check count, prompt and gate are unchanged.
- **Run record.** One line after `Plan:`: `Spec tests: written by <model> before planning; see spec-tests.json in <runDir>`, or `Spec tests: supplied with the spec`.

### 6.4 Progress and summary
Outcomes: O1, O5.

- `lib/progress.ts`: add `spec-tests` to the accepted stage names.
- `lib/run-summary.ts`: add a `## Spec tests` section before the plan gate.
  - With `spec-tests.json`: `Written by <writer> in <rounds> round(s)`, one line per file marked `fail-to-pass` or `pass-to-pass`, and one line per manual check with its reason.
  - Otherwise, from `pipeline.json`: `supplied with the spec`, `to be written; not finished`, or `not recorded`.
  - Everything else is unchanged.

## 7. Paths

| Path | Trigger | Planned check or justified exclusion |
|---|---|---|
| downloaded `.md` without tests | install, then the writer | V8 |
| writer edits outside the tests directory | stub edits `README.md` | V8 |
| tests pass before implementation | stub round 1 | V9 |
| test file doesn't parse | stub round 2 | V9 |
| three rejections | stub | V10 |
| tests supplied | committed `.tests/` | V11 |
| dry run without tests | | V12 |
| V1 vs V10 naming; out-of-range number; manual without a reason | | V1 |
| all manual; all pass; syntax error | | V2 |
| `.agent/` noise; renames | | V3 |
| prompt with and without Python and with errors | | V4 |
| import of a missing module | must not count as a syntax error | V5 |
| `writeSpecTests: false` | old refusal | V6 (preflight without the option) |
| resume after the stage finished | `spec-tests.json` present | not exercised: the condition is one existence check on the same path V8 asserts is written |
| Python writer output with no Python project | | not exercised: same branch as the parse-error path, adds a fixed message |
| a real model writing tests for a real spec | | Lucas's next run of a spec from another project is the acceptance |

## 8. Verification

| Outcome | Change | Check ID: falsifiable condition |
|---|---|---|
| O2, O3 | §6.1 | V1: `gate.test.ts` "every V-check needs…" and "V1 is not covered by…" pass |
| O3 | §6.1 | V2: `gate.test.ts` "checks that are all manual…" passes |
| O2 | §6.1 | V3: `gate.test.ts` "edits outside the tests directory…" passes |
| O2, O3 | §6.1 | V4: `gate.test.ts` "the writer's prompt…" passes |
| O3 | §6.1 | V5: `gate.test.ts` "a syntax error is caught…" passes |
| O1 | §6.2 | V6: `preflight-summary.test.ts` "a spec without tests no longer blocks…" passes |
| O5 | §6.4 | V7: `preflight-summary.test.ts` "the summary says who wrote…" passes |
| O2, O5 | §6.3 | V8: `runner.test.ts` "a downloaded spec without tests is installed…" passes: writer first, tests-only commit on the run branch, outside edit discarded, `spec-tests.json` correct, planning reached |
| O3 | §6.3 | V9: `runner.test.ts` "tests that pass before implementation, or do not parse…" passes: errors reach rounds 2 and 3, `rounds` is 3 |
| O3 | §6.3 | V10: `runner.test.ts` "after three rejected rounds…" passes: exit 1, no planning session, `main` unmoved, summary written |
| O4 | §6.3 | V11: `runner.test.ts` "a spec that ships its own tests…" passes |
| O1 | §6.3 | V12: `runner.test.ts` "a dry run of a spec without tests…" passes |
| all | all | V13: SPEC-0019's, SPEC-0018's and SPEC-0015's spec tests, SPEC-0010's, and `tests/*.test.ts` pass with the failing set equal to step 0's |

Run the spec's tests with `node --experimental-strip-types --test docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.tests/*.ts`. The runner tests put a scripted `pi` stub first on `PATH`; no model is called.

Protected (never edit, skip or weaken to pass): everything under `/docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.tests/`, every other spec's `.tests/`, and `tests/*.test.ts`.

Invariant: once the stage commits the tests, nothing later in the run changes the tests directory. The existing protection in `run-plan.mjs` enforces that; don't weaken it.

## 9. Stop conditions and repairs

If a check fails because of a local implementation error inside this scope, diagnose, fix and rerun the affected checks, up to three repair rounds per failed check group. Stop and report instead when:
- a step-0 contradiction changes the design;
- a protected test seems wrong;
- scope would need to grow;
- the same failure repeats without a new testable diagnosis.

Never mark an unrun check as passed.

Commit locally on the branch you were started on. Never run `git push`, create or delete remote branches, tags, PRs or releases, or change remotes; Lucas pushes.

## 10. Report back

1. Start revision; step-0 expected vs actual and the failing-test baseline.
2. Each V-check: command, output, pass/fail/not-run, repair rounds used.
3. O-ID → evidence; which §7 paths actually ran.
4. `git diff --stat`; the full diff of any protected file (should be empty); the complete changed functions with their callers.
5. Deviations from §6 with reasons; anything the spec didn't anticipate.

## 11. Landing

Filled from the review.
