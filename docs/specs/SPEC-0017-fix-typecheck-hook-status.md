File: /docs/specs/SPEC-0017-fix-typecheck-hook-status.md
# SPEC-0017: Report the typecheck hook's real compiler status

| Field | Value |
|---|---|
| Status | implemented |
| Size | M |
| Kind | fix |
| Parent | — |
| Date | 2026-10-06 |

Assign the next free SPEC ID in `/docs/specs/` and rename this file accordingly; don't reuse an ID.

Read `/.agents/notes/index.md` if present. Record the revision you start from and any pre-existing uncommitted changes; don't fold unrelated work into this change.

## 1. Intent
`post-edit-typecheck.ts` runs the equivalent of `cd ${dir} && npx tsc --noEmit --pretty 2>&1 | tail -30`. Without `pipefail`, the shell reports `tail`'s exit status, so a failing compile produces exit code 0. An external review confirmed this with a simulated compiler that printed an error and exited with code 2: the hook reported "Types OK". Two related defects come along with it. The unquoted `cd ${dir}` breaks on paths containing spaces. And the pending flag is cleared before the debounce check, so a requested check can be discarded.

Agreed decisions: run the compiler directly with an argument array (no shell), keep its exit status, truncate output after capture, and never discard a requested check.

- O1: The hook reports success only when the compiler exits with code 0.
- O2: A nonzero compiler exit is reported as type errors, with captured output truncated to the same length the hook uses today (last 30 lines).
- O3: When the compiler can't run (binary not found, spawn error, killed by a signal or timeout), the hook reports a distinct "check did not run" status with the reason. It never reports success, and it never downloads or installs a package to run the check.
- O4: Project directories whose paths contain spaces or shell metacharacters are checked correctly.
- O5: No requested check is lost. After the last edit in a burst, at least one check starts after that edit. An edit made while a check is running causes exactly one follow-up check.

## 2. Priority
This is the second live correctness bug. The hook tells the model, and the user, that types are fine when they aren't, which makes agents stop or move on with broken code. Deferred: everything else from the 2026-09-30 review.

## 3. Prior art
N/A — this is a local fix. Spawning with an argument array instead of a shell string, and using a trailing debounce with a "dirty" flag to rerun, are standard patterns.

## 4. Grounding
| Fact | Expected | Tag | Source |
|---|---|---|---|
| Hook location | `post-edit-typecheck.ts` | in-context | review of commit 1e32e3c |
| Command | `npx tsc --noEmit --pretty 2>&1 \| tail -30` run through a shell after an unquoted `cd ${dir}` | in-context | review of 1e32e3c |
| Pending flag cleared before the debounce check | yes | in-context | review of 1e32e3c |
| How `dir` is chosen (for example, the nearest `tsconfig.json`) and behavior when none exists | unknown | agent-verify | source |
| Existing timeout on the compiler run | unknown | agent-verify | source |
| Debounce window and which tools or events trigger a check | unknown | agent-verify | source |
| Where the status goes (message to the model, UI status, both) and the exact wording consumers depend on | unknown | agent-verify | source |
| Existing hook tests | unknown | agent-verify | repo |
| How the live Pi session loads this extension | unknown | agent-verify | Pi settings, installer |
| Pre-existing failing tests at start | review saw 8 failing, 1 skipped | agent-verify | run the suite |

Step 0: before editing, verify every row that describes repo or environment state (whatever its tag) and report expected vs actual. If a contradiction changes the design, outcomes, scope or verification, stop and report. Otherwise record it and continue.

## 5. Scope
In: compiler invocation, status classification, output truncation, debounce and pending logic, a test seam for the compiler command, tests. Out: the read guard (separate spec), what triggers a check, tsconfig discovery rules, adding a timeout if none exists today (report its absence instead).

## 6. Changes
### 6.1 Direct compiler invocation
Outcomes: O1, O2, O3, O4. Where: `post-edit-typecheck.ts`; agent confirms.
Change: resolve the project's own TypeScript compiler binary (the `node_modules/.bin/tsc` reachable from `dir`, following the resolution Node and npm use). Spawn it with an argument array, `cwd: dir`, and no shell. Capture stdout and stderr together, and keep the exit code and termination signal. Classify the result as:
- `ok`: exit code 0
- `errors`: nonzero exit
- `did-not-run`: binary not found, spawn error, signal, or timeout

Truncate the captured output only after the process has finished. Make the compiler command injectable (a parameter or an environment variable read only in tests) so tests can substitute a stub compiler.
Preserve: the success and error message wording that downstream consumers depend on, the `--noEmit --pretty` flags, any existing timeout value, and the behavior when no tsconfig exists.
Seams: hook → child process → status consumer. `did-not-run` must be distinguishable from both `ok` and `errors` wherever the status is shown.

### 6.2 Debounce without lost requests
Outcomes: O5. Where: the hook's pending and debounce logic; agent confirms.
Change: a request sets pending. Pending is cleared only when a check actually starts. If a request arrives while a check is running, mark the hook dirty and start one more check when the current one finishes; any number of requests during one run produce one follow-up.
Preserve: the debounce window and what triggers it.

### 6.3 Activation in the live build
Report exactly what the user must do for the running Pi to pick up this change. If it requires the installer or changing global configuration outside this repository, report the command and do not run it.

## 7. Paths
| Path | Trigger | Planned check or justified exclusion |
|---|---|---|
| happy | stub compiler exits 0 | V1 |
| type errors | stub prints an error and exits 2 | V2 |
| long output | stub prints 200 lines and exits 1 | V3 |
| compiler missing | no resolvable binary | V4 |
| spawn failure / signal | stub killed by a signal, or a path that isn't executable | V5 |
| timeout | stub sleeps past the existing timeout | V6, or not exercised if no timeout exists (report that) |
| path with spaces | project directory named `with space/` | V7 |
| burst of edits | 5 requests within the debounce window | V8 |
| edit during running check | request while the stub is running | V9 |
| no tsconfig | edit in a directory without one | V10 (existing behavior preserved) |

## 8. Verification
| Outcome | Change | Check ID: falsifiable condition |
|---|---|---|
| O1 | §6.1 | V1: status is `ok` |
| O2 | §6.1 | V2: status is `errors`, never `ok`. **Run V2 against the start revision first and record that it reports success there.** |
| O2 | §6.1 | V3: status is `errors`; output is truncated to the existing limit; the exit code was preserved |
| O3 | §6.1 | V4: status is `did-not-run` with a reason; no network or package install was attempted |
| O3 | §6.1 | V5: status is `did-not-run` |
| O3 | §6.1 | V6: status is `did-not-run` |
| O4 | §6.1 | V7: the check runs in the correct directory and reports the stub's real status |
| O5 | §6.2 | V8: at least one check starts after the last request, and at most one check runs per debounce window |
| O5 | §6.2 | V9: exactly one follow-up check runs after the current one finishes |
| — | §6.1 | V10: behavior matches the start revision |

Use fake timers for V8 and V9. You write and run the commands. Protected (never edit, skip or weaken to pass): all existing tests. Baseline: record the set of failing tests at the start revision; the set must not grow.

Invariants: across any sequence of requests and compiler completions, the hook never ends idle with an unserved request, and never reports `ok` for a nonzero exit or a run that did not complete.

## 9. Stop conditions and repairs
If a check fails because of a local implementation error inside this scope, diagnose, fix, rerun the affected checks. Up to three repair rounds per failed check group. Stop and report instead when: a step-0 contradiction changes the design; a seam differs from §6; scope would need to grow; a protected file seems wrong; an external prerequisite is missing; or the same failure repeats without a new testable diagnosis. Never mark an unrun check as passed.

When all checks pass, commit on the current branch with the spec ID in the message. Do not push.

## 10. Report back
1. Start revision; step-0 expected vs actual.
2. Each V-check: command, output, pass/fail/not-run, repair rounds used. Include V2's output at the start revision.
3. O-ID → evidence; which §7 paths actually ran.
4. `git diff --stat` for the whole change, full diff of any protected file (should be empty), and the complete changed functions with their callers.
5. Failing-test set at start vs at end.
6. Whether a timeout exists, and its value.
7. Activation: what the user must do for the live Pi to load the change.
8. Deviations from §6 with reasons; anything the spec didn't anticipate.

## 11. Landing
Filled from the review.
