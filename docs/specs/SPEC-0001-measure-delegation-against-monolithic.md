# SPEC — drift diagnosis, audit fixes, monolithic vs delegated measurement, conditional completion

**Place at:** `docs/design/SPEC-delegation-ab.md`

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

**One tripwire for the whole run: $25 or 250 model calls — your own.** If the run passes either before reaching §5, stop and report what is committed. Below that, do not stop to ask. The reference build was 398 calls and $32.50 for more work than this spec contains.

**Pi's inference calls are not yours.** Rows in `telemetry.db` are the measurement: they run on the Codex subscription, on a separate ledger, and they are the output of §4 rather than the cost of producing it. Never count them against the tripwire. Void trial 2 alone put 81 rows in the database; at that scale the fresh six are ~250 pi calls, which is the entire tripwire and would stop the set mid-run every time — and a stopped set is `VOID` under §6 rule 0, so the tripwire would be destroying the thing it is meant to protect.

The two ledgers, kept apart:

| Ledger | What is in it | Counts against the tripwire |
|---|---|---|
| Grok Build usage | Your model calls: reading this spec, editing the repo, orchestrating the trials, writing the report | Yes |
| `telemetry.db` | Every pi and subagent inference call from §1.2's probes, §2.3's probe, and the six trials | No — these are §5's data |

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

- Raise `maxLoopDepth`, `noProgressReads`, or `maxConsecutiveToolFailures` to make a pi trial finish. A bound firing is data.
- Raise `maxTurnWallClockMs` for one arm. **Amended 2026-09-22:** it may be raised for *both* arms, to the same value, before a set starts, and only because it binds the arms unequally — see §4.4a. Recording a bound that only one arm can hit measures the bound, not the architecture.
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

**The join must be transitive.** `parent_turn_id` points at the immediate parent, and a turn can be three deep: parent → nested `pi` started from `bash` → `implement` child. A single-level join reports zero child edits for a trial whose children edited every file, which is exactly how the f8edcd2 re-run mis-scored trial 2.

Add `scripts/report-ab.sql` producing one row per `(root_turn_id, arm, trial)` with the seven §5.2 metrics, resolving the root by walking the chain:

```sql
WITH RECURSIVE chain(turn_id, root_turn_id) AS (
  SELECT turn_id, turn_id FROM inference_calls WHERE parent_turn_id IS NULL
  UNION ALL
  SELECT i.turn_id, c.root_turn_id
  FROM inference_calls i JOIN chain c ON i.parent_turn_id = c.turn_id
)
SELECT root_turn_id, COUNT(*), SUM(prompt_tokens), SUM(cached_tokens), SUM(cost_usd)
FROM inference_calls JOIN chain USING (turn_id) GROUP BY root_turn_id;
```

Assert before scoring any set: every row in the database resolves to a root. An orphan means a session the scorer cannot attribute, and the set is not scoreable until it does.

Commit and continue.

---

## 3. Fixes that change behaviour under test

### 3.1 Checkpoint on abort

`extensions/routing.ts`, `fireBound`, records a telemetry row, appends a `pi-build-bound` entry, logs, and calls `ctx.abort()`. The partial tree survives; the knowledge of where the turn got to does not. The next prompt starts from a cleared `filesWritten` and an empty recap.

Before `ctx.abort()`, and only when `writtenFiles().length > 0`.

**Gate on written files, not on `edits`.** §2.2 pinned the mutating set to `bash / edit / powershell / write` against the installed package, so `turn.edits` now increments on any `bash` call. A turn that only ran shell commands has `edits > 0` and an empty `writtenFiles()`, and would write a checkpoint row reading `wrote ` with nothing after it. `edits` is still the right counter for the no-progress bound; it is the wrong one for a resume point.

The row:

1. `queue_append` one row: `bounded at <reason>; wrote <writtenFiles().join(", ")>; resume from <first unwritten path named in the open note, or "(unknown)">`, source `SPEC-delegation-ab §3.1`.
2. `setLastRecap` with the same line, so `orientationBlock` carries it into the next turn's cached prefix.

When `writtenFiles()` is empty the turn produced nothing to resume from — log and abort as now, no queue row. A queue that accumulates empty bound rows is a log, which INDEX forbids.

Failure of either write must not prevent `ctx.abort()`. Wrap both, log on failure, continue.

Test: a written file produces exactly one queue row and a non-empty recap; a turn with `edits > 0` from `bash` alone and no written file produces neither; a throwing `queue_append` still reaches `ctx.abort()`.

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

## 3.6 Validate before measuring

Three sets of six have been spent discovering that a mechanism did not work. Each cost ~45 minutes and ~$3 to learn something the first arm B trial had already shown. Nothing in §4 runs until every check below passes.

### 3.6.1 Offline — score the recorded sets

Four databases already exist, with known correct verdicts. They are the scorer's golden fixtures and cost nothing to replay.

| Database | Commit | Expected scorer output |
|---|---|---|
| `/tmp/pi-build-ab/telemetry.db` | `bd51f93` | 2 trials, both **void**: trial 1 on prerequisite failure (3 consecutive tool failures inside the first 3 calls), trial 2 on zero child edits. |
| `/tmp/pi-build-ab-set/telemetry.db` | `9d81e6b` | Arm A: 2 completed, 1 real miss on no-progress. Arm B: 3 **void**, zero child edits. Set verdict **`VOID`** by rule 0. |
| `/tmp/pi-build-ab-set2/telemetry.db` | `f8edcd2` | Trial 1 completed. Trial 2 is **not void**: the transitive join finds 6 child edits on nested turn `16157b26-…`, and the parent-wrote flag does **not** fire on `find` commands containing the fixture path. Its bound is `wall clock 645510ms`. |
| The `78ce7cb` set | `78ce7cb` | Arm A: 3 completed. Arm B: 3 **void**, zero child edits. Set verdict **`VOID`** by rule 0. |

`f8edcd2` is the discriminating case. A scorer that marks its trial 2 void has one of the two known bugs and is not ready to run a set. Both must be green before §4.

Assert alongside them:

- Every inference row in every database resolves to a root through the §2.3 recursive CTE. Zero orphans.
- The parent-wrote flag is computed only from `edit`/`write` target paths. Feed it a fabricated `bash` row whose command text contains `tests/fixtures/ab/` and confirm it stays false.
- Rule 0 fires before rules 1–6 on both `VOID` sets, and `NEITHER` is never returned for either.

### 3.6.2 Offline — unit tests from §2 and §3

`./doctor.sh --offline` exits 0, and these specific cases are present and green: deduped reads do not move `reads` (§2.1); the mutating-tool set matches the installed package (§2.2); a written file produces one checkpoint row while a bash-only turn produces none (§3.1); explain is skipped after an abort (§3.2); every key in `example.json` is read somewhere (§3.4).

### 3.6.3 Live — one smoke trial per arm, single file

Not the six-file fixture. A one-file task, which proves the mechanism in about a minute instead of eight.

**Arm B smoke.** With `.pi/agents/explore.md` moved aside and `maxTurnWallClockMs` at 1800000, dispatch `implement` for one file. Assert all five:

1. At least one child inference row exists, on a turn whose root is this trial.
2. That child recorded at least one successful `edit` or `write`.
3. The target file changed on disk, and `tsc --noEmit` still passes.
4. The parent recorded zero `edit`/`write` calls targeting that path.
5. Elapsed under 120s.

**Arm A smoke.** Same one file, no dispatch. Assert it completes and the file changed.

If the arm B smoke fails any of the five, fix and repeat the smoke. Do not start a set to find out.

### 3.6.4 Trial-commit assertions

In the commit the six will share: `maxTurnWallClockMs` is 1800000 for both arms (§4.4a), `.pi/agents/explore.md` is absent, the arm B prompt in §4.3 contains the string `implement subagent`, §4.0's path-integrity grep passes, and `npx tsc --noEmit && node --test` exits 0 on the unmodified fixture.

Cost of all of §3.6: roughly 10–15 pi calls and under $0.30, against ~$3 and 45 minutes for one void set.

---

> **Withdrawn 2026-09-22.** §4, §5, and §6 are withdrawn. `SPEC-context-500k.md` supersedes them. The text below stays as the record of the measurement. It is not an instruction. §7 and §8 recorded that measurement and do not start another six.

## 4. The measurement

### 4.0 Runnability, asserted before any trial

**Arm B requires a subagent definition that can write.** Verify before the first trial:

```bash
pi subagent list
```

If the only installed definition is `explore`, or no listed definition has `edit` and `write` in its tool set, **arm B is not runnable and must not be run.** A read-only child given a file and a spec section will read it, fail to edit it, and exhaust its own no-progress budget — which measures the definition's tool set, not delegation.

Fix it before proceeding: add a minimal `implement` definition with `read`, `edit`, `write`, and no dispatch of its own, scoped to a single file path. Commit it. That commit becomes the `HEAD` all six trials share.

**Installed is not dispatched.** At 9d81e6b and at 78ce7cb, `implement` was installed, the pre-trial check passed, and every arm B trial still dispatched `explore`, because the prompt asked for "a subagent" and the harness supplied its default. Two assertions, both mechanical:

```bash
grep -q 'implement subagent' <arm-B-prompt-file> || exit 1
ls .pi/agents/ | grep -qv '^explore\.md$' && test ! -e .pi/agents/explore.md
```

The arm B prompt names the writing definition by name, and **no read-only definition is dispatchable for the duration of the set.** Move `.pi/agents/explore.md` aside in the trial commit and restore it afterwards. An instruction the harness can silently override is not a control; removing the wrong option is.

**Subagent model selection is ignored.** Trial 4 at 78ce7cb dispatched text asking for Terra and Luna; every recorded row was Sol. Children inherit the parent's session model, which routing has set to `escalate`. This settles §4.0's model-confound check in the good direction — both arms run one model, so rules 4 and 5 stay on dollars — and it is worth an INDEX row on its own, because it means tier mix cannot be controlled from a dispatch call.

**Every path `SPEC.md` names must exist.** Trial 1 (void, §4.3a) died at `consecutive tool failures 3` reading `tests/fixtures/ab/types.ts`, `parse.ts`, and `format.ts` — three guesses at a flat layout, while the sources are under `src/`. The compile gate passed throughout, because it compiles what exists rather than what the spec names.

```bash
grep -oE 'tests/fixtures/ab/[A-Za-z0-9_./-]+\.ts' tests/fixtures/ab/SPEC.md \
  | sort -u | while read -r f; do test -f "$f" || { echo "missing: $f"; exit 1; }; done
```

`SPEC.md` names every file by its full repo-relative path, exactly once, and every one resolves. A bare filename is a guess the child or the parent has to make, and three wrong guesses end the turn.

**Arm A requires the fixture gate to run at all.** Verify, from a clean fixture:

```bash
cd tests/fixtures/ab && npx tsc --noEmit && node --test
```

Both must exit 0 on the unmodified fixture. A turn that dies at `consecutive tool failures 3` within the first three calls did not hit a bound — it hit a broken prerequisite, and the same break will void every arm A trial.

**Both arms must run the same model.** `.pi/agents/implement.md` carries no model id, so an ephemeral child resolves to whatever the harness gives it — the parent's session model, which routing has set to the `escalate` tier, or `defaultModel`. Those are Sol and Terra respectively, and the difference is 2.5x on input.

After the first arm B trial, before continuing:

```sql
SELECT parent_turn_id IS NULL AS is_parent, model, COUNT(*), SUM(prompt_tokens)
FROM inference_calls WHERE session_id IN (SELECT session_id FROM trials WHERE arm='B')
GROUP BY is_parent, model;
```

If children ran a cheaper model than the parent, arm B's cost advantage is a tier difference and not a delegation result. That does not void the set — record the child model per trial, and evaluate §6 rules 4 and 5 on `total_prompt_tokens` alone, stating the substitution. Delegation is being measured for what it does to context, and a tier mix is a separate lever that can be pulled without it.

**A trial that fails any assertion is void, not failed.** Void trials do not count toward the §6 completion tallies, do not appear in the arm medians, and are re-run after the prerequisite is fixed. Record them in the report under a separate heading with the assertion that failed.

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
Apply tests/fixtures/ab/SPEC.md in full. Dispatch the implement subagent once per file named in the spec; give each child the spec section and the full path of its one file. Do not read, edit, or write those files in this session.
```

The definition name is load-bearing. Three void sets have now dispatched `explore` — a read-only agent — because the prompt asked for "a subagent" and the harness supplied its default. §4.0 makes the name a checked string, not a hope.

### 4.3a Trials recorded void, 2026-09-22

Two trials ran at `bd51f93` before §4.0 existed. Both are void. Their rows stay in `/tmp/pi-build-ab/telemetry.db` and are reported under the void heading; neither is retried at that commit, because §4.0's fix will move `HEAD`.

| Trial | Arm | Bound | Void because |
|---|---|---|---|
| 1 | A | consecutive tool failures 3, at 3 calls / 148s | Failed before work started. Fixture gate unverified. |
| 2 | B | child unbounded, 721s, 8 subagent calls / 18 sessions | Only `explore` installed; children were read-only and could not write the files they were given. |

Trial 2 does confirm one thing worth keeping: child sessions are instrumented and `parent_turn_id` correlation works, so §2.3 took its first branch and §5 can be computed from `telemetry.db`.

### 4.3b The parent can escape every bound from `bash`

In the f8edcd2 re-run the parent, told not to edit the fixture, started a nested `pi` from `bash`; that session dispatched `implement`, and those children edited all six files. The instruction held. The bounds did not.

This is a property of the harness, not of the trial. `maxLoopDepth`, `maxTurnWallClockMs`, the no-progress check and the failure counter all live in the parent process and count the parent's own rounds. A nested `pi` started from `bash` has its own budget for each of them, and `bash` is in the mutating-tool set pinned by §2.2, so the escape costs one tool call.

Record it in INDEX as an open finding. Do not fix it inside this spec — it changes what every trial measures, and a fix mid-set voids the set. It belongs in whichever of §6.A or §6.B runs, where child bounds are already on the list.

For scoring: a nested session's work counts as that trial's work. The transitive join in §2.3 is what makes it visible.

### 4.4a The wall clock binds one arm only

Measured wall clock: arm A finished in 403s, 412s, and 404s across two sets. Arm B ran 500s, 500s, and 517s with children that did no work, and 645s once children actually edited — past the 600000ms limit, which ended the turn.

So `maxTurnWallClockMs` is not a shared constraint. Arm A clears it by 200s; arm B exceeds it as soon as delegation does anything. Left at 600000, no arm B trial can ever record `completed`, rules 1–3 resolve to `MONOLITHIC` on completion counts alone, and the token and cost columns are never reached. The measurement would return the bound's value rather than the architectures'.

**Set `maxTurnWallClockMs` to 1800000 for both arms, in the commit the six share.** This is not tuning an arm to pass: it is symmetric, fixed before the set runs, and removes a gate that only one arm can trip.

Then report the 600s result as its own finding, because it is one: **at the default turn budget, delegation does not fit.** If the set returns `MONOLITHIC`, that finding is most of the reason, and it belongs in INDEX next to the verdict. If arm B wins on tokens at 1800000 while being unable to finish at 600000, the honest conclusion is that delegation trades wall clock for context, and 6.A's child bounds have to be designed around a turn budget that admits it.

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

**Abort the set after the first arm B trial if it records zero child edits.** Three sets of six have now been spent discovering setup faults that the first arm B trial exposed in full: read-only children at 9d81e6b, a single-level join at f8edcd2, read-only children again at 78ce7cb. A void set costs six trials, about 45 minutes, and roughly $3 of measurement to learn what trial 2 already showed. Check child edits before starting trial 3; if they are zero, stop, fix, and start a new set.

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

### 5.2a Window headroom — scope of any verdict

Report `median peak_parent_prompt_tokens / 272000` for arm A, as a percentage, in the first table.

Delegation's mechanism is relieving window pressure. If arm A never approaches the window, the comparison cannot show delegation's benefit and can only show its overhead, so the verdict is about this fixture rather than about the architecture.

| Arm A peak as share of window | What the verdict means |
|---|---|
| Under 25% | The fixture does not exercise the mechanism. A `MONOLITHIC` result reads **"monolithic wins at this fixture size"** and must be written that way everywhere it appears, including INDEX. A `DELEGATED` result at this size would be surprising and worth re-checking before acting on. |
| 25–70% | The comparison is meaningful. The verdict stands unqualified. |
| Over 70% | Arm A is near the window. Record whether any arm A trial compacted or aborted on context, because that is delegation's case being made by arm A's failure. |

Measured at 9d81e6b (void set): arm A peak was 19,991 and 20,077 — **7% of the window**. Overhead was measured in the same set, with children that did no work: arm B ran +80k prompt tokens, −0.15 cache share, and 2–3x cost per trial against arm A. For arm B to clear rule 4 at that size, children would have to remove more than 120k tokens from a parent holding 20k, which is not reachable. Treat a `MONOLITHIC` result at 7% as expected and narrowly scoped.

### 5.3 Report

`.agent/explain/2026-09-22-ab-results.md`: the 6 trial rows, per-arm median and range, and the §6 verdict with the arithmetic shown. Table before summary. Failed trials included.

---

## 6. Pre-committed branch

Evaluate in order. First match decides. **Fixed before any trial ran; not revisited.**

`NEITHER` means both architectures were tested and both lost. It does not mean both arms were broken — that is `VOID`, and the two are not interchangeable.

| # | If | Then |
|---|---|---|
| 0 | Either arm has fewer than 3 non-void trials | `VOID` — fix the §4.0 prerequisite, re-run the full set of six, do not evaluate rules 1–6 |
| 1 | Neither arm completes in ≥ 2 of 3 non-void trials | `NEITHER` |
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
9. `tests/fixtures/ab/` is byte-identical across all six trials, checked against the commit the six share — not against `ab-baseline`, which predates the §4.0 fixes. Move the tag to the trial commit, or record the trial commit explicitly in the report and drop the tag reference.
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
| Any arm B trial records 0 child edits across all children | The children did not write. Void, and re-check §4.0's definition assertion before re-running. |
| In any arm B trial the parent writes a fixture file itself — **detected from `edit`/`write` tool calls whose target path resolves under `tests/fixtures/ab/`, never from `bash` command text** | The parent did the work and the children were decoration, as in void trial 2. That trial is void — instruction alone did not prevent it, so tighten the arm B prompt or scope the parent's tools before re-running. |
| Arm B children exhaust their own no-progress budget with 0 edits | The child definition cannot write. The trial is **void**, §4.0's assertion was skipped, and every arm B trial to date is void with it. |
| An arm dies within its first 3 calls at `consecutive tool failures` | A prerequisite is broken, not a bound. The trial is **void**. Diagnose the failing tool call before re-running that arm. |
| A prerequisite fix changes `HEAD` | Every trial recorded before that commit is void, including ones that ran cleanly. All six re-run from the new commit. |
| Any arm B trial is killed for `child unbounded` **after §4.0 passes** | It counts as not completed. Child bounds move from 6.A step 2 into a prerequisite. |
| §3.3 changes the tier chosen for the §4.3 prompts | Record the chosen tier per trial. If arms differ in tier, the trial is void and re-runs with the tier pinned for both. |
| Median `peak_parent_prompt_tokens` differs by less than 20% between arms | Arm B did not delegate. Trials void; fix the arm B prompt and re-run. |
| Arm A's median peak is under 25% of the window and the verdict is `MONOLITHIC` | The verdict is scoped to this fixture, per §5.2a. Before adopting 6.B as settled, either accept that scope explicitly in INDEX or build a second fixture whose arm A peak exceeds 60% of the window and re-run §4 once against it. Do not treat the small-fixture result as a general finding about delegation. |
| An arm completes 2 of 3 with the third failing on a bound the other two did not hit | Record the flake rate. Arm A did this at 9d81e6b: trials 1 and 3 completed, trial 5 hit no-progress at 6 reads and 0 edits on the same tree and prompt. A 1-in-3 nondeterministic miss makes a 2-of-3 threshold noisy, and the completion counts in rules 1–3 should be read with that in mind. |
| Any stage exceeds $6 or 80 model calls | Stop, report the cost and what was completed, and start the remainder as a new turn. |
