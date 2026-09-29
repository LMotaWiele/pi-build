# SPEC-0010: Make pi ready to develop specs through the delegated pipeline

| Field | Value |
|---|---|
| Status | landed |
| Size | staged (4 stages) |
| Kind | build |
| Parent | the `translate-specs-with-sol` spec, which built the pipeline this finishes |
| Date | 2026-09-29 |
| Checkpoint | continuous, with one restart after Stage 1 |
| Run record | /docs/specs/SPEC-0010-run.md |
| Revision | 2 — 2026-09-29, after the first run stopped at Stage 1's exit |

Replace `NNNN` in this file's name, its `.tests/` and `.reference/` directories and the run record with the next free spec ID — `0010` as of `ad28fa1`. Confirm it is free.

**Revision 2.** The first run stopped at Stage 1's exit because `./doctor.sh --offline` failed its memory-structure check. That failure was already present at `ad28fa1`, before this spec changed anything; the spec required doctor to pass outright instead of judging it against the start revision. Every doctor check below is now judged against that baseline, and Stage 4 fixes the check itself. **Stage 1 is complete: resume at Stage 2** with its recorded evidence.

Read `/.agents/notes/index.md` if present. Record the revision you start from and any pre-existing uncommitted changes; don't fold unrelated work into this change.

## 1. Intent

Lucas's workflow: he writes a spec with Claude, hands it to the harness, reviews the result with Claude, and merges it. For spec work the harness uses the delegated route — GPT-6 Sol plans at high, GPT-6 Luna implements each task at medium, Sol integrates at high. Two things stand in the way.

**The runtime stops good work and lets through the one real failure.** Four of the six per-turn bounds are proxies that end turns doing legitimate work: loop depth at 60 rounds; a 30-minute wall clock that, being checked on pi's own events, can never catch a hang; three consecutive tool failures, where pi's bash tool counts every non-zero exit — a failing test run, a `grep` with no match — so red-green iteration ends the turn; and no progress after six reads, which fires on a planner reading before it writes. The only runaway Lucas has seen in real use is a stuck loop, which none of them detect. Separately, when pi compacts on context overflow and will not retry, the turn simply ends and waits for someone to type "continue"; and a 5-hour quota hold waits for a confirmation it does not need.

**The pipeline cannot run on its own.** The runner takes a plan someone else wrote, grades only Node tests, ignores the current template's checks, and ends in a worktree. Planning was Grok Build's job; Grok Build is on cooldown.

Decisions agreed in planning:
- Remove loop depth, wall clock, consecutive failures and no-progress reads. **Stuck loops are detected and escalated**: a nudge first, then the retry ladder.
- The token and cost bounds stay as a backstop against a loop the detector cannot recognise. They **stop** the turn and do not retry: an exhausted budget is a reason to report, not to spend again at a higher price.
- **5-hour window at 95%: pause in place until the window resets, plus five minutes, then continue.** Weekly window at 95%: stop and wait for Lucas.
- A turn that pi ends after an overflow compaction continues by itself.

This spec is implemented by **pi, in an interactive session**, not through the pipeline it builds. The next spec, completing what `SPEC-0007` left undone, will be the pipeline's first real job.

Outcomes:
- **O1**: A turn is bounded only by stuck-loop detection, which nudges then escalates, and by budget backstops, which stop.
- **O2**: The 5-hour window pauses and resumes by itself; the weekly window holds for Lucas; a turn ended by overflow compaction resumes by itself.
- **O3**: The pipeline's decisions are shared, tested functions: finding a spec, choosing a test runner, counting a spec's checks, deciding whether a run may start.
- **O4**: `bin/pi-implement <spec>` takes a spec from plan to a branch ready for review, through the delegated route, with no other orchestrator.
- **O5**: The spec index records which harness built each spec, and the README describes the workflow and its gates.

## 2. Priority

The runtime gates first: they are what would end the pipeline's own planning and integration sessions. Deferred: hang detection, which has not been seen in use and which no in-process check can catch; automatic merging; the route's models and levels; the `SPEC-0007` follow-up.

## 3. Prior art

- **Stuck detection:** OpenHands' `StuckDetector` flags the same action producing the same observation four or more times, the same action producing an error three or more times, and ping-pong between two action-observation pairs; errors are compared by message, so different failing commands are not a loop. The common response is a nudge before a stop, because a false positive must be cheap. Adopt the patterns and thresholds.
- **Resuming after a usage reset:** the `pi-keep-going` extension resolves the reset time and resumes the session. Adopt the mechanism, not the extension: a second extension deciding what to do on the same `agent_end` as the quota gate would give that event two owners.
- **The route and its gate** come from the `translate-specs-with-sol` spec. Nothing here changes the route; it removes the orchestrator it depended on.

## 4. Grounding

| Fact | Expected | Tag | Source |
|---|---|---|---|
| Bounds in the host file | loop depth 60, wall clock 1,800,000 ms, consecutive failures 3, no-progress reads 6, prompt tokens 20,000,000, cost $12 | measured | `settings/hosts/machina.json` at `ad28fa1` |
| `boundReason` | checks tokens, cost, loop depth, wall clock, failures, no-progress in that order | measured | `lib/telemetry.ts` |
| `extensions/bounds.ts` | reads all six keys from settings | measured | same |
| Pi's bash tool | throws on any non-zero exit, so the result is an error | measured | pi 0.87.1 bundle |
| `countsAsEdit` | includes `bash` | measured | `lib/telemetry.ts` |
| Pi awaits extension event handlers | `await this._emitExtensionEvent(event)` | measured | pi 0.87.1 bundle |
| Extension API | `pi.sendUserMessage(content, options)` and `pi.sendMessage(message, options)` exist | measured | same |
| Compaction | threshold compaction runs before the next response and the turn continues; overflow compaction after a `stop` response compacts without retrying, ending the turn; a second overflow in a turn fails with "recovery failed after one compact-and-retry attempt" | measured | same |
| `session_before_compact` | carries `reason` and `willRetry` | measured | same |
| Whether a message sent at `agent_end` in print mode (`-p`) is processed before the process exits | unknown | agent-verify | pi source or a trial |
| Repo tests using the removed bounds | `tests/bounds-split.test.ts` forces a bound with `maxLoopDepth: 1`; `tests/holdout/sections-6.test.ts` asserts `maxLoopDepth` 60 and that budgets fire before it | measured | same |
| Runner launches Luna tasks with `PI_BUILD_RETRY=0` | yes | agent-verify | `scripts/run-plan.mjs` |
| `scripts/run-plan.mjs` | takes `--plan`; no planning step; `verifyCount` returns 0 for a `## 8. Verification` table; grades with `node --test` only, passing Python files to Node when no Node tests exist; ends with `grade.json` in a detached worktree | measured | same |
| Spec resolution | private functions in `scripts/pi-rework.ts` | measured | same |
| Python projects | only `tools/map`; a fresh worktree has no `.venv`, so its first `uv run` builds one | measured | same |
| `SPEC-0007` | no verification table or list; no `.tests/` directory | measured | same |
| Who built each spec | `SPEC-0007` Claude cloud; `SPEC-0008`, `SPEC-0009` pi; all earlier Grok Build | in-context | Lucas, 2026-09-29, and commit trailers |
| `SPEC-0008` header | Status `ready`, H1 `SPEC-NNNN` | measured | same |
| `SPEC-0006` layout | older format, no Landing section, appendices at the end | measured | same |
| `./doctor.sh --offline` at `ad28fa1` | fails "memory structure": the neutrality rule `/note_open\|memoryGate\|\.pi\/\|pi-build/` in `lib/scaffold.ts` matches an explain walkthrough that names `.pi/agents/implement.md`, and INDEX row 2, a bound checkpoint listing the files a turn wrote | measured | `lib/scaffold.ts --validate` on `ad28fa1` |
| The neutrality rule's exemptions | `.agent/map/` only — "output, not memory" | measured | same |

**Step 0:** verify every row that describes repo state and report expected against actual. If a contradiction changes the design, outcomes, scope or verification, stop and report; otherwise record it and continue.

## 5. Scope

In: Stage 1's runtime gates in `lib/telemetry.ts`, `lib/quota.ts`, `extensions/bounds.ts` and `extensions/quota-gate.ts`, with new `lib/stuck.ts` and `lib/continuation.ts`; three pipeline libraries and the runner; one entry point; the index column, two status fixes and a README section.

Out: the route's models and levels; automatic merging; hang detection; `SPEC-0007`'s remaining work.

**This session runs on the code Stage 1 changes.** A running pi session keeps the extensions it loaded, so Stage 1's changes take effect only in a new session. After Stage 1, start a fresh session before continuing; if it fails to start, revert Stage 1's commit and stop.

## 6. Changes

### 6.0 Architecture

Runtime: each tool result feeds `lib/stuck.ts`; a finding nudges, then escalates through the existing retry ladder. The quota gate evaluates `quotaAction` at each round boundary and pauses in place or holds. Compaction outcomes feed `lib/continuation.ts`, which resumes a turn with `pi.sendUserMessage`. Pipeline: `bin/pi-implement` → `lib/specs.ts` → `lib/pipeline.ts` preflight → branch and worktree → Sol plans → gate → Luna per task → Sol integrates → final grade → run record and report on the branch. Seams: record in `agent/EXTENSIONS.md` that `extensions/bounds.ts` owns stuck handling and auto-continue, and `extensions/quota-gate.ts` owns pauses and holds.

### 6.1 Stage 1: Runtime gates

Depends on: nothing. Outcomes: O1, O2.

**Bounds.**
- Remove `maxLoopDepth`, `maxTurnWallClockMs`, `maxConsecutiveToolFailures` and `noProgressReads` from `BoundConfig`, `DEFAULT_BOUNDS` and `boundReason` in `lib/telemetry.ts`; from the settings `extensions/bounds.ts` reads; and from `bounds` in both host files. `boundReason` checks prompt tokens and cost only.
- A budget bound stops the turn with its checkpoint and does **not** retry.

**Stuck detection** — `lib/stuck.ts` from this spec's reference.
- `extensions/bounds.ts` keeps, for the current turn since the last user message, each tool call's name, input, result text or error message, and error flag, and runs `detectStuck` after every tool result.
- First finding in a turn: send `stuckNudge(finding)` into the running turn with `pi.sendMessage`. Later finding: escalate through the existing retry path — `retryAllowed`, then `nextTier` — with the checkpoint row and the nudge as the prompt. No target — Sol at high or above, Astra, an unknown model — stops the turn.
- Record every finding and response as a bound row: `stuck: <pattern> <tool> <count>`, then `nudged`, `escalated to <model>` or `stopped`.

**Quota** — append `quotaAction` and `PAUSE_MARGIN_SEC` to `lib/quota.ts` from the reference.
- At `session_start` and at each round boundary, `extensions/quota-gate.ts` evaluates `quotaAction` on the latest windows. **Pause**: notify with the resume time, `await` a sleep until `untilSec`, poll the usage endpoint, and evaluate again; when it says continue, the turn carries on in place. **Hold**: the existing hold — interactive sessions ask, headless ones exit 75.
- On `agent_end` with a usage-limit error: poll the usage endpoint and evaluate. A pause — or a `continue`, which means the poll raced the refusal, treated as a pause of `PAUSE_MARGIN_SEC` — sleeps, then sends `continue` with `pi.sendUserMessage`. A hold holds.
- The 5-hour window no longer asks for confirmation. `shouldHold` and `continuationFor` stay for the weekly hold.

**Continuing after compaction** — `lib/continuation.ts` from the reference.
- `extensions/bounds.ts` records `reason` and `willRetry` from `session_before_compact`, and whether pi reported the overflow recovery as failed. At `agent_end`, if pi will not retry, `continueAfterCompaction(outcome, continuesWithoutEdit)` decides: `continue` sends `continue` with `pi.sendUserMessage`; `stuck` is handled as a stuck finding at the escalate step. `continuesWithoutEdit` resets whenever a file is edited or written.
- **Print mode.** If a message sent at `agent_end` is not processed before a `-p` process exits, record an entry `pi-build-continue-needed` instead, and have the runner (Stage 3) relaunch that task's session with `--continue`.

**Tests the removal changes.** `tests/bounds-split.test.ts` keeps covering: routing disabled leaves the bounds running; a Luna turn escalates once to GPT-6 Sol at medium; no escalation while a quota hold exists; `PI_BUILD_RETRY=0` skips escalation — now triggered by a stuck finding rather than `maxLoopDepth: 1` — and adds that a budget bound stops without retrying. In `tests/holdout/sections-6.test.ts`, remove only the assertions about the four removed bounds; this is a deliberate change to a historical grader, recorded here.

Preserve: one retry per original prompt; no retry while a quota hold exists; the weekly hold's behaviour.

Checks: V1, V2, V3, V4, V5, V6. **Exit:** all pass, then a fresh pi session starts on the new extensions and `./doctor.sh --offline` in it reports nothing beyond the start-revision baseline.

### 6.2 Stage 2: Shared pipeline decisions

Depends on: Stage 1. Outcomes: O3.

- `lib/plan.ts`: add `countVerifyChecks` from the reference — counts the V-IDs defined in a `## N. Verification` table, falls back to a numbered `Verify` list without counting the heading, throws on non-contiguous V-IDs or on a spec with neither. The runner uses it instead of `verifyCount`, which is removed.
- `lib/specs.ts` from the reference: `listSpecs`, `resolveSpec`, `specPaths`. `scripts/pi-rework.ts` uses it instead of its private copies, with unchanged behaviour.
- `lib/pipeline.ts` from the reference: `testCommands` and `preflight`. The runner grades acceptance and spec tests through `testCommands`, with `pythonProject` from a new host setting `pipeline.pythonProject`, default `tools/map`. `runNodeTest` and `expandTests` are removed.

Preserve: `validatePlan`'s signature; `bin/pi-rework`'s behaviour.

Checks: V7, V8, V9, V10. Exit: all pass.

### 6.3 Stage 3: One command from spec to branch

Depends on: Stage 2. Outcomes: O4.

`bin/pi-implement <spec> [--dry-run] [--plan-only] [--resume]`, run from the repository:

1. **Resolve** through `resolveSpec` over `/docs/specs/`.
2. **Preflight**, before any model call: `preflight` with `held` from `readHold(defaultHoldPath(process.env))` and `dirty` from `git status --porcelain`. Exit 75 when held, 2 on another blocking reason; print warnings.
3. **`--dry-run`** prints the resolved paths, check count, planner and editor models with thinking levels, and the test commands for the spec's tests, then exits 0.
4. **Branch** `pipeline/SPEC-<id>-<slug>-<stamp>` at `HEAD`, with a worktree on it. Run directory `~/var/pipeline-runs/SPEC-<id>-<slug>/<stamp>`.
5. **Plan.** One Sol session in the worktree — `routing.tiers.escalate`, `pipeline.plannerThinking` — with the translation spec's §3 prompt, adapted: map each check by V-number (`V3` is `verifyMap` key `"3"`), order tasks by the spec's stages, write the plan and one acceptance test per Luna task under the spec's `.plan/` directory.
6. **Gate.** `countVerifyChecks`, `validatePlan`, `undeclaredImports` on every plan test, and every Luna acceptance test **failing** now, through `testCommands`. On failure, a new Sol session receives the errors; at most two such rounds. Still failing: stop, exit 1, keep the worktree, print the errors. Otherwise commit the plan on the branch.
7. **`--plan-only`** stops here.
8. **Implement and integrate** with the runner's existing loop. Luna tasks run **without** `PI_BUILD_RETRY=0`, so a stuck task escalates to Sol. Relaunch a task with `--continue` when Stage 1's print-mode fallback recorded `pi-build-continue-needed`. Add to the integration prompt: run the spec's tests through the given test commands, and write `report.md` in the run directory following the spec's §10.
9. **Hand off.** Restore protected files; final grade; commit on the branch; write `SPEC-<id>-run.md` on the branch, headed `Implemented by: pi pipeline`, with the plan summary, per-task results, stuck findings and escalations, pauses, final grade, costs, quota deltas, the protected-files diff and the report. Print the branch, run record and a one-line grade. Remove the worktree; keep the branch. **Never write to `main` or any other branch.**
10. **`--resume`** continues the latest run directory for that spec.

`scripts/run-plan.mjs --plan` keeps working.

Checks: V11, V12, V13, V14. Exit: all pass.

### 6.4 Stage 4: Record who built what, and document the workflow

Depends on: nothing. Outcomes: O5.

- `/docs/specs/index.md`: add **Implemented by** after Status. Vocabulary: `Grok Build`, `pi` (an interactive session), `pi pipeline`, `Claude cloud`, `—`, `unknown`; several joined with `;`; sections optional in parentheses. Values: 0001–0004 `Grok Build`; 0005 `Grok Build (§2, §5.2)`; 0006 `Grok Build (steps 0–2)`; 0007 `Claude cloud`; 0008, 0009 and this spec `pi`. Under the H1: *Implemented by is filled when a spec is implemented, from its run record.*
- `SPEC-0006`: status `implemented` in its header and the index; after its appendices, `## Landing` with *Steps 0–2 implemented. Step 3 withdrawn by Lucas on 2026-09-29 in favour of using both harnesses in production.*
- `SPEC-0008`: status `implemented` in its header and the index; H1 `SPEC-0008:`.
- **Neutrality rule**, in `validateProject` in `lib/scaffold.ts`: exempt `.agent/explain/` as generated output, as `.agent/map/` already is; and skip the rule when validating the harness's own repository, where `.pi/` paths and its name are project content rather than harness leakage. It still applies to every other project. Leave the existing entries in `.agent/` as they are.
- README, **Developing with pi**: the workflow — a spec in the current template with its `.tests/`; `bin/pi-implement <spec> --dry-run`, then `bin/pi-implement <spec>`; review the branch, run record and report; merge; `bin/pi-rework` for anything that later proves wrong. And the gates: stuck loops nudge then escalate; budgets stop; the 5-hour window pauses and resumes itself; the weekly window holds for you, released with `bin/pi-continue`; `--resume` continues a held run.

Preserve: every spec's §1–§10; every other index value.

Checks: V15, V16. Exit: all pass.

## 7. Paths

| Path | Trigger | Planned check or justified exclusion |
|---|---|---|
| three different failing commands | red-green iteration | V1 — not stuck |
| same failing call three times | a loop on an error | V1 — nudge; V5 — then escalate |
| same result four times; ping-pong | a loop without errors | V1 |
| stuck at the top of the ladder | Sol at high | V5 — stops |
| budget exhausted | runaway the detector misses | V4, V5 — stops, no retry |
| long turn, many reads, many rounds | normal work | V4 — never bounded |
| 5-hour window at 95% | quota | V3 — pause until reset plus five minutes |
| weekly window at 95% | quota | V3 — hold |
| 429 on the 5-hour window | a burst past the threshold | V3 decides; the continue message is exercised by V6's session start only indirectly — not exercised live, since it needs a real exhaustion |
| overflow compaction ending the turn | context overflow | V2 — continue |
| continues with no edit in between | overflow loop | V2 — stuck |
| threshold compaction | normal | V2 — nothing to do |
| happy pipeline run | a ready spec with Node and Python tests | V14 |
| dry run | `--dry-run` | V11 |
| spec without verification or tests | `SPEC-0007` | V12 — exit 2 |
| quota hold before start | hold file | V13 — exit 75 |
| Python tests only | a directory of `test_*.py` | V9 — never sent to Node |
| fresh worktree without `.venv` | first `uv run` | V14 |

## 8. Verification

| Outcome | Change | Check ID: falsifiable condition |
|---|---|---|
| O1 | §6.1 | V1: `stuck.test.ts` passes, 10 tests |
| O2 | §6.1 | V2: `continuation.test.ts` passes, 4 tests |
| O2 | §6.1 | V3: `quota-action.test.ts` passes, 7 tests, and the `translate-specs-with-sol` spec's protected `quota.test.ts` still passes |
| O1 | §6.1 | V4: `bounds.test.ts` passes, 3 tests |
| O1 | §6.1 | V5: `tests/bounds-split.test.ts` passes, covering stuck escalation from Luna to GPT-6 Sol at medium, no escalation at Sol high, a budget stop without retry, no escalation while held, and `PI_BUILD_RETRY=0` |
| O1, O2 | §6.1 | V6: a fresh interactive pi session starts on the Stage 1 extensions, and `./doctor.sh --offline` in it reports no failure absent from the start-revision baseline |
| O3 | §6.2 | V7: `verify-count.test.ts` passes, 5 tests |
| O3 | §6.2 | V8: `specs.test.ts` passes, 4 tests, and `tests/pi-rework.test.ts` still passes |
| O3 | §6.2 | V9: `pipeline.test.ts` passes, 6 tests |
| O3 | §6.2 | V10: the protected `plan.test.ts` still passes, and `countVerifyChecks` returns 7 for `SPEC-0008`, 13 for `SPEC-0009` and 16 for this spec |
| O4 | §6.3 | V11: `bin/pi-implement 9 --dry-run` exits 0 and prints `SPEC-0009`'s paths, 13 checks, GPT-6 Sol at high, GPT-6 Luna at medium and a Node command; no inference row is added |
| O4 | §6.3 | V12: `bin/pi-implement 7 --dry-run` exits 2 and names both blocking reasons |
| O4 | §6.3 | V13: with a hold file present, `bin/pi-implement 9 --dry-run` exits 75 |
| O4 | §6.3 | V14: **live smoke.** In a scratch worktree of `HEAD` on a scratch branch, copy `tests/fixtures/pipeline-smoke/SPEC-9001-add-smoke-double.md` and its `.tests/` into `docs/specs/`, commit, and run `bin/pi-implement 9001`. It passes the gate, runs two Luna tasks and the integration, and hands off a branch whose run record says `Implemented by: pi pipeline`, whose final grade shows both spec tests passing — one through Node, one through `uv` — and which carries `report.md`; `main` is unchanged. Record quota used, then delete the scratch worktree and both branches |
| O5 | §6.4 | V15: `index.test.ts` passes, 3 tests |
| O5 | §6.4 | V16: `./doctor.sh --offline` and `./doctor.sh --project .` exit 0 outright — the neutrality fix removes the baseline failure — and the README section exists |

You write and run the commands. **Protected** — never edit, skip or weaken to pass: this spec's `.tests/`; `tests/fixtures/pipeline-smoke/`; the `translate-specs-with-sol` spec's `plan.test.ts` and `quota.test.ts`; `tests/pi-rework.test.ts`; §1–§10 of every spec. `tests/bounds-split.test.ts` and `tests/holdout/sections-6.test.ts` change only as §6.1 states.

Invariants: no bound fires on round count, elapsed time, failure count or reads; a budget bound never retries; `countVerifyChecks` never returns 0; `bin/pi-implement` never writes to `main`; no model is called before preflight passes.

Shared checks (every stage): `./doctor.sh --offline`, **judged against the start-revision baseline**: a failure present at the start is recorded in the report, not blocking; a new one blocks. From Stage 4 on it must pass outright.
Final integrated acceptance: V1–V5, V7–V10, V15 and V16 pass together at the final commit, and V14's evidence is in the run record.
Resume baseline: `./doctor.sh --offline` before editing in any new session; record its failures as the baseline for that session's checks.

## 9. Stop conditions and repairs

If a check fails because of a local implementation error inside this scope, diagnose, fix and rerun the affected checks. Up to three repair rounds per failed check group per stage; never reset the count by restarting a session, renaming a check or repeating the same attempt. V14 is one check group: a smoke run that fails from a pipeline defect is repaired and rerun; one that fails because Luna or Sol wrote wrong code for the fixture is recorded and rerun once, and a second such failure is a stop. Stop and report instead when: a step-0 contradiction changes the design; a fresh session fails to start after Stage 1 — revert Stage 1's commit first; a seam differs from §6; a protected file seems wrong; scope would need to grow; or the same failure repeats without a new testable diagnosis. Never mark an unrun check as passed.

On a stop, change nothing further beyond the Stage 1 revert above: leave the working tree, installed versions and run record as they are, and report.

Continuation: update the run record after each stage exit and each repair round. Checkpoint is continuous, with the one restart after Stage 1. To resume, read this spec, the run record and git state, and run the resume baseline.

## 10. Report back

1. Start revision; step-0 expected against actual, including the print-mode row.
2. Per stage: each V-check's command, output, pass/fail/not-run and repair rounds; the stage's exit status.
3. Final integrated acceptance, separately.
4. O-ID → evidence; which §7 paths ran.
5. `git diff --stat`; the full diff of any protected file, which should be empty; the diffs of `tests/bounds-split.test.ts` and `tests/holdout/sections-6.test.ts`; `bin/pi-implement`, the changed runner functions, and the changed handlers in `extensions/bounds.ts` and `extensions/quota-gate.ts` with their callers; the final `/docs/specs/index.md`.
6. For V14: the smoke run's plan, per-task results, final grade, run record and quota used.
7. Deviations from §6 with reasons. The run record's path.

## 11. Landing

Filled from the review.
