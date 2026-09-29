# SPEC-0014: Complete the codebase map — attribution, pipeline visibility, owners and data model views

| Field | Value |
|---|---|
| Status | implemented |
| Size | staged (3 stages) |
| Kind | build |
| Parent | SPEC-0007 |
| Date | 2026-09-30 |
| Checkpoint | continuous |
| Run record | /docs/specs/SPEC-0014-run.md |

Spec ID `0014` confirmed free at start revision `d816bd98a6aa8d77ba066c420078850a21087757`.

Executor: `bin/pi-implement` — the delegated route: Sol plans at high, Luna implements each task at medium, Sol integrates at high.

Read `/.agents/notes/index.md` if present. Record the revision you start from.

## 1. Intent

`SPEC-0007` built the map, but skipped its harness half, M0, so agent activity is nearly empty — 6 of 341 snapshot rows attribute to this repository. Its extractors capture no methods, and only TypeScript functions under `export`. Its data model tab mixes code and data in 501 cards. Since then, two changes to the harness make the gap wider and the fix simpler:

- **Pipeline work would be invisible.** Every pipeline session writes its own telemetry database in its run directory, while the map reads one database. Pipeline sessions run in git worktrees outside the repository, so even a recorded project root would be the worktree's path. And the map, like explain before `SPEC-0011`, would rebuild after every turn inside pipeline children.
- **Walkthroughs are named by turn id** since `SPEC-0011`. The map can link a walkthrough to its turn from the file name; the harness no longer needs to write a marker line into it.

And the index write-back has been skipped at three spec landings in a row. The pipeline should do it itself.

Decisions agreed in planning: the page gets **two tabs, Data and Code**, replacing the data model tab. A class with fields and methods appears in both — as a record in Data, as the owner of its methods in Code. Events belong to Code, on the card of the function that subscribes. History backfill is deferred.

Outcomes:
- **O1**: Every telemetry row records the repository it worked on — the main working tree, including from a worktree — the tool call id, and the session's role: `explain`, `recap`, `planner`, `editor` or `integration`.
- **O2**: The map reads every pipeline run's telemetry and links walkthroughs to turns by file name; it does not run inside pipeline children.
- **O3**: When a pipeline run's final grade passes, the spec's header and index row say `implemented`, by `pi pipeline`.
- **O4**: Both extractors capture methods and nested named functions, linked to their owners; anonymous callbacks are not entities.
- **O5**: Every data model entity is labelled `data` or `code`, and whether it is test code; the page shows separate Data and Code tabs.
- **O6**: This repository's map excludes reference trees and test fixtures, and the performance test measures the tool, not environment setup.

## 2. Priority

Agent activity is what makes this map more than a code visualiser, and from now on most development runs through the pipeline. Deferred: backfilling historical rows; visual polish beyond the structure in §6.3; call graph changes.

## 3. Prior art

The map's own design already supplies what this needs: qualified ids from enclosing scopes, `method_definition` as a TypeScript scope, a telemetry adapter that reads `project_root`, `subagent_role` and `tool_call_id` when present, and a build that accepts `--telemetry` repeatedly. Git's `rev-parse --git-common-dir` gives the main repository for any worktree. Adopt all of it; add captures, columns and arguments, not machinery.

## 4. Grounding

| Fact | Expected | Tag | Source |
|---|---|---|---|
| `lib/telemetry.ts` | has `ensureColumn`, `parent_turn_id`; no `project_root`, `subagent_role` or `tool_call_id` | measured | `34c3bd4` |
| Turn ids | `randomUUID()`; walkthroughs named `<day>-turn-<turnId>.md` | measured | `lib/telemetry.ts`, `extensions/explain.ts` |
| `explainSpawnEnv(base)` | used by explain and recap; sets no role | measured | same |
| Pipeline child sessions | spawned in `bin/pi-implement` (planner), `scripts/run-plan.mjs` (each task, and integration); env sets `PI_BUILD_PIPELINE` and a per-run `PI_BUILD_TELEMETRY_DB`, no role | measured | same |
| Pipeline databases | `<run>/tasks/<task>/telemetry.db`, `<run>/integration-telemetry.db`, and the planner's in `bin/pi-implement`; run root `~/var/pipeline-runs`, hardcoded in `bin/pi-implement` | measured | same |
| Pipeline working directory | a git worktree outside the repository | measured | `bin/pi-implement` |
| `mapCommand(settings, { root, telemetry, turn? })` | one `--telemetry`; pinned by `tests/map-shim.test.ts` | measured | `extensions/map.ts` |
| Map build | `--telemetry` repeatable; each source processed separately | measured | `tools/map/map_build/__main__.py`, `build.py` |
| Map walkthrough links | first-line marker `<!-- turn: <id> -->` only, which nothing writes | measured | `_explain_links` in `build.py` |
| Adapter attribution | rule 1 `project_root`; rule 2 absolute path under root; rule 3 relative path in a rule-2 session | measured | `tools/map/traces/pi_telemetry.py` |
| Extractors | TypeScript: functions under `export_statement` only, no methods; Python: module-level functions only | measured | the two `structure.scm` queries |
| IR vocabulary | no `method` kind, no `member_of` relation | measured | `tools/map/map_build/ir.py` |
| Page tabs | `treemap`, `callgraph`, `erd` | measured | `render/template.html` |
| `.map/project.toml` excludes | no `docs/specs/*.reference/**`, no `tests/fixtures/**` | measured | same |
| Performance test | times a cold then warm build; the first run in a fresh environment exceeds its limit | measured | `tools/map/tests/test_snapshot.py`; a fresh-environment run |
| Index write-back | skipped at `SPEC-0008`, `SPEC-0010` and `SPEC-0011` | measured | `docs/specs/index.md` history |

**Step 0:** verify every row and record expected against actual. Where the repository differs, follow §9.

## 5. Scope

In: `lib/telemetry.ts`, `lib/pipeline.ts`, `lib/specs.ts`, `extensions/map.ts`, `extensions/recap.ts`, `bin/pi-implement`, `scripts/run-plan.mjs`, `agent/AGENTS.md`; `tools/map`; `.map/project.toml`.

Out: backfilling history; the adapter's attribution rules; `scripts/report.sql` semantics; the call graph view.

The pipeline's sessions load the harness from the main checkout, not their worktree, so this run does not change the code it runs on; the new telemetry and map extension take effect in the next pi session after merging.

## 6. Changes

### 6.0 Architecture

Harness telemetry writes rows with `project_root`, `tool_call_id` and `subagent_role`; pipeline children write theirs to run databases; `extensions/map.ts` passes the main database and every run database to the map build; the adapter attributes rows by `project_root`; extractors emit owners and layers; views build `erd.json`; the page renders Data and Code. Seams: telemetry columns ↔ the adapter's `M0_COLUMNS`; walkthrough file names ↔ `_explain_links`; `childEnv` ↔ every pipeline spawn; `markImplemented` ↔ the hand-off.

### 6.1 Stage 1: Attribution, roles, and pipeline visibility

Depends on: nothing. Outcomes: O1, O2 (harness half), O3.

- `lib/telemetry.ts`: add `tool_calls.tool_call_id`, and `project_root` and `subagent_role` on `tool_calls` and `inference_calls`, through `ensureColumn` and in `SCHEMA`. Existing rows keep nulls.
- Export `telemetryProjectRoot(cwd)`: the parent of `git rev-parse --path-format=absolute --git-common-dir` run in `cwd` — the main working tree, for a worktree too — and `findProjectRoot(cwd)` from `lib/scaffold.ts` when `cwd` is not in a git repository. On `agent_start`, store it for `ctx.cwd`; write it on every row.
- Persist `row.toolCallId`. Capture `PI_BUILD_SUBAGENT_ROLE` when the telemetry state is created; write it on every row, null when unset.
- `explainSpawnEnv(base = process.env, role = "explain")` sets `PI_BUILD_SUBAGENT_ROLE`; `extensions/recap.ts` passes `"recap"`.
- `lib/pipeline.ts`: `childEnv(base, role, telemetryDb)` returns `base` with `PI_BUILD_PIPELINE=1`, `PI_BUILD_SUBAGENT_ROLE=role` and `PI_BUILD_TELEMETRY_DB=telemetryDb`; `pipelineRunRoot(settings, home)` reads `pipeline.runRoot`, default `<home>/var/pipeline-runs`; `pipelineTelemetryDbs(root)` returns every `telemetry.db` and `*-telemetry.db` under `root`, sorted, `[]` when `root` is missing. The planner spawn in `bin/pi-implement` uses role `planner`, each task `editor`, integration `integration`; `bin/pi-implement` uses `pipelineRunRoot`.
- `extensions/map.ts`: `mapCommand` accepts `extraTelemetry?: string[]`, each added as a further `--telemetry` after the main one; the extension passes `pipelineTelemetryDbs(pipelineRunRoot(settings, homedir()))`. Export `shouldRunMap(env)` — false when `PI_BUILD_PIPELINE` is `1` — and do not build the map when it is false.
- `lib/specs.ts`: `markImplemented(indexText, specText, id, by)` sets the spec header's Status row and the index row's Status to `implemented`, and the index's Implemented by to `by`; it changes nothing else and throws when the index has no row for `id`. `bin/pi-implement`'s hand-off applies it with `pi pipeline` on the branch when the final grade passes.
- `agent/AGENTS.md`: add *When a spec's final acceptance passes in an interactive session, set its status to `implemented` in its header and in `/docs/specs/index.md`, with Implemented by.*

Preserve: every existing row and column; `mapCommand`'s output when no extra databases are given.

Checks: V1, V2, V3, V4, V5. Exit: all pass.

### 6.2 Stage 2: Owners, layers and test code

Depends on: nothing. Outcomes: O4, O5 (data half).

- Add entity kind `method` and relation kind `member_of` to `ENTITY_KINDS` and `RELATION_KINDS` in `tools/map/map_build/ir.py`; document both in `tools/map/README.md`.
- Captures, using the runner's existing qualified ids:

| Language | Captured | Kind | Owner, via `member_of` |
|---|---|---|---|
| TypeScript | every named `function_declaration`, exported or not, at any depth | `function` | enclosing function, if any |
| TypeScript | every `const`/`let` declarator whose value is an arrow function or function expression, at any depth | `function` | enclosing function, if any |
| TypeScript | every `method_definition` in a class body, including `get` and `set` | `method` | the class |
| Python | every `function_definition` at any depth | `method` when its parent scope is a class, else `function` | enclosing function or class |

- Anonymous functions — callbacks, handlers passed to `pi.on`, arguments to `.map` — are not entities; their accesses attribute to the innermost named scope.
- Every `erd.json` entity gains `"layer"`: `data` for `table`, `file_store`, `config`, `dataclass`, `pydantic`, `typeddict`, `enum` and `global`, and for a `class`, `interface` or `type` with at least one field; `code` otherwise. And `"test"`: true under a `tests/` directory or for `test_*.py`, `*_test.py`, `conftest.py`, `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`.
- Regenerate the TypeScript and Python conformance goldens.

Preserve: every existing entity, relation and access in the goldens.

Checks: V6, V7, V8. Exit: all pass.

### 6.3 Stage 3: Links, tabs, exclusions and the performance test

Depends on: Stage 2. Outcomes: O2 (map half), O5 (page half), O6.

- `_explain_links` in `tools/map/map_build/build.py`: a first-line marker still wins; otherwise take the turn id from a file named `<YYYY-MM-DD>-turn-<id>.md`. Other files, `known.md` included, link to nothing.
- Page tabs, in order, with these `data-tab` values and panel ids: Treemap `treemap` `view-treemap`; Call graph `callgraph` `view-callgraph`; Data `data` `view-data`; Code `code` `view-code`. Treemap stays the default; keys 1–4 select tabs.
- **Data** shows data-layer entities with their fields, the `has_field_of` and `fk` relations among them, and, as smaller nodes, every function or method with a `read` or `write` access to a data entity, joined by read and write edges.
- **Code** groups code-layer entities: a module contains its top-level declarations; a declaration contains its members through `member_of`. A data-layer entity that owns code members also appears here as their owner. An owner's card lists its event subscriptions. Test entities are hidden behind a toggle, off by default; the modules-and-imports toggle stays.
- `.map/project.toml`: exclude `docs/specs/*.reference/**` and `tests/fixtures/**`.
- `test_performance`: run the build once untimed to warm the environment, then time cold and warm runs.
- Regenerate `tools/map/fixtures/sample-index.html` from the snapshot.

Preserve: the treemap and call graph views.

Checks: V9, V10, V11, V12, V13, V14. Exit: all pass.

## 7. Paths

| Path | Trigger | Planned check or justified exclusion |
|---|---|---|
| new row in a plain checkout | a turn in the repository | V1 |
| new row in a worktree | a pipeline session | V1 — the main working tree |
| outside any git repository | a scratch directory | V1 — `findProjectRoot` fallback |
| pre-M0 database | opening the snapshot | V1 — columns added, rows kept |
| role unset; explain, recap and pipeline roles | each kind of session | V1, V2 |
| pipeline databases present or absent | the run root | V2 |
| map inside a pipeline child | `PI_BUILD_PIPELINE=1` | V2 — not built |
| final grade passes | pipeline hand-off | V3 |
| spec missing from the index | hand-off | V3 — error |
| relative paths with a project root | synthetic telemetry | V4 |
| method, getter, nested function, nested arrow, Python nested def | fixture project | V6 |
| anonymous callback | `pi.on(…, async () => …)` | V6 — not an entity |
| class with fields and methods; interface without fields | fixture project | V6 |
| test files | fixture project | V6 |
| golden regression | an existing capture broken | V7 |
| walkthrough by file name; legacy marker; `known.md` | the explain directory | V11 |
| reference trees and fixtures | this repository | V10 |
| fresh environment | a new pipeline worktree | V12 |

## 8. Verification

| Outcome | Change | Check ID: falsifiable condition |
|---|---|---|
| O1 | §6.1 | V1: `telemetry-attribution.test.ts` passes, 5 tests |
| O1, O2 | §6.1 | V2: `pipeline-roles.test.ts` passes, 5 tests |
| O3 | §6.1 | V3: `writeback.test.ts` passes, 3 tests |
| O1 | §6.1 | V4: `test_relative_paths_are_attributed_through_project_root` in `test_map_views.py` passes |
| O1, O2 | §6.1 | V5: `./doctor.sh --offline` reports no failure absent from the start-revision baseline, and `tests/map-shim.test.ts` passes unchanged |
| O4, O5 | §6.2 | V6: the methods, nested-functions, named-declarations, layer and test-flag tests in `test_map_views.py` pass |
| O4 | §6.2 | V7: the goldens' diff adds records only |
| O4, O5 | §6.2 | V8: `uv run --project tools/map pytest -q tools/map` passes |
| O5 | §6.3 | V9: `test_page_has_separate_data_and_code_tabs` passes |
| O6 | §6.3 | V10: `test_this_repository_excludes_reference_trees_and_fixtures` passes |
| O2 | §6.3 | V11: `test_walkthroughs_link_to_their_turn_by_file_name` passes |
| O6 | §6.3 | V12: `test_performance` passes in an environment whose `tools/map/.venv` was just removed |
| O5 | §6.3 | V13: `tools/map/fixtures/sample-index.html` is regenerated at the final commit |
| O1–O6 | §6.3 | V14: `./doctor.sh --offline` and `./doctor.sh --project .` exit 0 |

**Protected** — never edit, skip or weaken to pass: this spec's `.tests/`; `tools/map/fixtures/telemetry.db`; every other spec's `.tests/`.

Invariants: the goldens only grow; `scripts/report.sql` totals on the snapshot are unchanged; `mapCommand` without extra databases produces the same arguments as before.

Shared checks (every stage): `./doctor.sh --offline`, judged against the start-revision baseline.
Final integrated acceptance: all of this spec's `.tests/` pass — 13 Node tests and 9 Python tests — together with V8 and V14.

After landing, not checks: Lucas reviews `sample-index.html` — the Data tab should read as a data model, and the Code tab should show `ReadGuard` with its methods and `quotaGate` with its helpers and subscriptions. After the first real pipeline run, the map should show its sessions with their roles.

## 9. Decisions, repairs and stops

Everything here is committed and reversible with git, so **decide and continue** rather than stop. When this spec conflicts with the repository or with itself, when a check fails, or when a seam differs from §6, make the smallest change that serves the outcomes in §1, record it in the run record as a deviation with the reason, and carry on. Fix failing checks for as long as each attempt brings a new, testable diagnosis.

Stop only for what git cannot undo, or what would change this spec's intent:
- writing outside the repository, except the telemetry columns §6.1 adds and the map's own output;
- spending well beyond an ordinary run — a quota hold is handled by the gate, not by stopping;
- dropping or redefining an outcome in §1, or editing a protected test.

Never mark an unrun check as passed.

## 10. Report back

1. Start revision; step-0 expected against actual.
2. Per stage: each V-check's command, output, pass/fail/not-run and repair rounds.
3. Final integrated acceptance, separately.
4. O-ID → evidence; which §7 paths ran.
5. `git diff --stat`; the full diff of any protected file, which should be empty; the goldens' diff summary; the changed functions with callers in `lib/telemetry.ts`, `extensions/map.ts`, the two structure queries and `map_build/views/erd.py`.
6. Deviations from §6 with reasons.

## 11. Landing

Filled from the review.
