# SPEC — drift diagnosis, audit fixes, monolithic vs delegated measurement, conditional completion

**Place this file at the repository root of `pi-build`. Do not create a new top-level directory for it.**

**Status:** open
**Applies to:** `pi-build` @ `@earendil-works/pi-coding-agent` 0.87.0
**Executor:** Grok Build
**Written:** 2026-09-22

---

## 0. How to run this spec

Read this section before anything else.

### 0.1 You are Grok Build. Pi is the instrument.

You implement this spec by editing this repository and by running `pi` as a subprocess. Those are different activities and must not be substituted for each other.

| Section | What you do |
|---|---|
| §1 | Run diagnostic commands, transcribe output, report. Do not edit config to "fix" what you find. |
| §2, §3 | Edit this repository. |
| §4, §5 | Start `pi` sessions, reset the fixture between them, read `telemetry.db`. |
| §6 | Edit this repository, down exactly one branch. |

**Do not predict pi's behaviour by reading `extensions/`.** Where this spec says run, run it and transcribe the output. The harness's behaviour under load has never been measured on this machine; a model that reads the source and infers the answer reproduces the exact error this spec exists to correct.

**You do not have pi's tools.** `queue_append`, `note_open`, `note_update`, and `explain_write` are registered by the `memory-gate` extension inside a pi session. Where this spec says `queue_append`, you edit `.agent/notes/INDEX.md` directly and must match the row format `appendQueue` emits: a pipe-table row under `## Active next`, numbered one past the current last row, with a `Source` and an ISO date. `./doctor.sh --project .` validates the result and must exit 0 after any such edit. Code that *calls* `queue_append` — §3.1's change inside `fireBound` — is pi calling its own tool at runtime and is unaffected.

### 0.2 Cost, in the corrected unit

The reference session for this repository cost **≈ $32.50** — `costUsdTicks 325,012,927,600 ÷ 1e10`, not `÷ 1e9`. `.agent/notes/INDEX.md` row 3 states the 1e9 divisor and is wrong by an order of magnitude. §2.0 corrects it. Every per-turn figure derived from that row is 10x high.

Corrected reference, for calibration:

| Turn | Work | Model calls | Cost |
|---|---|---|---|
| 1 | Build the v0.1 harness | 184 | $14.78 |
| 2 | MIT license and OSS README | 51 | $3.60 |
| 3 | Decouple models, apply closeout spec | 127 | $12.16 |
| 4–7 | Four short questions | 36 | $1.97 |

398 calls, 46,998,477 input tokens, 88% of them cache reads, 446,464 output tokens.

**One tripwire for the whole run: $25 or 250 model calls.** If the run passes either before reaching §5, stop and report what is committed. Below that, do not stop to ask. The reference build was 398 calls and $32.50 for more work than this spec contains.

### 0.3 Turns

**Two turns. Commit as you go; do not stop to report between sections.**

| Turn | Prompt | Covers |
|---|---|---|
| 1 | `Apply SPEC-delegation-ab.md §1 through §6.` | Diagnosis, all fixes, the six trials, and the winning branch — unless §6 lands on `NEITHER` or `INCONCLUSIVE`, which stop. |
| 2 | Only if turn 1 stopped. | Whatever §6.C or §6.D left open. |

Commit after §2, after §3 (tagged `ab-baseline`), and after §6. Those are `git commit` calls inside the turn, not places to hand back.

**Two things do stop the turn, and only two:**

1. **§6 lands on `NEITHER` or `INCONCLUSIVE`.** The next action is a human decision and the thresholds exist precisely so that an agent cannot argue past them.
2. **The §0.2 tripwire fires.**

Everything else — a failed assertion, a void trial, a branch in §1.2 or §2.3 — is handled by a conditional written into the section itself. Follow it and keep going.

Stay in one session. The reference session ran 88% cache reads, which is what held 47M input tokens to $32.50; a fresh session re-pays the prefix cold.

### 0.4 Do not

- Raise `maxLoopDepth`, `maxTurnWallClockMs`, `noProgressReads`, or `maxConsecutiveToolFailures` to make a pi trial finish. A bound firing is data.
- Change `routing.tiers` except where §1.4 and §6 instruct.
- Edit the §4 fixture between trials or between arms.
- Re-tune the §6 thresholds after seeing any result.
- Delete or amend trial rows from `telemetry.db`, including failed trials.
- Begin §4 before §3 exits green.
- Decide §6 by argument. The branch is arithmetic on recorded rows, or it is `INCONCLUSIVE`.

---

## 1. Diagnosis (no edits in this stage)

Three things are known to be inconsistent. Each has a mechanical answer available from the machine. Find it; do not reason to it.

### 1.1 Why the turn escalated to Sol — settled 2026-09-22

**Finding: an uncommitted working-tree edit.**

`~/.pi/agent/settings.json` is intact as the symlink `install.sh` created, pointing at `settings/hosts/machina.json` **in the working tree**. Pi therefore loads the working copy, not HEAD. The only commit touching that file, `26a3137`, maps `escalate` to `openai/gpt-5.6-terra`. The working copy maps it to `openai-codex/gpt-5.6-sol`, retargeted after Codex login verified Sol, and never committed.

Nothing misrouted. `"Reply with the single word OK"` is neither a single-file edit nor spec'd, so `selectTier` returned `escalate`; `setModel` then took whatever id the loaded file assigned to that tier. Terra is both `work` and `defaultModel` in the commit and in the working copy, and the router does not stay on the default once it has picked a tier. Tier name and model id are independent choices, and only the id had drifted.

Ruled out: the fallback chain (escalate → work → scout cannot produce Sol from either version of the file); a replaced settings file (the symlink is intact); a false model string in the cost line (it matches the loaded mapping).

**Two consequences, both load-bearing.**

**1. Commit the retarget.** The config that runs is untracked. Commit `settings/hosts/machina.json`, then reconcile INDEX: row 16 describes the temporary Terra mapping and is now stale, while row 20 records the Sol retarget. Correct row 16 or delete it — do not leave both standing. Row 13 (`credentials_not_configured`) is likewise superseded by the verified login; supersede it in place rather than appending a third row about the same fact.

**2. Pi reads the working tree.** This is the finding that matters beyond the drift. Every pi run in §4 loads whatever is uncommitted at that moment, and `reset.sh` restores only the fixture. Six trials run against a dirty host file measure six slightly different harnesses, with nothing in the output to say so. §4.4 makes a clean tree a mandatory pre-trial assertion.

### 1.2 What does `usage.cost.total` mean for a Codex OAuth provider?

The probe's arithmetic is exact on a $5/M input card: `8,749 × 5/1e6 + 5 × 30/1e6 = $0.0439`. That is pi's built-in Sol card. But the call reached `chatgpt.com/backend-api` and drew subscription usage, and INDEX row 3 claims a promo card of 4 / 0.40 / 20 while instructing *leave Sol without a dollar override* — which is why `agent/models.json` carries only `contextWindow` and `promptCache` for `gpt-5.6-sol`.

So three things can be true of the printed number and only one is: it is a catalog estimate at list price, it is a catalog estimate at promo price, or it is something the provider reported.

Determine it. Run the same minimal prompt twice, once per tier, and compare the printed cost against hand arithmetic:

```bash
PI_BUILD_TELEMETRY_DB=/tmp/pi-card-probe.db pi -p "Reply OK." --model openai/gpt-5.6-terra --thinking off --no-session
PI_BUILD_TELEMETRY_DB=/tmp/pi-card-probe.db pi -p "Reply OK." --model openai-codex/gpt-5.6-sol --thinking off --no-session
```

For each: record `prompt_tokens`, `cached_tokens`, `completion_tokens`, `cost_usd`, and solve for the implied input rate. Report which card each tier is being priced on, and whether the Sol figure matches 5 / 0.50 / 30, 4 / 0.40 / 20, or neither.

If the Sol figure matches neither, that is the finding: **the cost line is not a catalog estimate for this provider**, every §5 dollar figure is uninterpretable, and §5 must be evaluated on token counts alone. Say so plainly rather than picking the nearest card.

### 1.3 Reconcile the tick divisor

`costUsdTicks 325,012,927,600` is ≈ $32.50, so the divisor is 1e10. INDEX row 3 says 1e9 and cites a "$13.02 session", which under the correct divisor was $1.30. Confirm against the raw `usage.json` if it is still on disk; if it is not, record that the confirmation rests on the €32 figure alone. §2.0 writes the correction.

### 1.4 Assertions, then continue

Write §1.1's finding, §1.2's result, and §1.3's confirmation to `.agent/explain/2026-09-22-diagnosis.md`, then continue to §2. This is not a handback: §1.1 is settled and §1.2 is a probe you run yourself.

Assert the following before §4 runs. If one fails, fix it and carry on — do not report and stop.

1. `git diff --quiet -- settings/hosts/machina.json` exits 0, so the retarget is committed. §1.1 consequence 1.
2. INDEX rows 13 and 16 no longer contradict row 20.
3. The diagnosis file states what the cost line means for `openai-codex/gpt-5.6-sol`, per §1.2.
4. `./doctor.sh --offline` and `./doctor.sh --project .` both exit 0.

---

## 2. Fixes the measurement depends on

These change what `telemetry.db` records and when a turn dies. Without them §5 measures the instrument rather than the architecture.

### 2.0 Correct the tick divisor in INDEX

Edit `.agent/notes/INDEX.md` row 3: `costUsdTicks / 1e9` becomes `costUsdTicks / 1e10`, and the "$13.02 session" becomes "$1.30". Append one queue row, in `appendQueue` format, recording that every cost figure in the 2026-09-21 review is 10x high.

Any `$` figure a future session reads from that row is otherwise wrong by an order of magnitude, including the thresholds in §6.

### 2.1 Deduped reads must not consume progress budget

`lib/telemetry.ts`, in the `tool_result` handler:

```ts
noteToolOutcome(outcome === "error", name === "read" && outcome !== "blocked", name === "edit" || name === "write");
```

A read suppressed by `read-guard` arrives with `outcome === "deduped"` and still increments `turn.reads`. Read-guard therefore saves tokens and zero bound headroom, and the no-progress bound fires on turns that are not re-reading anything.

```ts
const countsAsRead = name === "read" && outcome !== "blocked" && outcome !== "deduped";
```

Add to `tests/read-guard.test.ts`: a deduped read does not move `reads`; a passed read does.

### 2.2 Pin the progress tool names against the installed package

`countsAsEdit` is `name === "edit" || name === "write"`. If pi 0.87.0 exposes any other write path, `turn.edits` stays 0 for the whole turn and `boundReason` aborts a turn that is shipping files.

Add a test to `tests/interop.test.ts` reading the installed package's registered tool names and asserting that every tool capable of mutating a file on disk is in `{edit, write}`. If it fails, widen the predicate to the observed set in the same commit — do not widen speculatively. Record the observed tool-name list in INDEX.

### 2.3 Attribute subagent inference to the parent turn

INDEX row 12: *a mjakl subagent session has its own message list … its own multi-call cache was not measured on this machine.* §5 cannot be computed unless a child's `inference_calls` rows are attributable to the parent turn that spawned them.

Determine empirically whether child rows land in `telemetry.db` at all. Run a pi session with a prompt that provably dispatches a subagent:

```bash
PI_BUILD_TELEMETRY_DB=/tmp/ab-probe.db pi --subagent-max-depth 2
```

```sql
SELECT session_id, COUNT(*), SUM(prompt_tokens), SUM(cached_tokens), SUM(cost_usd)
FROM inference_calls GROUP BY session_id;
```

- **Two or more `session_id` values:** children are instrumented. Add correlation. Export `PI_BUILD_PARENT_TURN` from the parent before dispatch, read it in `attachTelemetry`, store it as a nullable `parent_turn_id` on `tool_calls` and `inference_calls`. A `CREATE TABLE IF NOT EXISTS` plus an `ALTER TABLE … ADD COLUMN` guarded by a `PRAGMA table_info` check keeps existing databases readable.
- **One `session_id`:** children are not instrumented, §5 cannot be computed from `telemetry.db`, and arm B must be measured from the child processes' stdout. Record this in INDEX and say so in the §5 report. Do not fabricate the missing rows.

Add `scripts/report-ab.sql` producing one row per `(parent_turn_id, arm, trial)` with the seven §5.2 metrics.

Commit and continue.

---

## 3. Fixes that change behaviour under test

### 3.1 Checkpoint on abort

`extensions/routing.ts`, `fireBound`, records a telemetry row, appends a `pi-build-bound` entry, logs, and calls `ctx.abort()`. The partial tree survives; the knowledge of where the turn got to does not. The next prompt starts from a cleared `filesWritten` and an empty recap.

Before `ctx.abort()`, and only when `turnSnapshot().edits > 0`:

1. `queue_append` one row: `bounded at <reason>; wrote <writtenFiles().join(", ")>; resume from <first unwritten path named in the open note, or "(unknown)">`, source `SPEC-delegation-ab §3.1`.
2. `setLastRecap` with the same line, so `orientationBlock` carries it into the next turn's cached prefix.

When `edits === 0` the turn produced nothing to resume from — log and abort as now, no queue row. A queue that accumulates empty bound rows is a log, which INDEX forbids.

Failure of either write must not prevent `ctx.abort()`. Wrap both, log on failure, continue.

Test: `edits > 0` produces exactly one queue row and a non-empty recap; `edits === 0` produces neither; a throwing `queue_append` still reaches `ctx.abort()`.

### 3.2 Explain must not fire on an aborted turn

`extensions/explain.ts` gates on `shouldExplain(writtenFiles())` at `agent_end`, which also fires after abort. A bounded turn currently spawns a 180-second read-only subprocess to narrate a half-finished edit.

`if (!shouldExplain(files) || sawRunAborted()) return;`. Add the case to the explain-gate test.

### 3.3 Feed the decision real state

`before_agent_start` builds the Jev state with `loopIndex: 0, tools: [], filesWritten: [], filesRead: [], lastToolResult: ""`, and `getOpenNote()` is null because `beginUserTurn` has just cleared it. `spec_exists` ("the prompt or state names a spec, ADR, or design doc") and `unfamiliar_stack` ("a language the state does not already show as known") are being asked of a state that cannot contain the answer. This is the mechanism behind universal escalation, not the strictness of the gate.

Supply, at decision time only, with no extra model call:

- `indexRow`: the top `Active next` row text, not just the open note's topic.
- `filesRead`: `git status --porcelain`, truncated to 40 lines.
- `lastToolResult`: `.agent/explain/known.md`, capped at the existing 500-token budget. It is the only thing in the tree that can make `unfamiliar_stack` answerable as false.

`buildState`'s drop order sheds these first under budget pressure, so the 4,000-token ceiling still holds.

**Do not change `selectTier` here.** Whether the conjunction needs loosening is what §5 answers; moving the map and the state together makes the measurement uninterpretable.

### 3.4 Wire or delete the dead settings

`routing.stateBudgetTokens` is never read — `buildState(ctx, budgetTokens = 4000)` is called with one argument. `routing.defaultOnUncertain` is never read — the behaviour is hardcoded in `ESCALATE_DEFAULTS`.

Wire `stateBudgetTokens` through as the second argument. Either wire `defaultOnUncertain` (`"escalate"` → current `ESCALATE_DEFAULTS`, `"work"` → its inverse) or delete the key from both host files. Do not leave it present and inert.

Add to `doctor.sh --offline`: every key in `settings/hosts/example.json` appears as a string literal under `extensions/` or `lib/`. Fail with the unread key name.

### 3.5 Stop the cached prefix from lying

`agent/AGENTS.md` §Models states *Escalation is a subagent with its own context* and names `openai-codex/gpt-5.6-sol` for escalate.

Half of that is now true. Per §1.1 the working copy does route escalate to Sol, so the id is right — it was the committed host file that was stale, not the prose. The subagent claim is still false: routing calls `setModel` on the session and spawns nothing. So the model is told one false thing about its own execution environment on every cached turn, and one true thing that is true only by coincidence of the drift.

Both are the same defect: a hand-maintained copy of the tier map inside the cached prefix.

Replace §Models with a description of session-level `setModel`, and remove the hardcoded ids. Inject the resolved map from `plan.tiers` at `session_start` as a prompt section so the prefix cannot drift from the host file again.

**Do not** describe delegation here. §6 decides whether that sentence becomes true.

Commit, tag `ab-baseline`, confirm `./doctor.sh --offline` exits 0, and continue straight into §4.

---

## 4. The measurement

### 4.1 What is being compared

Both arms run the **same task, same prompt text, same starting tree**, differing only in whether the work happens in the parent's context or in children.

- **Arm A, monolithic.** `pi --subagent-max-depth 0`.
- **Arm B, delegated.** `pi --subagent-max-depth 2`, plus a dispatch instruction in the prompt.

Arm B uses the **already-pinned `pi-subagent` package and a prompt-level instruction only. Do not build a routing seam for delegation in this spec.** Whether that seam is worth writing is what §6 decides; writing it first is the decision the measurement exists to make.

### 4.2 The fixture

Create `tests/fixtures/ab/`:

- 6 TypeScript source files with real interdependence — a change to a shared type must propagate to at least 4 of them.
- `SPEC.md`: an unambiguous, fully specified change requiring edits in all 6. No design decisions left open. This is deliberately the easy case for the router: spec exists, change is reversible, stack is familiar.
- A deterministic gate: `tsc --noEmit` clean and `node --test` green from the fixture root.
- `reset.sh`: restores the fixture from git.

Checked in. Not edited between trials or arms.

### 4.3 The two prompts, verbatim

**Arm A:**

```
Apply tests/fixtures/ab/SPEC.md in full. Do not dispatch subagents.
```

**Arm B:**

```
Apply tests/fixtures/ab/SPEC.md in full. Dispatch one subagent per file named in the spec; give each child the spec section and the file path only. Do not read those files in this session.
```

### 4.4 Protocol

6 runs: **A, B, A, B, A, B**.

Before each trial, in this order:

```bash
bash tests/fixtures/ab/reset.sh
git diff --quiet -- settings/hosts/machina.json agent/models.json agent/AGENTS.md || exit 1
git status --porcelain            # clean apart from the fixture reset
readlink -f ~/.pi/agent/settings.json   # must resolve inside this repo
git rev-parse HEAD                      # record per trial
```

The `git diff --quiet` line is not ceremony. Per §1.1, pi loads `settings/hosts/machina.json` from the working tree, so an uncommitted edit to the host file, the model overrides, or the cached prefix changes the harness under measurement with nothing in the trial output to reveal it. A trial that starts dirty is void, not noisy.

Controls, all mandatory:

- Record `HEAD` per trial. All six must share one commit.
- `cacheWarming` stays `off`. With a 1800s TTL the gap between runs changes the result; record `gap_since_previous_run_s` per trial.
- One session per trial. No session reuse.
- No trial is retried. A crashed or aborted trial is recorded as-is with its bound reason.
- Record wall-clock start per trial.

Arm B's children have **no bounds** — `maxLoopDepth`, `maxTurnWallClockMs`, and the no-progress check live in the parent process and do not cross the `execFile` boundary, as `explain.ts` already demonstrates with its bare 180-second timeout. If a child hangs, kill it and record the trial as failed with reason `child unbounded`. That is a cost of arm B, not noise.

---

## 5. Metrics and report

### 5.1 Source

`telemetry.db` via `scripts/report-ab.sql`, parent and child joined on `parent_turn_id` if §2.3 found child instrumentation; otherwise arm B's child figures come from stdout and are flagged as such in every table.

### 5.2 Per trial

| Metric | Definition |
|---|---|
| `completed` | §4.2 gate passes and no bound fired. Boolean. |
| `bound_reason` | The `boundReason` string, or null. |
| `total_prompt_tokens` | `SUM(prompt_tokens)` across parent and children. |
| `cache_read_share` | `SUM(cached_tokens) / SUM(prompt_tokens)`. |
| `total_completion_tokens` | `SUM(completion_tokens)` across parent and children. |
| `total_cost_usd` | `SUM(cost_usd)`, carrying the §1.2 finding. Omitted entirely if §1.2 concluded the cost line is uninterpretable for this provider. |
| `wall_clock_s` | Trial start to gate result. |
| `peak_parent_prompt_tokens` | `MAX(prompt_tokens)` on parent rows only. The window-pressure metric, and the one delegation is supposed to move. |

### 5.3 Report

`.agent/explain/2026-09-22-ab-results.md`: the 6 trial rows, per-arm median and range, and the §6 verdict with the arithmetic shown. Table before summary. Failed trials included.

---

## 6. Pre-committed branch

Evaluate in order. First match decides. **Fixed before any trial ran; not revisited.**

| # | If | Then |
|---|---|---|
| 1 | Neither arm completes in ≥ 2 of 3 | `NEITHER` |
| 2 | Arm B completes ≥ 2 of 3 and arm A ≤ 1 | `DELEGATED` |
| 3 | Arm A completes ≥ 2 of 3 and arm B ≤ 1 | `MONOLITHIC` |
| 4 | Both ≥ 2 of 3, median B `total_prompt_tokens` ≤ 0.75 × median A, and median B `total_cost_usd` ≤ median A | `DELEGATED` |
| 5 | Both ≥ 2 of 3, and median A `total_cost_usd` ≤ 0.75 × median B | `MONOLITHIC` |
| 6 | Anything else | `INCONCLUSIVE` |

If §1.2 found `total_cost_usd` uninterpretable, rules 4 and 5 are evaluated on `total_prompt_tokens` alone, with the substitution stated in the report.

Median `peak_parent_prompt_tokens` is reported in every case and decides nothing. It is the mechanism behind rules 2 and 4; if it did not move, say so, because that means arm B's children were not taking the context.

### 6.A If DELEGATED

1. Add a dispatch seam to `extensions/routing.ts`: `escalate` spawns a file-scoped child via the pinned `pi-subagent`, parent stays on the `work` model holding the spec and the open note, child returns a diff.
2. Give children bounds, reusing the `explain.ts` `execFileAsync` pattern: wall-clock timeout, maximum child count per turn, child failure counted toward the parent's `maxConsecutiveToolFailures`. A child with no bound is not shippable.
3. Update `agent/AGENTS.md` §Models — the subagent sentence becomes true, written to describe the seam as built.
4. Move the note/queue mechanics and the post-edit validation summary to `scout`, giving Luna a job it can hold.
5. Close INDEX row 12 with the measured child cache figure.

### 6.B If MONOLITHIC

1. Invert the router default: `work` by default, `escalate` on genuine uncertainty. Loosen `selectTier` by dropping `single_file_edit` from the conjunction — `spec_exists && reversible && !unfamiliar_stack && !needs_repo_reasoning` → `work`.
2. Add retry-on-bound: when `fireBound` trips with `edits > 0`, re-dispatch at `escalate` with the §3.1 checkpoint as the prompt. The cascade at turn granularity, reusing §3.1 rather than adding a mechanism.
3. Replace `maxLoopDepth` as the primary control with `maxTurnPromptTokens` and `maxTurnCostUsd` in `BoundConfig` and `boundReason`, computed from the turn usage already in the telemetry bag. Keep 60 as a backstop.
4. Close INDEX row 12 with the measured child cache figure and the reason delegation was not adopted.

### 6.C If NEITHER

Both arms failing is not a tie. It is the finding that the harness cannot complete a spec'd multi-file change in either architecture, which makes the bounds the subject and the architecture moot.

1. Report which bound fired in each of the 6 trials. If one bound dominates, name it.
2. Apply 6.B steps 2 and 3 — checkpoint retry and budget-shaped bounds — and nothing else.
3. Do **not** touch `selectTier` or build a delegation seam. The measurement did not discriminate between them.
4. Re-run §4 after those land, as a new stage, once.

### 6.D If INCONCLUSIVE

Do **not** pick. Do **not** run more trials to break the tie in this turn.

1. Write the §5.3 report in full.
2. Append one queue row naming which rule failed and which metric was closest to its threshold.
3. Set the open note's `currentClaim` to the one-line verdict.
4. **End the turn.** Report to the human and stop.

---

## 7. Verify, in order

1. `./doctor.sh --offline` exits 0 after §2, after §3, and after §6.
2. `./doctor.sh --project .` exits 0 after every `INDEX.md` edit.
3. `git log --oneline` shows one commit per stage, `ab-baseline` tagged at the end of §3.
4. `.agent/explain/2026-09-22-diagnosis.md` names one supported hypothesis for §1.1 and one card finding for §1.2.
5. INDEX row 3 says `1e10`.
6. `.agent/explain/2026-09-22-ab-results.md` contains 6 trial rows, including failures.
7. `scripts/report-ab.sql` runs against `telemetry.db` and returns those rows.
8. INDEX row 12 is closed, or the report states why it could not be.
9. `tests/fixtures/ab/` is byte-identical to its state at `ab-baseline`.
10. Under 6.A or 6.B: `agent/AGENTS.md` §Models describes the code as it stands and names no model id.

---

## 8. Pre-committed next

| If | Then |
|---|---|
| Any trial starts with a dirty `settings/hosts/machina.json`, `agent/models.json`, or `agent/AGENTS.md` | That trial is void and re-runs. It is not recorded as a failure — it measured a different harness. |
| The six trials do not share one `HEAD` | All six are void. Re-run the set from one commit. |
| A later session finds `~/.pi/agent/settings.json` is no longer a symlink into this repo | Stop. `install.sh`'s link was replaced and §1.1's finding no longer holds; re-run §1.1 before anything else. |
| §1.2 finds the Sol figure matches neither card | `total_cost_usd` is dropped from §5.2 and rules 4 and 5 run on tokens alone. |
| §2.3 finds children uninstrumented | Arm B is measured from child stdout, §5 rows are flagged, rules 4 and 5 run on parent-only tokens with that stated. |
| Any arm B trial is killed for `child unbounded` | It counts as not completed. Child bounds move from 6.A step 2 into a prerequisite. |
| §3.3 changes the tier chosen for the §4.3 prompts | Record the chosen tier per trial. If arms differ in tier, the trial is void and re-runs with the tier pinned for both. |
| Median `peak_parent_prompt_tokens` differs by less than 20% between arms | Arm B did not delegate. Trials void; fix the arm B prompt and re-run. |
| Any stage exceeds $6 or 80 model calls | Stop, report the cost and what was completed, and start the remainder as a new turn. |
