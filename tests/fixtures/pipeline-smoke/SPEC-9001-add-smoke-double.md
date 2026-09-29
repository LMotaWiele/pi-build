# SPEC-9001: Add a doubling helper in TypeScript and Python

| Field | Value |
|---|---|
| Status | ready |
| Size | S |
| Kind | build |
| Parent | — |
| Date | 2026-09-29 |

A fixture for the pipeline's smoke run. It is copied into a scratch worktree and never merged.

## 1. Intent

Add a function that doubles an integer, once in TypeScript and once in Python.

- **O1**: `lib/smoke-double.ts` exports `double(n: number): number`, returning `n * 2`.
- **O2**: `tools/map/map_build/smoke_double.py` defines `double(n: int) -> int`, returning `n * 2`.

## 2. Priority

A fixture; no priority.

## 3. Prior art

N/A.

## 4. Grounding

| Fact | Expected | Tag | Source |
|---|---|---|---|
| `lib/smoke-double.ts` | absent | agent-verify | working tree |
| `tools/map/map_build/smoke_double.py` | absent | agent-verify | working tree |

**Step 0:** verify both rows.

## 5. Scope

In: the two files. Out: everything else.

## 6. Changes

### 6.1 TypeScript

Create `lib/smoke-double.ts` exporting `double(n: number): number` that returns `n * 2`.

### 6.2 Python

Create `tools/map/map_build/smoke_double.py` defining `double(n: int) -> int` that returns `n * 2`.

## 7. Paths

| Path | Trigger | Planned check or justified exclusion |
|---|---|---|
| happy | positive, zero and negative inputs | V1, V2 |

## 8. Verification

| Outcome | Change | Check ID: falsifiable condition |
|---|---|---|
| O1 | §6.1 | V1: `double.test.ts` passes |
| O2 | §6.2 | V2: `test_smoke_double.py` passes |

You write and run the commands. **Protected:** `SPEC-9001-add-smoke-double.tests/`.

## 9. Stop conditions and repairs

Up to three repair rounds per failed check. Never mark an unrun check as passed.

## 10. Report back

1. Each V-check's command and output. 2. `git diff --stat`.

## 11. Landing

Not applicable: a fixture.
