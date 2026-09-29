# SPEC-0009 run record

## Start

- Revision: `86d7019b216c973fcfd87439776e41b20c74888f`
- Contract revision: 2 (2026-09-29)
- Installed pi baseline: 0.87.0
- Resume baseline: `./doctor.sh --offline` passed before this run (92 passed, 1 skipped; map 80 passed).
- Pre-existing work: the complete uncommitted SPEC-0008 move, host thinking/order edits in `settings/hosts/machina.json`, and untracked explanation files. These are not part of this migration.

## Step 0

Expected repo and environment rows matched. `pi-smart-router` contains unrelated benchmark profile model mappings but no live harness GPT-5.6 host configuration; this does not affect scope. ID 0009 was confirmed free and assigned.

## Stage 1

Status: passed.
Repairs used: 0.

- V1: `pi --version` → `0.87.1`.
- V2: quota threshold run → exit 75, hold reason `5h`, 0 inference rows; `bin/pi-continue --yes` cleared the hold and the next prompt exited 0.
- V3: `./install.sh` ran `./doctor.sh`; 92 node tests passed, 1 skipped, and 80 map tests passed.
- V4: `pi --list-models` lists GPT-6 Sol, Luna and Astra under `openai-codex`.
- Patch: the sole `pi-smart-router.patch` was already applied and passed the install-script check.
- Pi 0.87.1 re-check: `buildSessionOptions` prefers the bare configured default when it resolves in scope, otherwise the first scoped model; provider composition uses exact bare-id matching.

Exit: all required Stage 1 checks passed.

## Stage 2

Status: passed.
Repairs used: 0.

- V5: `host-config.test.ts` → 8/8 passed.
- V6: `./doctor.sh --offline` passed; scratch prefixed-default and omitted-default hosts both failed with the intended diagnostics.
- V7: RPC `get_state` on a fresh no-flag session reported `openai-codex/gpt-6-sol` with `thinkingLevel: medium`; a temporary persisted GPT-5.6 Luna session resumed on `gpt-5.6-luna` after the config switch.
- V8: `tests/run-plan-thinking.test.ts` → 2/2 passed for configured and absent `pipeline` settings.
- V13: `models.test.ts` → 5/5 passed.
- Shared check: `./doctor.sh --offline` passed (94 node tests passed, 1 skipped; map 80 passed).

Exit: all required Stage 2 checks passed.

## Stage 3

Status: passed.
Repairs used: 0.

- Step-2 source decision: the plan commit was `2171462a24f49c6d9959a6c4d8abf16691d89a1c`. Contrary to the expected row, its reference directory was present. The step-2 `tiers.ts` and `rework.ts` differed from the references only in comments, formatting and equivalent expression structure, so the reference path was taken: rework files came from SPEC-0005's reference and tiers from SPEC-0009's reference.
- V9: `tiers.test.ts` passed 8/8.
- V10: `tests/bounds-split.test.ts` covers Luna to Sol medium, Sol-high stop, quota hold, disabled retry and one retry; passed 6/6.
- V12: `tests/pi-rework.test.ts` invokes `bin/pi-rework` and passed ID, slug, path and unknown-candidate cases.
- V11: the obsolete SPEC-0005 tiers test was deleted; protected rework tests passed 7/7; both doctor commands exited 0.
- Shared check: `./doctor.sh --offline` passed (96 node tests passed, 1 skipped; map 80 passed); `./doctor.sh --project .` passed.

Exit: all required Stage 3 checks passed.

## Final integrated acceptance

Status: passed.

The combined V5, V9, V10, V12, V13 and runner checks passed 37/37. A final RPC `get_state` reported GPT-6 Sol at medium. The prior persisted-session check for V7 remained valid.

## Quota observation

Immediately before one ordinary GPT-6 Sol task: 5h 67%, weekly 23%. Immediately after: 5h 67%, weekly 23%. The task exited 0 and replied `OK`.

## Deviations

- The step-2 plan commit contained `docs/SPEC-production-config.reference/`, although the spec expected it absent. This did not change the source-selection decision because the implementations were near-identical to the references.
- The runner's testable pipeline-thinking policy is exported from existing `lib/plan.ts`; `scripts/run-plan.mjs` consumes it. No new runtime component was added.
