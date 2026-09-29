# SPEC — routing and orchestration

**Place at `docs/SPEC-routing-orchestration.md`.**

**Status:** closed 2026-09-26 by `docs/SPEC-spec-translation.md`. The measurements stand. The suite stays closed.
**Executor:** Grok Build
**Written:** 2026-09-24
**Relation to other specs:** `docs/SPEC-harness-setup.md` §1–§14 are done and stand. Its §15 is superseded by this spec. §14.3's launcher stays as a fallback until §8 here replaces it.

---

## 0. Direction

### 0.1 What changed and why

Three findings from 2026-09-23, one internal and two published:

1. **Luna is reliable exactly where its work is checked.** It matched Sol on a three-assertion held-out suite at 1/43 the cost per round, and on the harness task it wrote a `maxTurnPromptTokens` default of 100,000 — below its own per-run usage — that passed every check it faced. It drops what nobody checks.
2. **Routers that read only the task text have little to work with.** Scrouting (arXiv 2608.04804) routes after a cheap model scouts the repository and writes a verified handoff. On SWE-bench Pro Python it matched the best single model, 159 against 158 of 266, at about a fifth of the cost per solve — and the no-router ablation, always using the cheapest fixer *with* the handoff, tied the routed system. The handoff carried the result. It also found solve sets nearly nested: what a cheaper model solves, the stronger one almost always solves too.
3. **Architect/editor is the established orchestration pattern.** A strong model plans, a cheaper one edits. Aider reports state-of-the-art results on its benchmark with this split, and practitioners report 30–50% below the architect model alone, strongest on multi-file changes with non-obvious dependencies.

`jev` previously answered five questions from the prompt alone, gated on `single_file_edit`. The questions could not be answered from that input. This spec gives Jev a handoff to read and a battery of questions aimed at what actually decides the route.

### 0.2 The economics that set the priorities

Measured on the §6 benchmark: Luna ~$0.001383 per round, Sol ~$0.060005 per round. A Luna attempt that fails *detectably*, followed by a Sol run, costs roughly 2–4% more than Sol alone.

So a cascade — try Luna, verify, escalate on failure — is financially close to free whenever the verification is trustworthy. Misrouting to Luna costs wall-clock time, not money. The expensive error is the **silent failure**: Luna's output passes the checks it can see and is still wrong.

This sets what Jev is for, in order of leverage:

1. **Predict silent-failure risk.** Would a plausible wrong implementation pass the checks available? This is the question that protects you.
2. **Predict wasted time.** Is Luna likely to fail detectably, so starting on Sol saves a round-trip?
3. **Choose the shape.** Luna solo with handoff, Sol architect with Luna editors, or Sol solo.

### 0.3 Two different things to measure about Jev

Keep them apart. Conflating them is how `single_file_edit` survived.

- **Answer accuracy:** does Jev answer the question correctly? Measured on questions with a deterministic ground truth from the diff — "does the change create a file under `extensions/`" can be checked against what was actually committed.
- **Question leverage:** does the answer predict the outcome? A question Jev answers perfectly can still carry no routing signal. Measured against the outcome matrix.

A question is kept only if it scores on both.

### 0.4 Executor, budget, ladder

Grok Build edits this repository and runs `pi` as a subprocess. `telemetry.db` rows are the measurement and never count against Grok's tripwire: **$25 or 250 Grok calls for the whole run.** Commit after each section and continue.

**The ladder is strict.** Each rung is cheaper than the next and tests an assumption the next depends on. If a rung's pre-committed row says stop, stop — do not spend the next rung's budget to find out what this one already showed.

| Rung | Section | Model spend | What it tests |
|---|---|---|---|
| 0 | §1 | none | Can a task suite with real held-out graders be built from git history? |
| 1 | §2 | ~$1, Luna only | Where does Luna fail, and how often silently? |
| 2 | §3 | ~$3–8, Sol on Luna's failures only | Are solve sets nested here? |
| 3 | §4 | cents | Does a handoff convert Luna's failures? |
| 4 | §5 | cents, Jev only | Does Jev answer correctly; which questions predict? |
| 5 | §6 | ~$2–5 | Does architect/editor fix what the handoff didn't? |
| 6 | §7 | none | Which routing policy wins, replayed offline? |
| 7 | §8 | none | Build the winner. |
| 8 | §9 | one real run | Does it hold at 500k? |

**Do not** let any replay read or edit a task's held-out grader. **Do not** tune a question or a threshold on the same tasks it is scored on — §5.4 splits them. **Do not** run a 500k task before §7 has a winner.

---

## 1. Task suite from git history — no model calls

The suite is your own past work, so it measures your workflow rather than a benchmark's.

### 1.1 Select

From the git history of `pi-build`, and of any other repository you actively work in, select **16–20 commits** that:

- change source and add or change tests in the same commit, so a grader exists
- span sizes: roughly a third single-file, a third 2–4 files, a third 5+ files or harness-level
- include the §6 benchmark and the §13 hard task as two of them, since their outcomes are already known

Reject commits whose tests only assert that something exists or is positive. §13 showed those grade nothing.

### 1.2 For each task, record

| Field | Source |
|---|---|
| `parent_sha` | The replay starts here. |
| `prompt` | The commit message and any spec section it implemented, rewritten as an instruction. No hints from the diff. |
| `visible_checks` | Tests existing at `parent_sha`, plus anything the prompt names. The replay may see and run these. |
| `heldout` | The commit's own new or changed tests, plus a derived value check for any configured number the commit sets. **Never visible to the replay.** |
| `reference_diff` | The committed diff: files, lines, symbols changed. Ground truth for §5's answer-accuracy checks. |

### 1.3 Verify the graders before any run

For every task: the held-out suite **fails** at `parent_sha` and **passes** at the commit. A grader that passes at `parent_sha` measures nothing; drop the task. Record the suite as `tests/routing-suite/tasks.jsonl`.

---

## 2. Luna arm — every task

Run every task once on Luna, pinned: `--model openai-codex/gpt-5.6-luna`, no router. Restore held-out files before grading.

Per task record: visible checks pass/fail, held-out pass/fail, provider cost, rounds, wall clock, files read before first edit.

Classify each outcome:

| Class | Visible | Held-out | Meaning |
|---|---|---|---|
| **Pass** | pass | pass | Luna suffices. |
| **Loud fail** | fail | fail | Luna failed and the checks noticed. The cascade catches this. |
| **Silent fail** | pass | fail | Luna failed and the checks did not notice. **The dangerous class.** |
| Odd | fail | pass | Visible checks are wrong or flaky. Investigate the task, not Luna. |

**The silent-fail count is the headline number of this spec.** Everything in §5 is ranked by whether it predicts it.

Budget: at ~$0.04–0.07 per run, the arm is about $1.

---

## 3. Sol arm — Luna's failures only

Run Sol, pinned at high thinking, on every loud-fail and silent-fail task. Also run Sol on **three** Luna-pass tasks chosen at random, to confirm Sol does not regress where Luna succeeds.

This tests nesting on your workload. If Sol passes everything Luna passes and most of what Luna fails, the Scrouting finding holds here and routing for cost is the right frame. If Sol fails tasks Luna passes, the tiers have different strengths on your work and a cascade that only escalates upward is incomplete.

Record the same fields as §2.

**A run stopped by a cost cap is censored, not failed.** It carries no pass/fail label and is excluded from nesting and from §7's replay until re-run with a higher cap. Set Sol's cap from the uncapped Sol runs' distribution — about twice the largest uncapped run — rather than a round number.

---

## 4. Handoff

Test the published claim that the handoff, not the route, carries the result.

### 4.1 Build it

A handoff is compact — it must fit Jev's 4,000-token state budget — and has two parts.

**Deterministic, computed by `scripts/handoff.mjs`, no model:**
- Implicated files: files the prompt names, plus files importing any symbol those files export.
- Fan-in: for each symbol the task is likely to change, the count of importing files outside the implicated set.
- Shared surfaces touched: section keys, hook registrations, settings keys, exported types.
- Tests covering each implicated file.

**Model-written, by Luna:**
- A numbered requirement checklist extracted from the prompt and any spec section it names.
- For each requirement, the check that would prove it — existing test, new test, or "no check exists".

Verify before delivery, as Scrouting does: every listed file exists, every named symbol is found by grep, every named test command runs. Strip claims that fail.

### 4.2 Test Luna's checklist against Sol's

Before trusting a Luna-written checklist, compare it with a Sol-written one on five tasks. Count requirements Sol lists that Luna omits. If Luna omits more than one in five, the checklist is Sol's job and the handoff's cost rises accordingly — record the difference.

### 4.3 Luna plus handoff, on Luna's failures

Rerun every loud-fail and silent-fail task on Luna with the handoff prepended. Grade on held-out.

| If | Then |
|---|---|
| Most failures convert to passes | The Scrouting result holds here. The handoff is the primary lever; routing matters less than assumed. |
| Loud fails convert, silent fails do not | The handoff fixes missing context but not missing checks. §5's verifiability questions carry the routing. |
| Few convert | The handoff adds little on your workload. Routing and architect/editor carry it. |

---

## 5. The Jev battery

### 5.1 Restore the adapter

`jev/` was deleted in stage 4b. Restore `adapter.ts` and `state-builder.ts` from git. Do not restore `questions.ts` or `selectTier`; both are replaced. Keep `ESCALATE_DEFAULTS` semantics: on any Jev failure the route is the safe one.

Check Jev's per-call cost and latency with the full battery before §5.3, and record both. The battery is cheap only if a many-question call costs about what a five-question call did.

### 5.2 The starting battery

Each question must be answerable from **prompt plus handoff**. A question whose answer is not in that input is not asked — that was `single_file_edit`'s failure.

Starting set. §5.4 prunes it.

**Verifiability — silent-failure risk:**
- V1 Does every requirement in the checklist map to an existing or specified test?
- V2 Does the task set a numeric value, threshold, limit, or default?
- V3 If V2: does any listed check constrain that value's magnitude, not just its sign or presence?
- V4 Could a plausible wrong implementation pass every listed check?

**Blast radius:**
- B1 Does the change modify a symbol with importers outside the implicated files? *(handoff fan-in)*
- B2 Does it touch a shared surface — a section key, hook registration, settings key, or exported type? *(handoff)*
- B3 Could a wrong change fail at runtime in a way the listed tests do not exercise — load order, process lifecycle, a subprocess?

**Judgment:**
- J1 Does the prompt or spec leave a design choice open between approaches?
- J2 Do any two requirements potentially conflict?

**Scope and familiarity:**
- S1 Does the task create a file under `extensions/`, `lib/`, or `settings/`?
- S2 Does the prompt name two or more **numbered spec sections or stages** (for example "§3" and "§4")? *Reworded 2026-09-24: "section" alone collided with `systemPromptOptions.sections` in this codebase.*
- S3 Does it use an API or package not used in any implicated file?

**Reversibility:**
- R1 Is the change confined to version-controlled files, with no install, network, or data side effect?

### 5.3 Answer accuracy

S1, S2, B1, B2 and R1 have deterministic ground truth in `reference_diff` and the handoff. Score Jev's answers on these across all tasks. Report accuracy per question.

**Amended 2026-09-24: the threshold is per question.** A question below 90% is a question defect — reword it, fix its label rule, or drop it. The classifier fails only if **three or more** deterministic questions fall below 90% after one rewording pass each. The original aggregate rule let one ambiguous question (S2, 4/16) veto a classifier that scored 60/61 on the rest.

### 5.4 Question leverage

Split the tasks into two halves, stratified by size. On the first half, for each question, measure how well its answer predicts:

- silent fail (the priority)
- any Luna fail
- whether the handoff converted the failure

Keep questions that carry signal on the first half. Build the aggregation rule on the first half. **Score everything on the second half only.** With 16–20 tasks this is a small sample; report the rule's second-half result with its counts, not as a percentage alone.

Default aggregation, to beat: **asymmetric.** Any yes on V4, B1, B3, or J1, or a no on V1 or V3 → not Luna solo. Upgrades are cheap and bounded; a silent fail is not.

### 5.5 Add questions, don't just prune

After §5.4, look at every silent fail and ask what question would have caught it. Add those, re-run the battery — a Jev call, cents — and re-score on the second half. This is where accuracy improves: from questions written against observed failures, not questions written in advance.

---

## 6. Architect/editor — on what the handoff did not fix

For every task that failed on Luna plus handoff, run Sol as architect and Luna as editor:

1. Sol reads prompt and handoff and writes a plan: per-file changes, and for each change the check that proves it.
2. `implement`, pinned to Luna, executes one file per dispatch with its plan section and its check.
3. Sol verifies: `tsc --noEmit`, the visible checks, and a pass over the checklist confirming each requirement is implemented and checked.

Child bounds from `docs/SPEC-harness-setup.md` §15.3 are a prerequisite. If they are not in place, build them first; children escape every parent bound, and the bash escape is on INDEX row 42.

Compare against Sol solo on the same tasks from §3: held-out result, provider cost, wall clock.

---

## 7. Router decision — offline

§2–§6 produce an outcome matrix: every task, every arm run, with pass/fail class, cost, and wall clock. Evaluate every candidate policy against it by replay. No new model runs.

### 7.1 Policies

| Policy | Rule |
|---|---|
| Always Sol | Sol solo on everything. |
| Always Luna, cascade | Luna with handoff; on a visible-check failure, Sol. Silent fails ship. |
| Three-step cascade | Luna; on a visible-check failure, Terra; on a second failure, Sol. Include only if the §12.6 Terra probe passed at least one task. |
| Always Terra | Terra on everything. The middle-tier baseline. |
| `pi-smart-router` | Its tier choice per task. Obtain it without a full run: its shadow or eval mode if one exists, otherwise a one-round launch with the decision logged. Include its first-turn pin — the route it pins is the route for the whole task. |
| Jev battery | The §5.4 rule, choosing Luna-with-handoff, architect/editor, or Sol solo, with the cascade on top. |
| Oracle | The cheapest arm that passed held-out, per task. The ceiling. |

### 7.2 Report, per policy

Provider cost per task, wall clock per task, **silent fails shipped**, loud fails recovered, and distance from the oracle. Rank by silent fails first, then cost.

### 7.3 Does `pi-smart-router` pay for itself?

It pays for itself if its policy ships no more silent fails than the Jev policy and costs no more. It is free to run, so the question is only whether its choices are as good.

| If | Then |
|---|---|
| Jev policy ships fewer silent fails | `pi-smart-router`'s classifier is the weak point. Replace it — §8. |
| Equal silent fails, `pi-smart-router` cheaper | Keep it, and use Jev only to override its first-turn pin toward Sol when the battery says so. |
| Always Luna with cascade matches the Jev policy | The handoff and the cascade are doing the work and routing adds nothing on your workload. Keep the cheapest router that does not pin a hard task to Luna. |

---

## 8. Build the winner

Whichever policy §7 selects, the implementation needs:

- **Route once per user turn**, before the first inference, and never switch mid-turn. Cache share has held 0.95–0.98 with this shape; preserve it.
- **The handoff built before routing**, passed to Jev, and prepended to whichever model executes.
- **The cascade:** on a visible-check failure after a Luna attempt, restart on Sol **from the handoff plus a one-paragraph failure summary**, not by continuing Luna's trajectory. Restarting keeps Sol's context clean and its cache shape predictable.
- **Asymmetric stickiness** within a session: upgrades immediate; a downgrade back to Luna only after several consecutive turns the battery rates Luna-safe.

### 8.1 Adopt or build

Evaluate in this order and stop at the first that fits without a second patch:

1. **`jordilopez2/pi-smart-router`** — a router built on TypeSafe Jev with a keyword fallback. Fits if it can take a custom question list and a custom state carrying the handoff.
2. **`pi-shift-router`** — LLM judge, immediate upgrades, sticky downgrades. Fits if its judge can be replaced with a Jev call.
3. **Your own**, restored from the pre-4b `routing.ts` seam: `setModel` once per turn, Jev battery over prompt plus handoff. It was small before; it stays small.

Whatever is chosen, `extensions/bounds.ts` stays separate and untouched.

### 8.2 Retire the launcher

When §8 lands, `bin/pi-run`'s path rules become Jev questions (S1, S2 cover them) and the launcher is deleted.

---

## 9. One real task at scale

Only after §8 lands. One real spec of the 500k kind, through the new router.

Record: the route chosen and the battery answers that chose it; whether the handoff fit Jev's budget at this scale; whether the cascade fired; provider cost; held-out or manual review of completeness against the spec's requirement list.

This is a validation, not a measurement. One run cannot rank policies; §7 already did that.

---

## 10. Verify

1. `./doctor.sh --offline` and `./doctor.sh --project .` exit 0 after every section.
2. `tests/routing-suite/tasks.jsonl` exists; every held-out suite fails at `parent_sha` and passes at the commit.
3. The outcome matrix is in `.agent/explain/2026-09-24-outcome-matrix.md`: one row per task per arm, with class, cost, wall clock.
4. §5.3's per-question answer accuracy and §5.4's second-half result are recorded with counts.
5. §7's policy table is recorded, ranked by silent fails then cost.
6. No replay ever read or modified a held-out file; the restore log proves it.
7. `extensions/bounds.ts` is unchanged by §8.

---

## 11. Pre-committed next

| If | Then |
|---|---|
| Fewer than 12 tasks survive §1.3 | Too few to split in §5.4. Add tasks from another repository you work in before running §2. |
| §2 shows zero silent fails | Luna's failures on your workload are all detectable. The cascade alone is the policy; §5's verifiability questions have nothing to predict. Skip to §7 with the Always-Luna-cascade policy as the favourite. |
| §3 shows Sol failing tasks Luna passed | Solve sets are not nested here. The cascade must allow Sol-to-Luna fallback as well; revisit §8's cascade before building. |
| §4.2 shows Luna's checklist omitting more than one requirement in five | Sol writes the checklist. Recompute the handoff's cost and re-check §7 with it. |
| §5.3 answer accuracy under 90% on deterministic questions | Stop. Report. The classifier is not reliable on your inputs, and question design cannot fix that. |
| A question keeps high answer accuracy and zero leverage | Drop it. A correctly answered question that predicts nothing is `single_file_edit` again. |
| §7 finds the oracle far cheaper than every real policy | Record the gap and which tasks cause it. Those tasks are where the next battery questions come from. |
| §9 finds the handoff overflows Jev's 4,000-token budget | Trim the handoff by fan-in rank before trimming the checklist. The checklist is what protects against silent fails. |


---

## 12. Suite repair — added 2026-09-24, blocks everything after §2

The first pass through §2–§5 measured the graders more than the tiers. Seven tasks scored identically under Luna, Sol, and Luna with handoff — `ab12c94`, `bd51f93`, `78ce7cb`, `4384c58`, `59c9121`, `49d5a83`, `aoh-c40f118`. At least four fail because the held-out tests import a name or path the prompt never gives: `allocate_run_dir`, `lib/settings-keys.ts`, `lib/score-ab.ts`, `lib/hook-budget.ts`. No attempt could pass them.

Nothing in §2–§7 is re-run until this section is done. It is almost entirely scripted, which matters: the orchestrator's session quota is now the scarcest resource, and a script spends none of it.

### 12.1 Interface audit — no model calls

`scripts/audit-graders.mjs`. For every task, list every symbol, module path, and file the held-out tests import or reference. Mark each one **derivable** if it exists in the tree at `parent_sha` or is named in the prompt, and **undeclared** otherwise.

A task with any undeclared interface fails the audit. Report the list per task.

### 12.2 Repair by declaring the interface

For each failing task, add the undeclared interface to the prompt: the file path, the exported names, and their signatures, taken from the commit. Do not add behaviour, only the surface.

This makes the prompts more like your real specs, not less: the specs you write name paths and exports. A prompt that hides them measures guessing, which is not a skill your workflow needs.

Drop a task only if declaring its interface would describe the implementation — if the surface *is* the answer.

### 12.3 Visible checks must touch the new work

Split each task's held-out tests by requirement. Move the tests for roughly half the requirements into `visible_checks`; keep the rest hidden. Choose the split before any run and record it.

Now the classes mean what §2 intended: **silent fail** is passing what the task showed and failing what it did not — the 100k-default class. **Loud fail** is failing what it showed, which the cascade can catch.

### 12.4 Restore visible tests too

Before visible grading, restore every visible test file to its `parent_sha` or declared version, exactly as held-out files are restored. §3's visible totals drifted — `690b685` 42 → 31, `a2c7c72` 47 → 42, `s13-hard` 29 → 24 — so a run could shrink its own visible suite. Log both restores.

### 12.5 Re-verify

Every task: held-out fails at `parent_sha`; passes at the commit; passes the §12.1 audit with zero undeclared interfaces; visible checks fail at `parent_sha` for at least one requirement. If fewer than 12 tasks survive, add tasks from another repository before §2 re-runs.

### 12.6 Regrade first, re-run only what changed

The first pass cost $29.97 in pi runs, 98% of it the Sol arm, and exhausted the orchestrator's session quota. This pass is budgeted to a fraction of that.

**Before anything:** confirm the run trees from the first pass still exist under `/tmp/routing-s2/`, `/tmp/routing-s3/`, `/tmp/routing-s4/`. Copy them to a persistent location. All future run trees go there, not `/tmp`.

**Phase A — no model calls.**
1. §12.1 audit and §12.2 repair.
2. §12.3 split and §12.4 restore rules.
3. **Regrade every existing run** — Luna, Sol, and handoff — for every task whose prompt did not change in §12.2. Capped Sol runs stay censored.

**Phase B — cents, plus one small Terra probe.**
1. Luna on every task whose prompt changed.
2. Jev on S2 only, all tasks. The other twelve answers stand.
3. **Terra probe.** Terra has never run as a parent on this suite. Run it on the two tasks where Sol passed and Luna failed with clean grades, `aoh-5cbfb21` and `aoh-fb5d493`, after confirming both pass the §12.1 audit. Pin `openai/gpt-5.6-terra` at **medium** thinking — the host config's `low` would confound tier with thinking. Estimated $1–2.
   - Passes both: re-run one at `low`. Record whether the cheaper setting holds. Terra becomes Phase C's first escalation target.
   - Passes one: Terra is Phase C's first step, Sol behind it.
   - Passes neither: Terra has no capability niche here. Phase C goes straight to Sol and Terra is dropped from §7.

**Decision point.** Count tasks Luna fails after A and B.

**Phase C — the only dollar spend, conditional.**
- If Luna fails **two or fewer** tasks: skip. The existing Sol evidence on `aoh-5cbfb21` and `aoh-fb5d493` suffices. Write a Jev question targeting what the remaining failures share and go to §5.4.
- If Luna fails **three or more**: escalate in steps, stopping each task at its first pass.
  1. Terra, at whichever thinking level the probe settled, on **at most four** of Luna's failures, chosen for different failure types. Skip this step if the probe passed neither task.
  2. Sol, only on those Terra fails.
  - Hard budget **$10** for the phase across both tiers. Do not re-run `a0043ca` or `4704b4f`; they passed on both tiers and are regraded in Phase A.

**Handoff (§4.3):** only on tasks Phase C finds Sol passing and Luna failing. Otherwise skip.

### 12.6a Script the runs

Write `scripts/run-arm.sh <arm> <task-list>` once: pin the model, run, restore held-out and visible files, grade, append one row to the outcome matrix. The orchestrator writes the script and the report and does not step through individual runs. A run that needs attention writes it to the row; the orchestrator reads rows, not transcripts.

### 12.7 What carries forward unchanged

- Luna's requirement checklist matched Sol's on 42 of 42 requirements. §4.2's verdict stands: Luna writes the checklist.
- Jev's cost: $0.000056 per 13-question call, under 3s. The battery can grow freely.
- `aoh-5cbfb21` and `aoh-fb5d493` — Sol passed, Luna failed with and without handoff, clean grades. Keep them; re-verify under §12.1, but they are the suite's strongest discriminating tasks so far.

---

## 13. Checkers — what catches missing work in production — added 2026-09-24

### 13.1 The gap

The suite grades with held-out tests. Production has none. What runs in real work — post-edit typecheck, existing tests, tests the model writes, bounds, the `explain.ts` walkthrough — catches type errors, regressions, and runaway turns. None of it catches a requirement that was never implemented or never tested. The cascade's "visible-check failure" trigger therefore fires only on regressions and type errors, and silent fails ship.

Routing reduces how often silent fails happen. A checker is what catches them. **If a checker turns most silent fails into loud ones, the cascade handles them nearly for free, and always-Luna-with-cascade becomes the default policy.** That makes this section at least as important as §5.

### 13.2 Candidates, cheapest first

| # | Checker | Input | Cost per run | Can catch | Cannot catch |
|---|---|---|---|---|---|
| C1 | Checklist reconciliation | Checklist, diff, test files | ~0, mostly scripted | Requirements with no code change or no test referencing them | Wrong code with a wrong test |
| C2 | Jev coverage questions | Per requirement: its text and the relevant diff hunks | ~$0.00006 per requirement | Requirements the diff does not implement | Subtle errors inside an implemented requirement |
| C3 | Blind tests | Checklist and declared interfaces, **not** the implementation | ~$0.02 on Luna | Behaviour the implementation gets wrong, as held-out does | Requirements missing from the checklist |
| C4 | Sol review | Diff against checklist | ~$0.10–0.30 | Most of the above, with judgment | Whatever Sol misses |

**Source of the checklist:** when the prompt names a spec, extract the spec's numbered Verify items first, then the body. Verify items are acceptance criteria written before any code, and they are the strongest input any checker here gets.

### 13.3 Evaluate on the corpus you already have

No new implementation runs. The corpus is every run tree from §2, §3, §4 and §12's Phase B, **restricted to tasks whose prompt did not change in §12.2** plus the Phase B reruns — an old run graded against a prompt that has since changed is not a fair test of a checker.

Ground truth per run: held-out pass or fail, and after §12.3's split, which requirement's tests failed.

Run each checker over each run's output. Score:

| Metric | Definition |
|---|---|
| **Recall on silent fails** | Of runs that passed visible and failed held-out, the share the checker flagged. The priority. |
| Requirement precision | When it flags a specific requirement, how often that requirement's held-out tests actually failed. |
| False-alarm rate | Of runs that passed held-out, the share the checker flagged. Each false alarm costs an unnecessary escalation. |
| Cost per run | Provider cost of the check. |

Run C1 and C2 on the whole corpus first — together about two cents. Run C3 on the whole corpus if C1 and C2 leave recall under 80%. Run C4 only on the silent fails C1–C3 missed, plus an equal number of clean passes as a false-alarm control.

### 13.4 Verdict

| If | Then |
|---|---|
| Some combination of C1–C3 reaches 80% recall with false alarms under 20% | Adopt it as the cascade trigger. In §7, add a policy "always Luna, cascade on checker flag" and re-run the replay. Expect it to be the cheapest policy within reach of the oracle. |
| Only C4 reaches 80% | Sol review is the checker. Cost it into §7's policies: every Luna run pays one review. Compare against routing more work to Terra or Sol directly. |
| No checker reaches 50% | Missing work is not detectable cheaply on your workload. Routing carries the whole load; §5's verifiability questions become the priority, and anything Jev rates silent-fail-prone goes to Sol. |
| C2 performs well | Jev's coverage questions are the cheapest high-volume check available. Move them into the production turn: after every edit turn, one Jev call per requirement. |
| C3 recall is high but C3's own tests fail on correct code | The blind tests are over-specified. Constrain them to declared interfaces and observable behaviour, and re-score. |

### 13.5 Order within §12

This section runs after §12.6 Phase B and before Phase C. If a checker reaches the first verdict row, Phase C's Sol runs may be unnecessary — the question becomes whether the cascade with a checker recovers Luna's failures, not whether Sol passes them.
