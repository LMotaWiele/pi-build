# SPEC-0008: Move specs into /docs/specs with sequential IDs

| Field | Value |
|---|---|
| Status | implemented |
| Size | M |
| Kind | build |
| Parent | — |
| Date | 2026-09-29 |

This spec runs **before** `SPEC-NNNN-migrate-to-gpt6`. It assigns the IDs; that spec then takes the next free one.

Read `/.agents/notes/index.md` if present. Record the revision you start from and any pre-existing uncommitted changes; don't fold unrelated work into this change.

## 1. Intent

Every spec in this project follows one layout: `/docs/specs/SPEC-NNNN-<slug>.md`, IDs sequential and zero-padded, with sibling directories renamed alongside, and `/docs/specs/index.md` listing them. Lucas's decision: rename the existing specs to this convention rather than keep two layouts.

- **O1**: Every project spec lives at `/docs/specs/SPEC-NNNN-<slug>.md`, and its `.tests/`, `.reference/` and `.plan/` directories sit beside it under the same stem.
- **O2**: `/docs/specs/index.md` maps each ID to its title, status and former path.
- **O3**: Everything that ran before still runs: every moved test passes, and no code, script, test or plan file resolves a former path.

## 2. Priority

The GPT-6 migration and every later spec take their IDs from this numbering, and the migration already uses the new layout. Deferred: converting the older specs' content to the current template — they are historical; only `SPEC-map-views` is still to be executed, and it gets its own rewrite.

## 3. Prior art

N/A — local file moves following the planner's documented repository conventions.

## 4. Grounding

| Fact | Expected | Tag | Source |
|---|---|---|---|
| Spec files | `docs/design/SPEC-delegation-ab.md`, `docs/design/SPEC-context-500k.md`, `docs/SPEC-harness-setup.md`, `docs/SPEC-routing-orchestration.md`, `docs/SPEC-production-config.md`, `docs/SPEC-spec-translation.md`, `tools/map/SPEC.md`, `docs/SPEC-map-views.md` | measured | GitHub `main`, 2026-09-29; `docs/SPEC-map-views.md` may be uncommitted locally |
| `docs/SPEC-extension-coordination.md` | absent from `main` | measured | same — if it exists locally, include it |
| Sibling directories | `docs/SPEC-map-views.tests/`, `docs/SPEC-production-config.{plan,reference,tests}/`, `docs/SPEC-spec-translation.{reference,tests}/` | measured | same |
| First-added order | delegation-ab 09-22; context-500k 09-23; harness-setup 09-23; routing-orchestration 09-24; production-config, spec-translation and `tools/map/SPEC.md` in one commit on 09-26; map-views not on `main` | measured | `git log --diff-filter=A --follow` |
| Test files depending on directory depth | relative imports of `../../lib/…` and `../../extensions/…`; `resolve(here, "../../tools/…")`; Python `parents[2]` | measured | the `.tests/` directories above |
| `docs/SPEC-spec-translation.tests/plan.test.ts` contains `"../../"` inside string literals | yes — lines near 92 and 96 are test data | measured | same |
| `scripts/run-plan.mjs` derives the spec-tests directory by replacing `.md` with `.tests` on `plan.spec` | yes | measured | same |
| `install.sh` references a spec path | yes, content unknown | agent-verify | grep hit |
| `tests/fixtures/ab/SPEC.md` | a routing-suite fixture, not a project spec | measured | path |

**Step 0:** verify every row against the working tree and report expected against actual. Specs present locally but absent from this table are included under the same rules; report them. If a spec file or reference exists that cannot be moved without changing behaviour, stop and report.

## 5. Scope

In: moving and renaming every project spec and its sibling directories; `/docs/specs/index.md`; updating every path reference in code, scripts, tests, plan files and `install.sh`; the mechanical depth edit in §6.2.

Out: editing any spec's prose, including path mentions inside spec text — the index resolves those; `tests/fixtures/ab/SPEC.md`; `docs/reference/`; `.agent/notes/`.

## 6. Changes

### 6.1 Assign IDs and move

Outcomes: O1, O2.

- **IDs:** in first-added order from git, ties broken by former path alphabetically, then uncommitted specs by file modification time. Zero-padded to four digits, starting at `0001`. Then this spec takes the next ID and `SPEC-NNNN-migrate-to-gpt6` the one after.
- **Slugs**, lowercase and imperative:

| Former path | Slug |
|---|---|
| `docs/design/SPEC-delegation-ab.md` | `measure-delegation-against-monolithic` |
| `docs/design/SPEC-context-500k.md` | `manage-context-for-500k-specs` |
| `docs/SPEC-harness-setup.md` | `set-up-harness-on-real-workload` |
| `docs/SPEC-routing-orchestration.md` | `route-with-jev-and-orchestrate` |
| `docs/SPEC-production-config.md` | `configure-production-harness` |
| `docs/SPEC-spec-translation.md` | `translate-specs-with-sol` |
| `tools/map/SPEC.md` | `build-codebase-map` |
| `docs/SPEC-map-views.md` | `fix-map-views` |
| `docs/SPEC-extension-coordination.md`, if present | `coordinate-extensions` |

- Move with `git mv` so history follows. Sibling directories take the new stem: `docs/SPEC-production-config.tests/` becomes `/docs/specs/SPEC-NNNN-configure-production-harness.tests/`.
- Remove `docs/design/` if it is left empty.
- **`/docs/specs/index.md`:** one H1, a table with ID, title from the spec's H1, status, date first added, former path. Status uses `draft / ready / implemented / landed / superseded`. Expected values below; confirm each against the spec's own status line and the repository, and report any you change:

| Former | Expected status | Reason |
|---|---|---|
| delegation-ab | superseded | its §4–§6 were withdrawn; §1–§3 landed |
| context-500k | superseded | marked superseded in the file |
| harness-setup | implemented | §1–§14 applied; §15 superseded |
| routing-orchestration | superseded | closed by later specs |
| production-config | ready | §2 and §5.2 exist only in an unmerged worktree; §3 not built |
| spec-translation | ready | steps 0–2 done; step 3 not run |
| `tools/map/SPEC.md` | implemented | built on branch `claude/new-session-7cskk6`; confirm whether merged |
| map-views | draft | to be rewritten before execution |
| extension-coordination, if present | superseded | marked superseded in the file |

### 6.2 Keep everything running

Outcomes: O3.

- Update every path reference to a moved file in code, scripts, tests, `plan.json` files and `install.sh`. Comments count.
- **Authorised edit to protected tests, and only this edit:** in each moved `.tests/` and `.plan/` file, change relative import specifiers and repository-root resolution so they resolve from one directory deeper — for example `"../../lib/rework.ts"` becomes `"../../../lib/rework.ts"`, `resolve(here, "../../tools/…")` becomes `resolve(here, "../../../tools/…")`, and Python `parents[2]` becomes `parents[3]`. **String literals used as test data are not import specifiers and must not change** — in particular the `"../../"` strings inside `plan.test.ts`'s fixtures.
- Test data strings that merely contain an old spec path — for example `normalizeSpecName("docs/SPEC-tiered-retry.md")` — stay as they are; they test string handling, not file locations.

Preserve: every spec's prose; every test's assertions.
Seams: `scripts/run-plan.mjs` → `plan.spec` → `.tests` sibling, which works for the new names unchanged once `plan.json`'s `spec` field is updated.

## 7. Paths

| Path | Trigger | Planned check or justified exclusion |
|---|---|---|
| happy: committed spec | any of the seven on `main` | V1, V2 |
| uncommitted spec | `docs/SPEC-map-views.md` | V1 |
| spec with sibling directories | production-config, spec-translation, map-views | V1, V4 |
| test depending on depth | moved `.tests/` files | V4, V5 |
| string literal resembling a path | `plan.test.ts` fixtures | V5 |
| a reference that cannot move | step 0 finds one | §9 stop |

## 8. Verification

| Outcome | Change | Check ID: falsifiable condition |
|---|---|---|
| O1 | §6.1 | V1: `find . -name 'SPEC*.md' -not -path './node_modules/*'` lists only `/docs/specs/SPEC-NNNN-*.md` files and `tests/fixtures/ab/SPEC.md`; every sibling directory has a matching stem |
| O1 | §6.1 | V2: `git log --follow` on two moved specs shows their pre-move history |
| O2 | §6.1 | V3: `/docs/specs/index.md` has one row per spec, with ID, title, status, date and former path, and IDs are unique and contiguous |
| O3 | §6.2 | V4: every moved test suite passes as before — the node suites and `uv run --project tools/map pytest` on the moved Python file |
| O3 | §6.2 | V5: `git diff -M` on every moved protected test shows only import-specifier and root-resolution lines changed |
| O3 | §6.2 | V6: `grep -rn "docs/SPEC-\|docs/design/SPEC" --include=*.ts --include=*.mjs --include=*.js --include=*.sh --include=*.json --include=*.py .` returns only test-data strings, each listed in the report |
| O3 | §6.2 | V7: `./doctor.sh --offline` and `./doctor.sh --project .` exit 0 |

You write and run the commands. **Protected** — never edit, skip or weaken to pass, except the §6.2 depth edit: every moved `.tests/` directory; `tests/routing-suite/`; `tests/fixtures/`.

Invariants: each spec's prose is byte-identical before and after the move.

## 9. Stop conditions and repairs

If a check fails because of a local error inside this scope, diagnose, fix, and rerun the affected checks. Up to three repair rounds per failed check group. Stop and report instead when: a step-0 contradiction changes the design; a protected test needs any change beyond §6.2's depth edit to pass; a reference cannot be updated without changing behaviour; scope would need to grow; or the same failure repeats without a new testable diagnosis. Never mark an unrun check as passed.

## 10. Report back

1. Start revision; step-0 expected against actual.
2. Each V-check: command, output, pass/fail/not-run, repair rounds used.
3. O-ID → evidence; which §7 paths actually ran.
4. `git diff --stat -M`; the full diff of every moved protected test, which should show only depth edits; the final `/docs/specs/index.md`.
5. Any status in the index that differs from §6.1's expected column, with the reason.
6. Deviations from §6 with reasons.

## 11. Landing

Filled from the review.
