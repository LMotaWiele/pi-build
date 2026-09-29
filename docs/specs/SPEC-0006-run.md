# SPEC-0006 run record

Reports moved here from `.agent/explain/` on 2026-09-29, verbatim.

## Moved from `.agent/explain/2026-09-26-spec-translation-step-0.md`

# Spec translation — step 0

Date: 2026-09-26. Step 0 of `docs/SPEC-spec-translation.md` is installed. Steps 1–3 have not started.

## Usage

One usage GET, during the held Luna prompt. That run made no model call.

| Window | Slot | Duration (seconds) | Used | Resets (local) |
|---|---|---|---|---|
| 5h | primary | 18000 | 66% | 2026-09-26 17:10:52 |
| weekly | secondary | 604800 | 66% | 2026-09-28 23:20:35 |

The weekly threshold stays 95 in both host settings. Measured weekly use is 66%, twenty-nine points under that line. The threshold leaves five points before a window is exhausted.

The 5-hour setting stays 95. The live check set `PI_BUILD_QUOTA_5H=1` only in an isolated environment. The per-user hold file and override file were absent and were left untouched.

## Live check

Headless Luna (`openai-codex/gpt-5.6-luna`, thinking `minimal`), flags before the prompt, one-word prompt `ping`.

- Exit 75.
- Hold reason `5h`, soft, set at 2026-09-26T13:50:45.756Z.
- Windows as in the table above.
- Inference rows: 0.

`bin/pi-continue --yes` cleared that hold and suspended the 5-hour threshold until 2026-09-26 17:10:52 local. The next one-word prompt, `pong`, exited 0. Its inference model was `gpt-5.6-luna`. Catalog cost of that call was $0.0015. The isolated override is what let it proceed while the environment threshold stayed at 1.

The live token carried `https://api.openai.com/auth` → `chatgpt_account_id`. That matches the claim path in the installed coding agent 0.87.0.

## Verified shapes

The notes index holds the row. Package: `@earendil-works/pi-coding-agent` 0.87.0.

No row in the spec's fallback table was used. `after_provider_response` includes `status` and `headers`. `hasUI` is false in print mode, and the held run took the headless path. `message_end` and `before_agent_start` are awaited. `getApiKeyForProvider` returned a token, and the usage GET succeeded.

`agent_end` carries messages and no error object. The gate joins the preceding response status to the assistant `errorMessage`.

Print mode assigns its own exit code on the way out and would replace a stored code of 75. A headless hold calls `process.exit(75)` from `before_agent_start` (after `session_start` has polled), and from `message_end` and `agent_end`. The held run exited 75.

## Tooling

In place, and covered by the uneditable tests: `lib/quota.ts`, `lib/plan.ts`, `lib/conformance.ts`, the difficulty and quality batteries, `scripts/pi-continue.ts`, and `bin/pi-continue`. The gate wiring, the bounds hold check, both host `quotaGate` blocks, and `scripts/run-plan.mjs` are in the tree. The runner parses and refuses to start without a plan. It has not executed a plan.

`quota.test.ts`, `plan.test.ts`, `conformance.test.ts`, and `batteries.test.ts` passed. The bounds hold test and the retry-disabled test passed. `./doctor.sh --offline` and `./doctor.sh --project .` both exited 0 after the notes update.

## Not started

`docs/SPEC-production-config.md` is not in the repository, and it has no tests directory. Step 1 waits on those author-supplied tests. No Sol session and no Luna plan ran.

## Grok cost

This session has no `usage.json`, so `costUsdTicks / 1e10` cannot be computed. The Codex side of the check is the usage GET above plus one Luna call at $0.0015 catalog.

## Moved from `.agent/explain/2026-09-26-translation-step-1.md`

# Translation step 1

The plan gate passed on 2026-09-26.

Codex usage moved from 5% to 15% on the 5-hour window and from 66% to 68% on the weekly window. No hold was present before or after. The successful planning session spent $1.59 of catalog cost across 29 inferences, all on the Sol pin. This executor session has no usage ledger, so no executor dollar figure is recorded.

The first resume stopped after six reads and no edits. The retry left the host settings file unchanged and pointed the process at a copy whose read budget was 40. That session exited 0. It wrote the two missing command tests and clarified two briefs. It did not create the implementation files.

Checks at this tree: plan validation is ok for six verify items; undeclared imports are empty on all four plan tests; all four tests fail because the implementation files are absent.

The plan commit is 1655918. The first attempt to run it stopped before any model call: the runner treated the section heading number as a verify item and asked for items 7 and 8. The list has six items, which is what the plan maps. That count is fixed in 2171462. The run itself is recorded in the step 2 report. Step 3 has not started.

## Moved from `.agent/explain/2026-09-26-translation-step-2.md`

# Translation step 2

Graded on 2026-09-26. The run exited 0. No hold occurred. Step 3 has not started.

Codex usage for this step moved from 15% to 27% on the 5-hour window and from 68% to 70% on the weekly window. From the start of the planning retry to the end of this run, the windows moved from 5% to 27% and from 66% to 70%. This executor session has no usage ledger, so no executor dollar figure is recorded.

The worktree is `/home/george-contis/var/pipeline-runs/production-config/step2/work`, branched from `2171462`. It is not merged to the main branch.

| Task | Assignee | Acceptance | Model | Rounds | Catalog cost | Wall | Sol edited the task file |
|---|---|---|---|---|---|---|---|
| T1 | Luna | pass | gpt-5.6-luna | 9 | $0.007 | 65s | no |
| T4 | Luna | pass | gpt-5.6-luna | 7 | $0.008 | 66s | no |
| T5 | Luna | pass | gpt-5.6-luna | 11 | $0.011 | 74s | no |
| T6 | Luna | pass | gpt-5.6-luna | 9 | $0.007 | 63s | no |

Luna's first-try rate is 4 of 4. Sol kept every Luna file. During integration Sol wrote the two tasks assigned to Sol: the bounds extension and the bounds split test. The integration session's own inferences were 33 calls on gpt-5.6-sol, catalog $1.63, wall 805s. Its first inference was that Sol pin. Twenty-two child inferences on gpt-5.6-luna cost $0.04. The user rework log gained two rows, for T2 and T3, describing corrections made inside that same integration session. Protected spec tests and plan tests were not edited.

Plan acceptance tests: 12 passed, 0 failed. There is no root tsconfig, so the typecheck step recorded no compiler run.

The runner's own spec-test grade failed in 23ms because it passed the tests directory through as a module. Re-running the two spec test files in the same worktree passed 14 of 14. That invocation is what the grade should have been. No assertion in those files failed.

Anchored battery accuracy, answer against the script anchor, four tasks:

| Question | Matches |
|---|---|
| D1 | 2/4 |
| D6 | 4/4 |
| D9 | 4/4 |
| D10 | 1/4 |
| D11 | 4/4 |
| Q8 | 4/4 |
| Q10 | 4/4 |

The misses are D1 on T5 and T6, and D10 on T1, T4, and T5. Every task was a first-try pass, none was rewritten by Sol, and no spec-test failure traces to a task. No cell has five tasks, so nothing is a candidate signal.

Interventions. The planning retry used a process-local read budget of 40 after a six-read stop; the host settings file was not changed. The first launch of this run stopped before a model call because the section heading was counted as a verify item; `2171462` counts the list instead. The spec-test grade above was re-run by hand after the directory invocation failed.
