# SPEC-0009: Move the harness to GPT-6 Sol and Luna

| Field | Value |
|---|---|
| Status | implemented |
| Size | staged (3 stages) |
| Kind | build |
| Parent | — |
| Date | 2026-09-29 |
| Checkpoint | continuous |
| Run record | /docs/specs/SPEC-0009-run.md |
| Revision | 2 — 2026-09-29, after the first run stopped at step 0 |

Runs **after** `SPEC-0008-move-specs-into-docs-specs`. Replace `NNNN` everywhere — this file's name, its `.tests/` and `.reference/` directories, the run record — with the next free spec ID after that one. Confirm it is free; do not infer it.

**Revision 2.** The first run stopped correctly: pi does not prefer `enabledModels[0]`. Planning had read a fallback path in pi's source and taken it for the main one. The actual rule, identical in 0.87.0 and 0.87.1, is in §4, and it moves the fix from list order to the format of `defaultModel`. Changed: §1, §4, step 0, §6.2, §7, §8 and §9. The retry ladder and Stage 1 are unchanged. Stage 1 must be redone, since the first run reverted it.

Former spec paths named below (`docs/SPEC-<name>…`) refer to specs now under `/docs/specs/`; resolve each through `/docs/specs/index.md`'s former-path column.

Read `/.agents/notes/index.md` if present. Record the revision you start from and any pre-existing uncommitted changes; don't fold unrelated work into this change.

## 1. Intent

Run the harness on GPT-6 Sol and Luna instead of GPT-5.6, with a working retry ladder. Decisions agreed in planning:

- GPT-6 Sol replaces GPT-5.6 Terra as the interactive default. It costs the same per token (2.00 / 0.20 / 10.00 against 2.00 / 0.20 / 12.00) and is the stronger tier. GPT-5.6 Terra keeps no live role.
- Sol and Luna run at **medium** thinking interactively. Pipeline planning and integration stay at **high**.
- Retry ladder: Luna → Sol at medium → Sol at high → stop. GPT-6 Astra is reachable manually only.
- Subscription provider (`openai-codex`) only. A retry never targets a per-token provider.
- The implementer runs this directly, not through the plan pipeline: this changes the models the pipeline itself runs on.
- **Corrections from planning.** The tiered retry specified earlier is *not* on `main`: `lib/tiers.ts` and `lib/rework.ts` exist only in an unmerged pipeline worktree, and `extensions/bounds.ts` calls neither. And sessions open on GPT-5.6 Luna because of a format disagreement over one key. Pi resolves the default with `getModel(defaultProvider, defaultModel)`, an exact match on the **bare** id, and uses it if it is in `enabledModels`, otherwise `enabledModels[0]`. The harness validator in `lib/models.ts` resolves `defaultModel` as `provider/id` and refuses to start on anything else. So the host file carries `openai-codex/gpt-5.6-terra`, which pi can never resolve, and every fresh session falls back to the first enabled model.

Outcomes:
- **O1**: The harness runs on pi 0.87.1, with its patches applied and the quota gate holding.
- **O2**: A fresh session with no flags opens on `openai-codex/gpt-6-sol` at medium; the pipeline plans and integrates at high and edits at medium on GPT-6 Luna; nothing live names GPT-5.6 Terra.
- **O3**: A bound-stopped turn retries once along the ladder above; a Sol-at-high turn, a quota hold, `PI_BUILD_RETRY=0`, or a previous retry prevents it.

## 2. Priority

Every fresh session currently opens on GPT-5.6 Luna at low, the weakest configuration measured; GPT-6 halves prices and reports a lower coding-deception rate; and the retry believed live is not. Deferred: `docs/SPEC-map-views.md` (separate spec); the production-week measurement (`docs/SPEC-production-config.md` §5); any change to `pi-smart-router`.

## 3. Prior art

- GPT-6 Sol and Luna released 2026-09-22 to Codex for Plus, Pro, Business, Enterprise and Edu. There is no GPT-6 Terra. OpenAI prices them 50% below GPT-5.6 promotional rates, has **not** published how they draw on the Codex allowance, and reports coding-deception rates at max effort of 1.3% (GPT-6 Sol) and 2.8% (GPT-6 Luna) against 10.4% for GPT-5.6 Sol. Adopt.
- Pi 0.87.1, published the same day, lists both under `openai-codex`. Pi 0.87.0 lists only GPT-6 Astra. Adopt 0.87.1.
- GPT-6 Astra at 10.00 / 1.00 / 50.00. Reject for automatic escalation: five times Sol's price with no measured need on this workload.

## 4. Grounding

| Fact | Expected | Tag | Source |
|---|---|---|---|
| Installed pi version | 0.87.0 | agent-verify | `pi --version` |
| Pi 0.87.1 lists `gpt-6-sol`, `gpt-6-luna`, `gpt-6-astra` under `openai-codex` | yes, costs as in §1 | measured | `npm pack` of 0.87.1, 2026-09-29 |
| Pi's startup model with `enabledModels` set | `defaultModel` if `getModel(defaultProvider, defaultModel)` resolves and it is in `enabledModels`; otherwise `enabledModels[0]` | measured | `buildSessionOptions` in the 0.87.0 and 0.87.1 bundles — identical |
| `getModel(provider, id)` | exact match on the bare id: `model.id === id` | measured | same bundles |
| Host `defaultModel` | `openai-codex/gpt-5.6-terra` — provider-prefixed, so pi never resolves it | measured | GitHub `main` |
| `resolveRouting` in `lib/models.ts` | resolves `provider/id` exactly; a bare id partially matching several providers is a mismatch and refuses the session | measured | same |
| Callers passing `defaultModel` to `resolveRouting` | `extensions/bounds.ts` and `extensions/explain.ts`, raw from settings | measured | same |
| Codex GPT-6 models map `minimal` to `low` | yes | measured | 0.87.1 catalog `thinkingLevelMap` |
| `lib/tiers.ts`, `lib/rework.ts` on `main` | absent | measured | GitHub `main`, 2026-09-29 |
| `extensions/bounds.ts` calls `nextTier` or `retryAllowed` | no | measured | same |
| Step-2 pipeline result with `lib/tiers.ts` and `lib/rework.ts` | at `~/var/pipeline-runs/production-config/step2/work`, unmerged | in-context | agent report after step 2 |
| `scripts/run-plan.mjs` takes Luna and Sol thinking from `modelThinkingLevels` | yes, near lines 399–400 | measured | GitHub `main` |
| `.pi/agents/implement.md` pins its model with a `model:` line | `openai-codex/gpt-5.6-luna` | measured | same |
| `agent/models.json` has `openai-codex.modelOverrides` for GPT-5.6 ids with `contextWindow` 272000 and `promptCache` 1800/1800, no `cost` | yes | measured | same |
| `pi-smart-router` 0.8.0 names no model ids in shipped config | yes | measured | `npm pack` of 0.8.0 |
| `extensions/quota-gate.ts` records its verification against 0.87.0 | yes | measured | file header |
| Where the pi version is pinned for install | unknown | agent-verify | README says "the script" |
| Repo tests naming GPT-5.6 ids | `tests/{audit-graders,explain-oneshot,handoff,interop,bounds-split}.test.ts` | measured | GitHub `main` |

**Step 0:** before editing, verify every row that describes repo or environment state, whatever its tag, and report expected against actual. If a contradiction changes the design, outcomes, scope or verification, stop and report. Otherwise record it and continue. Re-check the startup-model and `getModel` rows in the installed pi after Stage 1. The configuration in §6.2 is chosen to open on GPT-6 Sol under either reading, so a difference there is recorded, not a stop; V7 is the check that decides.

## 5. Scope

In: pi upgrade; GPT-6 host configuration, pins and overrides; the runner's `pipeline` setting; one doctor check; the retry ladder and its wiring in `bounds.ts`; README and host-gotchas corrections.

Out: `pi-smart-router` changes; measurement tooling (`scripts/run-arm.mjs`, `scripts/check-c3.mjs`, `scripts/check-c4.mjs`) and routing-suite fixtures, which reproduce recorded results on the models they were measured on; `docs/SPEC-map-views.md`; any new routing policy.

## 6. Changes

### 6.0 Architecture

No new components. Three existing flows change: host settings → pi startup (`enabledModels[0]`) → session model; bound → `lib/tiers.ts` → retry model; runner → `pipeline` settings → planner and editor thinking. If `/docs/architecture.md` exists and names model ids, update it in Stage 2; otherwise do not create it.

### 6.1 Stage 1: Upgrade pi to 0.87.1

Depends on: nothing. Outcomes: O1.

Changes:
- Change every install pin from 0.87.0 to 0.87.1 and install. Leave `lastChangelogVersion` in the host file alone; pi writes it.
- Re-apply `patches/*.patch` through the install script.
- `tests/interop.test.ts` pins the file-mutating tool names against the installed package. If it fails on 0.87.1, update `countsAsEdit` in `lib/telemetry.ts` to the observed set.
- Update the quota gate's verified-version comment only after V2 passes.

Checks: V1, V2, V3, V4. Exit: all four pass.

### 6.2 Stage 2: Switch the live configuration to GPT-6

Depends on: Stage 1. Outcomes: O2.

Changes:
- `settings/hosts/machina.json` — set exactly these keys, leaving all others as they are:

```json
"defaultProvider": "openai-codex",
"defaultModel": "gpt-6-sol",
"enabledModels": ["openai-codex/gpt-6-sol", "openai-codex/gpt-6-luna", "openai-codex/gpt-6-astra"],
"modelThinkingLevels": {
  "openai-codex/gpt-6-sol": "medium",
  "openai-codex/gpt-6-luna": "medium",
  "openai-codex/gpt-6-astra": "high"
},
"routing": { "enabled": false, "tiers": {
  "scout": "openai-codex/gpt-6-luna", "work": "openai-codex/gpt-6-sol",
  "escalate": "openai-codex/gpt-6-sol", "explain": "openai-codex/gpt-6-luna" } },
"pipeline": { "plannerThinking": "high", "editorThinking": "medium" }
```

- `defaultModel` is the **bare** id, which pi resolves under `defaultProvider`. `enabledModels[0]` is Sol as well, so pi's fallback lands on the same model.
- `lib/models.ts`: add `defaultModelRef(settings)` — returns `${defaultProvider}/${defaultModel}` for a bare id with a provider, a prefixed id unchanged, a bare id without a provider unchanged, and `undefined` when `defaultModel` is not a non-empty string. `extensions/bounds.ts` and `extensions/explain.ts` pass `defaultModelRef(settings)` to `resolveRouting` and `selectExplainModel` instead of the raw value. `resolveRouting` itself does not change.
- `settings/hosts/example.json`: `defaultModel` becomes a bare id.
- `scripts/run-plan.mjs`: take editor and planner thinking from `pipeline.editorThinking` and `pipeline.plannerThinking`, defaulting to `medium` and `high` when absent, instead of `modelThinkingLevels`. Model ids still come from `routing.tiers.scout` and `routing.tiers.escalate`. Add `pipeline` to `settings/hosts/example.json`.
- `.pi/agents/implement.md`: `model: openai-codex/gpt-6-luna`.
- `agent/models.json`: add `gpt-6-sol` and `gpt-6-luna` under `openai-codex.modelOverrides`, copying the GPT-5.6 entries' `contextWindow` and `promptCache`. No `cost` override. Keep the GPT-5.6 entries so resumed sessions keep their limits.
- `doctor.sh --offline`: fail when a host file's `defaultModel` contains `/`, or when `enabledModels` is set and does not contain `${defaultProvider}/${defaultModel}`. Online checks: every model id in the host file appears in `pi --list-models`.
- Repo tests that assert the *live* configuration's ids move to GPT-6. Tests using a GPT-5.6 id as fixture data stay.
- README: pi 0.87.1; the ladder in §1; state pi's startup rule — the bare `defaultModel` under `defaultProvider` if it is in `enabledModels`, otherwise `enabledModels[0]` — that `defaultModel` must be a bare id, and that Codex models map `minimal` thinking to `low`.

Preserve: every host key not listed above; `pi -c` sessions keep their stored model.
Seams: pi startup reads `defaultProvider`, `defaultModel` (bare) and `enabledModels`; the harness validator reads `defaultModel` through `defaultModelRef`; the runner reads `routing.tiers` and `pipeline`; `doctor.sh`'s unread-key check proves the runner reads `pipeline`.

Checks: V5, V6, V7, V8, V13. Exit: all pass.

### 6.3 Stage 3: Land the retry ladder on GPT-6

Depends on: Stage 2. Outcomes: O3.

Changes:
- **Bring in the step-2 result.** First confirm `docs/SPEC-production-config.reference/` was absent from the step-2 worktree at its plan commit, and diff its `lib/tiers.ts` and `lib/rework.ts` against that reference. If near-identical, discard the step-2 result and take `lib/rework.ts`, `scripts/pi-rework.ts` and `bin/pi-rework` from the reference. Otherwise merge the step-2 result. Report which path was taken.
- Replace `lib/tiers.ts` with this spec's reference implementation. Interface: `familyOf(model)` → `"luna" | "terra" | "sol" | "astra" | null` for GPT-5.6 and GPT-6 ids; `nextTier(model, thinking, resolves)` → target or null, where `thinking` is the current turn's level; `retryAllowed({ env, held, alreadyRetried })`. When `openai-codex/gpt-6-sol` does not resolve, the fallback is `openai-codex/gpt-5.6-sol` at high.
- Wire `extensions/bounds.ts`: when a bound fires with written files and `retryAllowed` is true — `held` from `readHold(defaultHoldPath(process.env)) !== null` in `lib/quota.ts` — call `nextTier` with the session's current model id, its current thinking level, and `resolves` backed by pi's model registry; retry once on the target with the existing bound checkpoint as the prompt.
- `scripts/pi-rework.ts` resolves specs under `/docs/specs/`: accept a four-digit ID, a slug, a file name or a path, and find the spec file and its `.plan/plan.json` by globbing `/docs/specs/SPEC-*.md`. An ambiguous or unknown spec is refused with the candidates listed.
- Delete `docs/SPEC-production-config.tests/tiers.test.ts`, which asserts the GPT-5.6 ladder this spec changes. Add one status line to `docs/SPEC-production-config.md` naming this spec as the reason. Its `rework.test.ts` stays.

Preserve: one retry per original prompt; no retry while a quota hold exists.
Seams: `bounds.ts` → `nextTier` (null means no retry, never an error); `bounds.ts` → `lib/quota.ts` `readHold` (an unreadable hold file counts as held); `resolves` → pi's registry (an id it cannot resolve returns false).

Checks: V9, V10, V11, V12. Exit: all pass.

## 7. Paths

| Path | Trigger | Planned check or justified exclusion |
|---|---|---|
| happy: fresh session | `pi` with no flags | V7 |
| happy: Luna turn bound | bound on a GPT-6 Luna turn | V9, V10 |
| Sol below high bound | bound on GPT-6 Sol at medium | V9, V10 |
| Sol at high bound | bound on GPT-6 Sol at high, xhigh or max | V9, V10 — no retry |
| resumed GPT-5.6 session | `pi -c` on a pre-migration session, then a bound | V9 (5.6 ids map onto the ladder); V7 confirms the stored model is kept |
| GPT-6 Sol unresolvable | registry lacks `gpt-6-sol` | V9 — fallback to GPT-5.6 Sol at high |
| retry blocked | quota hold, `PI_BUILD_RETRY=0`, or second retry | V9, V10 |
| unknown model | bound on `smart-router/auto` | V9 — no retry |
| runner without `pipeline` key | older host file | V8 |
| prefixed `defaultModel` | a host file written the old way | V6 — doctor refuses it; V13 pins why |
| quota gate on 0.87.1 | session opening over threshold | V2 |
| patch fails on 0.87.1 | `pi-smart-router.patch` rejected | not exercised unless it occurs; §9 stop condition |
| rollback | `git revert`, reinstall 0.87.0 | not exercised: reversible by construction, and resumed GPT-6 sessions are expected to fail to resolve |

## 8. Verification

| Outcome | Change | Check ID: falsifiable condition |
|---|---|---|
| O1 | §6.1 | V1: `pi --version` prints 0.87.1 |
| O1 | §6.1 | V2: with `PI_BUILD_QUOTA_5H=1`, one headless prompt exits 75, writes a hold file with reason `5h`, and adds no inference row; `bin/pi-continue --yes` then lets a prompt run |
| O1 | §6.1 | V3: `./doctor.sh --offline` exits 0, including `tests/interop.test.ts` against 0.87.1 |
| O1 | §6.1 | V4: `pi --list-models` lists `gpt-6-sol`, `gpt-6-luna` and `gpt-6-astra` under `openai-codex` |
| O2 | §6.2 | V5: `host-config.test.ts` passes, 8 tests |
| O2 | §6.2 | V6: `./doctor.sh --offline` exits 0 with the new check, and fails on a scratch host file with a prefixed `defaultModel` and on one whose `enabledModels` omits the default |
| O2 | §6.2 | V13: `models.test.ts` passes, 5 tests |
| O2 | §6.2 | V7: a fresh `pi` session with no flags reports `openai-codex/gpt-6-sol` at medium; a `pi -c` pre-migration session keeps its GPT-5.6 model |
| O2 | §6.2 | V8: a runner unit test shows planner `high` and editor `medium` from `pipeline`, and the same defaults with the key absent |
| O3 | §6.3 | V9: `tiers.test.ts` passes, 8 tests |
| O3 | §6.3 | V10: a `bounds.ts` test shows a Luna turn's bound retrying on GPT-6 Sol at medium, a Sol-at-high turn's bound not retrying, and no retry while a hold file exists |
| O3 | §6.3 | V12: an implementer test shows `bin/pi-rework` resolving one spec under `/docs/specs/` by ID, by slug and by path, and refusing an unknown one with candidates listed |
| O3 | §6.3 | V11: `docs/SPEC-production-config.tests/tiers.test.ts` is gone, `rework.test.ts` passes, and `./doctor.sh --offline` and `./doctor.sh --project .` exit 0 |

You write and run the commands. **Protected** — never edit, skip or weaken to pass: `/docs/specs/SPEC-0009-migrate-to-gpt6.tests/`; `docs/SPEC-spec-translation.tests/`; `docs/SPEC-production-config.tests/rework.test.ts`; `scripts/run-arm.mjs`, `scripts/check-c3.mjs`, `scripts/check-c4.mjs`; `tests/routing-suite/`.

Invariants: a retry target always has the `openai-codex/` prefix; every host `defaultModel` is a bare id, and `${defaultProvider}/${defaultModel}` is in `enabledModels`.

Shared checks (every stage): `./doctor.sh --offline`.
Final integrated acceptance: V5, V7, V9, V10, V12 and V13 pass together at the final commit.
Resume baseline: `./doctor.sh --offline` and `pi --version`, run before editing in any new session; record pre-existing failures separately.

Also report, as an observation rather than a check: `used_percent` for both quota windows before and after one ordinary interactive task on GPT-6 Sol. It is the first measurement of how GPT-6 draws on this account's allowance.

## 9. Stop conditions and repairs

If a check fails because of a local implementation error inside this scope, diagnose, fix, and rerun the affected checks. Up to three repair rounds per failed check group per stage; never reset the count by restarting a session, renaming a check, or repeating the same attempt. Stop and report instead when: a step-0 contradiction changes the design; V7 fails — a fresh session does not open on GPT-6 Sol at medium; a seam differs from §6; `patches/pi-smart-router.patch` does not apply to 0.87.1; scope would need to grow; a protected file seems wrong; an external prerequisite is missing; or the same failure repeats without a new testable diagnosis. Never mark an unrun check as passed.

**On a stop, change nothing further.** Leave the working tree, installed versions and run record as they are; do not revert completed stages, reinstall anything, or restore renamed paths. Report the state. Undoing work is a planning decision.

Continuation: update the run record `/docs/specs/SPEC-0009-run.md` after each stage exit and each repair round, with unit status, revision, check evidence, exit and repairs used. Never advance past a failing required check; later stages stay blocked until it is repaired or this spec is revised. Checkpoint is continuous: proceed through stages without asking. To resume in a new session, read this spec, the run record and git state, run the resume baseline, keep still-valid completed work, and invalidate any check affected by changed source, dependencies or config.

## 10. Report back

1. Start revision; step-0 expected against actual for every §4 row.
2. Per stage: each V-check's command, output, pass/fail/not-run, and repair rounds used; the stage's exit status.
3. Final integrated acceptance, separately.
4. O-ID → evidence; which §7 paths actually ran.
5. `git diff --stat` for the whole change; the full diff of any protected file, which should be empty; the complete changed functions with callers for `lib/tiers.ts`, `extensions/bounds.ts` and `scripts/run-plan.mjs`.
6. Which Stage 3 path was taken for the step-2 result, with the diff evidence.
7. The quota observation from §8.
8. Deviations from §6 with reasons; anything the spec didn't anticipate. The run record's path.

## 11. Landing

Filled from the review.

`host-config.test.ts` is superseded by SPEC-0015's `host-config.test.ts`.
