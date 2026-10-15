# SPEC-0019: Install specs from a download, land runs on your branch, and summarize every exit

| Field | Value |
|---|---|
| Status | ready |
| Size | M |
| Kind | fix |
| Parent | SPEC-0018 |
| Date | 2026-10-15 |

Read `/.agents/notes/index.md` if present. Record the revision you start from and any pre-existing uncommitted changes; don't fold unrelated work into this change.

## 1. Intent

Four things went wrong or cost manual work around SPEC-0018's runs.

1. **The first run worked on a spec that wasn't the one preflight checked.** The rewritten spec and its tests were uncommitted. Preflight read the working copy (11 checks, tests present) and passed. The run branched from `HEAD`, which still had the first draft (10 checks, no tests). The gate then failed with "verification count changed".
2. **The gate spent two Sol-at-high repair sessions on an error no plan edit can fix.** It retried "verification count changed" like any other gate error.
3. **A failed run leaves only raw files.** The run record is written at handoff, so a failure left 13 logs and databases to dig through. Lucas wants a summary compiled from the run directory on every exit.
4. **Landing is manual git work.** Lucas works on `main` and doesn't want branch handling in his personal workflow. A passing run should land on the branch it started from by itself.

A fifth, smaller one came from SPEC-0018's review: a successful `planOnly` call is reported as an error.

A sixth is delivery. A pipeline spec arrives from the planning chat as a download: a `.zip` holding the spec and its `.tests/`, or a single `.md`. Today Lucas unzips it, renames `SPEC-NNNN` to the next free ID, adds the index row and commits, all by hand. Once item 1 is fixed, a missed commit blocks the run outright. The pipeline should take the download itself.

Agreed decisions:
- A real run refuses to start while the spec or anything under its `.tests/` is uncommitted. A dry run only warns, so a draft can still be inspected. Other uncommitted paths stay a warning, as today.
- Landing is a fast-forward only. The run lands on the branch the target had checked out when the run started, and only if that branch is still checked out and still points at the run's start commit. Otherwise the review branch stays and the summary says why. No merge commits, no rebases, no force.
- Landing is on by default. `pipeline.land: false` in host settings turns it off.
- `implement_spec` and `bin/pi-implement` accept a path to a downloaded `.md` (with its sibling `.tests/`, when present) or `.zip` in place of a spec ID. The runner installs it into the target's `docs/specs/`, gives a `SPEC-NNNN` spec the next free numeric ID, adds the index row, commits only those paths, then runs it. A dry run reports the install without writing anything.
- The summary is deterministic, built by the runner from the run directory with no model call, and written to `<runDir>/summary.md` on every exit once the run directory exists. The integration report stays as it is, as the evidence package.

Required outcomes:
- O1: A real run whose spec or tests are uncommitted exits 2 before creating a branch, worktree or run directory, and before any model call. The message names the spec and the uncommitted paths. `--dry-run` warns instead.
- O2: "Verification count changed" ends the run immediately, with no repair session.
- O3: Every exit after the run directory exists writes `summary.md` and puts its path in the `done` event. The tool shows the path.
- O4: A run whose final grade passes fast-forwards the branch it started from when that is safe, deletes the review branch, and reports `Landed on <branch>`. When it isn't safe, it keeps the review branch and reports why. A failed run never moves the target's branches.
- O5: A successful `planOnly` call returns `isError: false` with how to continue. Failures keep SPEC-0018's stop-and-report behaviour.
- O6: Given a downloaded `.md` or `.zip`, a run installs and commits the spec and its tests, then runs from that commit. A conflicting ID, or an archive without exactly one spec, exits 2 with nothing written.

## 2. Priority

O6 removes the manual steps between the planning chat and a run, and is what makes O1 painless. O1 and O2 together prevent the most expensive failure seen so far: a whole planning round wasted on the wrong spec revision. O4 removes the manual step from every successful run. O3 makes every failure readable without collecting files by hand.

Deferred:
- A full model-driven run on another repository (SPEC-0018's acceptance, which is still pending).
- Exercising SPEC-0018's handoff without `.agent`, and with a missing index row.

## 3. Prior art

- Fast-forward-only landing with a moved-base check is how merge queues and GitHub's "rebase and merge" protect a branch. The tip must equal what the change was built on, or nothing lands. Here the base is recorded at run start and compared at the end; `git merge --ff-only` enforces the rest. Uncommitted edits to unrelated files survive a fast-forward. Conflicting edits make it refuse, which is the behaviour wanted.
- Python's `zipfile` module (`python3 -m zipfile -e`) extracts archives with no new dependency. pi-build already needs Python through `uv`, and Node has no zip reader built in.
- `git commit -- <paths>` commits only the named paths and leaves other staged or unstaged work alone, so an install never sweeps up unrelated edits.
- `git status --porcelain` reports an untracked directory once, at its top-most untracked ancestor (`?? docs/`). Matching the spec by exact path alone misses that case, so an untracked ancestor directory counts as covering the spec.

## 4. Grounding

| Fact | Expected | Tag | Source |
|---|---|---|---|
| Preflight inputs | `{ specText, hasTestsDir, held, dirty, testFiles?, pythonProject? }`; `dirty` is raw porcelain lines | measured | `lib/pipeline.ts` at dc204dd |
| Spec text and tests at preflight | read from the target's working copy | measured | `bin/pi-implement` |
| Gate loop | three rounds; a repair Sol session after rounds 1 and 2 for any error | measured | `bin/pi-implement` |
| `exit` / `finish` | `exit` → `finish(false, text)` → one `done` event | measured | `bin/pi-implement` |
| `pipeline.json` | `{ branch, spec, stamp, startedAt }` | measured | `bin/pi-implement` |
| Handoff end | worktrees removed, then `finish(true, …, { branch, runRecord })` | measured | `bin/pi-implement` |
| `done` event schema | `ok`, optional `branch`, `runRecord`, `summary`; validated in `parseProgressLine` | measured | `lib/progress.ts` |
| Tool success | `handedOff` needs `branch` and `runRecord`; plan-only success is an error | measured | `extensions/pipeline.ts` |
| Tool description | contains "Hands off on a branch and never writes main" | measured | `extensions/pipeline.ts` |
| Telemetry columns | `inference_calls(cost_usd, prompt_tokens, completion_tokens, subagent_role, …)` | measured | uploaded run databases |
| `node:sqlite` | available without a flag on the Node versions in use | agent-verify | run the tests |
| `python3` | on PATH, with the standard `zipfile` module | agent-verify | `python3 -m zipfile -h` |
| Index header | `\| ID \| Title \| Status \| Implemented by \| Date first added \| Former path \|` | measured | `docs/specs/index.md` |
| Existing failing tests | none on Lucas's machine (SPEC-0018 report) | agent-verify | run the suite at start |

Step 0, before editing:
- Verify every row that describes repo or environment state and report expected vs actual.
- Record the failing-test baseline for `tests/*.test.ts` and every `docs/specs/*.tests/`.

If a contradiction changes the design, outcomes, scope or verification, stop and report. Otherwise record it and continue.

## 5. Scope

In:
- `lib/pipeline.ts`
- `lib/progress.ts`
- new `lib/run-summary.ts`
- new `lib/install-spec.ts`
- `extensions/pipeline.ts`
- `bin/pi-implement`
- `agent/EXTENSIONS.md` and README lines that describe how a run ends

Out:
- `scripts/run-plan.mjs`
- the plan prompt, the plan gate's checks, models, thinking levels, quota gating
- the integration report's content
- the run record's format, except that its "Branch:" line may name a branch the run later deleted
- landing for runs resumed from before this change: no recorded base means no landing, with a reason

## 6. Changes

The spec's tests in `/docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.tests/` define these interfaces by import; they are the contract.

### 6.1 Preflight and gate: `lib/pipeline.ts`
Outcomes: O1, O2.

- `uncommittedSpecPaths(dirty: string[], paths: { spec: string; tests: string }): string[]`. From porcelain lines (`XY path`, renames `old -> new` take the new path), return the entries that are:
  - the spec file;
  - the tests directory, or anything under it;
  - an untracked ancestor directory (ending `/`) of either.

  Order follows the input.
- `preflight` takes optional `specPaths?: { spec, tests }`. When given and `uncommittedSpecPaths` is non-empty, add one blocking reason that names `specPaths.spec`, says the run starts from `HEAD`, and lists the paths. Without `specPaths`, the result is exactly what it is today. Uncommitted paths stay in the existing warning.
- `gateRepairable(errors: string[]): boolean`. False when any error is exactly `"verification count changed"`.

### 6.2 Landing: `lib/pipeline.ts`
Outcomes: O4.

`landReviewBranch({ target, branch, base, baseBranch, enabled }): { landed: boolean; onto?: string; reason: string }`. In order:

1. `enabled` false → not landed, reason contains "disabled".
2. `baseBranch` null → reason contains "detached".
3. The target's checked-out branch (`symbolic-ref --short -q HEAD`) differs from `baseBranch` → reason names the current branch.
4. `rev-parse <baseBranch>` differs from `base` → reason contains "moved".
5. `git merge --ff-only <branch>` fails → reason contains "fast-forward" and git's first error line.
6. Otherwise delete the review branch with `branch -d` (ignore failure) and return `{ landed: true, onto: baseBranch, reason }`.

Never merge with a commit, rebase, reset or force. A refusal leaves both branches exactly as they were.

### 6.3 Summary: new `lib/run-summary.ts`
Outcomes: O3.

`buildSummary({ runDir, outcome: { ok, stage, reason, next?, landed?, branch? } }): string` returns markdown built only from files in `runDir`. Missing files are reported as missing, never thrown. Contents, in this order:

1. **Title** with the spec ID from `pipeline.json`.
2. **Status**: `Failed`, `Handed off` or `Landed on <branch>`, plus the stage and reason. Then the review branch when kept, and `next` when given.
3. **Run**: spec path, start commit (7 characters) and start branch, start time, run directory.
4. **Plan gate**: one line per `gate-N.log`, as `Gate round N+1:` and its errors; `Passed` from `gate.json`; `not reached` when neither exists.
5. **Tasks**: one line per `results.jsonl` row (id, acceptance, model, rounds, cost); `none recorded` when absent.
6. **Final grade**: spec tests, plan tests and typecheck as pass / fail / not run from `grade.json`, else `Grade not reached`.
7. **Sessions table**: every `*telemetry.db` under `runDir` except inside `branch/` and `work/`. Each row has the session name (file name without `-telemetry.db`), calls, summed prompt tokens, summed completion tokens and cost as `$0.00`, followed by a total row.
8. **Integration report**: the absolute path of `report.md` when it exists.

### 6.4 Progress: `lib/progress.ts`
Outcomes: O3, O4.

- The `done` event gains optional string fields `landed` and `summaryPath`. `parseProgressLine` rejects either one when it is present but not a string.
- `progressSummary` and `renderProgress` show `Landed on <landed>` in place of `Handed off`. They omit `Branch:` when `landed` is set, and add `Summary: <summaryPath>` when present.
- Output without the new fields is unchanged.

### 6.5 Runner: `bin/pi-implement`
Outcomes: O1–O5.

- **Preflight.** For a real run, pass `specPaths: { spec: specRel, tests: testRel }` to `preflight`. For `--dry-run`, don't pass it; print a warning (stderr, plus a `notice` event) listing `uncommittedSpecPaths` when non-empty.
- **Run metadata.** At run start, record `base` (`rev-parse HEAD`) and `baseBranch` (`symbolic-ref --short -q HEAD`, or null) in `pipeline.json`. Create the branch from `base`.
- **Summary on every exit.**
  - Track the current stage, and the run directory once it exists.
  - Every `exit` and `finish` after that writes `summary.md` with `buildSummary` and adds `summaryPath` to the `done` event.
  - `exit` passes `next`. For 75 or 130: resume, naming both the tool call and the terminal command. Otherwise: fix the reason, then start a new run, naming where the worktree is kept.
  - A summary that fails to write is reported on stderr and never changes the exit code.
- **Gate.** After writing `gate-N.log`, if `gateRepairable(errors)` is false, exit 1 at once. The message must say the run's spec differs from the one preflight read and to commit and start a new run.
- **Plan-only.** `finish(true, …, { branch })` in both progress and terminal mode, so its summary is written.
- **Landing.** After the handoff commit and the worktree removals, emit stage `land` and call `landReviewBranch` with `enabled: settings.pipeline?.land !== false`.
  - Landed → `finish(true, summary, { landed, runRecord })`.
  - Otherwise → `finish(true, summary, { branch, runRecord })`, with the reason in `summary`.
  - Terminal mode prints one line either way.
  - A failed run never calls it.
- **Header comment.** Update it to say what the runner now does.

### 6.6 Tool: `extensions/pipeline.ts`
Outcomes: O3, O4, O5.

- **Hand-off.** `ok`, exit 0, `runRecord`, and either `branch` or `landed`. Not an error, no stop sentence.
- **Plan-only success.** `planOnly` called, exit 0, `ok`, a `branch` and no `runRecord`. Return `isError: false`, the progress summary, and "Plan gate passed on `<branch>`. To implement it, call implement_spec again with resume: true." No stop sentence.
- **Everything else.** Unchanged from SPEC-0018: `isError: true`, ending with `STOP_AND_REPORT`. The summary path appears through `progressSummary`.
- **Parameter.** The `spec` parameter's description says it also takes a downloaded `.md` or `.zip`, which is installed and then run. The tool passes it through unchanged.
- **Description.** Replace "Hands off on a branch and never writes main" with a sentence saying a passing run fast-forwards the branch you started on if it hasn't moved, and otherwise leaves a review branch. Keep the Sol/Luna sentence and the stop sentence.

### 6.7 Install: new `lib/install-spec.ts`
Outcomes: O6.

`installSpec({ target, source, today, dryRun? }): InstallResult`. On success: `{ ok: true, id, slug, spec, tests, title, indexRow, committed, commit? }`, where `spec` and `tests` are repo-relative and `tests` is null when there are none. On refusal: `{ ok: false, error }` with nothing written.

- **Sources.**
  - A `.zip`: extract to a scratch directory; entries may sit under `docs/specs/` or at the root.
  - A `.md`: the file, plus its sibling `<stem>.tests/` directory when one exists.
  - Anything else is refused.
  - The source must hold exactly one `SPEC-<ID>-<slug>.md` that isn't a run record. The tests are that file's `<stem>.tests/`. Other entries are ignored. The scratch directory is always removed.
- **ID.**
  - `NNNN` becomes the next free numeric ID: one more than the largest all-digit ID among the existing spec files and index rows, padded to four digits, `0001` when there are none. Every `SPEC-NNNN` in the spec and test file contents becomes the new ID.
  - An explicit ID is kept.
  - An ID already used by a spec with a different slug is refused.
  - The same ID and slug replaces the spec and the whole tests directory.
- **Index row.**
  - Add a row only when no row has this ID. Cells follow the existing header: ID, Title (the spec's H1), Status (the spec's header Status, else `ready`), a column starting "Date" (`today`), `—` elsewhere.
  - No `index.md` → create one with a `# Specifications` heading and the header `| ID | Title | Status | Implemented by | Date first added |`.
  - Create `docs/specs/` when missing.
- **Commit.** Stage the spec, its tests directory (deletions included) and `index.md`, then `git commit -- <those paths>` with message `Add SPEC-<id>: <title without its SPEC prefix>`. When nothing changed, don't commit and return `committed: false`.
- **`dryRun`.** Compute and return everything, write nothing.

Runner (`bin/pi-implement`), before the `docs/specs` existence check:
- Treat the spec argument as a source when it ends in `.md` or `.zip`, names an existing file once a leading `~/` is expanded, and lies outside the target's `docs/specs/`.
- Emit stage `install` and call `installSpec` with today's local date. A refusal exits 2 with `install failed: <error>`. Report the result in a `notice` and on stderr.
- With `--dry-run`, print `{ "install": <result> }` and exit 0 without resolving or preflighting.
- Otherwise continue with the installed ID as the spec query, so preflight sees a committed spec.

## 7. Paths

| Path | Trigger | Planned check or justified exclusion |
|---|---|---|
| uncommitted spec, real run | untracked `docs/` in target | V3 |
| uncommitted spec, dry run | same | V4 |
| committed spec | clean target | V5 (reaches planning with a failing `pi`; summary written; main unmoved) |
| porcelain forms | modified, untracked file and dir, ancestor dir, rename, added | V1 |
| gate: count changed | error list | V2 (decision); runner wiring by review: the repair loop can't be reached without a model |
| landing: clean fast-forward | review one commit ahead | V6 |
| landing: unrelated local edit | untracked file | V6 |
| landing: moved, switched, detached, conflicting edit, disabled | each | V7 |
| summary: failed early | gate logs + telemetry, no grade | V8 |
| summary: finished and landed | grade, results, report | V8 |
| summary: empty run directory | nothing | V8 |
| `done` fields and rendering | landed, summaryPath, invalid types | V9 |
| tool: landed / kept / plan-only / failed | fake runner | V10 |
| install: zip with NNNN, under docs/specs/ | next free ID, row, commit of just those paths, unrelated edit untouched | V11 |
| install: zip at root with explicit ID; .md with sibling tests | | V11 |
| install: reinstall changed / identical | replace and commit / no commit | V11 |
| install: ID clash, no spec, two specs | refused, nothing changed | V11 |
| install: dry; no docs/specs or index | | V11 |
| runner: dry run with a zip | install reported, repo unchanged | V12 |
| runner: real run with `~/Downloads/x.zip` | installed, committed, run based on that commit | V12 |
| full run that lands | real spec | not exercised here: needs a model-driven run; Lucas's next pipeline run is the acceptance |

## 8. Verification

| Outcome | Change | Check ID: falsifiable condition |
|---|---|---|
| O1 | §6.1 | V1: `preflight-gate.test.ts` "uncommitted changes…" passes, including the ancestor-directory cases |
| O2 | §6.1 | V2: `preflight-gate.test.ts` "a changed verification count…" passes |
| O1 | §6.1, §6.5 | V3: `runner.test.ts` "a run whose spec and tests are uncommitted…" passes: exit 2, names the spec, no `pipeline/*` branch, no run directory, no `pi` invoked |
| O1 | §6.5 | V4: `runner.test.ts` "a dry run only warns…" passes |
| O1, O3, O4 | §6.5 | V5: `runner.test.ts` "a committed spec passes preflight…" passes: `base` and `baseBranch` recorded, `summary.md` written on the planning failure, `main` unmoved |
| O4 | §6.2 | V6: `land.test.ts` the two landing tests pass: fast-forward without a merge commit, review branch deleted, unrelated local edit kept |
| O4 | §6.2 | V7: `land.test.ts` "a moved branch…" passes: all five refusals keep both branches as they were |
| O3 | §6.3 | V8: `summary.test.ts` passes (failed, finished, empty) |
| O3, O4 | §6.4 | V9: `progress-tool.test.ts` "done events carry…" and "a landed run says…" pass |
| O4, O5 | §6.6 | V10: `progress-tool.test.ts` tool tests pass: landed, kept, plan-only, failed with summary, description |
| O6 | §6.7 | V11: `install.test.ts` passes |
| O6 | §6.7, §6.6 | V12: `runner.test.ts` "given a downloaded zip…" (both) pass, and "the description says…" in `progress-tool.test.ts` finds `.zip` in the parameters |
| all | all | V13: SPEC-0018's and SPEC-0015's spec tests and `tests/*.test.ts` pass, with the failing set equal to step 0's |

Run the spec's tests with `node --experimental-strip-types --test docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.tests/*.ts`. They build their own temp repositories, settings, hold paths and a `pi` stub that fails when called; no model is called.

Protected (never edit, skip or weaken to pass): everything under `/docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.tests/`, every other spec's `.tests/`, and `tests/*.test.ts`.

Invariant: no code path moves, resets or deletes the target's checked-out branch except the fast-forward in `landReviewBranch`, and that runs only after a passing final grade.

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
