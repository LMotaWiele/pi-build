# SPEC-0020 run

Implemented by: pi pipeline

Branch: pipeline/SPEC-0020-write-spec-tests-when-a-spec-has-none-2026-10-15T18-50-50-747Z
Plan: docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan; gate: pass; checks: 13

## Tasks
- L01-decisions: pass; model gpt-6-luna; rounds 6; cost $0.004283380000000001
- L02-preflight: pass; model gpt-6-luna; rounds 8; cost $0.00358098
- L04-progress: pass; model gpt-6-luna; rounds 5; cost $0.00133606
- L05-summary: pass; model gpt-6-luna; rounds 4; cost $0.00187092

## Final grade

```json
{
  "commit": "26f23072649c9bbba96ce87ca5788b75d34fc62d",
  "typecheck": {
    "code": null,
    "out": "no tsconfig.json"
  },
  "specTests": {
    "code": 0,
    "out": "(node:499043) ExperimentalWarning: stripTypeScriptTypes is an experimental feature and might change at any time\n(Use `node --trace-warnings ...` to show where the warning was created)\n✔ every V-check needs a test file named for it or a MANUAL.md entry with a reason (1.086894ms)\n✔ V1 is not covered by a file named for V10, and a file naming a check the spec lacks is an error (0.658172ms)\n✔ checks that are all manual, tests that all pass before implementation, and syntax errors are rejected (0.205996ms)\n✔ edits outside the tests directory are found, generated walkthroughs are not (0.233668ms)\n✔ the writer's prompt names the spec, the directory, every check, the runners available, and forbids implementing (0.164407ms)\n✔ a syntax error is caught without running the file, and an import of a module that does not exist yet is not one (19.041262ms)\n✔ a spec without tests no longer blocks when the pipeline will write them; it still blocks otherwise (0.978381ms)\n✔ the summary says who wrote the spec tests, which failed before implementation and which checks are manual (1.262242ms)\n✔ a downloaded spec without tests is installed, the test writer runs first, and its tests are frozen in their own commit (318.125135ms)\n✔ tests that pass before implementation, or do not parse, go back to the writer with the gate's errors (531.935141ms)\n✔ after three rejected rounds the run stops before planning, with a summary (522.263646ms)\n✔ a spec that ships its own tests skips the writer (138.392747ms)\n✔ a dry run of a spec without tests says who will write them instead of refusing (103.452185ms)\nℹ tests 13\nℹ suites 0\nℹ pass 13\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 1680.226983\n"
  },
  "planTests": {
    "code": 0,
    "out": "(node:499508) ExperimentalWarning: stripTypeScriptTypes is an experimental feature and might change at any time\n(Use `node --trace-warnings ...` to show where the warning was created)\n✔ test recognition and basename V-IDs use runner patterns and numeric boundaries (1.513823ms)\n✔ manual entries require a reason and normalize padded check numbers (0.237615ms)\n✔ gate accepts mixed fail-to-pass/pass-to-pass coverage and rejects omissions, range errors and vacuity (0.34688ms)\n✔ outside edits return paths, honor directory boundaries, rename destinations and .agent noise (0.240841ms)\n✔ writer prompt gives every check, permitted runners, red-test rule, isolation and repair feedback (0.562523ms)\n✔ parse checks strip TS, check JS/Python, never execute or resolve imports, and ignore non-tests (423.237928ms)\n✔ writeTests opts out only of the missing-directory blocker and defaults to old behaviour (1.488195ms)\n✔ test generation does not bypass malformed verification, quota, Python, dirty-spec blockers or warnings (0.369722ms)\n✔ spec-tests stage survives parsing, reduction and both progress renderings (1.094629ms)\n✔ existing stages still parse and unknown or malformed stages still cannot update the UI (0.170639ms)\n✔ generated tests are labelled with writer, rounds, per-file before status and manual reasons (2.846057ms)\n✔ unfinished, supplied and legacy runs have explicit fallback status without inventing test evidence (1.234841ms)\n✔ spec-tests evidence wins over metadata while existing gate, tasks and grade sections remain intact (0.481772ms)\nℹ tests 13\nℹ suites 0\nℹ pass 13\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 492.891918\n"
  }
}
```

## Runtime
Stuck findings, escalations and pauses: see task session logs and telemetry in /home/george-contis/var/pipeline-runs/SPEC-0020-write-spec-tests-when-a-spec-has-none/2026-10-15T18-50-50-747Z.
Provider cost by role: planner $0.5242259999999999; editor $0.011071340000000002; integration $0.74754; other $0; total $1.2828373400000004. Planner: {"calls":21,"cost":0.524226}. Quota deltas: see usage snapshots in telemetry.

## Protected files diff

```diff
diff --git a/docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/report.md b/docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/report.md
new file mode 100644
index 0000000..ddc153d
--- /dev/null
+++ b/docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/report.md
@@ -0,0 +1,1017 @@
+# SPEC-0020 implementation and integration report
+
+## 1. Starting state, grounding and baseline (S00)
+
+- Planning/step-0 revision: `42e61473b5e244a388ee0224ad8d20eafc4af3b6`, clean tracked/untracked status, as recorded in `planning-checks.json`.
+- Integration start: `a6767ae272dc0de1979d6cd41fe6d240ab3a5f5c`, on the provided detached integration worktree. Luna's four committed tasks were already present. Pre-existing untracked files: `.agent/recaps/2026-10-15-session-{1,2,3,4}.md`; left unchanged and excluded from commits.
+- Sol production commit: `94ca3aa30397e80b091bfc6b69e392b6752edb51` (`Implement SPEC-0020 generated tests before planning`). Report committed separately on the same starting worktree/HEAD lineage. No push, remote changes, tags, PRs, releases or rewritten commits.
+- `/.agents/notes/index.md` and repository `.agents/notes/index.md` are absent. Opened only the indexed, sealed host note; did not modify it or the queue. The instructions prohibit editing sealed notes.
+- Authoritative planning evidence: `docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/planning-checks.json`; task results: the supplied run's `results.jsonl` (all four Luna acceptance results pass; no out-of-scope/protected edits recorded).
+- Fresh integration evidence, including repeated pre-edit baseline, is under this run's `integration-checks/` (called `E/` below). No real model was called by tests; `pi` children in runner checks are local scripted stubs. No GPU use, router-package change, live routing benchmark, stages 5/6, mutation testing or independent-vendor policy change.
+
+### Step-0 expected versus actual
+
+| Grounding fact | Expected | Actual and evidence |
+|---|---|---|
+| Missing-tests preflight | Refuses with `spec has no .tests/ directory: …` | Confirmed original condition at planning; integration inherited Luna's opt-in `writeTests` condition with exact legacy error retained (`lib/pipeline.ts`). |
+| Protected old expectation | SPEC-0010 expects refusal without the option | Confirmed `pipeline.test.ts` preflight cases; all 42 tests pass before and after. |
+| Run metadata | `branch,spec,stamp,startedAt,base,baseBranch` | Confirmed runner literal before editing. Added only `specTests` to fresh metadata; retained prior fields/resume loading. |
+| Progress stage validation | Fixed STAGES list | Confirmed `lib/progress.ts`; Luna adds `spec-tests` to union/list only. |
+| Child session interface | `pi(work,model,thinking,prompt,log,db)`, planner role | Confirmed runner implementation and `childPiArgs`/`childEnv`; reused without changing global quota/interruption handling. Extra checks verify role, writer override, planner thinking and fresh round paths. |
+| Per-file test runner | `tests(work,files,pythonProject)` returns code/output | Confirmed; each generated test passed separately to it. Null Python project normalized to the existing empty-project CLI representation to avoid an invalid spawn argument. |
+| Final grading/protection | `run-plan.mjs` grades and protects `.tests/` | Confirmed `protectedPaths`, `restoreProtected`, integration restore and final spec-test grade. File unchanged. Additional seam: its snapshot starts after planning, so bin-level generated-test restoration now also covers planner calls (see deviations). |
+| Summary headings | Status, Run, Plan gate, Tasks, Final grade, Sessions | Confirmed original source; Luna inserts only Spec tests before Plan gate. |
+| TS stripping | `module.stripTypeScriptTypes` available | `node -e 'console.log(process.version, typeof require("node:module").stripTypeScriptTypes)'` -> `v24.18.0 function`. |
+| Old tests | No existing failures on Lucas's machine | Not reproduced here: two unit failures, detailed below. All older spec suites and spec Python checks pass. This environment discrepancy does not change design/scope/outcomes. |
+
+`lib/plan.ts` is byte-identical to `/home/george-contis/src/pi-build/lib/plan.ts` (`cmp` exit 0). No design-changing contradiction was found; continued within the allowed production files.
+
+### Failing-test baseline, before implementation
+
+Planning ran every spec suite and the unit suite before any implementation. Integration repeated these before Sol edits. For each older Node suite the command was `node --experimental-strip-types --test docs/specs/<suite>.tests/*.ts`; unit command was `node --experimental-strip-types --test tests/*.test.ts`.
+
+| Suite | Planning baseline | Integration pre-edit repeat |
+|---|---|---|
+| Unit | 131 total, 128 pass, 2 fail, 1 skip; exit 1 | Same exact counts and identities, `E/unit-before.log` |
+| SPEC-0005 | 7/7, exit 0 | 7/7, `E/before-SPEC-0005-configure-production-harness.tests.log` |
+| SPEC-0006 | 39/39, exit 0 | 39/39 |
+| SPEC-0009 | 13/13, exit 0 | 13/13 |
+| SPEC-0010 | 42/42, exit 0 | 42/42 |
+| SPEC-0011 | 23/23, exit 0 | 23/23 |
+| SPEC-0014 Node | 11/11, exit 0 | 11/11 |
+| SPEC-0015 | 22/22, exit 0 | 22/22 |
+| SPEC-0018 | 26/26, exit 0 | 26/26 |
+| SPEC-0019 | 29/29, exit 0 | 29/29 |
+| SPEC-0014 Python | 9/9, exit 0 | 9/9, `E/python-before.log` |
+| SPEC-0020 protected | 8 failing entries: missing helper module; preflight/summary and five runner failures | After Luna, combined requested command: 26 total, 21 pass, 5 fail (runner integration missing), `E/initial-acceptance.log` |
+
+Other pre-edit logs follow `E/before-<full-suite>.tests.log`. Python command: `uv run --project tools/map pytest -q docs/specs/SPEC-0014-complete-the-codebase-map.tests/test_map_views.py` (9 passed in 0.28s). This created only ignored `tools/map/.venv`; no tracked dependency/config changes.
+
+The two unrelated existing failures are:
+1. `tests/markdown.test.ts:184` — `session recap predicate, explain gate, known.md, tier map`, assertion at line 191 (`false !== true`).
+2. `tests/quota-gate-refresh.test.ts` — module-load failure: missing `@earendil-works/pi-tui` imported by `extensions/quota-gate.ts`.
+
+Neither was edited, skipped, weakened or dependency-fixed. Unit skip remains the pre-existing `recorded sets score to the §3.6.1 verdicts` (local measurement databases absent).
+
+All four Luna acceptance *files* failed before implementation, recorded in `planning-checks.json`: decisions missing-module failure; preflight two behavioural failures; progress one behavioural failure (one preservation case passed); summary three behavioural failures. Planning introduced no implementation. Current `validatePlan(plan,13)` -> `{ok:true,errors:[]}` and all four owner-specific `undeclaredImports` -> `[]`.
+
+## 2. Commands, V checks, outputs and repairs (S08)
+
+All commands below ran from this worktree unless the path explicitly names an external evidence script. `E/` is `/home/george-contis/var/pipeline-runs/SPEC-0020-write-spec-tests-when-a-spec-has-none/2026-10-15T18-50-50-747Z/integration-checks/`.
+
+### C1 — exact requested combined acceptance command
+
+```bash
+node "--experimental-strip-types" "--test" "docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/decisions.test.ts" "docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/preflight.test.ts" "docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/progress.test.ts" "docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/summary.test.ts" "docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.tests/gate.test.ts" "docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.tests/preflight-summary.test.ts" "docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.tests/runner.test.ts"
+```
+
+Initial: exit 1, 21 pass / 5 fail. First implementation verification: exit 0, 26 pass / 0 fail (`E/acceptance-round-1.log`). Final verification after preventive freeze hardening: exit 0, 26 pass / 0 fail / 0 skip (`E/final-acceptance.log`). One implementation/repair round fixed the five missing-runner failures. No acceptance failure occurred after that round; preventive hardening was independently reverified, not a repeated unexplained repair.
+
+### C2 — protected spec command
+
+```bash
+node --experimental-strip-types --test docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.tests/*.ts
+```
+
+Exit 0, 13 pass / 0 fail / 0 skip (`E/spec-only.log`).
+
+| V | Exact named checks (C1 and C2) | Result / repairs |
+|---|---|---|
+| V1 | gate: `every V-check needs a test file named for it or a MANUAL.md entry with a reason`; `V1 is not covered by a file named for V10, and a file naming a check the spec lacks is an error` | PASS; inherited Luna implementation, 0 Sol failure repairs |
+| V2 | gate: `checks that are all manual, tests that all pass before implementation, and syntax errors are rejected` | PASS; 0 |
+| V3 | gate: `edits outside the tests directory are found, generated walkthroughs are not` | PASS; 0; additional quoting/staging evidence in C5 |
+| V4 | gate: `the writer's prompt names the spec, the directory, every check, the runners available, and forbids implementing` | PASS; 0 |
+| V5 | gate: `a syntax error is caught without running the file, and an import of a module that does not exist yet is not one` | PASS; 0; plan decisions also parses JS/MJS/MTS/Python |
+| V6 | preflight-summary: `a spec without tests no longer blocks when the pipeline will write them; it still blocks otherwise` | PASS; 0; C5 also checks runner `writeSpecTests:false` |
+| V7 | preflight-summary: `the summary says who wrote the spec tests, which failed before implementation and which checks are manual` | PASS; 0 |
+| V8 | runner: `a downloaded spec without tests is installed, the test writer runs first, and its tests are frozen in their own commit` | PASS; 1 runner implementation round |
+| V9 | runner: `tests that pass before implementation, or do not parse, go back to the writer with the gate's errors` | PASS; 1; simulated run itself uses three writer rounds, distinct from local repair count |
+| V10 | runner: `after three rejected rounds the run stops before planning, with a summary` | PASS; 1 |
+| V11 | runner: `a spec that ships its own tests skips the writer` | PASS; 1 |
+| V12 | runner: `a dry run of a spec without tests says who will write them instead of refusing` | PASS; 1 |
+| V13 | C4 below: SPEC-0019,0018,0015,0010 and unit suite | PASS baseline-relative: exact failing identities unchanged. Raw unit command still FAILS with two baseline failures; 0 repairs to unrelated failures. |
+
+### C3 — each Luna plan acceptance file, independently
+
+```bash
+node --experimental-strip-types --test docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/decisions.test.ts
+node --experimental-strip-types --test docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/preflight.test.ts
+node --experimental-strip-types --test docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/progress.test.ts
+node --experimental-strip-types --test docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/summary.test.ts
+```
+
+All exit 0: 6, 2, 2 and 3 passing cases respectively; zero failures/skips (`E/plan-{decisions,preflight,progress,summary}.log`). No plan acceptance file was edited in integration. No correction of an erroneous plan acceptance test was necessary.
+
+### C4 — V13 regression comparison (same suite boundaries as baseline)
+
+```bash
+node --experimental-strip-types --test docs/specs/SPEC-0019-*.tests/*.ts
+node --experimental-strip-types --test docs/specs/SPEC-0018-*.tests/*.ts
+node --experimental-strip-types --test docs/specs/SPEC-0015-*.tests/*.ts
+node --experimental-strip-types --test docs/specs/SPEC-0010-*.tests/*.ts
+node --experimental-strip-types --test tests/*.test.ts
+```
+
+First four: exit 0, respectively 29/29, 26/26, 22/22, 42/42 (`E/v13-{0019,0018,0015,0010}.log`). Unit: exit 1, 131 total / 128 pass / 2 fail / 1 skip (`E/unit-after.log`), same exact two identities and assertion/load diagnoses as step 0. No new regression.
+
+An additional combined invocation of all five groups was also run (`E/v13.log`): exit 1, 250 total / 248 pass / 1 fail / 1 skip. It is **not** the baseline comparison: SPEC-0018 `tool.test.ts` and SPEC-0019 `progress-tool.test.ts` temporarily symlink the installed pi package's `node_modules` into the checkout. Running these concurrently with unit tests can make the missing-pi-tui load failure disappear. Independent-suite reruns reproduce both baseline failures exactly. This is a fixture/environment interaction, not a dependency repair or an all-green claim.
+
+### C5 — additional hermetic evidence
+
+```bash
+node --experimental-strip-types /home/george-contis/var/pipeline-runs/SPEC-0020-write-spec-tests-when-a-spec-has-none/2026-10-15T18-50-50-747Z/integration-checks/extra-checks.mjs
+```
+
+Exit 0; all nine logged assertions/groups pass (`E/extra-checks.log`). Local scripted `pi` and `uv` only, temporary git repositories, no model or network:
+
+- custom `pipeline.testWriter`, separate planner model, planner thinking, planner role, fresh writer session/log/DB path;
+- mixed per-file fail/pass evidence, tracked/staged-new/rename/Unicode-arrow outside cleanup, ignored-but-unstaged `.agent` noise, tests-only commit;
+- completed generated-stage resume skips the writer and retains the accepted writer provenance despite a changed setting;
+- markerless legacy resume never speculatively generates tests;
+- planner staging edits/additions to generated tests cannot change the frozen baseline, even on ordinary planner failure;
+- ordinary nonzero writer exit stops before planning, cleans outside edits, creates summary but no completion sentinel;
+- Python output with no project is rejected by the fixed per-file gate error (uv stub exits nonzero; the second writer deliberately fails, so this is evidence of the first gate branch, not three Python repairs);
+- opt-out refuses without calls; custom-writer dry run is mutation-free;
+- Python syntax compilation leaves no bytecode in the tests directory; C-quoted octal UTF-8 and arrow-containing rename destinations decode correctly.
+
+These are implementation checks, **not** real model-driven external-project acceptance.
+
+### C6 — typecheck, syntax, plan/protection checks
+
+- Typecheck: **NOT RUN / not applicable** — no `tsconfig.json` in the worktree. Followed the existing `scripts/run-plan.mjs` rule (typecheck code null, `no tsconfig.json`); did not invoke `npx` to install a compiler or invent a configuration. `E/typecheck.log` records this. This is not a claimed typecheck pass.
+- `node --experimental-strip-types --check bin/pi-implement`: exit 0, no diagnostics (`E/runner-syntax.log`). Syntax parsing is not typechecking.
+- `validatePlan(plan,13)` -> `{ok:true,errors:[]}`; owner-specific `undeclaredImports` for all four Luna tasks -> `[]`.
+- `git diff --check`: exit 0, no whitespace errors.
+- Protected spec/unit tests, plan acceptance tests, `scripts/run-plan.mjs`, plan prompt/gate, install/landing/tool/skills/settings were not modified (full protected diff below).
+
+## 3. Outcomes and §7 path evidence
+
+| Outcome | Evidence |
+|---|---|
+| O1 | V6 opt-in/legacy preflight; V12 dry JSON; C5 custom writer/thinking, mutation-free dry run, explicit opt-out. |
+| O2 | V8 verifies installed spec, writer first, tests-only commit on run branch, outside edit discarded and planning reached. C5 verifies staged/new/renamed/Unicode paths and staged .agent exclusion; mixed per-file baseline and planner freeze. Existing run-plan task/integration protection and final-grade calls unchanged. |
+| O3 | V9 passes all-pass and parse errors to fresh rounds 2/3; V10 stops after three rejections, leaves base unmoved and writes summary. C5 ordinary writer exit and Python gate fixed-error branch. |
+| O4 | V11 supplied metadata, no writer/sentinel; C3 legacy/supplied summary fallbacks. |
+| O5 | V7 and C3 summary tests verify writer/rounds, both transition labels, manual lines and unfinished/legacy states. V8/V9 assert producer JSON contents and rounds; C5 checks original provenance retained across resume. Run-record construction statically reviewed below; no claim of a full new model-driven pipeline handoff. |
+
+All protected §7 paths ran: downloaded markdown; outside README write; all-pass rejection; parse rejection; three rejections; supplied tests; resolved-spec dry run; numeric V1/V10/range/manual rules; all-manual/all-pass/syntax; .agent/renames; prompts with/without Python/errors; missing imports. The declared exclusions are treated explicitly:
+
+- Completed-stage existence guard: not exercised by protected suite, but exercised by C5 for completed and markerless resumes.
+- Python writer output with no Python project: not exercised by protected suite, but first-round fixed error exercised by C5, without invoking a real uv/project dependency resolution.
+- Real model writing tests for a real external-project spec: **NOT RUN**. Lucas's next external-project run remains acceptance. No hermetic stub is represented as model acceptance.
+
+Static review of paths not fully end-to-end here:
+- Generated run record uses `spec-tests.json.writer`, not the current setting, and inserts exactly one `Spec tests:` line immediately after `Plan:`. Supplied/no-artifact line is `Spec tests: supplied with the spec`; all remaining record text is preserved. Full record/handoff code appears below. No complete generated-run handoff was executed in this integration session.
+- Later freeze/grading: unchanged `run-plan.mjs` restores protected paths after tasks and integration and runs both generated/supplied `.tests/` for final grade. Added bin-level guard closes the earlier planner-call gap; C5 tests staged planner edits on failure. Quota/interrupt paths in `pi()` remain unchanged; resume also restores generated baseline before entering planning.
+
+## 4. Changes and callers (S03, S06, S07, S08)
+
+Production changes are restricted to the seven §5 paths. Implemented all Sol tasks: S00 grounding, S03 runner, S06 README, S07 extension documentation, S08 final report (also copied to the plan report path). Luna's L01/L02/L04/L05 remain committed separately; integration hardens L01 parsing/porcelain details without changing its public interface.
+
+Caller inventory:
+- New `isTestFile` -> `specTestsGate`, `parseErrors` and runner automated-file collection; `checksNamed` -> `specTestsGate`; `manualEntries` -> `specTestsGate` and runner JSON producer; internal `decodePorcelainPath` -> `pathsOutside`.
+- New `pathsOutside`, `parseErrors`, `specTestsPrompt`, `specTestsGate` -> runner generation stage. Public helpers are also exercised directly by protected gate and plan decisions tests.
+- Changed `preflight` / `PreflightInput` -> runner top-level preflight; protected/spec/plan callers omitting `writeTests` retain exact prior behavior.
+- Changed runner `tests` -> generation per-file gate and existing plan acceptance gate. Empty Python-project normalization prevents a null subprocess argument in the newly reachable rejection path.
+- New runner `restoreFrozenSpecTests` -> before plan, after initial planner and every repair planner, before plan commit. Applies only to metadata-marked generated runs.
+- Changed runner top-level declarations -> preflight inputs, dry JSON, fresh metadata, pre-plan stage and handoff record. Full script below supplies their complete calling context.
+- `ProgressStage`/`STAGES` -> existing `parseProgressLine`; its callers include runner stream forwarding and `extensions/pipeline.ts`. Reduction/render logic unchanged.
+- Changed `buildSummary` -> runner `finish` for all post-directory exits; protected summary and plan summary tests call directly. Existing status/gate/tasks/grade/session behavior retained.
+- README Developing with pi and agent/EXTENSIONS Pipeline tool -> human usage docs only; no tool contract or runtime code outside scope changed.
+
+### Scope diff stat
+
+Command: `git diff --stat 26f2307 -- README.md agent/EXTENSIONS.md bin/pi-implement lib/spec-tests.ts lib/pipeline.ts lib/progress.ts lib/run-summary.ts` (all implementation, including Luna, relative to the committed plan; excludes the report itself and earlier planning artifacts).
+
+```text
+ README.md           |   4 +-
+ agent/EXTENSIONS.md |   2 +-
+ bin/pi-implement    |  95 +++++++++++++++++++++++++++++++++++--
+ lib/pipeline.ts     |   3 +-
+ lib/progress.ts     |   4 +-
+ lib/run-summary.ts  |  25 ++++++++++
+ lib/spec-tests.ts   | 131 ++++++++++++++++++++++++++++++++++++++++++++++++++++
+ 7 files changed, 254 insertions(+), 10 deletions(-)
+```
+
+### Full protected diffs
+
+`git diff 42e61473b5e244a388ee0224ad8d20eafc4af3b6 -- 'docs/specs/*.tests/**' 'tests/*.test.ts' scripts/run-plan.mjs`:
+
+```diff
+```
+
+Empty (zero bytes). `git diff 26f2307 -- docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/*.test.ts` is also empty. No protected or plan acceptance test edit, skip or weakening.
+
+## 5. Deviations and unanticipated seams
+
+1. Grounding's no-old-failures expectation is false in this environment. Preserved the exact existing failures; no scope growth to repair documentation fixtures/dependencies.
+2. Downloaded-source dry preview retains SPEC-0019's install-only early exit. The new `specTests` field is on the normal resolved-spec dry run, as planned. No install/landing/tool change.
+3. Git cleanup uses uncollapsed status (`--no-renames --untracked-files=all`) so cross-boundary renames expose both sides; HEAD-tracked paths use staged/worktree restore, index-only paths are unstaged then cleaned, all pathspecs literal. `.agent` noise remains on disk but is unstaged to prevent leakage into the unchanged later plan commit. Generated commit uses `--only` plus the tests path.
+4. Parser hardening: lowercase filename v-number rule; full Git C-quote UTF-8 decoding/quoted-arrow handling; `mkdtemp` parse scratch and temporary Python cache prefix cleaned in `finally`. These fix interface/resource details from inherited Luna code, not acceptance-test changes or new dependencies.
+5. Newly reachable Python/no-project gate needs empty-project normalization inside runner `tests()`; otherwise spawn receives a null argument and exits before recording the required gate error. Existing public library `testCommands`/environment APIs unchanged.
+6. The spec assumes existing protection covers planning, but `run-plan.mjs` snapshots after the plan commit. Added generated-test baseline restoration around planning/resume/repair and before plan commit in allowed `bin/pi-implement`. Plan prompt, check count, gate decisions and run-plan protection unchanged; C5 demonstrates staged planner tampering is discarded. This enforces the required freeze invariant without broadening scope.
+7. Concurrent cross-suite node_modules symlink fixtures affect the combined V13 failure count. Baseline-relative comparison therefore uses the same independent suite commands as step 0, not the misleading combined count. No fixtures edited.
+8. Typecheck is genuinely inapplicable without tsconfig. Real model-driven acceptance and full generated handoff/run-record execution remain unrun; static review/hermetic evidence is labelled, not promoted to real acceptance. The outer pipeline owns final grading/status/run-record handoff; this noninteractive integration does not prematurely change the spec/index status.
+
+No plan acceptance tests were changed; no design/scope-changing stop condition fired; no failed group exceeded the three-round limit. Complete current changed functions/constants and runner calling context follow.
+
+## Appendix A — complete new decisions/parser module
+
+```typescript
+import fs from "node:fs";
+import os from "node:os";
+import path from "node:path";
+import { spawnSync } from "node:child_process";
+import { stripTypeScriptTypes } from "node:module";
+
+const NODE_TEST = /\.test\.(?:ts|mts|js|mjs)$/;
+const PY_TEST = /(?:^|\/)(?:test_[^/]*|[^/]*_test)\.py$/;
+
+export function isTestFile(file: string): boolean {
+  return NODE_TEST.test(file) || PY_TEST.test(file);
+}
+
+export function checksNamed(file: string): number[] {
+  const base = path.posix.basename(file.replaceAll("\\", "/"));
+  return [...base.matchAll(/(?:^|[^a-zA-Z0-9])v(\d+)(?!\d)/g)].map((m) => Number(m[1]));
+}
+
+export function manualEntries(text: string | null): { check: string; reason: string }[] {
+  if (text === null) return [];
+  const entries: { check: string; reason: string }[] = [];
+  for (const line of text.split(/\r?\n/)) {
+    const match = line.trim().match(/^(?:[-*]\s*)?V(\d+)\s*:\s*(.*)$/i);
+    const reason = match?.[2].trim();
+    if (match && reason) entries.push({ check: `V${Number(match[1])}`, reason });
+  }
+  return entries;
+}
+
+export function specTestsGate(input: { checks: number; files: string[]; manual: string | null; syntaxErrors: string[]; before: { file: string; passed: boolean }[] }): string[] {
+  const tests = input.files.filter(isTestFile);
+  const covered = new Set<number>(manualEntries(input.manual).map((entry) => Number(entry.check.slice(1))));
+  for (const file of tests) {
+    for (const n of checksNamed(file)) {
+      if (n < 1 || n > input.checks) continue;
+      covered.add(n);
+    }
+  }
+  const errors: string[] = [];
+  for (let n = 1; n <= input.checks; n++) if (!covered.has(n)) errors.push(`V${n}: no test file and no MANUAL.md entry`);
+  for (const file of tests) for (const n of checksNamed(file)) {
+    if (n < 1 || n > input.checks) errors.push(`${file}: names V${n}, but the spec has V1–V${input.checks}`);
+  }
+  if (tests.length === 0) errors.push("no automated checks: add at least one test file");
+  errors.push(...input.syntaxErrors);
+  if (input.before.length > 0 && input.before.every((entry) => entry.passed)) errors.push("all automated checks pass before implementation");
+  return errors;
+}
+
+function decodePorcelainPath(value: string): string {
+  if (!value.startsWith('"') || !value.endsWith('"')) return value;
+  // Git C-quotes UTF-8 bytes as octal escapes, which JSON.parse cannot decode.
+  const chunks: Buffer[] = [];
+  const escapes: Record<string, string> = { a: "\u0007", b: "\b", t: "\t", n: "\n", v: "\v", f: "\f", r: "\r" };
+  for (const part of value.slice(1, -1).matchAll(/\\([0-7]{1,3}|.)|([^\\]+)/g)) {
+    chunks.push(part[2] !== undefined ? Buffer.from(part[2]) : /^[0-7]+$/.test(part[1])
+      ? Buffer.from([parseInt(part[1], 8)]) : Buffer.from(escapes[part[1]] ?? part[1]));
+  }
+  return Buffer.concat(chunks).toString("utf8");
+}
+
+export function pathsOutside(dirty: string[], dir: string): string[] {
+  const root = dir.replace(/\/$/, "");
+  const outside: string[] = [];
+  for (const line of dirty) {
+    if (line.length < 4) continue;
+    const raw = line.slice(3);
+    let destination = 0;
+    if (/[RC]/.test(line.slice(0, 2))) {
+      let quoted = false;
+      for (let i = 0; i < raw.length; i++) {
+        if (quoted && raw[i] === "\\") { i++; continue; }
+        if (raw[i] === '"') quoted = !quoted;
+        else if (!quoted && raw.startsWith(" -> ", i)) destination = i + 4;
+      }
+    }
+    const file = decodePorcelainPath(raw.slice(destination));
+    if (file.startsWith(".agent/")) continue;
+    if (file === root || file.startsWith(`${root}/`)) continue;
+    outside.push(file);
+  }
+  return outside;
+}
+
+export function specTestsPrompt(input: { spec: string; testsDir: string; checks: number; pythonProject: string | null; errors?: string[] }): string {
+  const checks = Array.from({ length: input.checks }, (_, i) => `V${i + 1}`).join(", ");
+  const runners = `Run Node tests with: node --experimental-strip-types --test${input.pythonProject ? `\nRun Python tests with: uv run --project ${input.pythonProject} pytest` : ""}`;
+  return `Write tests for the specification at ${input.spec}. Put all files in ${input.testsDir}.\n\nChecks to cover individually: ${checks || "(none)"}. Name automated test files with the check number, using v<digits> (for example v01-check.test.ts); V1 and V10 are distinct. For any check that cannot be automated, add a MANUAL.md line such as V2: needs a model-driven run, with a non-empty reason.\n\n${runners}\n\nTests for newly required behaviour must fail before implementation; tests for preserved behaviour may pass. At least one test must fail. Use temporary directories for filesystem tests. Use no models and no network. Read the spec and repository only; do not read a plan. Do not edit outside ${input.testsDir}. Do not implement anything.${input.errors?.length ? `\n\nThe previous attempt was rejected for these reasons:\n${input.errors.map((e) => `- ${e}`).join("\n")}` : ""}`;
+}
+
+export function parseErrors(root: string, files: string[]): string[] {
+  const errors: string[] = [];
+  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "spec-tests-parse-"));
+  try {
+    for (const file of files) {
+      if (!isTestFile(file)) continue;
+      const full = path.resolve(root, file);
+      const ext = path.extname(file).toLowerCase();
+      let command: string;
+      let args: string[];
+      if (ext === ".ts" || ext === ".mts") {
+        try {
+          const stripped = stripTypeScriptTypes(fs.readFileSync(full, "utf8"));
+          const strippedFile = path.join(scratch, "stripped.mjs");
+          fs.writeFileSync(strippedFile, stripped);
+          command = process.execPath;
+          args = ["--check", strippedFile];
+        } catch (error) {
+          const line = String(error).split(/\r?\n/, 1)[0];
+          errors.push(`${file}: syntax error: ${line}`);
+          continue;
+        }
+      } else if (ext === ".js" || ext === ".mjs") {
+        command = process.execPath;
+        args = ["--check", full];
+      } else {
+        command = "python3";
+        args = ["-m", "py_compile", full];
+      }
+      const result = spawnSync(command, args, { encoding: "utf8",
+        env: { ...process.env, PYTHONPYCACHEPREFIX: path.join(scratch, "pycache") } });
+      if (result.error || result.status !== 0) {
+        const output = result.stderr || result.stdout || String(result.error ?? "syntax check failed");
+        errors.push(`${file}: syntax error: ${output.split(/\r?\n/, 1)[0]}`);
+      }
+    }
+  } finally {
+    fs.rmSync(scratch, { recursive: true, force: true });
+  }
+  return errors;
+}
+
+```
+
+## Appendix B — complete changed preflight interface and function
+
+```typescript
+export interface PreflightInput {
+  specPaths?: { spec: string; tests: string };
+  specText: string;
+  hasTestsDir: boolean;
+  writeTests?: boolean;
+  held: boolean;
+  dirty: string[]; // uncommitted paths in the repository
+  testFiles?: string[];
+  pythonProject?: string | null;
+}
+
+export interface Preflight {
+  checks: number | null;
+  blocking: string[];
+  warnings: string[];
+}
+
+export function preflight(input: PreflightInput): Preflight {
+  const blocking: string[] = [];
+  const warnings: string[] = [];
+  let checks: number | null = null;
+  try {
+    checks = countVerifyChecks(input.specText);
+  } catch (err) {
+    blocking.push(`spec: ${(err as Error).message}`);
+  }
+  if (!input.hasTestsDir && !input.writeTests) blocking.push("spec has no .tests/ directory: the pipeline grades against the spec's tests");
+  if (input.held) blocking.push("quota hold in place: run bin/pi-continue first");
+  if (input.pythonProject === null && (input.testFiles ?? []).some((file) => PY_TEST.test(file))) {
+    blocking.push("Python tests but no Python project; add .pi/pipeline.json with pythonProject");
+  }
+  if (input.dirty.length) {
+    warnings.push(`${input.dirty.length} uncommitted path(s) are not part of the run, which starts from HEAD: ${input.dirty.slice(0, 5).join(", ")}`);
+  }
+  if (input.specPaths) {
+    const matches = uncommittedSpecPaths(input.dirty, input.specPaths);
+    if (matches.length) {
+      blocking.push(`uncommitted changes to ${input.specPaths.spec} relative to HEAD: ${matches.join(", ")}`);
+    }
+  }
+  return { checks, blocking, warnings };
+}
+
+```
+
+## Appendix C — complete changed progress declarations
+
+```typescript
+export type ProgressStage = "preflight" | "plan" | "gate" | "tasks" | "integration" | "grade" | "handoff" | "install" | "land" | "spec-tests";
+const STAGES: readonly string[] = ["preflight", "plan", "gate", "tasks", "integration", "grade", "handoff", "install", "land", "spec-tests"];
+```
+
+Only these declarations changed in progress; the existing parser/reducer/renderers are unchanged.
+
+## Appendix D — complete changed summary formatter
+
+```typescript
+import { existsSync, readFileSync, readdirSync } from "node:fs";
+import { basename, join, relative, resolve } from "node:path";
+import { DatabaseSync } from "node:sqlite";
+
+export function buildSummary(input: {
+  runDir: string;
+  outcome: { ok: boolean; stage: string; reason: string; next?: string; landed?: string; branch?: string };
+}): string {
+  const { runDir, outcome } = input;
+  const lines: string[] = [];
+  const readJson = (name: string): any => {
+    try { return JSON.parse(readFileSync(join(runDir, name), "utf8")); } catch { return undefined; }
+  };
+  const metadata = readJson("pipeline.json");
+  const spec = typeof metadata?.spec === "string" ? metadata.spec : "missing";
+  const id = spec.match(/SPEC-[0-9A-Za-z]+/)?.[0] ?? "missing";
+
+  lines.push(`# Run summary: ${id}`, "", "## Status", `**${!outcome.ok ? "Failed" : outcome.landed ? `Landed on ${outcome.landed}` : "Handed off"}**`, `Stage: ${outcome.stage || "missing"}`, `Reason: ${outcome.reason || "missing"}`);
+  const keptBranch = !outcome.landed ? (outcome.branch || metadata?.branch) : undefined;
+  if (keptBranch) lines.push(`Branch: ${keptBranch}`);
+  if (outcome.next) lines.push(`Next: ${outcome.next}`);
+
+  lines.push("", "## Run", `Spec: ${spec}`, `Base: ${typeof metadata?.base === "string" ? metadata.base.slice(0, 7) : "missing"}`, `Base branch: ${metadata?.baseBranch ?? "missing"}`, `Started at: ${metadata?.startedAt ?? "missing"}`, `Run directory: ${runDir}`);
+
+  lines.push("", "## Spec tests");
+  const specTests = readJson("spec-tests.json");
+  if (specTests && typeof specTests === "object") {
+    lines.push(`Written by ${specTests.writer ?? "missing"} in ${specTests.rounds ?? "missing"} round(s)`);
+    if (Array.isArray(specTests.files)) {
+      for (const file of specTests.files) {
+        if (!file || typeof file !== "object") continue;
+        const status = file.before === "fail" ? "fail-to-pass" : "pass-to-pass";
+        lines.push(`- ${file.file ?? "missing"}: ${status}`);
+      }
+    }
+    if (Array.isArray(specTests.manual)) {
+      for (const manual of specTests.manual) {
+        if (!manual || typeof manual !== "object") continue;
+        lines.push(`- ${manual.check ?? "missing"}: ${manual.reason ?? "missing"}`);
+      }
+    }
+  } else if (metadata?.specTests === "supplied") {
+    lines.push("supplied with the spec");
+  } else if (metadata?.specTests === "generated") {
+    lines.push("to be written; not finished");
+  } else {
+    lines.push("not recorded");
+  }
+
+  lines.push("", "## Plan gate");
+  let gateFound = false;
+  try {
+    const gates = readdirSync(runDir).map((name) => ({ name, match: /^gate-(\d+)\.log$/.exec(name) }))
+      .filter((item) => item.match).sort((a, b) => Number(a.match![1]) - Number(b.match![1]));
+    for (const gate of gates) {
+      gateFound = true;
+      let content = "missing";
+      try { content = readFileSync(join(runDir, gate.name), "utf8").trim() || "(empty)"; } catch { /* report missing */ }
+      lines.push(`- Gate round ${Number(gate.match![1]) + 1}: ${content}`);
+    }
+  } catch { /* missing directory */ }
+  const gate = readJson("gate.json");
+  if (gate?.result === "pass") { lines.push("- Passed"); gateFound = true; }
+  if (!gateFound) lines.push("- not reached (missing gate files)");
+
+  lines.push("", "## Tasks");
+  let resultRows = 0;
+  try {
+    const content = readFileSync(join(runDir, "results.jsonl"), "utf8");
+    for (const row of content.split(/\r?\n/)) {
+      if (!row.trim()) continue;
+      try {
+        const task = JSON.parse(row);
+        lines.push(`- ${task.id ?? "missing"}: ${task.acceptance ?? "missing"}; ${task.model ?? "missing"}; rounds ${task.rounds ?? "missing"}; cost $${Number(task.providerCost ?? 0).toFixed(2)}`);
+        resultRows++;
+      } catch { lines.push(`- missing (invalid results row)`); resultRows++; }
+    }
+  } catch { /* missing results file */ }
+  if (!resultRows) lines.push("- none recorded");
+
+  lines.push("", "## Final grade");
+  const grade = readJson("grade.json");
+  if (!grade) lines.push("- Grade not reached");
+  for (const [key, label] of [["specTests", "spec tests"], ["planTests", "plan tests"], ["typecheck", "typecheck"]] as const) {
+    if (grade) {
+      const code = grade[key]?.code;
+      lines.push(`- ${label}: ${code === 0 ? "pass" : typeof code === "number" ? "fail" : "not run"}`);
+    }
+  }
+
+  lines.push("", "## Sessions", "| Session | Calls | Prompt tokens | Completion tokens | Cost |", "|---|---:|---:|---:|---:|");
+  const databases: string[] = [];
+  const walk = (dir: string): void => {
+    let entries;
+    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
+    for (const entry of entries) {
+      if (entry.isDirectory()) {
+        if (entry.name !== "branch" && entry.name !== "work") walk(join(dir, entry.name));
+      } else if (entry.isFile() && entry.name.endsWith("telemetry.db")) databases.push(join(dir, entry.name));
+    }
+  };
+  walk(runDir);
+  databases.sort((a, b) => relative(runDir, a).localeCompare(relative(runDir, b)));
+  let calls = 0, prompt = 0, completion = 0, cost = 0;
+  for (const file of databases) {
+    let db: DatabaseSync | undefined;
+    try {
+      db = new DatabaseSync(file, { readOnly: true });
+      const row: any = db.prepare("SELECT COUNT(*) AS calls, COALESCE(SUM(prompt_tokens),0) AS prompt, COALESCE(SUM(completion_tokens),0) AS completion, COALESCE(SUM(cost_usd),0) AS cost FROM inference_calls").get();
+      const n = Number(row.calls), p = Number(row.prompt), c = Number(row.completion), dollars = Number(row.cost);
+      calls += n; prompt += p; completion += c; cost += dollars;
+      const fileName = basename(file);
+      const name = fileName.endsWith("-telemetry.db") ? fileName.slice(0, -"-telemetry.db".length) : fileName;
+      lines.push(`| ${name} | ${n} | ${p} | ${c} | $${dollars.toFixed(2)} |`);
+    } catch {
+      // An unreadable or incompatible database is surfaced as missing evidence.
+      lines.push(`| ${basename(file).replace(/-telemetry\.db$/, "")} | missing | missing | missing | missing |`);
+    } finally { db?.close(); }
+  }
+  lines.push(`| Total | ${calls} | ${prompt} | ${completion} | $${cost.toFixed(2)} |`);
+
+  if (existsSync(join(runDir, "report.md"))) lines.push("", "## Integration report", resolve(runDir, "report.md"));
+  return `${lines.join("\n")}\n`;
+}
+
+```
+
+## Appendix E — complete runner, including changed function callers and top-level lifecycle
+
+```javascript
+#!/usr/bin/env -S node --experimental-strip-types
+// Install/commit downloaded specs, summarize every run exit, and safely fast-forward
+// an unchanged starting branch after a passing grade; otherwise keep a review branch.
+import fs from "node:fs";
+import os from "node:os";
+import path from "node:path";
+import { execFileSync, spawn } from "node:child_process";
+import { fileURLToPath } from "node:url";
+import { DatabaseSync } from "node:sqlite";
+import { countVerifyChecks, pipelineThinking, undeclaredImports, validatePlan } from "../lib/plan.ts";
+import { childEnv, childPiArgs, costByRole, gateRepairable, landReviewBranch, pipelineRunRoot, planPrompt, preflight, pythonProjectFor, runDirBase, targetRepo, testCommands, testEnv, uncommittedSpecPaths } from "../lib/pipeline.ts";
+import { buildSummary } from "../lib/run-summary.ts";
+import { isTestFile, manualEntries, parseErrors, pathsOutside, specTestsGate, specTestsPrompt } from "../lib/spec-tests.ts";
+import { installSpec } from "../lib/install-spec.ts";
+import { childEventToProgress, finalText, parseProgressLine } from "../lib/progress.ts";
+import { markImplemented, resolveSpec, specPaths } from "../lib/specs.ts";
+import { defaultHoldPath, readHold } from "../lib/quota.ts";
+import { readPiSettings } from "../lib/telemetry.ts";
+
+const harnessRoot = path.dirname(path.dirname(fs.realpathSync(fileURLToPath(import.meta.url))));
+const argv = process.argv.slice(2);
+const valueFlags = ["--progress", "--repo"];
+const query = argv.find((arg, i) => !arg.startsWith("--") && (i === 0 || !valueFlags.includes(argv[i - 1])));
+const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
+const progress = argv.includes("--progress") && argv[argv.indexOf("--progress") + 1] === "json";
+let currentChild = null;
+let terminated = false;
+let done = false;
+let currentStage = "preflight";
+let currentRunDir;
+let keptBranch;
+let resumeTarget;
+let resumeQuery = query;
+let keptWorktrees = [];
+const emit = (event) => { if (progress) process.stdout.write(`${JSON.stringify(event)}\n`); };
+const finish = (ok, summary, extra = {}, next) => {
+  if (done) return;
+  done = true;
+  let summaryPath;
+  if (currentRunDir) {
+    try {
+      const file = path.resolve(currentRunDir, "summary.md");
+      fs.writeFileSync(file, buildSummary({ runDir: currentRunDir,
+        outcome: { ok, stage: currentStage, reason: summary, next,
+          ...(!extra.landed && keptBranch ? { branch: keptBranch } : {}), ...extra } }));
+      summaryPath = file;
+    } catch (error) { console.error(`summary write failed: ${error instanceof Error ? error.message : String(error)}`); }
+  }
+  emit({ type: "done", ok, summary, ...extra, ...(summaryPath ? { summaryPath } : {}) });
+};
+const exit = (text, code = 1) => {
+  console.error(text);
+  if (code === 75) emit({ type: "notice", text });
+  const next = code === 75 || code === 130
+    ? `${code === 75 ? "Run bin/pi-continue, then " : ""}resume with implement_spec(${JSON.stringify({ spec: resumeQuery, resume: true })}) or bin/pi-implement ${JSON.stringify(resumeQuery)} --repo ${JSON.stringify(resumeTarget)} --resume.`
+    : `Fix the reason, then start a new run. Worktree(s) retained: ${keptWorktrees.filter((file) => fs.existsSync(file)).join(", ") || "none"}.`;
+  finish(false, text, {}, next);
+  process.exit(code);
+};
+const interrupt = () => {
+  terminated = true;
+  currentChild?.kill("SIGTERM");
+  if (!currentChild) exit("Interrupted; run directory and worktree retained for --resume", 130);
+};
+process.on("SIGTERM", interrupt);
+process.on("SIGINT", interrupt);
+const interrupted = () => { if (terminated) exit("Interrupted; run directory and worktree retained for --resume", 130); };
+const stage = (name) => { currentStage = name; emit({ type: "stage", stage: name }); };
+process.on("uncaughtException", (err) => exit(String(err.stack || err)));
+process.on("unhandledRejection", (err) => exit(String(err)));
+const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
+const read = (file) => fs.readFileSync(file, "utf8");
+const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
+const filesIn = (dir, prefix = "") => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
+  const rel = path.join(prefix, entry.name);
+  return entry.isDirectory() ? filesIn(path.join(dir, entry.name), rel) : [rel];
+}) : [];
+async function tests(work, files, pythonProject) {
+  const cmds = testCommands(files, { pythonProject: pythonProject ?? "" });
+  if (!cmds.length) return { code: 1, output: "no recognized test files" };
+  const results = [];
+  for (const { cmd, args } of cmds) {
+    results.push(await streamed(cmd, args, work, { env: testEnv(process.env) }));
+    interrupted();
+  }
+  return { code: results.some((result) => result.code !== 0) ? 1 : 0, output: results.map((r) => r.output).join("\n") };
+}
+function usage(db) {
+  if (!fs.existsSync(db)) return { calls: 0, cost: 0 };
+  const store = new DatabaseSync(db, { readOnly: true });
+  try {
+    const row = store.prepare("SELECT COUNT(*) calls, COALESCE(SUM(cost_usd), 0) cost FROM inference_calls").get();
+    return { calls: row.calls, cost: row.cost };
+  } catch { return { calls: 0, cost: 0 }; }
+  finally { store.close(); }
+}
+// Write the raw JSON stream immediately: a failed or interrupted run remains inspectable.
+function streamed(cmd, args, cwd, { env = process.env, log, role, forward = false } = {}) {
+  return new Promise((resolve) => {
+    if (log) write(log, "");
+    let output = "";
+    let pending = "";
+    let stderr = "";
+    const child = spawn(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
+    currentChild = child;
+    const line = (text) => {
+      if (forward) {
+        const event = parseProgressLine(text);
+        // The entrypoint owns the final handoff and done event.
+        if (event && event.type !== "done" && event.stage !== "grade" && event.stage !== "handoff") {
+          if (event.type === "stage") stage(event.stage);
+          else emit(event);
+        }
+      } else if (role) {
+        try {
+          for (const event of childEventToProgress(role, undefined, JSON.parse(text))) emit(event);
+        } catch { /* Ignore partial or non-JSON child output. */ }
+      }
+    };
+    child.stdout.on("data", (chunk) => {
+      const text = chunk.toString();
+      if (log) fs.appendFileSync(log, text);
+      output += text;
+      pending += text;
+      const lines = pending.split("\n");
+      pending = lines.pop();
+      for (const item of lines) line(item.replace(/\r$/, ""));
+    });
+    child.stderr.on("data", (chunk) => {
+      const text = chunk.toString();
+      stderr += text;
+      if (progress) process.stderr.write(text);
+    });
+    child.on("error", (err) => { stderr += String(err); });
+    child.on("close", (code) => {
+      if (pending.trim()) line(pending);
+      if (currentChild === child) currentChild = null;
+      resolve({ code: code ?? 1, output: role ? `${finalText(output)}${stderr ? `\n${stderr}` : ""}` : `${output}${stderr}` });
+    });
+    if (terminated) child.kill("SIGTERM");
+  });
+}
+async function pi(work, model, thinking, prompt, log, db) {
+  const result = await streamed("pi", childPiArgs({ model, thinking, prompt, sessionDir: path.join(path.dirname(log), `${path.basename(log, ".log")}-session`) }), work,
+    { env: childEnv(process.env, "planner", db), log, role: "planner" });
+  interrupted();
+  if (result.code === 75) exit(`Quota hold; resume with bin/pi-implement ${resumeQuery} --resume`, 75);
+  if (result.code === 130) exit("Interrupted; run directory and worktree retained for --resume", 130);
+  return result;
+}
+function runCosts(dir) {
+  const rows = [];
+  const visit = (folder) => {
+    if (!fs.existsSync(folder)) return;
+    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
+      if (item.isDirectory()) {
+        if (item.name !== "branch" && item.name !== "work") visit(path.join(folder, item.name));
+      } else if (item.isFile() && (item.name === "telemetry.db" || item.name.endsWith("-telemetry.db"))) {
+        let store;
+        try {
+          store = new DatabaseSync(path.join(folder, item.name), { readOnly: true });
+          for (const row of store.prepare("SELECT subagent_role AS role, cost_usd AS cost FROM inference_calls").all()) rows.push(row);
+        } catch { /* A child may not have initialized its telemetry yet. */ }
+        finally { store?.close(); }
+      }
+    }
+  };
+  visit(dir);
+  return costByRole(rows);
+}
+if (!query || [...flags].some((flag) => !["--dry-run", "--plan-only", "--resume", ...valueFlags].includes(flag)) ||
+    valueFlags.some((flag) => argv.includes(flag) && (!argv[argv.indexOf(flag) + 1] || argv[argv.indexOf(flag) + 1].startsWith("--"))) ||
+    (argv.includes("--progress") && !progress))
+  exit("usage: bin/pi-implement <spec> [--dry-run] [--plan-only] [--resume] [--progress json] [--repo <path>]", 2);
+const repoPath = argv.includes("--repo") ? argv[argv.indexOf("--repo") + 1] : process.cwd();
+const target = targetRepo(repoPath);
+if (!target) exit(`not inside a git repository: ${repoPath}`, 2);
+resumeTarget = target;
+const specsDir = path.join(target, "docs/specs");
+let resolutionQuery = query;
+const source = path.resolve(query.startsWith("~/") ? path.join(os.homedir(), query.slice(2)) : query);
+const inside = (parent, file) => { const rel = path.relative(parent, file); return rel === "" || (!path.isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${path.sep}`)); };
+if (/\.(md|zip)$/.test(query) && fs.existsSync(source) && fs.statSync(source).isFile() &&
+    !inside(fs.existsSync(specsDir) ? fs.realpathSync(specsDir) : specsDir, fs.realpathSync(source))) {
+  stage("install");
+  const now = new Date();
+  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
+  const installed = installSpec({ target, source, today, dryRun: flags.has("--dry-run") });
+  if (!installed.ok) exit(`install failed: ${installed.error}`, 2);
+  const text = `Installed SPEC-${installed.id}: ${installed.spec}; tests ${installed.tests ?? "none"}; ${installed.committed ? `committed ${installed.commit}` : "not committed (unchanged or dry run)"}`;
+  console.error(text);
+  emit({ type: "notice", text });
+  if (flags.has("--dry-run")) {
+    const report = JSON.stringify({ install: installed }, null, 2);
+    if (progress) { console.error(report); finish(true, "install dry run complete"); }
+    else console.log(report);
+    process.exit(0);
+  }
+  resolutionQuery = installed.id;
+}
+if (!fs.existsSync(specsDir)) exit(`no docs/specs directory in ${target}`, 2);
+const resolution = resolveSpec(fs.readdirSync(specsDir), resolutionQuery);
+if (!resolution.ok) exit(resolution.error, 2);
+const spec = resolution.spec;
+resumeQuery = spec.id;
+const paths = specPaths(spec);
+const specRel = path.join("docs/specs", paths.spec);
+const testRel = path.join("docs/specs", paths.tests);
+const planRel = path.join("docs/specs", paths.plan);
+// Do not trim: the first porcelain status column may be a space.
+const dirty = execFileSync("git", ["-C", target, "status", "--porcelain"], { encoding: "utf8" }).split("\n").filter(Boolean);
+const settings = readPiSettings();
+const pythonProject = pythonProjectFor({ target, harnessRoot, settings });
+const suppliedTests = fs.existsSync(path.join(target, testRel));
+const writeTests = settings.pipeline?.writeSpecTests !== false;
+const testFiles = filesIn(path.join(target, testRel), testRel);
+stage("preflight");
+const check = preflight({ specText: read(path.join(target, specRel)), hasTestsDir: suppliedTests, writeTests,
+  held: readHold(defaultHoldPath(process.env)) !== null, dirty, testFiles, pythonProject,
+  ...(!flags.has("--dry-run") ? { specPaths: { spec: specRel, tests: testRel } } : {}) });
+if (flags.has("--dry-run")) {
+  const paths = uncommittedSpecPaths(dirty, { spec: specRel, tests: testRel });
+  if (paths.length) {
+    const text = `uncommitted spec/tests for ${specRel}; a real run starts from HEAD: ${paths.join(", ")}`;
+    console.error(`warning: ${text}`);
+    emit({ type: "notice", text });
+  }
+}
+for (const warning of check.warnings) { console.error(`warning: ${warning}`); emit({ type: "notice", text: warning }); }
+if (check.blocking.length) exit(check.blocking.join("\n"), check.blocking.some((s) => s.includes("quota hold")) ? 75 : 2);
+const planner = settings.routing?.tiers?.escalate || "openai-codex/gpt-6-sol";
+const editor = settings.routing?.tiers?.scout || "openai-codex/gpt-6-luna";
+const testWriter = settings.pipeline?.testWriter || planner;
+const levels = pipelineThinking(settings);
+const commands = testCommands(testFiles, { pythonProject: pythonProject ?? "" });
+const base = runDirBase({ runRoot: pipelineRunRoot(settings, os.homedir()), target, harnessRoot, id: spec.id, slug: spec.slug });
+if (flags.has("--dry-run")) {
+  const text = JSON.stringify({ spec: specRel, tests: testRel, plan: planRel, runRecord: paths.runRecord,
+    checks: check.checks, planner: `${planner} at ${levels.planner}`, editor: `${editor} at ${levels.editor}`, commands,
+    target, harnessRoot, runDir: base, pythonProject,
+    specTests: suppliedTests ? "supplied" : `to be written by ${testWriter} at ${levels.planner}` }, null, 2);
+  if (progress) { process.stderr.write(`${text}\n`); finish(true, "dry run complete"); }
+  else console.log(text);
+  process.exit(0);
+}
+const existing = fs.existsSync(base) ? fs.readdirSync(base).sort().reverse().find((s) => fs.existsSync(path.join(base, s, "pipeline.json"))) : undefined;
+if (flags.has("--resume") && !existing) exit(`no run to resume for SPEC-${spec.id}`, 2);
+const stamp = flags.has("--resume") ? existing : new Date().toISOString().replace(/[:.]/g, "-");
+const dir = path.join(base, stamp);
+const metaPath = path.join(dir, "pipeline.json");
+// Track an existing run before reading its metadata, including malformed resumes.
+if (flags.has("--resume")) currentRunDir = dir;
+const metadata = flags.has("--resume") ? JSON.parse(read(metaPath)) : {
+  branch: `pipeline/SPEC-${spec.id}-${spec.slug}-${stamp}`, spec: specRel, stamp,
+  specTests: suppliedTests ? "supplied" : "generated",
+  startedAt: new Date().toISOString(), base: git(target, "rev-parse", "HEAD"),
+  baseBranch: (() => { try { return git(target, "symbolic-ref", "--short", "-q", "HEAD") || null; } catch { return null; } })(),
+};
+const branch = metadata.branch;
+const work = path.join(dir, "branch");
+keptBranch = branch;
+keptWorktrees = [work, path.join(dir, "work")];
+if (!flags.has("--resume")) {
+  fs.mkdirSync(dir, { recursive: true });
+  currentRunDir = dir;
+  write(metaPath, JSON.stringify(metadata, null, 2));
+  git(target, "branch", branch, metadata.base);
+  git(target, "worktree", "add", work, branch);
+}
+// Use saved metadata, not the target's current tests/settings, when resuming.
+// Markerless legacy runs must not speculatively start a new writing stage.
+const specTestsPath = path.join(dir, "spec-tests.json");
+if (metadata.specTests === "generated" && !fs.existsSync(specTestsPath)) {
+  stage("spec-tests");
+  let previousErrors = [];
+  for (let round = 1; round <= 3; round++) {
+    const written = await pi(work, testWriter, levels.planner,
+      specTestsPrompt({ spec: specRel, testsDir: testRel, checks: check.checks, pythonProject, errors: previousErrors }),
+      path.join(dir, `spec-tests-${round}.log`), path.join(dir, `spec-tests-${round}-telemetry.db`));
+    // Avoid rename folding here: both an outside source deletion and an outside
+    // destination must be restored, even when the other side is inside tests.
+    const dirty = execFileSync("git", ["-C", work, "status", "--porcelain", "--no-renames", "--untracked-files=all"], { encoding: "utf8" }).split("\n").filter(Boolean);
+    const outside = pathsOutside(dirty, testRel);
+    for (const file of outside) {
+      if (git(work, "--literal-pathspecs", "ls-tree", "-r", "--name-only", "HEAD", "--", file)) {
+        git(work, "--literal-pathspecs", "restore", "--source=HEAD", "--staged", "--worktree", "--", file);
+      } else {
+        // A writer may have staged a new outside path. Remove it from the index
+        // before cleaning it; a path-scoped commit alone would leave it staged.
+        if (git(work, "--literal-pathspecs", "ls-files", "--", file)) git(work, "--literal-pathspecs", "rm", "--cached", "-f", "--", file);
+        git(work, "--literal-pathspecs", "clean", "-fd", "--", file);
+      }
+    }
+    // Keep local memory noise on disk, but never carry a writer-staged .agent
+    // path into the later (unchanged) plan commit.
+    if (git(work, "diff", "--cached", "--name-only", "--", ".agent")) git(work, "restore", "--source=HEAD", "--staged", "--", ".agent");
+    if (outside.length) {
+      const text = `Discarded test writer edits outside ${testRel}: ${outside.join(", ")}`;
+      console.error(text);
+      emit({ type: "notice", text });
+    }
+    if (written.code !== 0) exit(`spec tests writer failed: ${written.output}`, 1);
+    const files = filesIn(path.join(work, testRel), testRel);
+    const automated = files.filter(isTestFile);
+    const manualPath = path.join(work, testRel, "MANUAL.md");
+    const manual = fs.existsSync(manualPath) ? read(manualPath) : null;
+    const syntaxErrors = parseErrors(work, files);
+    if (pythonProject === null) {
+      for (const file of automated.filter((file) => file.endsWith(".py"))) syntaxErrors.push(`${file}: Python tests but no Python project; add .pi/pipeline.json with pythonProject`);
+    }
+    const before = [];
+    for (const file of automated) {
+      const result = await tests(work, [file], pythonProject);
+      before.push({ file, passed: result.code === 0 });
+    }
+    previousErrors = specTestsGate({ checks: check.checks, files, manual, syntaxErrors, before });
+    write(path.join(dir, `spec-tests-gate-${round}.log`), previousErrors.length ? previousErrors.join("\n") : "pass\n");
+    if (previousErrors.length) {
+      const text = `Spec tests gate round ${round}: ${previousErrors.join("\n")}`;
+      console.error(text);
+      emit({ type: "notice", text });
+      if (round === 3) exit(`spec tests rejected after three rounds:\n${previousErrors.join("\n")}`, 1);
+      continue;
+    }
+    // --only excludes unrelated index entries, including ignored .agent noise.
+    git(work, "add", "--", testRel);
+    git(work, "commit", "--only", "-m", `spec tests: SPEC-${spec.id} (written by ${testWriter})`, "--", testRel);
+    write(specTestsPath, JSON.stringify({ writer: testWriter, rounds: round,
+      files: before.map(({ file, passed }) => ({ file, before: passed ? "pass" : "fail" })),
+      manual: manualEntries(manual) }, null, 2));
+    break;
+  }
+}
+// run-plan protects tests after planning. Preserve the tests-only baseline
+// around planner calls too, including a planner that stages a test edit.
+const frozenSpecTests = metadata.specTests === "generated" ? git(work, "rev-parse", "HEAD") : null;
+function restoreFrozenSpecTests() {
+  if (!frozenSpecTests) return;
+  git(work, "restore", `--source=${frozenSpecTests}`, "--staged", "--worktree", "--", testRel);
+  git(work, "clean", "-fd", "--", testRel);
+}
+restoreFrozenSpecTests();
+const workPlan = path.join(work, planRel, "plan.json");
+stage("plan");
+if (!fs.existsSync(workPlan)) {
+  const created = await pi(work, planner, levels.planner, planPrompt({ spec: specRel, planDir: planRel, checks: check.checks, harnessRoot }),
+    path.join(dir, "planner.log"), path.join(dir, "planner-telemetry.db"));
+  restoreFrozenSpecTests();
+  if (created.code !== 0) exit(`planning failed: ${created.output}`);
+}
+stage("gate");
+let gate = "";
+for (let repair = 0; repair <= 2; repair++) {
+  const errors = [];
+  let plan;
+  try {
+    if (countVerifyChecks(read(path.join(work, specRel))) !== check.checks) errors.push("verification count changed");
+    plan = JSON.parse(read(workPlan));
+    if (plan.spec !== specRel) errors.push(`plan.spec must be ${specRel}`);
+    const checked = validatePlan(plan, check.checks);
+    errors.push(...checked.errors);
+    for (const testFile of filesIn(path.join(work, planRel), planRel).filter((file) => /\.test\.(ts|mts|js|mjs)$|(?:^|\/)test_[^/]*\.py$/.test(file))) {
+      const owner = plan.tasks.find((task) => task.acceptanceTest === testFile);
+      const declared = owner?.interfaces || plan.tasks.flatMap((task) => task.interfaces || []);
+      const missing = undeclaredImports(read(path.join(work, testFile)), declared);
+      if (missing.length) errors.push(`${testFile}: undeclaredImports ${missing.join(", ")}`);
+    }
+    for (const task of plan.tasks) {
+      if (task.assignee !== "luna") continue;
+      const file = path.join(work, task.acceptanceTest || "");
+      if (!task.acceptanceTest || !fs.existsSync(file)) { errors.push(`${task.id}: missing acceptance test`); continue; }
+      const undeclared = undeclaredImports(read(file), task.interfaces || []);
+      if (undeclared.length) errors.push(`${task.id}: undeclaredImports ${undeclared.join(", ")}`);
+      const result = await tests(work, [task.acceptanceTest], pythonProject);
+      if (result.code === 0) errors.push(`${task.id}: acceptance test already passes`);
+      if (/no recognized test files/.test(result.output)) errors.push(`${task.id}: ${result.output}`);
+    }
+  } catch (err) { errors.push(String(err)); }
+  if (!errors.length) { gate = "pass"; emit({ type: "notice", text: `Plan gate round ${repair + 1}: pass` }); break; }
+  gate = errors.join("\n");
+  emit({ type: "notice", text: `Plan gate round ${repair + 1}: ${gate}` });
+  write(path.join(dir, `gate-${repair}.log`), gate);
+  if (!gateRepairable(errors)) exit(`The run's spec differs from the one preflight read (verification count changed). Commit the spec and tests and start a new run.\n${gate}`);
+  if (repair === 2) exit(`plan gate failed after two repairs:\n${gate}`);
+  const fixed = await pi(work, planner, levels.planner, `Repair the plan and its acceptance tests only. Gate errors:\n${gate}\nDo not implement tasks.`,
+    path.join(dir, `repair-${repair + 1}.log`), path.join(dir, `repair-${repair + 1}-telemetry.db`));
+  restoreFrozenSpecTests();
+  if (fixed.code !== 0) exit(`plan repair failed: ${fixed.output}`);
+}
+restoreFrozenSpecTests();
+git(work, "add", "--", planRel);
+if (git(work, "diff", "--cached", "--name-only")) git(work, "commit", "-m", `plan: SPEC-${spec.id}`);
+write(path.join(dir, "gate.json"), JSON.stringify({ result: gate, checks: check.checks }, null, 2));
+if (flags.has("--plan-only")) {
+  const text = `${branch} ${workPlan}: plan gate passed`;
+  if (progress) process.stderr.write(`${text}\n`);
+  else console.log(text);
+  finish(true, text, { branch });
+  process.exit(0);
+}
+// The runner owns task and integration stages; its JSONL stream is forwarded as received.
+const runner = await streamed(process.execPath, ["--experimental-strip-types", path.join(harnessRoot, "scripts/run-plan.mjs"),
+  "--plan", workPlan, "--run-dir", dir, "--repo", work, "--python-project", pythonProject ?? "", "--progress", "json",
+  ...(flags.has("--resume") ? ["--resume"] : [])], work,
+  { log: path.join(dir, "runner.log"), forward: true });
+interrupted();
+if (runner.code === 75) exit(`quota hold: bin/pi-implement ${resumeQuery} --resume`, 75);
+if (runner.code === 130) exit("Interrupted; run directory and worktree retained for --resume", 130);
+if (runner.code !== 0) exit(`runner failed (${runner.code}): ${runner.output}`);
+stage("grade");
+const nested = path.join(dir, "work");
+const gradePath = path.join(dir, "grade.json");
+const grade = JSON.parse(read(gradePath));
+if (grade.specTests.code !== 0 || grade.planTests.code !== 0 || grade.typecheck.code > 0) {
+  exit(`final grade failed; worktree retained at ${nested}: ${JSON.stringify(grade)}`);
+}
+const resultRows = fs.existsSync(path.join(dir, "results.jsonl")) ? read(path.join(dir, "results.jsonl")).trim().split("\n").filter(Boolean).map(JSON.parse) : [];
+const protectedDiff = fs.existsSync(path.join(dir, "protected-edits.diff")) ? read(path.join(dir, "protected-edits.diff")) : "";
+stage("handoff");
+// The runner commits in its detached worktree. Fast-forward only our review branch.
+const finished = git(nested, "rev-parse", "HEAD");
+// Planning sessions can generate local walkthroughs on this worktree. They are
+// not part of the plan commit and must not block the fast-forward handoff.
+if (fs.existsSync(work) && fs.existsSync(path.join(work, ".agent"))) {
+  if (git(work, "ls-files", "--", ".agent")) git(work, "restore", "--worktree", "--", ".agent");
+  git(work, "clean", "-fd", "--", ".agent");
+}
+git(work, "merge", "--ff-only", finished);
+const report = path.join(dir, "report.md");
+if (!fs.existsSync(report)) exit(`integration did not write ${report}`);
+const branchReport = path.join(work, planRel, "report.md");
+write(branchReport, read(report));
+const runRecord = path.join(work, "docs/specs", paths.runRecord);
+const costs = runCosts(dir);
+const specTestsRecord = fs.existsSync(specTestsPath) ? JSON.parse(read(specTestsPath)) : null;
+const specTestsLine = specTestsRecord
+  ? `Spec tests: written by ${specTestsRecord.writer} before planning; see spec-tests.json in ${dir}`
+  : "Spec tests: supplied with the spec";
+const record = `# SPEC-${spec.id} run\n\nImplemented by: pi pipeline\n\nBranch: ${branch}\nPlan: ${planRel}; gate: ${gate}; checks: ${check.checks}\n${specTestsLine}\n\n` +
+  `## Tasks\n${resultRows.map((row) => `- ${row.id}: ${row.acceptance}; model ${row.model}; rounds ${row.rounds}; cost $${row.providerCost}`).join("\n")}\n\n` +
+  `## Final grade\n\n\`\`\`json\n${JSON.stringify(grade, null, 2)}\n\`\`\`\n\n` +
+  `## Runtime\nStuck findings, escalations and pauses: see task session logs and telemetry in ${dir}.\n` +
+  `Provider cost by role: planner $${costs.planner}; editor $${costs.editor}; integration $${costs.integration}; other $${costs.other}; total $${costs.total}. Planner: ${JSON.stringify(usage(path.join(dir, "planner-telemetry.db")))}. Quota deltas: see usage snapshots in telemetry.\n\n` +
+  `## Protected files diff\n\n\`\`\`diff\n${protectedDiff}\n\`\`\`\n\n## Report\n${read(report)}\n`;
+write(runRecord, record);
+const indexPath = path.join(work, "docs/specs/index.md");
+const specPath = path.join(work, specRel);
+const handoffFiles = [path.relative(work, runRecord), path.relative(work, branchReport)];
+try {
+  const implemented = markImplemented(read(indexPath), read(specPath), spec.id, "pi pipeline");
+  write(indexPath, implemented.index);
+  write(specPath, implemented.spec);
+  handoffFiles.push(specRel, "docs/specs/index.md");
+} catch (err) {
+  const notice = `index not updated: ${err instanceof Error ? err.message : String(err)}`;
+  console.error(notice);
+  emit({ type: "notice", text: notice });
+  fs.appendFileSync(runRecord, `\n## Index\n\n${notice}\n`);
+}
+git(work, "add", "--", ...handoffFiles);
+git(work, "commit", "-m", `pipeline: record SPEC-${spec.id} run`);
+git(target, "worktree", "remove", "--force", nested);
+git(target, "worktree", "remove", "--force", work);
+stage("land");
+const landing = typeof metadata.base === "string" && (typeof metadata.baseBranch === "string" || metadata.baseBranch === null)
+  ? landReviewBranch({ target, branch, base: metadata.base, baseBranch: metadata.baseBranch, enabled: settings.pipeline?.land !== false })
+  : { landed: false, reason: "Landing skipped: no recorded base/baseBranch metadata in this legacy run" };
+const summary = `${landing.landed ? `Landed on ${landing.onto}` : `Handed off on ${branch}`} ${paths.runRecord} — ${landing.reason}; spec pass, plan pass`;
+if (!progress) console.log(summary);
+finish(true, summary, { ...(landing.landed ? { landed: landing.onto } : { branch }), runRecord: path.join("docs/specs", paths.runRecord) });
+
+```

```

## Report
# SPEC-0020 implementation and integration report

## 1. Starting state, grounding and baseline (S00)

- Planning/step-0 revision: `42e61473b5e244a388ee0224ad8d20eafc4af3b6`, clean tracked/untracked status, as recorded in `planning-checks.json`.
- Integration start: `a6767ae272dc0de1979d6cd41fe6d240ab3a5f5c`, on the provided detached integration worktree. Luna's four committed tasks were already present. Pre-existing untracked files: `.agent/recaps/2026-10-15-session-{1,2,3,4}.md`; left unchanged and excluded from commits.
- Sol production commit: `94ca3aa30397e80b091bfc6b69e392b6752edb51` (`Implement SPEC-0020 generated tests before planning`). Report committed separately on the same starting worktree/HEAD lineage. No push, remote changes, tags, PRs, releases or rewritten commits.
- `/.agents/notes/index.md` and repository `.agents/notes/index.md` are absent. Opened only the indexed, sealed host note; did not modify it or the queue. The instructions prohibit editing sealed notes.
- Authoritative planning evidence: `docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/planning-checks.json`; task results: the supplied run's `results.jsonl` (all four Luna acceptance results pass; no out-of-scope/protected edits recorded).
- Fresh integration evidence, including repeated pre-edit baseline, is under this run's `integration-checks/` (called `E/` below). No real model was called by tests; `pi` children in runner checks are local scripted stubs. No GPU use, router-package change, live routing benchmark, stages 5/6, mutation testing or independent-vendor policy change.

### Step-0 expected versus actual

| Grounding fact | Expected | Actual and evidence |
|---|---|---|
| Missing-tests preflight | Refuses with `spec has no .tests/ directory: …` | Confirmed original condition at planning; integration inherited Luna's opt-in `writeTests` condition with exact legacy error retained (`lib/pipeline.ts`). |
| Protected old expectation | SPEC-0010 expects refusal without the option | Confirmed `pipeline.test.ts` preflight cases; all 42 tests pass before and after. |
| Run metadata | `branch,spec,stamp,startedAt,base,baseBranch` | Confirmed runner literal before editing. Added only `specTests` to fresh metadata; retained prior fields/resume loading. |
| Progress stage validation | Fixed STAGES list | Confirmed `lib/progress.ts`; Luna adds `spec-tests` to union/list only. |
| Child session interface | `pi(work,model,thinking,prompt,log,db)`, planner role | Confirmed runner implementation and `childPiArgs`/`childEnv`; reused without changing global quota/interruption handling. Extra checks verify role, writer override, planner thinking and fresh round paths. |
| Per-file test runner | `tests(work,files,pythonProject)` returns code/output | Confirmed; each generated test passed separately to it. Null Python project normalized to the existing empty-project CLI representation to avoid an invalid spawn argument. |
| Final grading/protection | `run-plan.mjs` grades and protects `.tests/` | Confirmed `protectedPaths`, `restoreProtected`, integration restore and final spec-test grade. File unchanged. Additional seam: its snapshot starts after planning, so bin-level generated-test restoration now also covers planner calls (see deviations). |
| Summary headings | Status, Run, Plan gate, Tasks, Final grade, Sessions | Confirmed original source; Luna inserts only Spec tests before Plan gate. |
| TS stripping | `module.stripTypeScriptTypes` available | `node -e 'console.log(process.version, typeof require("node:module").stripTypeScriptTypes)'` -> `v24.18.0 function`. |
| Old tests | No existing failures on Lucas's machine | Not reproduced here: two unit failures, detailed below. All older spec suites and spec Python checks pass. This environment discrepancy does not change design/scope/outcomes. |

`lib/plan.ts` is byte-identical to `/home/george-contis/src/pi-build/lib/plan.ts` (`cmp` exit 0). No design-changing contradiction was found; continued within the allowed production files.

### Failing-test baseline, before implementation

Planning ran every spec suite and the unit suite before any implementation. Integration repeated these before Sol edits. For each older Node suite the command was `node --experimental-strip-types --test docs/specs/<suite>.tests/*.ts`; unit command was `node --experimental-strip-types --test tests/*.test.ts`.

| Suite | Planning baseline | Integration pre-edit repeat |
|---|---|---|
| Unit | 131 total, 128 pass, 2 fail, 1 skip; exit 1 | Same exact counts and identities, `E/unit-before.log` |
| SPEC-0005 | 7/7, exit 0 | 7/7, `E/before-SPEC-0005-configure-production-harness.tests.log` |
| SPEC-0006 | 39/39, exit 0 | 39/39 |
| SPEC-0009 | 13/13, exit 0 | 13/13 |
| SPEC-0010 | 42/42, exit 0 | 42/42 |
| SPEC-0011 | 23/23, exit 0 | 23/23 |
| SPEC-0014 Node | 11/11, exit 0 | 11/11 |
| SPEC-0015 | 22/22, exit 0 | 22/22 |
| SPEC-0018 | 26/26, exit 0 | 26/26 |
| SPEC-0019 | 29/29, exit 0 | 29/29 |
| SPEC-0014 Python | 9/9, exit 0 | 9/9, `E/python-before.log` |
| SPEC-0020 protected | 8 failing entries: missing helper module; preflight/summary and five runner failures | After Luna, combined requested command: 26 total, 21 pass, 5 fail (runner integration missing), `E/initial-acceptance.log` |

Other pre-edit logs follow `E/before-<full-suite>.tests.log`. Python command: `uv run --project tools/map pytest -q docs/specs/SPEC-0014-complete-the-codebase-map.tests/test_map_views.py` (9 passed in 0.28s). This created only ignored `tools/map/.venv`; no tracked dependency/config changes.

The two unrelated existing failures are:
1. `tests/markdown.test.ts:184` — `session recap predicate, explain gate, known.md, tier map`, assertion at line 191 (`false !== true`).
2. `tests/quota-gate-refresh.test.ts` — module-load failure: missing `@earendil-works/pi-tui` imported by `extensions/quota-gate.ts`.

Neither was edited, skipped, weakened or dependency-fixed. Unit skip remains the pre-existing `recorded sets score to the §3.6.1 verdicts` (local measurement databases absent).

All four Luna acceptance *files* failed before implementation, recorded in `planning-checks.json`: decisions missing-module failure; preflight two behavioural failures; progress one behavioural failure (one preservation case passed); summary three behavioural failures. Planning introduced no implementation. Current `validatePlan(plan,13)` -> `{ok:true,errors:[]}` and all four owner-specific `undeclaredImports` -> `[]`.

## 2. Commands, V checks, outputs and repairs (S08)

All commands below ran from this worktree unless the path explicitly names an external evidence script. `E/` is `/home/george-contis/var/pipeline-runs/SPEC-0020-write-spec-tests-when-a-spec-has-none/2026-10-15T18-50-50-747Z/integration-checks/`.

### C1 — exact requested combined acceptance command

```bash
node "--experimental-strip-types" "--test" "docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/decisions.test.ts" "docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/preflight.test.ts" "docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/progress.test.ts" "docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/summary.test.ts" "docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.tests/gate.test.ts" "docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.tests/preflight-summary.test.ts" "docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.tests/runner.test.ts"
```

Initial: exit 1, 21 pass / 5 fail. First implementation verification: exit 0, 26 pass / 0 fail (`E/acceptance-round-1.log`). Final verification after preventive freeze hardening: exit 0, 26 pass / 0 fail / 0 skip (`E/final-acceptance.log`). One implementation/repair round fixed the five missing-runner failures. No acceptance failure occurred after that round; preventive hardening was independently reverified, not a repeated unexplained repair.

### C2 — protected spec command

```bash
node --experimental-strip-types --test docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.tests/*.ts
```

Exit 0, 13 pass / 0 fail / 0 skip (`E/spec-only.log`).

| V | Exact named checks (C1 and C2) | Result / repairs |
|---|---|---|
| V1 | gate: `every V-check needs a test file named for it or a MANUAL.md entry with a reason`; `V1 is not covered by a file named for V10, and a file naming a check the spec lacks is an error` | PASS; inherited Luna implementation, 0 Sol failure repairs |
| V2 | gate: `checks that are all manual, tests that all pass before implementation, and syntax errors are rejected` | PASS; 0 |
| V3 | gate: `edits outside the tests directory are found, generated walkthroughs are not` | PASS; 0; additional quoting/staging evidence in C5 |
| V4 | gate: `the writer's prompt names the spec, the directory, every check, the runners available, and forbids implementing` | PASS; 0 |
| V5 | gate: `a syntax error is caught without running the file, and an import of a module that does not exist yet is not one` | PASS; 0; plan decisions also parses JS/MJS/MTS/Python |
| V6 | preflight-summary: `a spec without tests no longer blocks when the pipeline will write them; it still blocks otherwise` | PASS; 0; C5 also checks runner `writeSpecTests:false` |
| V7 | preflight-summary: `the summary says who wrote the spec tests, which failed before implementation and which checks are manual` | PASS; 0 |
| V8 | runner: `a downloaded spec without tests is installed, the test writer runs first, and its tests are frozen in their own commit` | PASS; 1 runner implementation round |
| V9 | runner: `tests that pass before implementation, or do not parse, go back to the writer with the gate's errors` | PASS; 1; simulated run itself uses three writer rounds, distinct from local repair count |
| V10 | runner: `after three rejected rounds the run stops before planning, with a summary` | PASS; 1 |
| V11 | runner: `a spec that ships its own tests skips the writer` | PASS; 1 |
| V12 | runner: `a dry run of a spec without tests says who will write them instead of refusing` | PASS; 1 |
| V13 | C4 below: SPEC-0019,0018,0015,0010 and unit suite | PASS baseline-relative: exact failing identities unchanged. Raw unit command still FAILS with two baseline failures; 0 repairs to unrelated failures. |

### C3 — each Luna plan acceptance file, independently

```bash
node --experimental-strip-types --test docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/decisions.test.ts
node --experimental-strip-types --test docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/preflight.test.ts
node --experimental-strip-types --test docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/progress.test.ts
node --experimental-strip-types --test docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/summary.test.ts
```

All exit 0: 6, 2, 2 and 3 passing cases respectively; zero failures/skips (`E/plan-{decisions,preflight,progress,summary}.log`). No plan acceptance file was edited in integration. No correction of an erroneous plan acceptance test was necessary.

### C4 — V13 regression comparison (same suite boundaries as baseline)

```bash
node --experimental-strip-types --test docs/specs/SPEC-0019-*.tests/*.ts
node --experimental-strip-types --test docs/specs/SPEC-0018-*.tests/*.ts
node --experimental-strip-types --test docs/specs/SPEC-0015-*.tests/*.ts
node --experimental-strip-types --test docs/specs/SPEC-0010-*.tests/*.ts
node --experimental-strip-types --test tests/*.test.ts
```

First four: exit 0, respectively 29/29, 26/26, 22/22, 42/42 (`E/v13-{0019,0018,0015,0010}.log`). Unit: exit 1, 131 total / 128 pass / 2 fail / 1 skip (`E/unit-after.log`), same exact two identities and assertion/load diagnoses as step 0. No new regression.

An additional combined invocation of all five groups was also run (`E/v13.log`): exit 1, 250 total / 248 pass / 1 fail / 1 skip. It is **not** the baseline comparison: SPEC-0018 `tool.test.ts` and SPEC-0019 `progress-tool.test.ts` temporarily symlink the installed pi package's `node_modules` into the checkout. Running these concurrently with unit tests can make the missing-pi-tui load failure disappear. Independent-suite reruns reproduce both baseline failures exactly. This is a fixture/environment interaction, not a dependency repair or an all-green claim.

### C5 — additional hermetic evidence

```bash
node --experimental-strip-types /home/george-contis/var/pipeline-runs/SPEC-0020-write-spec-tests-when-a-spec-has-none/2026-10-15T18-50-50-747Z/integration-checks/extra-checks.mjs
```

Exit 0; all nine logged assertions/groups pass (`E/extra-checks.log`). Local scripted `pi` and `uv` only, temporary git repositories, no model or network:

- custom `pipeline.testWriter`, separate planner model, planner thinking, planner role, fresh writer session/log/DB path;
- mixed per-file fail/pass evidence, tracked/staged-new/rename/Unicode-arrow outside cleanup, ignored-but-unstaged `.agent` noise, tests-only commit;
- completed generated-stage resume skips the writer and retains the accepted writer provenance despite a changed setting;
- markerless legacy resume never speculatively generates tests;
- planner staging edits/additions to generated tests cannot change the frozen baseline, even on ordinary planner failure;
- ordinary nonzero writer exit stops before planning, cleans outside edits, creates summary but no completion sentinel;
- Python output with no project is rejected by the fixed per-file gate error (uv stub exits nonzero; the second writer deliberately fails, so this is evidence of the first gate branch, not three Python repairs);
- opt-out refuses without calls; custom-writer dry run is mutation-free;
- Python syntax compilation leaves no bytecode in the tests directory; C-quoted octal UTF-8 and arrow-containing rename destinations decode correctly.

These are implementation checks, **not** real model-driven external-project acceptance.

### C6 — typecheck, syntax, plan/protection checks

- Typecheck: **NOT RUN / not applicable** — no `tsconfig.json` in the worktree. Followed the existing `scripts/run-plan.mjs` rule (typecheck code null, `no tsconfig.json`); did not invoke `npx` to install a compiler or invent a configuration. `E/typecheck.log` records this. This is not a claimed typecheck pass.
- `node --experimental-strip-types --check bin/pi-implement`: exit 0, no diagnostics (`E/runner-syntax.log`). Syntax parsing is not typechecking.
- `validatePlan(plan,13)` -> `{ok:true,errors:[]}`; owner-specific `undeclaredImports` for all four Luna tasks -> `[]`.
- `git diff --check`: exit 0, no whitespace errors.
- Protected spec/unit tests, plan acceptance tests, `scripts/run-plan.mjs`, plan prompt/gate, install/landing/tool/skills/settings were not modified (full protected diff below).

## 3. Outcomes and §7 path evidence

| Outcome | Evidence |
|---|---|
| O1 | V6 opt-in/legacy preflight; V12 dry JSON; C5 custom writer/thinking, mutation-free dry run, explicit opt-out. |
| O2 | V8 verifies installed spec, writer first, tests-only commit on run branch, outside edit discarded and planning reached. C5 verifies staged/new/renamed/Unicode paths and staged .agent exclusion; mixed per-file baseline and planner freeze. Existing run-plan task/integration protection and final-grade calls unchanged. |
| O3 | V9 passes all-pass and parse errors to fresh rounds 2/3; V10 stops after three rejections, leaves base unmoved and writes summary. C5 ordinary writer exit and Python gate fixed-error branch. |
| O4 | V11 supplied metadata, no writer/sentinel; C3 legacy/supplied summary fallbacks. |
| O5 | V7 and C3 summary tests verify writer/rounds, both transition labels, manual lines and unfinished/legacy states. V8/V9 assert producer JSON contents and rounds; C5 checks original provenance retained across resume. Run-record construction statically reviewed below; no claim of a full new model-driven pipeline handoff. |

All protected §7 paths ran: downloaded markdown; outside README write; all-pass rejection; parse rejection; three rejections; supplied tests; resolved-spec dry run; numeric V1/V10/range/manual rules; all-manual/all-pass/syntax; .agent/renames; prompts with/without Python/errors; missing imports. The declared exclusions are treated explicitly:

- Completed-stage existence guard: not exercised by protected suite, but exercised by C5 for completed and markerless resumes.
- Python writer output with no Python project: not exercised by protected suite, but first-round fixed error exercised by C5, without invoking a real uv/project dependency resolution.
- Real model writing tests for a real external-project spec: **NOT RUN**. Lucas's next external-project run remains acceptance. No hermetic stub is represented as model acceptance.

Static review of paths not fully end-to-end here:
- Generated run record uses `spec-tests.json.writer`, not the current setting, and inserts exactly one `Spec tests:` line immediately after `Plan:`. Supplied/no-artifact line is `Spec tests: supplied with the spec`; all remaining record text is preserved. Full record/handoff code appears below. No complete generated-run handoff was executed in this integration session.
- Later freeze/grading: unchanged `run-plan.mjs` restores protected paths after tasks and integration and runs both generated/supplied `.tests/` for final grade. Added bin-level guard closes the earlier planner-call gap; C5 tests staged planner edits on failure. Quota/interrupt paths in `pi()` remain unchanged; resume also restores generated baseline before entering planning.

## 4. Changes and callers (S03, S06, S07, S08)

Production changes are restricted to the seven §5 paths. Implemented all Sol tasks: S00 grounding, S03 runner, S06 README, S07 extension documentation, S08 final report (also copied to the plan report path). Luna's L01/L02/L04/L05 remain committed separately; integration hardens L01 parsing/porcelain details without changing its public interface.

Caller inventory:
- New `isTestFile` -> `specTestsGate`, `parseErrors` and runner automated-file collection; `checksNamed` -> `specTestsGate`; `manualEntries` -> `specTestsGate` and runner JSON producer; internal `decodePorcelainPath` -> `pathsOutside`.
- New `pathsOutside`, `parseErrors`, `specTestsPrompt`, `specTestsGate` -> runner generation stage. Public helpers are also exercised directly by protected gate and plan decisions tests.
- Changed `preflight` / `PreflightInput` -> runner top-level preflight; protected/spec/plan callers omitting `writeTests` retain exact prior behavior.
- Changed runner `tests` -> generation per-file gate and existing plan acceptance gate. Empty Python-project normalization prevents a null subprocess argument in the newly reachable rejection path.
- New runner `restoreFrozenSpecTests` -> before plan, after initial planner and every repair planner, before plan commit. Applies only to metadata-marked generated runs.
- Changed runner top-level declarations -> preflight inputs, dry JSON, fresh metadata, pre-plan stage and handoff record. Full script below supplies their complete calling context.
- `ProgressStage`/`STAGES` -> existing `parseProgressLine`; its callers include runner stream forwarding and `extensions/pipeline.ts`. Reduction/render logic unchanged.
- Changed `buildSummary` -> runner `finish` for all post-directory exits; protected summary and plan summary tests call directly. Existing status/gate/tasks/grade/session behavior retained.
- README Developing with pi and agent/EXTENSIONS Pipeline tool -> human usage docs only; no tool contract or runtime code outside scope changed.

### Scope diff stat

Command: `git diff --stat 26f2307 -- README.md agent/EXTENSIONS.md bin/pi-implement lib/spec-tests.ts lib/pipeline.ts lib/progress.ts lib/run-summary.ts` (all implementation, including Luna, relative to the committed plan; excludes the report itself and earlier planning artifacts).

```text
 README.md           |   4 +-
 agent/EXTENSIONS.md |   2 +-
 bin/pi-implement    |  95 +++++++++++++++++++++++++++++++++++--
 lib/pipeline.ts     |   3 +-
 lib/progress.ts     |   4 +-
 lib/run-summary.ts  |  25 ++++++++++
 lib/spec-tests.ts   | 131 ++++++++++++++++++++++++++++++++++++++++++++++++++++
 7 files changed, 254 insertions(+), 10 deletions(-)
```

### Full protected diffs

`git diff 42e61473b5e244a388ee0224ad8d20eafc4af3b6 -- 'docs/specs/*.tests/**' 'tests/*.test.ts' scripts/run-plan.mjs`:

```diff
```

Empty (zero bytes). `git diff 26f2307 -- docs/specs/SPEC-0020-write-spec-tests-when-a-spec-has-none.plan/*.test.ts` is also empty. No protected or plan acceptance test edit, skip or weakening.

## 5. Deviations and unanticipated seams

1. Grounding's no-old-failures expectation is false in this environment. Preserved the exact existing failures; no scope growth to repair documentation fixtures/dependencies.
2. Downloaded-source dry preview retains SPEC-0019's install-only early exit. The new `specTests` field is on the normal resolved-spec dry run, as planned. No install/landing/tool change.
3. Git cleanup uses uncollapsed status (`--no-renames --untracked-files=all`) so cross-boundary renames expose both sides; HEAD-tracked paths use staged/worktree restore, index-only paths are unstaged then cleaned, all pathspecs literal. `.agent` noise remains on disk but is unstaged to prevent leakage into the unchanged later plan commit. Generated commit uses `--only` plus the tests path.
4. Parser hardening: lowercase filename v-number rule; full Git C-quote UTF-8 decoding/quoted-arrow handling; `mkdtemp` parse scratch and temporary Python cache prefix cleaned in `finally`. These fix interface/resource details from inherited Luna code, not acceptance-test changes or new dependencies.
5. Newly reachable Python/no-project gate needs empty-project normalization inside runner `tests()`; otherwise spawn receives a null argument and exits before recording the required gate error. Existing public library `testCommands`/environment APIs unchanged.
6. The spec assumes existing protection covers planning, but `run-plan.mjs` snapshots after the plan commit. Added generated-test baseline restoration around planning/resume/repair and before plan commit in allowed `bin/pi-implement`. Plan prompt, check count, gate decisions and run-plan protection unchanged; C5 demonstrates staged planner tampering is discarded. This enforces the required freeze invariant without broadening scope.
7. Concurrent cross-suite node_modules symlink fixtures affect the combined V13 failure count. Baseline-relative comparison therefore uses the same independent suite commands as step 0, not the misleading combined count. No fixtures edited.
8. Typecheck is genuinely inapplicable without tsconfig. Real model-driven acceptance and full generated handoff/run-record execution remain unrun; static review/hermetic evidence is labelled, not promoted to real acceptance. The outer pipeline owns final grading/status/run-record handoff; this noninteractive integration does not prematurely change the spec/index status.

No plan acceptance tests were changed; no design/scope-changing stop condition fired; no failed group exceeded the three-round limit. Complete current changed functions/constants and runner calling context follow.

## Appendix A — complete new decisions/parser module

```typescript
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { stripTypeScriptTypes } from "node:module";

const NODE_TEST = /\.test\.(?:ts|mts|js|mjs)$/;
const PY_TEST = /(?:^|\/)(?:test_[^/]*|[^/]*_test)\.py$/;

export function isTestFile(file: string): boolean {
  return NODE_TEST.test(file) || PY_TEST.test(file);
}

export function checksNamed(file: string): number[] {
  const base = path.posix.basename(file.replaceAll("\\", "/"));
  return [...base.matchAll(/(?:^|[^a-zA-Z0-9])v(\d+)(?!\d)/g)].map((m) => Number(m[1]));
}

export function manualEntries(text: string | null): { check: string; reason: string }[] {
  if (text === null) return [];
  const entries: { check: string; reason: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^(?:[-*]\s*)?V(\d+)\s*:\s*(.*)$/i);
    const reason = match?.[2].trim();
    if (match && reason) entries.push({ check: `V${Number(match[1])}`, reason });
  }
  return entries;
}

export function specTestsGate(input: { checks: number; files: string[]; manual: string | null; syntaxErrors: string[]; before: { file: string; passed: boolean }[] }): string[] {
  const tests = input.files.filter(isTestFile);
  const covered = new Set<number>(manualEntries(input.manual).map((entry) => Number(entry.check.slice(1))));
  for (const file of tests) {
    for (const n of checksNamed(file)) {
      if (n < 1 || n > input.checks) continue;
      covered.add(n);
    }
  }
  const errors: string[] = [];
  for (let n = 1; n <= input.checks; n++) if (!covered.has(n)) errors.push(`V${n}: no test file and no MANUAL.md entry`);
  for (const file of tests) for (const n of checksNamed(file)) {
    if (n < 1 || n > input.checks) errors.push(`${file}: names V${n}, but the spec has V1–V${input.checks}`);
  }
  if (tests.length === 0) errors.push("no automated checks: add at least one test file");
  errors.push(...input.syntaxErrors);
  if (input.before.length > 0 && input.before.every((entry) => entry.passed)) errors.push("all automated checks pass before implementation");
  return errors;
}

function decodePorcelainPath(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"')) return value;
  // Git C-quotes UTF-8 bytes as octal escapes, which JSON.parse cannot decode.
  const chunks: Buffer[] = [];
  const escapes: Record<string, string> = { a: "\u0007", b: "\b", t: "\t", n: "\n", v: "\v", f: "\f", r: "\r" };
  for (const part of value.slice(1, -1).matchAll(/\\([0-7]{1,3}|.)|([^\\]+)/g)) {
    chunks.push(part[2] !== undefined ? Buffer.from(part[2]) : /^[0-7]+$/.test(part[1])
      ? Buffer.from([parseInt(part[1], 8)]) : Buffer.from(escapes[part[1]] ?? part[1]));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function pathsOutside(dirty: string[], dir: string): string[] {
  const root = dir.replace(/\/$/, "");
  const outside: string[] = [];
  for (const line of dirty) {
    if (line.length < 4) continue;
    const raw = line.slice(3);
    let destination = 0;
    if (/[RC]/.test(line.slice(0, 2))) {
      let quoted = false;
      for (let i = 0; i < raw.length; i++) {
        if (quoted && raw[i] === "\\") { i++; continue; }
        if (raw[i] === '"') quoted = !quoted;
        else if (!quoted && raw.startsWith(" -> ", i)) destination = i + 4;
      }
    }
    const file = decodePorcelainPath(raw.slice(destination));
    if (file.startsWith(".agent/")) continue;
    if (file === root || file.startsWith(`${root}/`)) continue;
    outside.push(file);
  }
  return outside;
}

export function specTestsPrompt(input: { spec: string; testsDir: string; checks: number; pythonProject: string | null; errors?: string[] }): string {
  const checks = Array.from({ length: input.checks }, (_, i) => `V${i + 1}`).join(", ");
  const runners = `Run Node tests with: node --experimental-strip-types --test${input.pythonProject ? `\nRun Python tests with: uv run --project ${input.pythonProject} pytest` : ""}`;
  return `Write tests for the specification at ${input.spec}. Put all files in ${input.testsDir}.\n\nChecks to cover individually: ${checks || "(none)"}. Name automated test files with the check number, using v<digits> (for example v01-check.test.ts); V1 and V10 are distinct. For any check that cannot be automated, add a MANUAL.md line such as V2: needs a model-driven run, with a non-empty reason.\n\n${runners}\n\nTests for newly required behaviour must fail before implementation; tests for preserved behaviour may pass. At least one test must fail. Use temporary directories for filesystem tests. Use no models and no network. Read the spec and repository only; do not read a plan. Do not edit outside ${input.testsDir}. Do not implement anything.${input.errors?.length ? `\n\nThe previous attempt was rejected for these reasons:\n${input.errors.map((e) => `- ${e}`).join("\n")}` : ""}`;
}

export function parseErrors(root: string, files: string[]): string[] {
  const errors: string[] = [];
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "spec-tests-parse-"));
  try {
    for (const file of files) {
      if (!isTestFile(file)) continue;
      const full = path.resolve(root, file);
      const ext = path.extname(file).toLowerCase();
      let command: string;
      let args: string[];
      if (ext === ".ts" || ext === ".mts") {
        try {
          const stripped = stripTypeScriptTypes(fs.readFileSync(full, "utf8"));
          const strippedFile = path.join(scratch, "stripped.mjs");
          fs.writeFileSync(strippedFile, stripped);
          command = process.execPath;
          args = ["--check", strippedFile];
        } catch (error) {
          const line = String(error).split(/\r?\n/, 1)[0];
          errors.push(`${file}: syntax error: ${line}`);
          continue;
        }
      } else if (ext === ".js" || ext === ".mjs") {
        command = process.execPath;
        args = ["--check", full];
      } else {
        command = "python3";
        args = ["-m", "py_compile", full];
      }
      const result = spawnSync(command, args, { encoding: "utf8",
        env: { ...process.env, PYTHONPYCACHEPREFIX: path.join(scratch, "pycache") } });
      if (result.error || result.status !== 0) {
        const output = result.stderr || result.stdout || String(result.error ?? "syntax check failed");
        errors.push(`${file}: syntax error: ${output.split(/\r?\n/, 1)[0]}`);
      }
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  return errors;
}

```

## Appendix B — complete changed preflight interface and function

```typescript
export interface PreflightInput {
  specPaths?: { spec: string; tests: string };
  specText: string;
  hasTestsDir: boolean;
  writeTests?: boolean;
  held: boolean;
  dirty: string[]; // uncommitted paths in the repository
  testFiles?: string[];
  pythonProject?: string | null;
}

export interface Preflight {
  checks: number | null;
  blocking: string[];
  warnings: string[];
}

export function preflight(input: PreflightInput): Preflight {
  const blocking: string[] = [];
  const warnings: string[] = [];
  let checks: number | null = null;
  try {
    checks = countVerifyChecks(input.specText);
  } catch (err) {
    blocking.push(`spec: ${(err as Error).message}`);
  }
  if (!input.hasTestsDir && !input.writeTests) blocking.push("spec has no .tests/ directory: the pipeline grades against the spec's tests");
  if (input.held) blocking.push("quota hold in place: run bin/pi-continue first");
  if (input.pythonProject === null && (input.testFiles ?? []).some((file) => PY_TEST.test(file))) {
    blocking.push("Python tests but no Python project; add .pi/pipeline.json with pythonProject");
  }
  if (input.dirty.length) {
    warnings.push(`${input.dirty.length} uncommitted path(s) are not part of the run, which starts from HEAD: ${input.dirty.slice(0, 5).join(", ")}`);
  }
  if (input.specPaths) {
    const matches = uncommittedSpecPaths(input.dirty, input.specPaths);
    if (matches.length) {
      blocking.push(`uncommitted changes to ${input.specPaths.spec} relative to HEAD: ${matches.join(", ")}`);
    }
  }
  return { checks, blocking, warnings };
}

```

## Appendix C — complete changed progress declarations

```typescript
export type ProgressStage = "preflight" | "plan" | "gate" | "tasks" | "integration" | "grade" | "handoff" | "install" | "land" | "spec-tests";
const STAGES: readonly string[] = ["preflight", "plan", "gate", "tasks", "integration", "grade", "handoff", "install", "land", "spec-tests"];
```

Only these declarations changed in progress; the existing parser/reducer/renderers are unchanged.

## Appendix D — complete changed summary formatter

```typescript
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function buildSummary(input: {
  runDir: string;
  outcome: { ok: boolean; stage: string; reason: string; next?: string; landed?: string; branch?: string };
}): string {
  const { runDir, outcome } = input;
  const lines: string[] = [];
  const readJson = (name: string): any => {
    try { return JSON.parse(readFileSync(join(runDir, name), "utf8")); } catch { return undefined; }
  };
  const metadata = readJson("pipeline.json");
  const spec = typeof metadata?.spec === "string" ? metadata.spec : "missing";
  const id = spec.match(/SPEC-[0-9A-Za-z]+/)?.[0] ?? "missing";

  lines.push(`# Run summary: ${id}`, "", "## Status", `**${!outcome.ok ? "Failed" : outcome.landed ? `Landed on ${outcome.landed}` : "Handed off"}**`, `Stage: ${outcome.stage || "missing"}`, `Reason: ${outcome.reason || "missing"}`);
  const keptBranch = !outcome.landed ? (outcome.branch || metadata?.branch) : undefined;
  if (keptBranch) lines.push(`Branch: ${keptBranch}`);
  if (outcome.next) lines.push(`Next: ${outcome.next}`);

  lines.push("", "## Run", `Spec: ${spec}`, `Base: ${typeof metadata?.base === "string" ? metadata.base.slice(0, 7) : "missing"}`, `Base branch: ${metadata?.baseBranch ?? "missing"}`, `Started at: ${metadata?.startedAt ?? "missing"}`, `Run directory: ${runDir}`);

  lines.push("", "## Spec tests");
  const specTests = readJson("spec-tests.json");
  if (specTests && typeof specTests === "object") {
    lines.push(`Written by ${specTests.writer ?? "missing"} in ${specTests.rounds ?? "missing"} round(s)`);
    if (Array.isArray(specTests.files)) {
      for (const file of specTests.files) {
        if (!file || typeof file !== "object") continue;
        const status = file.before === "fail" ? "fail-to-pass" : "pass-to-pass";
        lines.push(`- ${file.file ?? "missing"}: ${status}`);
      }
    }
    if (Array.isArray(specTests.manual)) {
      for (const manual of specTests.manual) {
        if (!manual || typeof manual !== "object") continue;
        lines.push(`- ${manual.check ?? "missing"}: ${manual.reason ?? "missing"}`);
      }
    }
  } else if (metadata?.specTests === "supplied") {
    lines.push("supplied with the spec");
  } else if (metadata?.specTests === "generated") {
    lines.push("to be written; not finished");
  } else {
    lines.push("not recorded");
  }

  lines.push("", "## Plan gate");
  let gateFound = false;
  try {
    const gates = readdirSync(runDir).map((name) => ({ name, match: /^gate-(\d+)\.log$/.exec(name) }))
      .filter((item) => item.match).sort((a, b) => Number(a.match![1]) - Number(b.match![1]));
    for (const gate of gates) {
      gateFound = true;
      let content = "missing";
      try { content = readFileSync(join(runDir, gate.name), "utf8").trim() || "(empty)"; } catch { /* report missing */ }
      lines.push(`- Gate round ${Number(gate.match![1]) + 1}: ${content}`);
    }
  } catch { /* missing directory */ }
  const gate = readJson("gate.json");
  if (gate?.result === "pass") { lines.push("- Passed"); gateFound = true; }
  if (!gateFound) lines.push("- not reached (missing gate files)");

  lines.push("", "## Tasks");
  let resultRows = 0;
  try {
    const content = readFileSync(join(runDir, "results.jsonl"), "utf8");
    for (const row of content.split(/\r?\n/)) {
      if (!row.trim()) continue;
      try {
        const task = JSON.parse(row);
        lines.push(`- ${task.id ?? "missing"}: ${task.acceptance ?? "missing"}; ${task.model ?? "missing"}; rounds ${task.rounds ?? "missing"}; cost $${Number(task.providerCost ?? 0).toFixed(2)}`);
        resultRows++;
      } catch { lines.push(`- missing (invalid results row)`); resultRows++; }
    }
  } catch { /* missing results file */ }
  if (!resultRows) lines.push("- none recorded");

  lines.push("", "## Final grade");
  const grade = readJson("grade.json");
  if (!grade) lines.push("- Grade not reached");
  for (const [key, label] of [["specTests", "spec tests"], ["planTests", "plan tests"], ["typecheck", "typecheck"]] as const) {
    if (grade) {
      const code = grade[key]?.code;
      lines.push(`- ${label}: ${code === 0 ? "pass" : typeof code === "number" ? "fail" : "not run"}`);
    }
  }

  lines.push("", "## Sessions", "| Session | Calls | Prompt tokens | Completion tokens | Cost |", "|---|---:|---:|---:|---:|");
  const databases: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name !== "branch" && entry.name !== "work") walk(join(dir, entry.name));
      } else if (entry.isFile() && entry.name.endsWith("telemetry.db")) databases.push(join(dir, entry.name));
    }
  };
  walk(runDir);
  databases.sort((a, b) => relative(runDir, a).localeCompare(relative(runDir, b)));
  let calls = 0, prompt = 0, completion = 0, cost = 0;
  for (const file of databases) {
    let db: DatabaseSync | undefined;
    try {
      db = new DatabaseSync(file, { readOnly: true });
      const row: any = db.prepare("SELECT COUNT(*) AS calls, COALESCE(SUM(prompt_tokens),0) AS prompt, COALESCE(SUM(completion_tokens),0) AS completion, COALESCE(SUM(cost_usd),0) AS cost FROM inference_calls").get();
      const n = Number(row.calls), p = Number(row.prompt), c = Number(row.completion), dollars = Number(row.cost);
      calls += n; prompt += p; completion += c; cost += dollars;
      const fileName = basename(file);
      const name = fileName.endsWith("-telemetry.db") ? fileName.slice(0, -"-telemetry.db".length) : fileName;
      lines.push(`| ${name} | ${n} | ${p} | ${c} | $${dollars.toFixed(2)} |`);
    } catch {
      // An unreadable or incompatible database is surfaced as missing evidence.
      lines.push(`| ${basename(file).replace(/-telemetry\.db$/, "")} | missing | missing | missing | missing |`);
    } finally { db?.close(); }
  }
  lines.push(`| Total | ${calls} | ${prompt} | ${completion} | $${cost.toFixed(2)} |`);

  if (existsSync(join(runDir, "report.md"))) lines.push("", "## Integration report", resolve(runDir, "report.md"));
  return `${lines.join("\n")}\n`;
}

```

## Appendix E — complete runner, including changed function callers and top-level lifecycle

```javascript
#!/usr/bin/env -S node --experimental-strip-types
// Install/commit downloaded specs, summarize every run exit, and safely fast-forward
// an unchanged starting branch after a passing grade; otherwise keep a review branch.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { countVerifyChecks, pipelineThinking, undeclaredImports, validatePlan } from "../lib/plan.ts";
import { childEnv, childPiArgs, costByRole, gateRepairable, landReviewBranch, pipelineRunRoot, planPrompt, preflight, pythonProjectFor, runDirBase, targetRepo, testCommands, testEnv, uncommittedSpecPaths } from "../lib/pipeline.ts";
import { buildSummary } from "../lib/run-summary.ts";
import { isTestFile, manualEntries, parseErrors, pathsOutside, specTestsGate, specTestsPrompt } from "../lib/spec-tests.ts";
import { installSpec } from "../lib/install-spec.ts";
import { childEventToProgress, finalText, parseProgressLine } from "../lib/progress.ts";
import { markImplemented, resolveSpec, specPaths } from "../lib/specs.ts";
import { defaultHoldPath, readHold } from "../lib/quota.ts";
import { readPiSettings } from "../lib/telemetry.ts";

const harnessRoot = path.dirname(path.dirname(fs.realpathSync(fileURLToPath(import.meta.url))));
const argv = process.argv.slice(2);
const valueFlags = ["--progress", "--repo"];
const query = argv.find((arg, i) => !arg.startsWith("--") && (i === 0 || !valueFlags.includes(argv[i - 1])));
const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
const progress = argv.includes("--progress") && argv[argv.indexOf("--progress") + 1] === "json";
let currentChild = null;
let terminated = false;
let done = false;
let currentStage = "preflight";
let currentRunDir;
let keptBranch;
let resumeTarget;
let resumeQuery = query;
let keptWorktrees = [];
const emit = (event) => { if (progress) process.stdout.write(`${JSON.stringify(event)}\n`); };
const finish = (ok, summary, extra = {}, next) => {
  if (done) return;
  done = true;
  let summaryPath;
  if (currentRunDir) {
    try {
      const file = path.resolve(currentRunDir, "summary.md");
      fs.writeFileSync(file, buildSummary({ runDir: currentRunDir,
        outcome: { ok, stage: currentStage, reason: summary, next,
          ...(!extra.landed && keptBranch ? { branch: keptBranch } : {}), ...extra } }));
      summaryPath = file;
    } catch (error) { console.error(`summary write failed: ${error instanceof Error ? error.message : String(error)}`); }
  }
  emit({ type: "done", ok, summary, ...extra, ...(summaryPath ? { summaryPath } : {}) });
};
const exit = (text, code = 1) => {
  console.error(text);
  if (code === 75) emit({ type: "notice", text });
  const next = code === 75 || code === 130
    ? `${code === 75 ? "Run bin/pi-continue, then " : ""}resume with implement_spec(${JSON.stringify({ spec: resumeQuery, resume: true })}) or bin/pi-implement ${JSON.stringify(resumeQuery)} --repo ${JSON.stringify(resumeTarget)} --resume.`
    : `Fix the reason, then start a new run. Worktree(s) retained: ${keptWorktrees.filter((file) => fs.existsSync(file)).join(", ") || "none"}.`;
  finish(false, text, {}, next);
  process.exit(code);
};
const interrupt = () => {
  terminated = true;
  currentChild?.kill("SIGTERM");
  if (!currentChild) exit("Interrupted; run directory and worktree retained for --resume", 130);
};
process.on("SIGTERM", interrupt);
process.on("SIGINT", interrupt);
const interrupted = () => { if (terminated) exit("Interrupted; run directory and worktree retained for --resume", 130); };
const stage = (name) => { currentStage = name; emit({ type: "stage", stage: name }); };
process.on("uncaughtException", (err) => exit(String(err.stack || err)));
process.on("unhandledRejection", (err) => exit(String(err)));
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
const read = (file) => fs.readFileSync(file, "utf8");
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const filesIn = (dir, prefix = "") => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const rel = path.join(prefix, entry.name);
  return entry.isDirectory() ? filesIn(path.join(dir, entry.name), rel) : [rel];
}) : [];
async function tests(work, files, pythonProject) {
  const cmds = testCommands(files, { pythonProject: pythonProject ?? "" });
  if (!cmds.length) return { code: 1, output: "no recognized test files" };
  const results = [];
  for (const { cmd, args } of cmds) {
    results.push(await streamed(cmd, args, work, { env: testEnv(process.env) }));
    interrupted();
  }
  return { code: results.some((result) => result.code !== 0) ? 1 : 0, output: results.map((r) => r.output).join("\n") };
}
function usage(db) {
  if (!fs.existsSync(db)) return { calls: 0, cost: 0 };
  const store = new DatabaseSync(db, { readOnly: true });
  try {
    const row = store.prepare("SELECT COUNT(*) calls, COALESCE(SUM(cost_usd), 0) cost FROM inference_calls").get();
    return { calls: row.calls, cost: row.cost };
  } catch { return { calls: 0, cost: 0 }; }
  finally { store.close(); }
}
// Write the raw JSON stream immediately: a failed or interrupted run remains inspectable.
function streamed(cmd, args, cwd, { env = process.env, log, role, forward = false } = {}) {
  return new Promise((resolve) => {
    if (log) write(log, "");
    let output = "";
    let pending = "";
    let stderr = "";
    const child = spawn(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    currentChild = child;
    const line = (text) => {
      if (forward) {
        const event = parseProgressLine(text);
        // The entrypoint owns the final handoff and done event.
        if (event && event.type !== "done" && event.stage !== "grade" && event.stage !== "handoff") {
          if (event.type === "stage") stage(event.stage);
          else emit(event);
        }
      } else if (role) {
        try {
          for (const event of childEventToProgress(role, undefined, JSON.parse(text))) emit(event);
        } catch { /* Ignore partial or non-JSON child output. */ }
      }
    };
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      if (log) fs.appendFileSync(log, text);
      output += text;
      pending += text;
      const lines = pending.split("\n");
      pending = lines.pop();
      for (const item of lines) line(item.replace(/\r$/, ""));
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (progress) process.stderr.write(text);
    });
    child.on("error", (err) => { stderr += String(err); });
    child.on("close", (code) => {
      if (pending.trim()) line(pending);
      if (currentChild === child) currentChild = null;
      resolve({ code: code ?? 1, output: role ? `${finalText(output)}${stderr ? `\n${stderr}` : ""}` : `${output}${stderr}` });
    });
    if (terminated) child.kill("SIGTERM");
  });
}
async function pi(work, model, thinking, prompt, log, db) {
  const result = await streamed("pi", childPiArgs({ model, thinking, prompt, sessionDir: path.join(path.dirname(log), `${path.basename(log, ".log")}-session`) }), work,
    { env: childEnv(process.env, "planner", db), log, role: "planner" });
  interrupted();
  if (result.code === 75) exit(`Quota hold; resume with bin/pi-implement ${resumeQuery} --resume`, 75);
  if (result.code === 130) exit("Interrupted; run directory and worktree retained for --resume", 130);
  return result;
}
function runCosts(dir) {
  const rows = [];
  const visit = (folder) => {
    if (!fs.existsSync(folder)) return;
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      if (item.isDirectory()) {
        if (item.name !== "branch" && item.name !== "work") visit(path.join(folder, item.name));
      } else if (item.isFile() && (item.name === "telemetry.db" || item.name.endsWith("-telemetry.db"))) {
        let store;
        try {
          store = new DatabaseSync(path.join(folder, item.name), { readOnly: true });
          for (const row of store.prepare("SELECT subagent_role AS role, cost_usd AS cost FROM inference_calls").all()) rows.push(row);
        } catch { /* A child may not have initialized its telemetry yet. */ }
        finally { store?.close(); }
      }
    }
  };
  visit(dir);
  return costByRole(rows);
}
if (!query || [...flags].some((flag) => !["--dry-run", "--plan-only", "--resume", ...valueFlags].includes(flag)) ||
    valueFlags.some((flag) => argv.includes(flag) && (!argv[argv.indexOf(flag) + 1] || argv[argv.indexOf(flag) + 1].startsWith("--"))) ||
    (argv.includes("--progress") && !progress))
  exit("usage: bin/pi-implement <spec> [--dry-run] [--plan-only] [--resume] [--progress json] [--repo <path>]", 2);
const repoPath = argv.includes("--repo") ? argv[argv.indexOf("--repo") + 1] : process.cwd();
const target = targetRepo(repoPath);
if (!target) exit(`not inside a git repository: ${repoPath}`, 2);
resumeTarget = target;
const specsDir = path.join(target, "docs/specs");
let resolutionQuery = query;
const source = path.resolve(query.startsWith("~/") ? path.join(os.homedir(), query.slice(2)) : query);
const inside = (parent, file) => { const rel = path.relative(parent, file); return rel === "" || (!path.isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${path.sep}`)); };
if (/\.(md|zip)$/.test(query) && fs.existsSync(source) && fs.statSync(source).isFile() &&
    !inside(fs.existsSync(specsDir) ? fs.realpathSync(specsDir) : specsDir, fs.realpathSync(source))) {
  stage("install");
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const installed = installSpec({ target, source, today, dryRun: flags.has("--dry-run") });
  if (!installed.ok) exit(`install failed: ${installed.error}`, 2);
  const text = `Installed SPEC-${installed.id}: ${installed.spec}; tests ${installed.tests ?? "none"}; ${installed.committed ? `committed ${installed.commit}` : "not committed (unchanged or dry run)"}`;
  console.error(text);
  emit({ type: "notice", text });
  if (flags.has("--dry-run")) {
    const report = JSON.stringify({ install: installed }, null, 2);
    if (progress) { console.error(report); finish(true, "install dry run complete"); }
    else console.log(report);
    process.exit(0);
  }
  resolutionQuery = installed.id;
}
if (!fs.existsSync(specsDir)) exit(`no docs/specs directory in ${target}`, 2);
const resolution = resolveSpec(fs.readdirSync(specsDir), resolutionQuery);
if (!resolution.ok) exit(resolution.error, 2);
const spec = resolution.spec;
resumeQuery = spec.id;
const paths = specPaths(spec);
const specRel = path.join("docs/specs", paths.spec);
const testRel = path.join("docs/specs", paths.tests);
const planRel = path.join("docs/specs", paths.plan);
// Do not trim: the first porcelain status column may be a space.
const dirty = execFileSync("git", ["-C", target, "status", "--porcelain"], { encoding: "utf8" }).split("\n").filter(Boolean);
const settings = readPiSettings();
const pythonProject = pythonProjectFor({ target, harnessRoot, settings });
const suppliedTests = fs.existsSync(path.join(target, testRel));
const writeTests = settings.pipeline?.writeSpecTests !== false;
const testFiles = filesIn(path.join(target, testRel), testRel);
stage("preflight");
const check = preflight({ specText: read(path.join(target, specRel)), hasTestsDir: suppliedTests, writeTests,
  held: readHold(defaultHoldPath(process.env)) !== null, dirty, testFiles, pythonProject,
  ...(!flags.has("--dry-run") ? { specPaths: { spec: specRel, tests: testRel } } : {}) });
if (flags.has("--dry-run")) {
  const paths = uncommittedSpecPaths(dirty, { spec: specRel, tests: testRel });
  if (paths.length) {
    const text = `uncommitted spec/tests for ${specRel}; a real run starts from HEAD: ${paths.join(", ")}`;
    console.error(`warning: ${text}`);
    emit({ type: "notice", text });
  }
}
for (const warning of check.warnings) { console.error(`warning: ${warning}`); emit({ type: "notice", text: warning }); }
if (check.blocking.length) exit(check.blocking.join("\n"), check.blocking.some((s) => s.includes("quota hold")) ? 75 : 2);
const planner = settings.routing?.tiers?.escalate || "openai-codex/gpt-6-sol";
const editor = settings.routing?.tiers?.scout || "openai-codex/gpt-6-luna";
const testWriter = settings.pipeline?.testWriter || planner;
const levels = pipelineThinking(settings);
const commands = testCommands(testFiles, { pythonProject: pythonProject ?? "" });
const base = runDirBase({ runRoot: pipelineRunRoot(settings, os.homedir()), target, harnessRoot, id: spec.id, slug: spec.slug });
if (flags.has("--dry-run")) {
  const text = JSON.stringify({ spec: specRel, tests: testRel, plan: planRel, runRecord: paths.runRecord,
    checks: check.checks, planner: `${planner} at ${levels.planner}`, editor: `${editor} at ${levels.editor}`, commands,
    target, harnessRoot, runDir: base, pythonProject,
    specTests: suppliedTests ? "supplied" : `to be written by ${testWriter} at ${levels.planner}` }, null, 2);
  if (progress) { process.stderr.write(`${text}\n`); finish(true, "dry run complete"); }
  else console.log(text);
  process.exit(0);
}
const existing = fs.existsSync(base) ? fs.readdirSync(base).sort().reverse().find((s) => fs.existsSync(path.join(base, s, "pipeline.json"))) : undefined;
if (flags.has("--resume") && !existing) exit(`no run to resume for SPEC-${spec.id}`, 2);
const stamp = flags.has("--resume") ? existing : new Date().toISOString().replace(/[:.]/g, "-");
const dir = path.join(base, stamp);
const metaPath = path.join(dir, "pipeline.json");
// Track an existing run before reading its metadata, including malformed resumes.
if (flags.has("--resume")) currentRunDir = dir;
const metadata = flags.has("--resume") ? JSON.parse(read(metaPath)) : {
  branch: `pipeline/SPEC-${spec.id}-${spec.slug}-${stamp}`, spec: specRel, stamp,
  specTests: suppliedTests ? "supplied" : "generated",
  startedAt: new Date().toISOString(), base: git(target, "rev-parse", "HEAD"),
  baseBranch: (() => { try { return git(target, "symbolic-ref", "--short", "-q", "HEAD") || null; } catch { return null; } })(),
};
const branch = metadata.branch;
const work = path.join(dir, "branch");
keptBranch = branch;
keptWorktrees = [work, path.join(dir, "work")];
if (!flags.has("--resume")) {
  fs.mkdirSync(dir, { recursive: true });
  currentRunDir = dir;
  write(metaPath, JSON.stringify(metadata, null, 2));
  git(target, "branch", branch, metadata.base);
  git(target, "worktree", "add", work, branch);
}
// Use saved metadata, not the target's current tests/settings, when resuming.
// Markerless legacy runs must not speculatively start a new writing stage.
const specTestsPath = path.join(dir, "spec-tests.json");
if (metadata.specTests === "generated" && !fs.existsSync(specTestsPath)) {
  stage("spec-tests");
  let previousErrors = [];
  for (let round = 1; round <= 3; round++) {
    const written = await pi(work, testWriter, levels.planner,
      specTestsPrompt({ spec: specRel, testsDir: testRel, checks: check.checks, pythonProject, errors: previousErrors }),
      path.join(dir, `spec-tests-${round}.log`), path.join(dir, `spec-tests-${round}-telemetry.db`));
    // Avoid rename folding here: both an outside source deletion and an outside
    // destination must be restored, even when the other side is inside tests.
    const dirty = execFileSync("git", ["-C", work, "status", "--porcelain", "--no-renames", "--untracked-files=all"], { encoding: "utf8" }).split("\n").filter(Boolean);
    const outside = pathsOutside(dirty, testRel);
    for (const file of outside) {
      if (git(work, "--literal-pathspecs", "ls-tree", "-r", "--name-only", "HEAD", "--", file)) {
        git(work, "--literal-pathspecs", "restore", "--source=HEAD", "--staged", "--worktree", "--", file);
      } else {
        // A writer may have staged a new outside path. Remove it from the index
        // before cleaning it; a path-scoped commit alone would leave it staged.
        if (git(work, "--literal-pathspecs", "ls-files", "--", file)) git(work, "--literal-pathspecs", "rm", "--cached", "-f", "--", file);
        git(work, "--literal-pathspecs", "clean", "-fd", "--", file);
      }
    }
    // Keep local memory noise on disk, but never carry a writer-staged .agent
    // path into the later (unchanged) plan commit.
    if (git(work, "diff", "--cached", "--name-only", "--", ".agent")) git(work, "restore", "--source=HEAD", "--staged", "--", ".agent");
    if (outside.length) {
      const text = `Discarded test writer edits outside ${testRel}: ${outside.join(", ")}`;
      console.error(text);
      emit({ type: "notice", text });
    }
    if (written.code !== 0) exit(`spec tests writer failed: ${written.output}`, 1);
    const files = filesIn(path.join(work, testRel), testRel);
    const automated = files.filter(isTestFile);
    const manualPath = path.join(work, testRel, "MANUAL.md");
    const manual = fs.existsSync(manualPath) ? read(manualPath) : null;
    const syntaxErrors = parseErrors(work, files);
    if (pythonProject === null) {
      for (const file of automated.filter((file) => file.endsWith(".py"))) syntaxErrors.push(`${file}: Python tests but no Python project; add .pi/pipeline.json with pythonProject`);
    }
    const before = [];
    for (const file of automated) {
      const result = await tests(work, [file], pythonProject);
      before.push({ file, passed: result.code === 0 });
    }
    previousErrors = specTestsGate({ checks: check.checks, files, manual, syntaxErrors, before });
    write(path.join(dir, `spec-tests-gate-${round}.log`), previousErrors.length ? previousErrors.join("\n") : "pass\n");
    if (previousErrors.length) {
      const text = `Spec tests gate round ${round}: ${previousErrors.join("\n")}`;
      console.error(text);
      emit({ type: "notice", text });
      if (round === 3) exit(`spec tests rejected after three rounds:\n${previousErrors.join("\n")}`, 1);
      continue;
    }
    // --only excludes unrelated index entries, including ignored .agent noise.
    git(work, "add", "--", testRel);
    git(work, "commit", "--only", "-m", `spec tests: SPEC-${spec.id} (written by ${testWriter})`, "--", testRel);
    write(specTestsPath, JSON.stringify({ writer: testWriter, rounds: round,
      files: before.map(({ file, passed }) => ({ file, before: passed ? "pass" : "fail" })),
      manual: manualEntries(manual) }, null, 2));
    break;
  }
}
// run-plan protects tests after planning. Preserve the tests-only baseline
// around planner calls too, including a planner that stages a test edit.
const frozenSpecTests = metadata.specTests === "generated" ? git(work, "rev-parse", "HEAD") : null;
function restoreFrozenSpecTests() {
  if (!frozenSpecTests) return;
  git(work, "restore", `--source=${frozenSpecTests}`, "--staged", "--worktree", "--", testRel);
  git(work, "clean", "-fd", "--", testRel);
}
restoreFrozenSpecTests();
const workPlan = path.join(work, planRel, "plan.json");
stage("plan");
if (!fs.existsSync(workPlan)) {
  const created = await pi(work, planner, levels.planner, planPrompt({ spec: specRel, planDir: planRel, checks: check.checks, harnessRoot }),
    path.join(dir, "planner.log"), path.join(dir, "planner-telemetry.db"));
  restoreFrozenSpecTests();
  if (created.code !== 0) exit(`planning failed: ${created.output}`);
}
stage("gate");
let gate = "";
for (let repair = 0; repair <= 2; repair++) {
  const errors = [];
  let plan;
  try {
    if (countVerifyChecks(read(path.join(work, specRel))) !== check.checks) errors.push("verification count changed");
    plan = JSON.parse(read(workPlan));
    if (plan.spec !== specRel) errors.push(`plan.spec must be ${specRel}`);
    const checked = validatePlan(plan, check.checks);
    errors.push(...checked.errors);
    for (const testFile of filesIn(path.join(work, planRel), planRel).filter((file) => /\.test\.(ts|mts|js|mjs)$|(?:^|\/)test_[^/]*\.py$/.test(file))) {
      const owner = plan.tasks.find((task) => task.acceptanceTest === testFile);
      const declared = owner?.interfaces || plan.tasks.flatMap((task) => task.interfaces || []);
      const missing = undeclaredImports(read(path.join(work, testFile)), declared);
      if (missing.length) errors.push(`${testFile}: undeclaredImports ${missing.join(", ")}`);
    }
    for (const task of plan.tasks) {
      if (task.assignee !== "luna") continue;
      const file = path.join(work, task.acceptanceTest || "");
      if (!task.acceptanceTest || !fs.existsSync(file)) { errors.push(`${task.id}: missing acceptance test`); continue; }
      const undeclared = undeclaredImports(read(file), task.interfaces || []);
      if (undeclared.length) errors.push(`${task.id}: undeclaredImports ${undeclared.join(", ")}`);
      const result = await tests(work, [task.acceptanceTest], pythonProject);
      if (result.code === 0) errors.push(`${task.id}: acceptance test already passes`);
      if (/no recognized test files/.test(result.output)) errors.push(`${task.id}: ${result.output}`);
    }
  } catch (err) { errors.push(String(err)); }
  if (!errors.length) { gate = "pass"; emit({ type: "notice", text: `Plan gate round ${repair + 1}: pass` }); break; }
  gate = errors.join("\n");
  emit({ type: "notice", text: `Plan gate round ${repair + 1}: ${gate}` });
  write(path.join(dir, `gate-${repair}.log`), gate);
  if (!gateRepairable(errors)) exit(`The run's spec differs from the one preflight read (verification count changed). Commit the spec and tests and start a new run.\n${gate}`);
  if (repair === 2) exit(`plan gate failed after two repairs:\n${gate}`);
  const fixed = await pi(work, planner, levels.planner, `Repair the plan and its acceptance tests only. Gate errors:\n${gate}\nDo not implement tasks.`,
    path.join(dir, `repair-${repair + 1}.log`), path.join(dir, `repair-${repair + 1}-telemetry.db`));
  restoreFrozenSpecTests();
  if (fixed.code !== 0) exit(`plan repair failed: ${fixed.output}`);
}
restoreFrozenSpecTests();
git(work, "add", "--", planRel);
if (git(work, "diff", "--cached", "--name-only")) git(work, "commit", "-m", `plan: SPEC-${spec.id}`);
write(path.join(dir, "gate.json"), JSON.stringify({ result: gate, checks: check.checks }, null, 2));
if (flags.has("--plan-only")) {
  const text = `${branch} ${workPlan}: plan gate passed`;
  if (progress) process.stderr.write(`${text}\n`);
  else console.log(text);
  finish(true, text, { branch });
  process.exit(0);
}
// The runner owns task and integration stages; its JSONL stream is forwarded as received.
const runner = await streamed(process.execPath, ["--experimental-strip-types", path.join(harnessRoot, "scripts/run-plan.mjs"),
  "--plan", workPlan, "--run-dir", dir, "--repo", work, "--python-project", pythonProject ?? "", "--progress", "json",
  ...(flags.has("--resume") ? ["--resume"] : [])], work,
  { log: path.join(dir, "runner.log"), forward: true });
interrupted();
if (runner.code === 75) exit(`quota hold: bin/pi-implement ${resumeQuery} --resume`, 75);
if (runner.code === 130) exit("Interrupted; run directory and worktree retained for --resume", 130);
if (runner.code !== 0) exit(`runner failed (${runner.code}): ${runner.output}`);
stage("grade");
const nested = path.join(dir, "work");
const gradePath = path.join(dir, "grade.json");
const grade = JSON.parse(read(gradePath));
if (grade.specTests.code !== 0 || grade.planTests.code !== 0 || grade.typecheck.code > 0) {
  exit(`final grade failed; worktree retained at ${nested}: ${JSON.stringify(grade)}`);
}
const resultRows = fs.existsSync(path.join(dir, "results.jsonl")) ? read(path.join(dir, "results.jsonl")).trim().split("\n").filter(Boolean).map(JSON.parse) : [];
const protectedDiff = fs.existsSync(path.join(dir, "protected-edits.diff")) ? read(path.join(dir, "protected-edits.diff")) : "";
stage("handoff");
// The runner commits in its detached worktree. Fast-forward only our review branch.
const finished = git(nested, "rev-parse", "HEAD");
// Planning sessions can generate local walkthroughs on this worktree. They are
// not part of the plan commit and must not block the fast-forward handoff.
if (fs.existsSync(work) && fs.existsSync(path.join(work, ".agent"))) {
  if (git(work, "ls-files", "--", ".agent")) git(work, "restore", "--worktree", "--", ".agent");
  git(work, "clean", "-fd", "--", ".agent");
}
git(work, "merge", "--ff-only", finished);
const report = path.join(dir, "report.md");
if (!fs.existsSync(report)) exit(`integration did not write ${report}`);
const branchReport = path.join(work, planRel, "report.md");
write(branchReport, read(report));
const runRecord = path.join(work, "docs/specs", paths.runRecord);
const costs = runCosts(dir);
const specTestsRecord = fs.existsSync(specTestsPath) ? JSON.parse(read(specTestsPath)) : null;
const specTestsLine = specTestsRecord
  ? `Spec tests: written by ${specTestsRecord.writer} before planning; see spec-tests.json in ${dir}`
  : "Spec tests: supplied with the spec";
const record = `# SPEC-${spec.id} run\n\nImplemented by: pi pipeline\n\nBranch: ${branch}\nPlan: ${planRel}; gate: ${gate}; checks: ${check.checks}\n${specTestsLine}\n\n` +
  `## Tasks\n${resultRows.map((row) => `- ${row.id}: ${row.acceptance}; model ${row.model}; rounds ${row.rounds}; cost $${row.providerCost}`).join("\n")}\n\n` +
  `## Final grade\n\n\`\`\`json\n${JSON.stringify(grade, null, 2)}\n\`\`\`\n\n` +
  `## Runtime\nStuck findings, escalations and pauses: see task session logs and telemetry in ${dir}.\n` +
  `Provider cost by role: planner $${costs.planner}; editor $${costs.editor}; integration $${costs.integration}; other $${costs.other}; total $${costs.total}. Planner: ${JSON.stringify(usage(path.join(dir, "planner-telemetry.db")))}. Quota deltas: see usage snapshots in telemetry.\n\n` +
  `## Protected files diff\n\n\`\`\`diff\n${protectedDiff}\n\`\`\`\n\n## Report\n${read(report)}\n`;
write(runRecord, record);
const indexPath = path.join(work, "docs/specs/index.md");
const specPath = path.join(work, specRel);
const handoffFiles = [path.relative(work, runRecord), path.relative(work, branchReport)];
try {
  const implemented = markImplemented(read(indexPath), read(specPath), spec.id, "pi pipeline");
  write(indexPath, implemented.index);
  write(specPath, implemented.spec);
  handoffFiles.push(specRel, "docs/specs/index.md");
} catch (err) {
  const notice = `index not updated: ${err instanceof Error ? err.message : String(err)}`;
  console.error(notice);
  emit({ type: "notice", text: notice });
  fs.appendFileSync(runRecord, `\n## Index\n\n${notice}\n`);
}
git(work, "add", "--", ...handoffFiles);
git(work, "commit", "-m", `pipeline: record SPEC-${spec.id} run`);
git(target, "worktree", "remove", "--force", nested);
git(target, "worktree", "remove", "--force", work);
stage("land");
const landing = typeof metadata.base === "string" && (typeof metadata.baseBranch === "string" || metadata.baseBranch === null)
  ? landReviewBranch({ target, branch, base: metadata.base, baseBranch: metadata.baseBranch, enabled: settings.pipeline?.land !== false })
  : { landed: false, reason: "Landing skipped: no recorded base/baseBranch metadata in this legacy run" };
const summary = `${landing.landed ? `Landed on ${landing.onto}` : `Handed off on ${branch}`} ${paths.runRecord} — ${landing.reason}; spec pass, plan pass`;
if (!progress) console.log(summary);
finish(true, summary, { ...(landing.landed ? { landed: landing.onto } : { branch }), runRecord: path.join("docs/specs", paths.runRecord) });

```

