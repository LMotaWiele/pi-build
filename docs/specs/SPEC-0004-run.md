# SPEC-0004 run record

Reports moved here from `.agent/explain/` on 2026-09-29, verbatim.

## Moved from `.agent/explain/2026-09-24-outcome-matrix.md`

# Routing outcome matrix — 2026-09-24

Section 2, Luna only. Model pin `openai-codex/gpt-5.6-luna`. No router. Seventeen tasks. Provider cost is the sum of `inference_calls.cost_usd` (already dollars). Parent cost is the same sum on the parent session. Rounds are parent inferences. Wall clock is the process elapsed, in seconds, and does not include grading. Reads are distinct read-tool paths before the first edit or write.

Every inference model was `gpt-5.6-luna`. No task hit the $0.50 cap or the 40-minute wall. Every process exit code is 0.

Twelve silent fails, four passes, one loud fail, zero odd. Provider cost $0.37095044. Parent cost $0.33536532. 309 parent rounds. Twelve silent fails keep the ladder on section 3.

Held-out files were absent or hashed differently from the commit blob at process start (`same=false` on every held-out line). The overlay timestamp is after `pi_exit` on every restore log under `/tmp/routing-s2/runs/<id>/restore.log`. Grade hashes match the commit blobs. Replay edits under `tests/` were restored away before either grade.

| Task | Class | Visible | Held-out | Provider $ | Parent $ | Rounds | Wall s | Reads |
|---|---|---|---|---|---|---|---|---|
| ab12c94 | Silent fail | 30 pass, 0 fail | 0 pass, 2 fail | 0.01764760 | 0.01764760 | 16 | 93.438 | 5 |
| bd51f93 | Silent fail | 32 pass, 0 fail | 5 pass, 6 fail | 0.03394616 | 0.03217660 | 26 | 187.284 | 5 |
| a0043ca | Pass | 38 pass, 0 fail | 4 pass, 0 fail | 0.01232200 | 0.01232200 | 11 | 72.583 | 2 |
| 78ce7cb | Silent fail | 39 pass, 0 fail | 1 pass, 3 fail | 0.02634960 | 0.01928256 | 18 | 146.427 | 3 |
| 4384c58 | Silent fail | 42 pass, 0 fail | 0 pass, 1 fail | 0.01708508 | 0.01708508 | 14 | 93.601 | 4 |
| 59c9121 | Silent fail | 47 pass, 0 fail | 2 pass, 1 fail | 0.02408792 | 0.01838964 | 19 | 125.851 | 4 |
| a2c7c72 | Loud fail | 46 pass, 1 fail | 1 pass, 4 fail | 0.02478332 | 0.02391272 | 20 | 120.685 | 2 |
| 4704b4f | Pass | 42 pass, 0 fail | 12 pass, 0 fail | 0.02312640 | 0.02312640 | 19 | 95.803 | 3 |
| 9e26310 | Pass | 54 pass, 0 fail | 12 pass, 0 fail | 0.01577240 | 0.00798500 | 13 | 86.959 | 4 |
| 690b685 | Pass | 42 pass, 0 fail | 8 pass, 0 fail | 0.01939100 | 0.01853480 | 18 | 85.903 | 1 |
| 49d5a83 | Silent fail | 50 pass, 0 fail | 0 pass, 2 fail | 0.01860456 | 0.01860456 | 19 | 92.961 | 5 |
| s6-benchmark | Silent fail | 29 pass, 0 fail | 13 pass, 3 fail | 0.03348008 | 0.03348008 | 26 | 163.435 | 3 |
| s13-hard | Silent fail | 29 pass, 0 fail | 4 pass, 4 fail | 0.03369016 | 0.03156916 | 25 | 165.223 | 4 |
| aoh-6ba7e7e | Silent fail | 143 pass, 0 fail | 46 pass, 3 fail | 0.01451812 | 0.00886264 | 8 | 129.226 | 2 |
| aoh-5cbfb21 | Silent fail | 103 pass, 0 fail | 0 pass, 0 fail, exit 1 | 0.01919004 | 0.01543048 | 17 | 134.929 | 5 |
| aoh-fb5d493 | Silent fail | 114 pass, 0 fail | 52 pass, 2 fail | 0.01514832 | 0.01514832 | 16 | 96.482 | 4 |
| aoh-c40f118 | Silent fail | 211 pass, 0 fail | 0 pass, 0 fail, exit 2 | 0.02180768 | 0.02180768 | 24 | 114.534 | 6 |

`aoh-5cbfb21` produced no held-out summary inside the 180s grader limit. A later regrade passed the first five tests in `tests/primitives/test_parallel.py` and hung on `test_cancel_on_kills_pending_children`. Visible checks passed, so the class stays Silent fail.

`aoh-c40f118` held-out collection exited 2: `ImportError: cannot import name 'allocate_run_dir' from 'tests.research_panel.run'`. Visible checks passed, so the class stays Silent fail.

The loud fail is `a2c7c72`.

## Sol selection

Sol ran on the thirteen Luna failures and on three of the four Luna passes: `a0043ca`, `4704b4f`, `690b685`. The pass held out of that draw is `9e26310`.

## Section 3 — Sol

Model pin `openai-codex/gpt-5.6-sol`, thinking high. Sixteen tasks. Provider cost $29.28209280. Parent cost $27.36353840. Four passes, eight silent fails, four loud fails, zero odd. Every counted inference model was `gpt-5.6-sol`.

Held-out files were overlaid only after `pi_exit`. Restore logs are under `/tmp/routing-s3/runs/<id>/restore.log`. Grade hashes match the commit blobs.

One earlier attempt on `s6-benchmark` and `s13-hard` was discarded. Sol executed a test that inserted a fixture inference row, session `s` and model `m`, and the pin checker treated that row as a model switch and killed both processes. Those two rows below are the rerun. The checker now ignores fixture rows.

Five tasks stopped at the $3 cap. Their grades are from the interrupted process: `bd51f93`, `59c9121`, `a2c7c72`, `s6-benchmark`, `s13-hard`.

| Task | Class | Visible | Held-out | Provider $ | Parent $ | Rounds | Wall s | Reads | Stop |
|---|---|---|---|---|---|---|---|---|---|
| ab12c94 | Silent fail | 30 pass, 0 fail | 0 pass, 2 fail | 1.58619600 | 1.49801040 | 28 | 303.982 | 11 | |
| bd51f93 | Silent fail | 32 pass, 0 fail | 5 pass, 6 fail | 3.13632240 | 3.03534400 | 37 | 532.105 | 22 | cost-cap |
| a0043ca | Pass | 38 pass, 0 fail | 4 pass, 0 fail | 0.68046240 | 0.59418320 | 21 | 239.776 | 6 | |
| 78ce7cb | Silent fail | 39 pass, 0 fail | 1 pass, 3 fail | 0.73873600 | 0.73873600 | 16 | 234.829 | 10 | |
| 4384c58 | Silent fail | 42 pass, 0 fail | 0 pass, 1 fail | 1.31876000 | 1.31876000 | 23 | 240.753 | 18 | |
| 59c9121 | Silent fail | 47 pass, 0 fail | 2 pass, 1 fail | 3.02328080 | 2.82133920 | 41 | 576.850 | 17 | cost-cap |
| a2c7c72 | Loud fail | 41 pass, 1 fail | 4 pass, 2 fail | 3.06899360 | 2.79726400 | 57 | 667.525 | 19 | cost-cap |
| 4704b4f | Pass | 42 pass, 0 fail | 12 pass, 0 fail | 0.68432240 | 0.56509680 | 23 | 219.358 | 10 | |
| 690b685 | Loud fail | 30 pass, 1 fail | 6 pass, 2 fail | 1.72878720 | 1.69401600 | 33 | 381.207 | 33 | |
| 49d5a83 | Silent fail | 50 pass, 0 fail | 0 pass, 2 fail | 2.28251040 | 2.16305440 | 41 | 553.932 | 25 | |
| s6-benchmark | Loud fail | 28 pass, 1 fail | 14 pass, 2 fail | 3.07390800 | 2.89656000 | 44 | 578.165 | 25 | cost-cap |
| s13-hard | Loud fail | 23 pass, 1 fail | 6 pass, 3 fail | 3.21510400 | 3.00325680 | 46 | 681.635 | 19 | cost-cap |
| aoh-6ba7e7e | Silent fail | 143 pass, 0 fail | 44 pass, 5 fail | 0.81059280 | 0.52661760 | 19 | 403.573 | 7 | |
| aoh-5cbfb21 | Pass | 103 pass, 0 fail | 39 pass, 0 fail | 1.39830480 | 1.33872480 | 31 | 394.351 | 22 | |
| aoh-fb5d493 | Pass | 114 pass, 0 fail | 54 pass, 0 fail | 1.13412720 | 1.05228000 | 26 | 218.145 | 16 | |
| aoh-c40f118 | Silent fail | 211 pass, 0 fail | 0 pass, 0 fail, exit 2 | 1.40168480 | 1.32029520 | 32 | 311.530 | 17 | |

`690b685` passed on Luna and loud-failed on Sol. The process exited 1 and did not hit the cap. `a0043ca` and `4704b4f` passed on both. Solve sets are not nested. The cascade has to allow a Sol failure to fall back to Luna, and that cascade is revisited before section 8 is built.

Sol passed `aoh-5cbfb21` and `aoh-fb5d493`, both silent fails on Luna. `aoh-fb5d493` exited 1 and both grades passed. `aoh-c40f118` again failed collection with `ImportError: cannot import name 'allocate_run_dir'`. `aoh-5cbfb21` held out 39 pass, 0 fail.

## Section 4 — handoff

The checklist comparison was fixed before any checklist call: `ab12c94`, `a0043ca`, `a2c7c72`, `59c9121`, `aoh-6ba7e7e`. Sol listed 42 requirements across those five. Luna omitted 0. That is not more than one in five, so Luna writes the checklist. On `a0043ca` the check labels differed — Luna said no check exists where Sol said new test — and the obligations still matched.

The deterministic half is `scripts/handoff.mjs`. Every delivered handoff was under the 4,000-token state budget. The longest, `s13-hard`, was 6,279 characters.

Section 4.3 reran Luna's loud fail and twelve silent fails with that handoff prepended. Model pin `openai-codex/gpt-5.6-luna`. No router. The four section 2 passes were not rerun. Provider cost $0.31833496. Parent cost $0.26834988. 250 parent rounds. Zero passes, twelve silent fails, one loud fail, zero odd. Every counted inference was `gpt-5.6-luna`. No task hit the $0.50 cap or the 40-minute wall. Every process exit code is 0.

Held-out files were overlaid only after `pi_exit`. No restore line says `same=true`. Grade hashes match the commit blobs. Restore logs are under `/tmp/routing-s4/luna-handoff/<id>/restore.log`.

| Task | Class | Visible | Held-out | Provider $ | Parent $ | Rounds | Wall s | Reads |
|---|---|---|---|---|---|---|---|---|
| ab12c94 | Silent fail | 30 pass, 0 fail | 0 pass, 2 fail | 0.01881168 | 0.01881168 | 17 | 103.967 | 5 |
| bd51f93 | Silent fail | 32 pass, 0 fail | 5 pass, 6 fail | 0.02961980 | 0.02253788 | 19 | 116.117 | 9 |
| 78ce7cb | Silent fail | 39 pass, 0 fail | 1 pass, 3 fail | 0.03069516 | 0.02427000 | 18 | 122.384 | 1 |
| 4384c58 | Silent fail | 42 pass, 0 fail | 0 pass, 1 fail | 0.01968300 | 0.01968300 | 14 | 81.922 | 3 |
| 59c9121 | Silent fail | 47 pass, 0 fail | 2 pass, 1 fail | 0.03200188 | 0.02556104 | 22 | 170.884 | 2 |
| a2c7c72 | Silent fail | 47 pass, 0 fail | 1 pass, 2 fail | 0.03178764 | 0.02775476 | 26 | 190.580 | 3 |
| 49d5a83 | Silent fail | 50 pass, 0 fail | 0 pass, 2 fail | 0.01635624 | 0.01635624 | 19 | 107.928 | 6 |
| s6-benchmark | Loud fail | 23 pass, 1 fail | 12 pass, 2 fail | 0.02135508 | 0.02135508 | 24 | 129.997 | 4 |
| s13-hard | Silent fail | 29 pass, 0 fail | 7 pass, 4 fail | 0.04902264 | 0.02759952 | 25 | 351.375 | 0 |
| aoh-6ba7e7e | Silent fail | 143 pass, 0 fail | 44 pass, 5 fail | 0.01161752 | 0.01161752 | 11 | 93.100 | 2 |
| aoh-5cbfb21 | Silent fail | 103 pass, 0 fail | 31 pass, 8 fail | 0.01661368 | 0.01661368 | 17 | 114.533 | 6 |
| aoh-fb5d493 | Silent fail | 114 pass, 0 fail | 53 pass, 1 fail | 0.01557916 | 0.01557916 | 17 | 97.572 | 5 |
| aoh-c40f118 | Silent fail | 211 pass, 0 fail | 0 pass, 0 fail, exit 2 | 0.02519148 | 0.02061032 | 21 | 154.784 | 7 |

No failure became a pass. `a2c7c72` moved from loud to silent: visible is now 47 pass and 0 fail, and held-out is still 1 pass and 2 fail. `s6-benchmark` moved from silent to loud: visible is 23 pass and 1 fail. `aoh-5cbfb21` held out 31 pass and 8 fail instead of hanging with no summary, and it still fails. `aoh-c40f118` collection again exited 2. The handoff adds little on this workload. Routing and architect/editor carry it. Section 5 is next.

## Section 5 — Jev battery

`extensions/jev/adapter.ts` and `extensions/jev/state-builder.ts` are restored from `9e26310ebdcd54ffb8e9e1c3c65deea616677065`. `extensions/jev/questions.ts` is a new thirteen-question battery. It is not the deleted question module. On a failed decision the defaults keep the route off Luna solo. Each call saw the handoff, the Luna checklist, and the task prompt. None of the sixteen states needed a trim. `s13-hard` was not sent. It is the last large prompt, and its handoff plus checklist plus prompt is the one state that crowds the 4,000-token budget.

Deterministic labels for S1, S2, B1, B2, and R1 were written at 2026-09-24T17:41:43Z, before any decision call. S1 is scored only when the reference diff and the named-missing list agree about a new file under `extensions/`, `lib/`, or `settings/`. S2 is yes only when the prompt names two or more numbered sections or stages. B1 is yes when a fan-in row has an outside count above zero. B2 is yes when the shared list is non-empty. R1 is yes when the prompt does not instruct an install, a fetch, or a publish.

The cost probe used `ab12c94`, one state. Five questions (S1, S2, B1, B2, R1): 723 ms, 807 input tokens, 89 output tokens, cost 0.000033894. Thirteen questions: 263 ms, 1342 input tokens, 225 output tokens, cost 0.000056364. The full battery cost 1.66 times the five-question call. Every latency in the run was under 3000 ms. The adapter's default timeout would not have replaced these answers. Seventeen calls, one five-question probe and sixteen full batteries, cost 0.001018.

Three S1 items were left unscored. The diff adds a file the handoff does not name: `bd51f93` adds `lib/settings-keys.ts`, `4384c58` adds `lib/score-ab.ts`, and `49d5a83` adds `lib/hook-budget.ts`.

| Question | Correct | Scored |
|---|---|---|
| S1 | 13 | 13 |
| S2 | 4 | 16 |
| B1 | 16 | 16 |
| B2 | 16 | 16 |
| R1 | 15 | 16 |
| All | 64 | 77 |

64 of 77 is 83%. That is under 90%. Section 5 stops here. The classifier is not reliable on these inputs, and the rest of this section would measure noise.

S2 is the gap. None of the sixteen prompts name two numbered sections. Twelve answers were yes: `ab12c94`, `bd51f93`, `78ce7cb`, `59c9121`, `a2c7c72`, `9e26310`, `690b685`, `49d5a83`, `s6-benchmark`, `aoh-5cbfb21`, `aoh-fb5d493`, `aoh-c40f118`. The four nos were `a0043ca` at 0.48, `4384c58` at 0.48, `4704b4f` at 0.49, and `aoh-6ba7e7e` at 0.36. The yes answers ran from 0.55 to 0.97. `49d5a83` names two section keys and scored 0.97. The frozen rule counts numbered sections only, so that label stayed no. Counting that single item as yes would be 65 of 77, still under 90%. R1 missed only `690b685`, at 0.40 against a yes label.

## Section 12 — suite repair

The amended spec continues past the aggregate stop. Nothing in sections 2 through 7 is re-run until the graders are repaired. This section made no model call.

The first-pass trees under `/tmp/routing-s2`, `/tmp/routing-s3`, `/tmp/routing-s4`, and `/tmp/routing-s5` were absent after the 2026-09-26 10:44 reboot. Phase A cannot regrade them. Later run trees go under `/home/george-contis/var/routing-runs`.

Eight prompts now declare the path and the signatures the held-out tests import: `bd51f93`, `4384c58`, `59c9121`, `a2c7c72`, `690b685`, `49d5a83`, `s13-hard`, `aoh-c40f118`. The undeclared surface at `4384c58` is the explain one-shot, not `lib/score-ab.ts`. That file is not imported by the graded held-out test.

`9e26310` does not survive. Its held-out change is one assertion inside an existing test, so it cannot fail on a visible half and a hidden half at once. Sixteen tasks remain. For each one, the hidden tests fail at the parent and pass at the commit, the interface audit reports nothing undeclared, and the visible half fails at the parent. The split is recorded on each task before any re-run.

## Invalid launch — luna flags as messages

The runner placed `--model`, `--approve`, and `--session-dir` after `--`. Pi treated each of those as another user message. Sessions started on gpt-5.6-luna at thinking minimal, and the hidden-file restore still ran, but this is not the pinned arm. The pinned re-run is the later luna section. Provider cost of this launch was 0.431110.

The first-pass trees were absent and the grader split changed, so the re-run covers every surviving task, including prompts that did not change. Run trees are under `/home/george-contis/var/routing-runs/luna`. A cost-cap stop is censored.

| Task | Class | Visible | Held-out | Provider $ | Parent $ | Rounds | Wall s | Reads | Stop |
|---|---|---|---|---|---|---|---|---|---|
| ab12c94 | Pass | 1 pass, 0 fail | 1 pass, 0 fail | 0.01903228 | 0.01903228 | 19 | 79.941 | 3 |  |
| a0043ca | Pass | 2 pass, 0 fail | 1 pass, 0 fail | 0.02483892 | 0.02072988 | 18 | 100.350 | 1 |  |
| bd51f93 | Loud fail | 3 pass, 2 fail | 2 pass, 2 fail | 0.03964372 | 0.03603696 | 33 | 180.001 | 12 |  |
| 4384c58 | Pass | 2 pass, 0 fail | 1 pass, 0 fail | 0.02336400 | 0.02336400 | 26 | 145.253 | 5 |  |
| 78ce7cb | Silent fail | 2 pass, 0 fail | 1 pass, 1 fail | 0.03915544 | 0.03387148 | 33 | 172.999 | 4 |  |
| 59c9121 | Silent fail | 2 pass, 0 fail | 1 pass, 1 fail | 0.02094300 | 0.01937652 | 22 | 123.931 | 1 |  |
| 4704b4f | Pass | 1 pass, 0 fail | 1 pass, 0 fail | 0.01942544 | 0.01133276 | 19 | 132.488 | 2 |  |
| a2c7c72 | Silent fail | 2 pass, 0 fail | 1 pass, 1 fail | 0.03787636 | 0.03787636 | 32 | 173.360 | 4 |  |
| 690b685 | Silent fail | 1 pass, 0 fail | 0 pass, 1 fail | 0.03193532 | 0.03193532 | 29 | 161.064 | 1 |  |
| 49d5a83 | Pass | 1 pass, 0 fail | 1 pass, 0 fail | 0.01871516 | 0.01871516 | 19 | 92.057 | 10 |  |
| aoh-6ba7e7e | Silent fail | 5 pass, 0 fail | 7 pass, 1 fail | 0.01071784 | 0.01071784 | 16 | 88.659 | 3 |  |
| s6-benchmark | Silent fail | 3 pass, 0 fail | 2 pass, 1 fail | 0.04249180 | 0.04249180 | 34 | 150.393 | 3 |  |
| aoh-5cbfb21 | Loud fail | 4 pass, 2 fail | 3 pass, 2 fail | 0.01886644 | 0.01886644 | 24 | 115.994 | 6 |  |
| aoh-fb5d493 | Silent fail | 5 pass, 0 fail | 3 pass, 1 fail | 0.01894980 | 0.01894980 | 20 | 103.594 | 1 |  |
| aoh-c40f118 | Silent fail | 4 pass, 0 fail | 2 pass, 1 fail | 0.02119508 | 0.02119508 | 21 | 102.764 | 6 |  |
| s13-hard | Silent fail | 4 pass, 0 fail | 2 pass, 2 fail | 0.04395940 | 0.03872780 | 30 | 167.320 | 4 |  |

Sixteen tasks. 5 pass, 2 loud fail, 9 silent fail. Provider cost 0.431110, parent cost 0.403219, 395 rounds. Every inference was gpt-5.6-luna and none stopped. Each hidden file's hash was recorded before the overlay, and none matched the declared hidden text.

## Invalid launch — terra flags as messages

Same flag placement. The pin check stopped both sessions because the model was gpt-5.6-luna. These rows are not a Terra result.

Run trees are under `/home/george-contis/var/routing-runs/terra`. A cost-cap stop is censored.

| Task | Class | Visible | Held-out | Provider $ | Parent $ | Rounds | Wall s | Reads | Stop |
|---|---|---|---|---|---|---|---|---|---|
| aoh-5cbfb21 | censored | 0 pass, 6 fail | 1 pass, 4 fail | 0.00124968 | 0.00124968 | 2 | 15.031 | 0 | pin |
| aoh-fb5d493 | censored | 3 pass, 2 fail | 2 pass, 2 fail | 0.00180000 | 0.00180000 | 1 | 15.315 | 1 | pin |

## Section 12 Phase B — S2

One reworded question, one call per surviving task, labels frozen before the calls. A numbered spec section or stage counts. A section key does not. `s13-hard` is the only yes. `9e26310` is out. The other twelve questions were not re-asked, and 64 of 77 stands.

16 of 16 matched. Provider cost 0.000654. The largest state was 1722 tokens.

| Task | Label | noul | Match |
|---|---|---|---|
| ab12c94 | no | 0.03 | yes |
| bd51f93 | no | 0.06 | yes |
| a0043ca | no | 0.04 | yes |
| 78ce7cb | no | 0.04 | yes |
| 4384c58 | no | 0.06 | yes |
| 59c9121 | no | 0.05 | yes |
| a2c7c72 | no | 0.04 | yes |
| 4704b4f | no | 0.05 | yes |
| 690b685 | no | 0.06 | yes |
| 49d5a83 | no | 0.07 | yes |
| s6-benchmark | no | 0.05 | yes |
| s13-hard | yes | 0.97 | yes |
| aoh-6ba7e7e | no | 0.04 | yes |
| aoh-5cbfb21 | no | 0.04 | yes |
| aoh-fb5d493 | no | 0.06 | yes |
| aoh-c40f118 | no | 0.03 | yes |

## Section 12 Phase B — luna

The first-pass trees were absent and the grader split changed, so this arm re-runs every surviving task, including prompts that did not change. Run trees are under `/home/george-contis/var/routing-runs/luna`. A cost-cap stop is censored.

| Task | Class | Visible | Held-out | Provider $ | Parent $ | Rounds | Wall s | Reads | Stop |
|---|---|---|---|---|---|---|---|---|---|
| ab12c94 | Silent fail | 1 pass, 0 fail | 0 pass, 1 fail | 0.01236792 | 0.01236792 | 15 | 68.997 | 4 |  |
| a0043ca | Pass | 2 pass, 0 fail | 1 pass, 0 fail | 0.01564360 | 0.01564360 | 15 | 84.930 | 3 |  |
| bd51f93 | Loud fail | 3 pass, 2 fail | 2 pass, 2 fail | 0.03026304 | 0.03026304 | 34 | 168.377 | 11 |  |
| 78ce7cb | Silent fail | 2 pass, 0 fail | 1 pass, 1 fail | 0.02304928 | 0.02304928 | 19 | 107.863 | 3 |  |
| 4384c58 | Pass | 2 pass, 0 fail | 1 pass, 0 fail | 0.01254324 | 0.01254324 | 17 | 95.211 | 5 |  |
| 4704b4f | Pass | 1 pass, 0 fail | 1 pass, 0 fail | 0.01387940 | 0.01387940 | 14 | 80.162 | 4 |  |
| 59c9121 | Silent fail | 2 pass, 0 fail | 1 pass, 1 fail | 0.01447776 | 0.01447776 | 14 | 106.109 | 5 |  |
| a2c7c72 | Silent fail | 2 pass, 0 fail | 1 pass, 1 fail | 0.03002872 | 0.03002872 | 25 | 169.098 | 3 |  |
| 49d5a83 | Pass | 1 pass, 0 fail | 1 pass, 0 fail | 0.01297332 | 0.01297332 | 15 | 76.822 | 5 |  |
| aoh-6ba7e7e | censored | 4 pass, 1 fail | 5 pass, 3 fail | 0.01122456 | 0.01122456 | 13 | 65.032 | 4 | pin |
| 690b685 | Pass | 1 pass, 0 fail | 1 pass, 0 fail | 0.04070804 | 0.03448144 | 28 | 196.584 | 6 |  |
| aoh-5cbfb21 | censored | 3 pass, 3 fail | 2 pass, 3 fail | 0.01253028 | 0.01253028 | 13 | 70.042 | 4 | pin |
| s6-benchmark | Loud fail | 2 pass, 1 fail | 2 pass, 1 fail | 0.04180552 | 0.04180552 | 37 | 198.500 | 7 |  |
| aoh-fb5d493 | Silent fail | 5 pass, 0 fail | 3 pass, 1 fail | 0.01691036 | 0.01691036 | 21 | 113.767 | 7 |  |
| aoh-c40f118 | Silent fail | 4 pass, 0 fail | 2 pass, 1 fail | 0.02358872 | 0.02037540 | 18 | 119.361 | 6 |  |
| s13-hard | Loud fail | 3 pass, 1 fail | 2 pass, 2 fail | 0.02532204 | 0.02532204 | 21 | 189.414 | 0 |  |

Pinned launch. Sixteen sessions, one user message each, model gpt-5.6-luna. 5 pass, 6 silent fail, 3 loud fail, 2 censored. Provider cost 0.337316, parent cost 0.327876, 319 rounds. `aoh-6ba7e7e` and `aoh-5cbfb21` are censored: after three consecutive tool failures the bounds extension retried at Sol, and the pin supervisor stopped the process. Sol's row has cost 0. The other fourteen finished on Luna only. Hidden files were hashed before the overlay.

## Section 12 Phase B — terra

Run trees are under `/home/george-contis/var/routing-runs/terra`. A cost-cap stop is censored.

| Task | Class | Visible | Held-out | Provider $ | Parent $ | Rounds | Wall s | Reads | Stop |
|---|---|---|---|---|---|---|---|---|---|
| aoh-fb5d493 | Pass | 5 pass, 0 fail | 4 pass, 0 fail | 0.28786840 | 0.28786840 | 19 | 166.063 | 8 |  |
| aoh-5cbfb21 | Silent fail | 6 pass, 0 fail | 3 pass, 2 fail | 0.47489520 | 0.45424880 | 27 | 263.272 | 13 |  |

Pinned at medium thinking, one user message, model gpt-5.6-terra. One pass and one silent fail. Provider cost 0.762764. The probe passed one task, so Terra is the first Phase C step and Sol stays behind it. The low-thinking rerun is not taken.

## Section 13 — checkers, C1 and C2

Corpus: the fourteen pinned Luna runs that finished. The two pin-censored runs are out. An old run is not in this corpus.

C1, scripted, symbols and numbers from the prompt against the model's added text and the visible tests. Silent fails flagged 0/6. Passes flagged 0/5. Loud fails flagged 2/3. Six of the silent-fail prompts name a symbol the added text also contains, or name none.

C2, one Jev call per prompt line, the line plus the added text, hidden tests withheld. Silent fails flagged 4/6. Passes flagged 4/5. Loud fails flagged 3/3. Provider cost 0.006862 across 83 calls. Recall is under 80% and the false-alarm rate is over 20%, so C3 is next.

## Section 13 — checkers, C3

Corpus stays the fourteen finished Luna runs. Each generated test was graded on the Luna worktree and then deleted. A test that failed to load is not a flag.

Names only. Silent fails flagged 4/6. Passes flagged 3/5. Loud fails flagged 2/3. Provider cost 0.031235. `59c9121` passed its blind test. `aoh-c40f118` imported a module that is not in the tree, so that test is unloadable. `a0043ca`, `4704b4f`, and `49d5a83` failed on correct code: the tests invented callback fields or a file path.

Signatures. The appendix carries each function signature from the commit, and the prompt forbids an invented field, callback name, or file path. A class body stays out. Silent fails flagged 0/6. Passes flagged 2/5. Loud fails flagged 2/3. Provider cost 0.024568. `a0043ca` still expects the queue error to reject. `4704b4f` still calls the injector with an empty object. `aoh-c40f118` is unloadable again.

C2 together with the signature pass flags 4 of 6 silent fails and 4 of 5 passes. C2 together with the names-only pass flags 5 of 6 silent fails and 5 of 5 passes. No combination reaches 80% recall with false alarms under 20%. C4 reviews the two silent fails those checkers left, `78ce7cb` and `59c9121`, and the first two held-out passes in the Phase B Luna table, `a0043ca` and `4384c58`.

## Section 13 — checkers, C4

Sol at high thinking, one user message, the checklist and the added text, in a sandbox that cannot see either repository. The sample is the two silent fails C1, C2, and the signature-constrained C3 all left, plus the first two held-out passes.

| Task | Class | Outcome | Flagged | Missing | Present | Provider $ |
|---|---|---|---|---|---|---|
| 78ce7cb | Silent fail | present | no | 0 | 1 | 0.042515 |
| 59c9121 | Silent fail | missing | yes | 1 | 5 | 0.046560 |
| a0043ca | Pass | missing | yes | 1 | 0 | 0.031050 |
| 4384c58 | Pass | present | no | 0 | 6 | 0.044835 |

Silent fails flagged 1/2. Passes flagged 1/2. Provider cost 0.164960, plus the probe 0.030175. Each review was one round on gpt-5.6-sol.

`78ce7cb` has one requirement and Sol marked it present. Its hidden tests failed. `59c9121` marked the hook-trace requirement missing, and its hidden tests failed. `a0043ca` marked its only requirement missing, and its hidden tests passed. Of the two requirements Sol marked missing, one task failed held-out.

No adoption row fires. C1 through C3 stay under 80% recall or over 20% false alarms. C4 flags one of the two silent fails it reviewed. C2's recall is 4 of 6, and it flags 4 of 5 passes. Section 13.5 keeps Phase C.

Phase C Terra, at medium thinking, on four Luna failures of different kinds: `bd51f93` (loud, visible checks fail), `78ce7cb` (silent, single file, no checker flagged it), `59c9121` (silent, hook trace), `aoh-c40f118` (silent, the other repository). `aoh-fb5d493` already passed on Terra. The phase stops at $10 across Terra and Sol. Sol runs only on a Terra fail from this four, and only with whatever budget remains.

## Section 12 Phase C — terra

Run trees are under `/home/george-contis/var/routing-runs/terra`. A cost-cap stop is censored.

| Task | Class | Visible | Held-out | Provider $ | Parent $ | Rounds | Wall s | Reads | Stop |
|---|---|---|---|---|---|---|---|---|---|
| 78ce7cb | Silent fail | 2 pass, 0 fail | 1 pass, 1 fail | 0.21703520 | 0.21703520 | 15 | 129.257 | 6 |  |
| bd51f93 | Silent fail | 5 pass, 0 fail | 3 pass, 1 fail | 0.61825000 | 0.61825000 | 42 | 286.436 | 16 |  |
| 59c9121 | Silent fail | 2 pass, 0 fail | 1 pass, 1 fail | 0.26184360 | 0.26184360 | 17 | 182.279 | 6 |  |
| aoh-c40f118 | censored | 4 pass, 0 fail | 3 pass, 0 fail | 0.17406120 | 0.17406120 | 14 | 100.082 | 14 | pin |

## Section 12 Phase C — sol

Run trees are under `/home/george-contis/var/routing-runs/sol`. A cost-cap stop is censored.

| Task | Class | Visible | Held-out | Provider $ | Parent $ | Rounds | Wall s | Reads | Stop |
|---|---|---|---|---|---|---|---|---|---|
| 78ce7cb | Loud fail | 0 pass, 2 fail | 1 pass, 1 fail | 0.76392240 | 0.58686800 | 16 | 357.146 | 11 |  |
| bd51f93 | Silent fail | 5 pass, 0 fail | 3 pass, 1 fail | 1.88045280 | 1.88045280 | 44 | 724.712 | 20 |  |
| 59c9121 | Silent fail | 2 pass, 0 fail | 1 pass, 1 fail | 2.58930240 | 2.27710640 | 41 | 623.036 | 17 |  |

Terra at medium thinking, one user message, model gpt-5.6-terra. Three silent fails and one pin censor. Provider cost 1.271190. `aoh-c40f118` stopped when bounds retried at Sol after three consecutive tool failures, so it has no pass or fail label and was not sent to Sol.

Sol at high thinking, cap 2.70, on the three silent fails. One user message each, model gpt-5.6-sol. The cap did not fire. `bd51f93` silent fail, `78ce7cb` loud fail, `59c9121` silent fail. Provider cost 5.233678. `78ce7cb` includes 7 child calls and `59c9121` includes 13, all on gpt-5.6-sol. Phase total 6.504868, under 10.

No task passed. The handoff rerun is skipped. `bd51f93` was loud on Luna and silent on Terra and on Sol. `78ce7cb` was silent on Luna and on Terra, and loud on Sol.
