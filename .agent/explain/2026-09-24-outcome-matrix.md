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
