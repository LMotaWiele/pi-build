# SPEC-0014 run

Implemented by: pi pipeline

Branch: pipeline/SPEC-0014-complete-the-codebase-map-2026-09-29T21-58-35-271Z
Plan: docs/specs/SPEC-0014-complete-the-codebase-map.plan; gate: pass; checks: 14

## Tasks
- T3: pass; model gpt-6-luna; rounds 4; cost $0.00278992
- T4: pass; model gpt-6-luna; rounds 11; cost $0.005275760000000001
- T10: pass; model gpt-6-luna; rounds 6; cost $0.00353972
- T17: pass; model gpt-6-luna; rounds 10; cost $0.00510738
- T20: pass; model gpt-6-luna; rounds 9; cost $0.00210268

## Final grade

```json
{
  "commit": "db833267e9212e586abbbaa2b49aff0e1f0b8f42",
  "typecheck": {
    "code": null,
    "out": "no tsconfig.json"
  },
  "specTests": {
    "code": 0,
    "out": "✔ every pipeline child is marked as pipeline work, with its role and its database (0.48088ms)\n✔ the run root is a host setting, defaulting to ~/var/pipeline-runs (0.110647ms)\n✔ every pipeline telemetry database under the run root is found, in a stable order (0.835343ms)\n✔ the map reads pipeline databases after the main one; existing calls are unchanged (0.167423ms)\n✔ the map does not run inside a pipeline child (0.08503ms)\n✔ opening a pre-M0 database adds the columns and keeps every row (8.000362ms)\n✔ rows carry the project root found from the turn's working directory, and the tool call id (4.920157ms)\n✔ a subagent role in the environment at startup is written on every row; none is null (9.141647ms)\n✔ explain and recap children are spawned with their role (0.214592ms)\n✔ inside a git worktree, the project root is the repository's main working tree (18.648779ms)\n✔ the spec's header and its index row become implemented, with who built it (0.732831ms)\n✔ nothing else changes: other rows, other fields, and prose that says ready (0.176059ms)\n✔ a spec missing from the index is an error, not a silent no-op (0.242163ms)\nℹ tests 13\nℹ suites 0\nℹ pass 13\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 128.550015\n.........                                                                [100%]\n9 passed in 0.22s\n"
  },
  "planTests": {
    "code": 0,
    "out": "✔ pipeline roles and DB override inherited values without changing the base (0.43849ms)\n✔ configurable run root and sorted recursive telemetry DB discovery (0.797713ms)\n✔ write-back changes only the specified index row and header status (0.80191ms)\nℹ tests 3\nℹ suites 0\nℹ pass 3\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 67.011122\n...                                                                      [100%]\n3 passed in 0.02s\n"
  }
}
```

## Runtime
Stuck findings, escalations and pauses: see task session logs and telemetry in /home/george-contis/var/pipeline-runs/SPEC-0014-complete-the-codebase-map/2026-09-29T21-58-35-271Z.
Provider task cost: $0.01881546; planner: {"calls":20,"cost":0.5032088}. Quota deltas: see usage snapshots in telemetry.

## Protected files diff

```diff

```

## Report
# SPEC-0014 integration report

## Start and step 0

Start revision: `d816bd98a6aa8d77ba066c420078850a21087757`. The §4 grounding matched the code at start (expected → actual):

| §4 surface | Expected → actual at start |
|---|---|
| Telemetry, turn ids, explain env | `ensureColumn` and parent id but no M0 fields; UUID turn/file naming; no child role → all matched |
| Pipeline child spawns, databases, working directory | Per-run child databases, no role, external git worktree → all matched |
| Run root | Hardcoded home `var/pipeline-runs` → matched |
| Map command/build | Single main telemetry argument; Python accepts repeated `--telemetry` → matched |
| Walkthrough links and attribution adapter | Marker-only links; project-root/path/session three-rule adapter → matched |
| Extractors and IR | TS exports only/Python module defs only; no `method` or `member_of` → matched |
| Page and config | Treemap/callgraph/erd tabs; no reference-tree/fixture exclusions → matched |
| Performance and index | Timed cold then warm, no environment warmup; recent writebacks skipped → matched |

The spec title still said `SPEC-NNNN` and index had no 0014 row, despite the allocated filename; corrected both for doctor validation. No spec tests or telemetry snapshot were changed.

## Stages, verification and repairs

| Check | Command / evidence | Result | Repairs |
|---|---|---|---|
| V1 | `node --experimental-strip-types --test docs/specs/SPEC-0014-complete-the-codebase-map.tests/telemetry-attribution.test.ts` (included in combined Node command below) | pass, 5 tests | Initial 5 failures: columns, root and roles absent. Added nullable migrations, worktree root, row attribution and role. |
| V2 | same combined Node command, `pipeline-roles.test.ts` | pass, 5 tests | Initial import error: `shouldRunMap` absent. Added child env, database discovery and map guard. |
| V3 | same combined Node command, `writeback.test.ts` | pass, 3 tests | 0 |
| V4 | same combined Python command, `test_relative_paths_are_attributed_through_project_root` | pass | 0 |
| V5 | `node --experimental-strip-types --test tests/map-shim.test.ts`; `env -u PI_BUILD_PIPELINE ./doctor.sh --offline` | pass (6 shim tests; doctor exit 0) | Existing source-inspection test `tests/pipeline-explain.test.ts` expected literal env object, updated to assert calls of equivalent `childEnv`; initial doctor also rejected placeholder spec title and missing index row. Environment sets `PI_BUILD_PIPELINE=1`, so unset it when running doctor: old `tests/markdown.test.ts` expects non-pipeline explain. |
| V6 | combined Python command, `test_map_views.py` owner/layer/test tests | pass | Initially missing methods/layers; then db store `db:app` was filtered out. Included data-kind entities even without relations. |
| V7 | `UPDATE_GOLDEN=1 uv run --project tools/map pytest -q tools/map/conformance/test_conformance.py`; set comparison against `git show HEAD:<golden>` | pass, 41 conformance tests; Python 58→70 (+12, 0 removed), TypeScript 61→70 (+9, 0 removed) | First generated goldens had incorrect ordering. A subsequent Python generation displaced two existing inferred fields from class to method; restored their owner in runner before final regeneration. Restricted TypeScript method capture to `class_body` (object-literal methods are outside the specified class-body capture). |
| V8 | `uv run --project tools/map pytest -q tools/map` | pass, 80 tests | 2 golden ordering failures in first round; regenerated correctly. |
| V9 | combined Python command, `test_page_has_separate_data_and_code_tabs` | pass | Initial 3-tab page; replaced ERD with Data and Code panels. |
| V10 | combined Python command, repository exclusions test | pass | 0 |
| V11 | combined Python command, filename link test | pass | 0 |
| V12 | moved `tools/map/.venv` aside; `uv run --project tools/map pytest -q tools/map/tests/test_snapshot.py::test_performance` | pass, 1 test in 1.85s after fresh virtualenv creation | Warmup now runs untimed against a separate disposable output. |
| V13 | Built with `BuildOptions(repo=Path.cwd(), out=Path('/tmp/spec14-final-map'), telemetry=[Path.cwd()/'tools/map/fixtures/telemetry.db'], window_days=36500, aliases=(...three snapshot roots...), no_cache=True)` then copied generated `index.html` to `tools/map/fixtures/sample-index.html` | pass; 43 events, 12 warnings, 0 errors; snapshot contains four tabs and inlined assets | 0 |
| V14 | `env -u PI_BUILD_PIPELINE ./doctor.sh --offline`; `env -u PI_BUILD_PIPELINE ./doctor.sh --project .` | pass, both exit 0 | Source-inspection test and spec index repaired as above. |

## Final integrated acceptance (separate)

- `node --experimental-strip-types --test docs/specs/SPEC-0014-complete-the-codebase-map.plan/T3.test.ts docs/specs/SPEC-0014-complete-the-codebase-map.plan/T4.test.ts docs/specs/SPEC-0014-complete-the-codebase-map.tests/pipeline-roles.test.ts docs/specs/SPEC-0014-complete-the-codebase-map.tests/telemetry-attribution.test.ts docs/specs/SPEC-0014-complete-the-codebase-map.tests/writeback.test.ts`: **16 passed, 0 failed** (3 plan, 13 spec).
- `uv run --project tools/map pytest -q docs/specs/SPEC-0014-complete-the-codebase-map.plan/test_T10.py docs/specs/SPEC-0014-complete-the-codebase-map.plan/test_T17.py docs/specs/SPEC-0014-complete-the-codebase-map.plan/test_T20.py docs/specs/SPEC-0014-complete-the-codebase-map.tests/test_map_views.py`: **12 passed, 0 failed** (3 plan, 9 spec).
- `uv run --project tools/map pytest -q tools/map`: **80 passed**; after the class-body restriction, `uv run --project tools/map pytest -q tools/map docs/specs/SPEC-0014-complete-the-codebase-map.tests/test_map_views.py`: **89 passed**. `env -u PI_BUILD_PIPELINE ./doctor.sh --offline` and `env -u PI_BUILD_PIPELINE ./doctor.sh --project .`: **exit 0**. `node --experimental-strip-types --test tests/map-shim.test.ts`: **6 passed**.
- Typecheck: runner's `tsconfig.json` check returned **not configured** (there is no `tsconfig.json`); no TS typecheck was claimed. `node --check scripts/run-plan.mjs`, `node --check bin/pi-implement`, `node --check tools/map/map_build/render/app.js`: all exit 0.
- `git diff --cached --check`: exit 0. Protected spec tests and `tools/map/fixtures/telemetry.db`: **empty diff**. Plan acceptance tests: **empty diff**, no edits.

## Outcomes and paths

O1: five telemetry tests, including checkout/worktree/non-git fallback, pre-M0 migration and null/labelled roles. O2: pipeline role/discovery tests, suppressed child map, filename and marker link tests; planner now uses discoverable `planner-telemetry.db`. O3: three writeback tests plus passing-grade-only handoff in `bin/pi-implement`. O4: method/nesting tests and monotonically expanded goldens. O5: layer and test flag tests, separate tab test and generated page. O6: exclusion and fresh-venv performance tests. §7 paths exercised: checkout, worktree, scratch fallback, legacy database, unset/set roles, present/absent pipeline DBs, child map suppression, writeback/missing index row, relative paths, named and anonymous structures, class with and without fields, test files, golden regression, filename/legacy/known links, exclusions, fresh environment. Real grade hand-off was reviewed in code, not launched from within this integration run.

## Diff and caller seams

`git diff --cached --stat`: 20 files changed, 432 insertions(+), 333 deletions(-); includes generated HTML (287 changed lines). Protected files full diff: **empty**. Goldens: Python +12 records, TypeScript +9, no removals. `scripts/report.sql` was not edited; snapshot totals compared by `tools/map/tests/test_snapshot.py::test_totals_match_report_sql` (pass).

Changed functions and callers: `telemetryProjectRoot` is called by `attachTelemetry`'s `agent_start`; `database` migrates rows consumed by `recordToolCall` and `recordInference`, both invoked by telemetry event handlers (and tests); `explainSpawnEnv` is called from explain and recap child spawns. `mapCommand` is called by `mapExtension.build` and map-shim tests; `shouldRunMap` is called at map-extension startup. TypeScript `structure.scm` and Python `structure.scm` are read by each language's `module.py` plugin through `run_queries`; `run_queries` supplies entities/relations to resolution and `build_erd`. `build_erd` is called by `map_build.build.build`, then its `erd.json` is rendered in the Data and Code views.

## Deviations from §6 / plan

- The allocated spec had an `NNNN` header and lacked an index row. Replaced header and added ready row so doctor can validate it; left status ready for the post-grade handoff.
- T5 brief suggested `planner.db` and `repair-*.db`, but §6.1's `pipelineTelemetryDbs` only discovers `telemetry.db` or `*-telemetry.db`. Used `planner-telemetry.db` and `repair-*-telemetry.db` to satisfy O2, adjusting usage lookup.
- `tests/pipeline-explain.test.ts` is an existing non-protected source-inspection test; updated its literal-env assertions to validate `childEnv` call sites (the spec-mandated API) without changing behavior. No plan acceptance tests were edited.
- Under the pipeline's inherited `PI_BUILD_PIPELINE=1`, the legacy markdown explain test expects non-pipeline behavior. Doctor was run with this inherited flag removed to test its normal host mode; raw doctor in the pipeline env initially failed that test. The unavailable `typebox` package also produces a nonfatal extension-load warning.
- No project TypeScript configuration exists, so the conditional typecheck was not run. No check has been labelled passed without being run.

