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

## Moved from `.agent/explain/2026-09-29-2026-09-29-gpt6-migration-stop.md`

# GPT-6 migration stopped at Stage 1 grounding

The migration was not applied because pi 0.87.1 contradicts a premise that the spec explicitly marks as a stop condition.

## Evidence

In pi 0.87.1, `dist/core/model-resolver.js` documents the generic resolution order, but the CLI's `buildSessionOptions` constructs the scoped model before `findInitialModel` runs. When `enabledModels` is non-empty, it resolves `defaultModel`; if that model is among the enabled models it selects the default, otherwise it selects the first enabled model:

```js
savedInScope
  ? (options.model = savedInScope.model, ...)
  : (options.model = scopedModels[0].model, ...)
```

Therefore 0.87.1 does **not** unconditionally prefer `enabledModels[0]` ahead of `defaultModel`. The proposed doctor invariant and README statement would encode behavior that is not true. `SPEC-NNNN-migrate-to-gpt6.md` §9 says to stop if 0.87.1 no longer prefers `enabledModels[0]`.

## Cleanup

- Reverted all attempted GPT-6 source/config/test edits.
- Restored the migration spec and protected directories to their original `SPEC-NNNN` names.
- Reinstalled pi 0.87.0; `pi --version` reports `0.87.0`.
- Removed temporary implementation files and generated smoke-session explanations.
- Restored the notes index after the live installer smoke appended a queue row.
- Preserved the previously completed `SPEC-0008` move work and its pre-existing host-setting edits.

## Verification

`./doctor.sh --offline` passes after rollback: 92 node tests passed, 1 skipped, and 80 map tests passed. The known optional `typebox` load warnings remain non-fatal.

The migration spec needs revision before implementation: either make `defaultModel` the authoritative startup rule (while keeping it equal to `enabledModels[0]` as a configuration convention), or supply evidence for a different pi 0.87.1 path that truly makes list order authoritative.

## Moved from `.agent/explain/2026-09-29-gpt6-migration.md`

# GPT-6 migration

Implemented `SPEC-0009` in three bounded stages.

- Upgraded the harness pin to pi 0.87.1 and kept the existing router patch unchanged.
- Made bare `gpt-6-sol` the host default, first in scope, with Sol/Luna at medium and Astra at high.
- Moved routing, agent pins, pipeline thinking, validation, documentation and model metadata to GPT-6.
- Added the bounded retry ladder in `lib/tiers.ts`: Luna → Sol medium, Sol below high → Sol high, and GPT-5.6 Terra resume → Sol high, with GPT-5.6 Sol only as the documented fallback.
- Integrated that ladder into `extensions/bounds.ts`, retaining quota, environment-switch and one-retry guards.
- Restored and adapted `pi-rework` for numbered specs. It accepts an ID, slug or full spec path and reports candidates on refusal.
- Deleted the superseded GPT-5.6 tiers test and marked SPEC-0005's retry ladder as superseded.

Validation:

- Integrated migration and runner suites: 37/37 passed.
- Final focused ladder/bounds/rework suites: 15/15 passed.
- `./doctor.sh --offline`: 96 passed, 1 skipped; map suite 80 passed.
- `./doctor.sh --project .`: passed.
- Fresh RPC state: GPT-6 Sol, medium thinking.
- Quota observation around one ordinary GPT-6 Sol task: 5h 67% and weekly 23% before and after.

The complete staged evidence and the one source-layout deviation are recorded in `docs/specs/SPEC-0009-run.md`.
