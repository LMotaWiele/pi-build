# Delegation measurement — 2026-09-22

The numbers below are copied from the local telemetry databases. Those files stay where the runs wrote them. This file is the record.

| Run | Database | Commit | What it is |
|---|---|---|---|
| Void pair before §4.0 | `/tmp/pi-build-ab/telemetry.db` | `bd51f93` | Two trials, both void. See SPEC §4.3a. |
| Six at `9d81e6b` | `/tmp/pi-build-ab-set/telemetry.db` | `9d81e6b` | Full set. Rule 0: `VOID`. |
| Re-run, stopped | `/tmp/pi-build-ab-set2/telemetry.db` | `f8edcd2` | Two trials. Not a set of six. Not scored. |

Catalog dollars are the §1.2 card (codex Sol 5 / 0.50 / 30). They are not the Grok tripwire. Pi rows are the measurement.

## Six at 9d81e6b

Arm B has 0 non-void trials. Rule 0 matches. Rules 1–6 do not run.

Each arm B child was `explore`. `implement` was installed and was not named. Children hit `no progress: 6 reads and 0 edits`. The parent then edited the fixture. Parent and child were both `gpt-5.6-sol`.

| Trial | Arm | Completed | Bound | Prompt tokens | Cache share | Cost | Peak parent | Wall | Idle gap |
|---|---|---|---|---|---|---|---|---|---|
| 1 | A | yes | — | 145802 | 0.8551 | 0.242506 | 19991 | 403.486 | — |
| 2 | B | void | — | 236547 | 0.6304 | 0.739925 | 15166 | 500.672 | 1.041 |
| 3 | A | yes | — | 158841 | 0.7664 | 0.326259 | 20077 | 411.887 | 1.060 |
| 4 | B | void | — | 241799 | 0.6580 | 0.701437 | 16818 | 499.713 | 1.042 |
| 5 | A | no | no progress: 6 reads and 0 edits | 16385 | 0.4375 | 0.061489 | 9086 | 142.475 | 1.043 |
| 6 | B | void | — | 169329 | 0.7106 | 0.520395 | 16102 | 516.602 | 1.045 |

Trials 1 and 3 each edited all six fixture files. Trial 5 is a real miss, not a void: the bound is no-progress, not three consecutive tool failures.

Same-arm spacing was inside the 1800s cache TTL: about 502s and 501s before arm A's later trials, and about 404s, 413s, and 144s before arm B's. Arm A's two finished runs show a higher cache-read share than arm B. That column was not used to change the order or the rules.

## Re-run at f8edcd2, stopped after trial 2

The arm B prompt named `implement` and told the parent not to read, edit, or write the fixture files. The runner stopped because it marked trial 2 void. That mark does not hold.

| Trial | Arm | What the runner recorded | What the rows show |
|---|---|---|---|
| 1 | A | completed, 403.754s, 12 calls | Parent edited all six fixture files. |
| 2 | B | void: 0 child edits; parent wrote a fixture file. Bound `wall clock 645510ms >= 600000ms`. | The outer session dispatched `implement`, then hit the wall clock. It did not edit. A nested `pi` the parent started from bash did dispatch `implement`, and those children edited all six fixture files. Their `parent_turn_id` is `16157b26-f216-4ee9-aa9b-197807c24c98`, not the outer turn `30c6db7f-4f6b-461a-ae53-f46be07f114b`. The runner only joined the outer id, so it counted 0 child edits. The parent-wrote flag came from bash commands whose text contains `tests/fixtures/ab/`, including `find`. |

This is not a completed set of six. Rule 0 is not applied to it. The join has to follow a nested session before another six would be interpretable.

## Not decided

§6.A and §6.B were not applied. INDEX row 12 stays open: child cache on a real delegated edit was not measured on the outer turn, because the only child edits in the re-run sit on a nested turn the scorer did not join.
