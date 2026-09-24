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

Sol runs on the thirteen failures and on three of the four passes: `a0043ca`, `4704b4f`, `690b685`. The pass held out of that draw is `9e26310`.
