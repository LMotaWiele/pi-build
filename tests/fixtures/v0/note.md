# CancelledError is a BaseException
**Status:** sealed
**Topic:** `asyncio.CancelledError` vs `except Exception` in `_loop`
**Last updated:** 2026-08-16

## Current claim
`asyncio.CancelledError` inherits from `BaseException`, not `Exception`. The
`except Exception` clause in `Harness._loop` does not catch it. An
interrupted run that relied on that clause used to leave a trajectory with
no `run_end`. ADR 0011 adds an explicit `except asyncio.CancelledError:`
**before** the `Exception` clause: write `run_end(reason="cancelled")`, then
**re-raise**. Swallowing `CancelledError` leaves `task.cancelled()` False
and is the standard way to make shutdown hang.

## Ruled out / confounds
- Not a Python 3.8-vs-3.9 inheritance change we have to paper over —
  3.12+ (this repo) still has `CancelledError` as `BaseException`.
- Not the inner `except Exception` around `model.complete()` — that one
  also misses `CancelledError`, which is correct: cancellation must
  reach the outer handler so `run_end` is written.

## Evidence (pointers only)
- code: `src/agent_orchestration_harness/harness.py` — `except asyncio.CancelledError` then `raise`
- code: `src/agent_orchestration_harness/primitives/parallel.py` — `_recover_cancelled_result` reads that `run_end`
- test: `tests/primitives/test_parallel.py` — `test_cancelled_child_trajectory_still_terminates`
- design: `docs/design/0011-cancel-on-reduce.md`

## Pre-committed next
| If | Then |
|---|---|
| Someone merges the two except clauses "for cleanliness" | Expect truncated trajectories on cancel; `test_cancelled_child_trajectory_still_terminates` fails or hangs |
| Someone swallows `CancelledError` "to return a RunResult" | `task.cancelled()` is False; parent recovery and process shutdown both break |

## Do not
- Do not catch `CancelledError` as `Exception`.
- Do not write `run_end` and then *return* — re-raise is mandatory.
- Do not add `sink_factory` to `ChildSpec` without a guard: cancelled-child recovery reads the child's JSONL off disk.
