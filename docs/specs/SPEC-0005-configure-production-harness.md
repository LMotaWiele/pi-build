# SPEC — production configuration

**Place at `docs/SPEC-production-config.md`.**
**Acceptance tests:** `docs/SPEC-production-config.tests/` — may not be edited by the implementer. They cover §2 and §5.2.
**Reference implementation:** `docs/SPEC-production-config.reference/` — `lib/tiers.ts`, `lib/rework.ts`, `scripts/pi-rework.ts`, `bin/pi-rework`. Copy into place; passes the tests as delivered.

**Status:** open. The GPT-5.6 retry ladder is superseded by `docs/specs/SPEC-0009-migrate-to-gpt6.md`.
**Executor:** Grok Build
**Written:** 2026-09-26
**Supersedes:** `docs/SPEC-routing-orchestration.md` §5.4 onward and §13. Its §1–§4, §12 and the outcome matrix stand as the record.

---

## 0. What was decided, and on what evidence

The routing program measured Luna, Terra and Sol on a 16-task suite built from real commits. Four findings set this configuration.

1. **Escalation rescued little.** On the repaired suite Luna passed 5 of 14 labelled tasks at ~$0.02 each. Terra rescued one Luna failure, `aoh-fb5d493`, for $0.29. $6.50 of Terra and Sol in Phase C rescued none.
2. **Most remaining failures were specification problems, not capability.** `59c9121`'s hidden test asserts the opposite of what its prompt and visible test state. `78ce7cb` failed three ways on three tiers: Terra ignored a stated requirement, Luna followed a defensible reading of an ambiguous one, and Sol broke a test helper.
3. **Checkers written after implementation do not discriminate.** C2, C3 and C4 flagged clean passes about as often as silent fails. Blind tests invented requirements; Jev coverage questions rejected correct code with the requirement in hand.
4. **Jev is reliable on questions its input can answer.** 76 of 77 on deterministic structural questions once S2 was reworded — 16 of 16 on S2 with confidences at 0.03–0.07 and 0.97. It is not reliable at judging whether code is correct from text.

**The suite cannot rank policies further.** Between two near-identical Luna runs, 2 of 14 tasks flipped pass/fail. At one run per task, about one label in seven is noise. No further suite runs are made under this spec.

### 0.1 Executor and budget

Grok Build edits this repository. `telemetry.db` rows are the measurement and never count against Grok's tripwire: **$15 or 150 Grok calls for the whole run.** This spec is mostly configuration and one small extension; it should need a fraction of that.

---

## 1. Router — keep `pi-smart-router`

It routes to Luna, is free to run, and nothing measured does clearly better per dollar. No change to its configuration.

The first-turn pin stays. The case against it — hard tasks held on Luna — did not survive the repaired suite: escalating those tasks rescued almost nothing.

---

## 2. Bounds retry — retarget from Sol to Terra

`extensions/bounds.ts` retries a bound-stopped turn once, at the escalate tier, which resolves to Sol. Three suite runs were censored by this path. In production it is a Luna-to-Sol jump on three consecutive tool failures, when Terra did the only rescue measured, at roughly a fifth of Sol's cost.

### 2.1 Change

The retry targets **the next tier up from the model that was running**:

| Running | Retry target |
|---|---|
| Luna | Terra, medium thinking |
| Terra | Sol, high thinking |
| Sol | No retry. Stop and report. |

Still one retry per original prompt. The §3.1 checkpoint row stays the retry's prompt.

**Subscription only.** Terra is `openai-codex/gpt-5.6-terra` when that id resolves at session start. If it does not, a Luna retry goes to `openai-codex/gpt-5.6-sol` instead. **A retry never targets a per-token provider**: spending dollars silently to recover a turn is worse than skipping a tier. Note that the routing spec's Terra probe was pinned to `openai/gpt-5.6-terra`, the per-token API — if that ran as written, those runs were billed in dollars, not quota.

The decision lives in `lib/tiers.ts`: `nextTier(model, resolves)` returns the target or null, and `retryAllowed({ env, held, alreadyRetried })` gates it. `bounds.ts` calls both; `held` is `readHold(defaultHoldPath(process.env)) !== null` from `lib/quota.ts`, so a quota hold blocks the retry.

### 2.2 A retry switch for pinned runs

Add `PI_BUILD_RETRY=0` to disable the retry entirely. Any pinned measurement sets it. Without it, a pinned run can escalate mid-turn and be censored, as `aoh-6ba7e7e`, `aoh-5cbfb21` and `aoh-c40f118` were.

### 2.3 Test

`docs/SPEC-production-config.tests/tiers.test.ts`. Luna retries on subscription Terra at medium, or subscription Sol when Terra does not resolve; Terra retries on subscription Sol at high; Sol and unknown models do not retry; no retry ever targets a per-token provider; `PI_BUILD_RETRY=0`, a quota hold, or a previous retry blocks it. The wiring in `bounds.ts` gets the implementer's own test.

---

## 3. Specs ship their acceptance tests

The one change the data supports most. Visible acceptance tests that touch the new work convert every failure mechanism seen on `59c9121` and `78ce7cb` into either no failure or a loud one — and the cascade catches loud failures nearly for free.

### 3.1 The rule

Every spec that asks for code ships with a test file, next to it:

```
docs/SPEC-<name>.md
docs/SPEC-<name>.tests/<file>.test.<ext>
```

Each numbered item in the spec's **Verify** section that describes behaviour maps to at least one test. Items that describe process — "one commit per stage", "doctor exits 0" — stay prose.

Tests assert against **declared interfaces only**: paths, exports and signatures named in the spec. A test that needs a name the spec does not declare means the spec is missing the declaration. Fix the spec.

### 3.2 Author-time consistency

Before a spec is handed to an implementer, whoever wrote it checks two things:

1. **The tests fail at the current tree.** A test that already passes describes nothing new.
2. **No test contradicts the prose.** Read each test against the Verify item it covers. `59c9121` is the failure this prevents: a test asserting one outcome under prose stating the other.

These are the author's checks, not the implementer's. The implementer never decides which of the two was meant.

### 3.3 Implementer rules

The implementing model:

- **sees and runs** the spec's tests;
- **may not edit** them — they are restored from the spec directory before grading, the same way held-out files were restored in the suite;
- **may add** its own tests elsewhere.

### 3.4 Wire it into the harness

Add `extensions/spec-tests.ts`:

- On `before_agent_start`, if the prompt names a `docs/SPEC-*.md` with a sibling `.tests/` directory, record the directory in the turn state and add one line to the prompt naming it.
- On `agent_end`, restore the spec's test files from the spec directory, run them, and record `spec_tests_passed` and `spec_tests_failed` on the turn in `telemetry.db`.
- **If any spec test fails, treat it as a visible-check failure:** trigger the §2 retry, with the failing test names in the checkpoint row.

Nothing here judges whether code is correct. It runs tests the author wrote.

### 3.5 Apply to future specs only

Existing specs are not back-filled. The first spec written after this one lands is the first to carry tests.

---

## 4. Jev — shadow mode, building a real dataset

Jev's structural answers are reliable. What was never measurable on 16 tasks is whether those answers **predict** anything. Real work supplies the sample size the suite could not.

### 4.1 Change

On every user prompt, after routing and before the first inference, run the battery — the 13 questions with the reworded S2 — against prompt plus handoff. **Do not act on the answers.** Record them in a `jev_shadow` table: `turn_id`, question id, answer, confidence.

Cost: about $0.00006 per prompt. A week of heavy use is under a cent.

### 4.2 Do not add

- No C2-style coverage questions. They misjudged correct code in the suite.
- No routing decision from Jev until §6's review.

---

## 5. A week of real work, measured

### 5.1 What to record per user prompt

Most of this is already in `telemetry.db`; add what is missing.

| Field | Source |
|---|---|
| Initial model, and every model after a retry | Router and §2 |
| Bound events and their reasons | `bounds.ts` |
| Spec tests passed / failed, first attempt and after retry | §3.4 |
| Provider cost, rounds, wall clock | Existing |
| Jev battery answers | §4 |
| **Rework** | Manual — see 5.2 |

### 5.2 Rework, recorded by you

```
bin/pi-rework <spec> <task|*> <reason...>
bin/pi-rework --list [spec]
```

Run it whenever you find that spec work was wrong or incomplete and had to be redone, that day or three days later. `<spec>` is the spec's name, file name or path; `<task>` is a task id from that spec's plan, or `*` when the finding belongs to the spec as a whole — an integration problem, or a spec that was underspecified. The reason is free text.

It refuses a spec that does not exist, an empty reason, and a task id the plan does not contain — listing the valid ids — so a typo cannot create an unjoinable row. Rows go to `~/.pi/agent/rework.jsonl` with the repository root on each, so one log serves every project.

**Scope:** only spec-driven work has a task id, so only spec-driven work can be logged. That is the work this configuration measures. Tests: `docs/SPEC-production-config.tests/rework.test.ts`.

This is the only production signal for a silent fail, and it has to come from you. It does not need to be complete: a rework row that exists is the most valuable data point this spec produces.

### 5.3 Report

After a week, write `.agent/explain/<date>-production-week.md`:

- Prompts, and the share that ended on each tier.
- Retry rate, and how often a retry passed.
- Spec-test pass rate on first attempt, for specs that carried tests.
- Every rework row, joined to its task through the plan run's `results.jsonl`, with the tier the task ran on and its Jev answers. Rows with task `*` are reported per spec.
- Provider cost per prompt, median and spread.

---

## 6. Review after the week

| If | Then |
|---|---|
| Rework concentrates on prompts where specific Jev questions answered one way | That is leverage, measured on real work. Wire those questions into routing: a matching prompt starts on Terra instead of Luna. Re-measure for a week. |
| Rework is spread evenly across Jev answers | Jev's structural answers do not predict rework on your work. Keep shadow mode off and remove the table. |
| Most rework is on specs without tests | §3 is working where it applies. Make tests mandatory for every code spec. |
| Rework persists on specs with passing tests | The tests are too thin. Look at what the rework found and add those checks to the §3.1 rule. |
| Retries mostly pass on Terra | §2's retarget holds. Leave it. |
| Retries mostly fail on Terra and pass on Sol | Terra is not a useful middle step on your work. Retarget Luna's retry straight to Sol. |
| Median cost per prompt is above $0.30 | Something is escalating more than the suite predicted. Find which tier, and why, before changing anything else. |

---

## 7. Also

- **Mark `59c9121` unfair** in `tests/routing-suite/tasks.jsonl` with the reason: its hidden assertion contradicts its prompt and visible test. Keep the suite as a smoke check for harness changes. It is not a ranking tool.
- **INDEX:** one row recording that the routing program closed with `pi-smart-router` kept, the retry retargeted, specs shipping tests, and Jev in shadow — and one row for the rework log's location.

---

## 8. Verify

1. `./doctor.sh --offline` and `./doctor.sh --project .` exit 0.
2. `tiers.test.ts` passes, and `bounds.ts`'s own test shows a bound retrying through `nextTier` and blocked while a quota hold exists.
3. A spec with a `.tests/` directory, named in a prompt, produces `spec_tests_passed` and `spec_tests_failed` on the turn; an edited spec test is restored before grading; a failing spec test triggers the retry.
4. `jev_shadow` has one set of answers per prompt, and no routing decision reads it.
5. `rework.test.ts` passes, and `bin/pi-rework` records a row that §5.3's report joins to its task.
6. `tests/routing-suite/tasks.jsonl` marks `59c9121` unfair, with the reason.

## Landing

§2 and §5.2 landed through SPEC-0009. The remaining sections were replaced by SPEC-0006, SPEC-0010 and Lucas's decision to use both harnesses in production.
