# SPEC-0018: Run implement_spec against any repository

| Field | Value |
|---|---|
| Status | implemented |
| Size | M |
| Kind | fix |
| Parent | SPEC-0015 |
| Date | 2026-10-15 |

Read `/.agents/notes/index.md` if present. Record the revision you start from and any pre-existing uncommitted changes; don't fold unrelated work into this change.

## 1. Intent

The delegated pipeline (Sol plans, Luna implements each task, Sol integrates) is the intended route for spec work in every project, not only in pi-build. Today it only works when the target is pi-build itself. Calling `implement_spec` for SPEC-00B1 from a pi session in another repository returned "No pipeline runner found above …". The session then implemented the spec inline with Sol at medium, with no plan gate, no Luna and no per-task grading.

The pipeline treats "the repository the session is in" as both the harness and the target in five places:

- `extensions/pipeline.ts` `repositoryRoot` walks up from `ctx.cwd` looking for `bin/pi-implement` *and* `docs/specs`, and spawns the runner from there.
- `bin/pi-implement` sets `root` from its own location and reads the spec, `git status`, branch, worktree and tests from it.
- It also runs `scripts/run-plan.mjs` from the run's worktree, and `run-plan.mjs` sets `REPO` from its own location.
- `planPrompt` points the planner at `lib/plan.ts` relative to the target, where it doesn't exist.
- Both scripts default `pythonProject` to `tools/map`.

Two more break on other repositories:
- `lib/specs.ts` accepts only four-digit IDs (`SPEC_FILE`, `resolveSpec`, `markImplemented`).
- The handoff runs `git restore -- .agent`, which fails when the target has no `.agent`. It also calls `markImplemented`, whose throw at that point would discard a finished run's record.

Separately, a failed `implement_spec` result gave the model nothing to act on, so it continued inline. A failed `implement_spec` must stop and report, not degrade to the expensive route.

Agreed decisions:
- The harness root comes from the extension's and runner's own files. The session's repository is the target.
- Target-specific test settings live in the target. pi-build's host setting stays pi-build's default.
- Spec IDs need not be all digits.
- The "do not implement inline" sentence goes in the tool's results and description only, never in a guideline or system-prompt field. A stray `"Do not commit."` guideline did exactly that before and broke a run.
- The pipeline still requires the spec's `.tests/` directory; this spec ships one.

Required outcomes:
- O1: From a pi session anywhere inside a git repository with `/docs/specs/`, `implement_spec` runs the pipeline against that repository. Spec, preflight, branch, worktrees, tests, run record and handoff all belong to the target; runner, `run-plan.mjs`, `lib/` and settings come from pi-build. `bin/pi-implement <spec> --repo <path>` does the same from a terminal, and so does running it from inside the target without `--repo`.
- O2: With pi-build as the target, behaviour is unchanged. That covers spec resolution, `--dry-run` fields, the run directory, `--resume`, Python grading through `tools/map`, and terminal use without `--repo`. The one exception: `run-plan.mjs` runs from the harness checkout with `--repo <worktree>` instead of from the worktree's own copy.
- O3: Alphanumeric spec IDs (`00B1`, any case) resolve, list and update the index, alongside every form that resolves today.
- O4: Every `implement_spec` result other than a hand-off is an error ending with the stop-and-report sentence (§6.5). The tool is registered with `exposure: "direct"`.
- O5: A finished run is never lost to the handoff. A missing `.agent` is skipped, and an index the run can't update becomes a notice in the run record instead of a crash.

## 2. Priority

This blocks the delegated route for every project except pi-build, and its failure mode is silent. Deferred:
- A `/implement <spec>` command that bypasses the model's tool choice. Revisit if O4 doesn't stop inline bypasses in practice.
- Landing on `main` after a passing grade.
- `/docs/specs/index.md` currently repeats rows 0013–0017 at the end. That's a separate one-line cleanup; `markImplemented` would refuse those IDs, but not 0018.

## 3. Prior art

- A host-provided plugin root versus the project working directory is the established split. Claude Code plugins get `${CLAUDE_PLUGIN_ROOT}` for their own files and run against the project cwd; `git -C <path>` and `npm --prefix <path>` take the target as an argument. Adopted here: the harness root is derived from the module's own path, and the target is passed explicitly as `--repo`.
- pi loads local TypeScript extensions through jiti, which provides `import.meta.url` as the module's file URL. `ExtensionContext` exposes no extension path (pi docs, Extensions).
- pi tool exposure defaults to `direct`. Set it explicitly so a later default change can't push the tool behind tool search.

## 4. Grounding

| Fact | Expected | Tag | Source |
|---|---|---|---|
| Tool lookup | `repositoryRoot(ctx.cwd)` needs `bin/pi-implement` and `docs/specs` in one ancestor; spawns with `cwd: root` | measured | `extensions/pipeline.ts` at 4684f86 |
| Runner roots | `root = path.resolve(import.meta.dirname, "..")`; `specsDir`, `git status`, branch and worktree from `root` | measured | `bin/pi-implement` |
| run-plan invocation | `path.join(work, "scripts/run-plan.mjs")`; `REPO = path.resolve(import.meta.dirname, "..")` | measured | `bin/pi-implement`, `scripts/run-plan.mjs` |
| Plan prompt | "following the Plan interface in lib/plan.ts" (relative) | measured | `bin/pi-implement` `planPrompt` |
| Python project | `settings.pipeline?.pythonProject \|\| "tools/map"` in both scripts | measured | both scripts |
| ID format | `SPEC_FILE = /^SPEC-(\d{4})-…/`; `markImplemented` rows must match `/^\d{4}$/` | measured | `lib/specs.ts` |
| Handoff `.agent` | unconditional `git restore` and `git clean` of `.agent` | measured | `bin/pi-implement` |
| `implement_spec` exposure | unset | measured | `extensions/pipeline.ts` |
| Hermetic settings and hold | `PI_BUILD_SETTINGS`, `PI_BUILD_QUOTA_HOLD` override the defaults | measured | `lib/telemetry.ts`, `lib/quota.ts` |
| Existing tool test | `tests/pipeline-tool.test.ts` builds a fake root with `bin/pi-implement` and `docs/specs`, not a git repo, and asserts the runner's exact args and cwd | measured | that file |
| Pre-existing failing tests | 8 in the planner's environment, none in the pipeline files | agent-verify | run the suite at the start revision |
| `import.meta.url` under pi's jiti | real `file://` URL of `extensions/pipeline.ts` | agent-verify | start a pi session after the change; the tool must find the runner |
| Child pi sessions in a worktree of another repository | start in JSON mode without a project-trust prompt | agent-verify | see step 0 |

Step 0, before editing:
- Verify every row that describes repo or environment state and report expected vs actual.
- Record the set of failing tests at the start revision. That set must not grow, apart from the three `tests/pipeline-tool.test.ts` cases §6.6 updates.
- Child-trust check: make a throwaway git repository outside pi-build with a `.pi/` directory, add a worktree of it, and in that worktree run `pi --mode json --list-models` (or the cheapest command that loads project resources without a model call). Record whether it blocks on trust.

If a contradiction changes the design, outcomes, scope or verification, stop and report. A child blocking on trust with no non-interactive way past it counts. Otherwise record it and continue.

## 5. Scope

In: `lib/specs.ts`, `lib/pipeline.ts`, `extensions/pipeline.ts`, `bin/pi-implement`, `scripts/run-plan.mjs`, the three fixture edits in `tests/pipeline-tool.test.ts`, and `agent/EXTENSIONS.md` / README lines that describe the tool or the runner's arguments.

Out:
- the plan prompt's wording beyond the `lib/plan.ts` path;
- the plan gate, models, thinking levels, quota gating, the progress protocol and rendering;
- a `/implement` command;
- landing on `main`;
- the index's duplicate rows;
- other repositories' spec IDs.

## 6. Changes

The spec's tests in `/docs/specs/SPEC-0018-run-implement-spec-from-any-repo.tests/` define the interfaces below by import; they are the contract.

### 6.1 Spec IDs: `lib/specs.ts`
Outcomes: O3.

- `SPEC_FILE` accepts `SPEC-<ID>-<slug>.md` with `<ID>` matching `[0-9A-Za-z]+`. `listSpecs` still drops `SPEC-<ID>-run.md`.
- `resolveSpec(fileNames, query)` matches, case-insensitively on the ID:
  - an ID, alone or `SPEC-`-prefixed;
  - a digits-only query of at most four digits, zero-padded (`14` → `0014`);
  - a file name or path ending in one;
  - a slug.

  More than one hit is an error naming every hit. Keep the existing error texts otherwise.
- `markImplemented` matches the row whose first cell equals `id`, case-insensitively, among cells matching `^[0-9A-Za-z]+$`.

Preserve: every query that resolves today resolves to the same spec; `bin/pi-rework` unchanged.

### 6.2 Shared decisions: `lib/pipeline.ts`
Outcomes: O1, O2, O4.

Add, exactly as the tests import them:
- `STOP_AND_REPORT`: the string `"Do not implement this spec with other tools. Report this result to the user and wait for instructions."`
- `findHarnessRoot(fromPath: string): string | null`. Take the real path of `fromPath`; start from it if it's a directory, else from its directory. Walk up to the first directory containing `bin/pi-implement` and return that directory's real path. Return `null` at the filesystem root or on any error.
- `targetRepo(cwd: string): string | null`. The real path of `git -C <cwd> rev-parse --show-toplevel`, or `null` when that fails (not a repository, missing directory).
- `implementArgs({ spec, planOnly?, resume?, repo? })`. Today's array, followed by `"--repo", repo` when `repo` is given.
- `pythonProjectFor({ target, harnessRoot, settings }): string | null`. First match wins:
  1. `<target>/.pi/pipeline.json` → `pythonProject` (a non-empty string, relative to the target);
  2. when `target` and `harnessRoot` are the same real path: `settings.pipeline.pythonProject`, else `"tools/map"`;
  3. `"."` when `<target>/pyproject.toml` exists;
  4. `null`.
- `runDirBase({ runRoot, target, harnessRoot, id, slug }): string`. `<runRoot>/SPEC-<id>-<slug>` when target and harness are the same real path; otherwise `<runRoot>/<basename(target)>/SPEC-<id>-<slug>`.
- `planPrompt({ spec, planDir, checks, harnessRoot }): string`. Moved from `bin/pi-implement`, identical text except that `lib/plan.ts` becomes `<harnessRoot>/lib/plan.ts`.
- `preflight` takes optional `testFiles?: string[]` and `pythonProject?: string | null`. When a test file matches the existing Python test pattern and `pythonProject === null`, add the blocking reason `"Python tests but no Python project; add .pi/pipeline.json with pythonProject"`. With neither field given, the result is exactly what it is today.

### 6.3 The runner: `bin/pi-implement`
Outcomes: O1, O2, O5.

- The harness root is the real path of the runner's parent directory. Parse `--repo <path>`; `--repo` takes a value, like `--progress`, so it is excluded when finding the spec query. The target is `targetRepo(--repo or process.cwd())`.
  - Not a repository → exit 2: `not inside a git repository: <path>`.
  - No `<target>/docs/specs` → exit 2 naming `docs/specs` and the target. This check runs before spec resolution and preflight.
- From the **target**: spec resolution, the spec text and its `.tests/` files, `git status`, the branch, the worktree, and the final worktree removals.
- From the **harness**: settings, quota hold, `lib/`, `scripts/run-plan.mjs`.
- Compute `pythonProject` with `pythonProjectFor` and pass `testFiles` and `pythonProject` to `preflight`.
- `--dry-run` prints today's fields plus `target`, `harnessRoot`, `runDir` (the `runDirBase` value) and `pythonProject`. It prints to stdout without `--progress`, as today.
- The run directory base is `runDirBase(...)`. `--resume` looks under the same base.
- The plan prompt is `planPrompt({ …, harnessRoot })`.
- Start `<harnessRoot>/scripts/run-plan.mjs` with `--repo <work>` and `--python-project <value>` (empty string for `null`), keeping the other arguments.
- Handoff:
  - Restore and clean `.agent` only if `<work>/.agent` exists; restore only if `.agent` has tracked files.
  - Wrap `markImplemented` and its two writes. On a throw, emit a notice `index not updated: <reason>`, append `## Index` with that line to the run record, leave `index.md` and the spec out of the commit, and continue the handoff.
- Usage text gains `[--repo <path>]`.

Preserve: exit codes 0, 1, 2, 75 and 130 and their meanings; progress events; `--plan-only`; for pi-build, the dry-run fields that exist today and the run directory.

### 6.4 run-plan: `scripts/run-plan.mjs`
Outcomes: O1, O2.

`REPO` is the real path of `--repo` when given, else today's value. `pythonProject` is `--python-project`'s value when the flag is present, else today's lookup. Everything else in the file reads `REPO` already.

### 6.5 The tool: `extensions/pipeline.ts`
Outcomes: O1, O4.

- `export default async function pipelineExtension(pi, options: { harnessRoot?: string } = {})`. The harness is `options.harnessRoot ?? findHarnessRoot(fileURLToPath(import.meta.url))`, resolved once at load. `options` exists for tests. Remove `repositoryRoot`.
- Per call, in this order:
  1. Runner missing (`<harness>/bin/pi-implement` absent, or no harness) → error naming the harness path or the file searched from.
  2. `targetRepo(ctx.cwd)` is `null` → error `implement_spec needs a git repository; <cwd> is not inside one.`
  3. Otherwise spawn `<harness>/bin/pi-implement` with `implementArgs({ ...params, repo: target })` and `cwd: target`, environment `testEnv(process.env)` as today.
- Every non-hand-off result (the two above, exit 2, exit 75, other failures, abort) has `isError: true` and ends with a newline plus `STOP_AND_REPORT`. Existing text, such as the quota hold's resume instructions, comes first. Hand-off results are unchanged.
- `exposure: "direct"`. The `description` keeps its current sentence and appends `If it fails: ` + `STOP_AND_REPORT`. Add nothing to any guideline or prompt field.

### 6.6 The existing tool test: `tests/pipeline-tool.test.ts`
Outcomes: O2.

The tool's contract changed in two ways: the runner now comes from the harness, and the target must be a repository. So the fixture changes in exactly three places:
- `git init -q` the fixture root;
- pass `{ harnessRoot: root }` to `pipelineExtension`;
- the expected `args` gain `"--repo", fs.realpathSync(root)`.

Every other assertion stays.

## 7. Paths

| Path | Trigger | Planned check or justified exclusion |
|---|---|---|
| tool, other repo, from a subdirectory | `ctx.cwd = <target>/src` | V6 |
| tool, pi-build | existing tool test | V9 |
| tool, no override, real runner | other repo without `docs/specs` | V8 |
| terminal, other repo, `--repo` and from inside | dry run | V3 |
| terminal, pi-build | `15 --dry-run` | V4 |
| no `docs/specs` | dry run | V5 |
| Python tests, no project | dry run | V5 |
| harness via symlink | symlinked `extensions/` | V2 |
| not a repository; missing directory | `targetRepo`, tool | V2, V7 |
| runner missing | tool with an empty harness | V7 |
| failed, preflight-blocked, held run | fake runner exits 1, 2, 75 | V7 |
| abort | existing abort test | V9 |
| ambiguous or unknown ID | `resolveSpec` | V1 |
| run-plan `--repo` | run-dir inside `--repo` refused | V5 |
| handoff with no `.agent`; index row missing | a full run on another repo | not covered by spec tests: needs a model-driven run. Integration: add a test you write, driving the handoff block if you extract it to a function, otherwise report it as not exercised |
| child trust prompt | worktree of an untrusted repo | step 0 |
| full model-driven run elsewhere | real spec | Lucas's next real use |

## 8. Verification

| Outcome | Change | Check ID: falsifiable condition |
|---|---|---|
| O3 | §6.1 | V1: `specs.test.ts` passes: alphanumeric listing, every query form for `00B1`, every existing form for pi-build IDs, duplicate-ID and unknown-ID errors, `markImplemented` on an alphanumeric row |
| O1, O2, O4 | §6.2 | V2: `pipeline-lib.test.ts` passes: `findHarnessRoot` (direct, symlinked, none), `targetRepo` (top level, subdirectory, plain dir, missing dir), `implementArgs`, `pythonProjectFor`'s four rules, `runDirBase`, `preflight` with and without the new fields, `planPrompt`, `STOP_AND_REPORT` |
| O1 | §6.3 | V3: `runner.test.ts` "a dry run against another repository…" passes: `target`, `harnessRoot`, `spec`, `checks`, test commands and a namespaced `runDir`, identical with `--repo` and from inside the target |
| O2 | §6.3 | V4: `runner.test.ts` "a dry run on pi-build itself…" passes: target = harness = pi-build, `SPEC-0015` resolved, `runDir` directly under the run root |
| O1 | §6.3, §6.4 | V5: `runner.test.ts` passes its three refusal tests: no `docs/specs` (exit 2), Python tests without a project (exit 2, names `.pi/pipeline.json`), `run-plan.mjs --repo` refusing a run-dir inside that repo |
| O1 | §6.5 | V6: `tool.test.ts` "from a subdirectory of another repository…" passes: runner cwd = target, args end with `--repo <target>`, hand-off not an error and without `STOP_AND_REPORT` |
| O4 | §6.5 | V7: `tool.test.ts` passes its error tests: outside a repository (runner not started), runner missing, and fail / preflight / hold results, each `isError` and ending with `STOP_AND_REPORT`; hold still says `resume: true` |
| O1, O4 | §6.5 | V8: `tool.test.ts` passes "declared directly…" (`exposure` is `direct`, description carries the sentence) and "without an override…" (the real runner is found and refuses a repo without `docs/specs`) |
| O2 | §6.6 | V9: `tests/pipeline-tool.test.ts` passes with only the three §6.6 edits; its diff shows nothing else |
| O1–O5 | all | V10: the full suite's failing set equals step 0's set, minus anything this change fixed |
| O5 | §6.3 | V11: a test you write covers the handoff without `.agent` and with an index lacking the row (notice appended, handoff completes), or the report states it was not exercised and why |

Run the spec's tests with `node --experimental-strip-types --test docs/specs/SPEC-0018-run-implement-spec-from-any-repo.tests/*.ts`. They create and remove their own temp repositories, settings and hold paths, and make no model calls.

Protected (never edit, skip or weaken to pass):
- everything under `/docs/specs/SPEC-0018-run-implement-spec-from-any-repo.tests/`;
- `tests/pipeline-tool.test.ts` beyond §6.6;
- every other existing test;
- SPEC-0010 and SPEC-0015.

Invariant: for a target other than pi-build, nothing the runner writes lands in pi-build's working tree, and every path it prints is under the target or under `<runRoot>/<target-basename>/`.

## 9. Stop conditions and repairs

If a check fails because of a local implementation error inside this scope, diagnose, fix and rerun the affected checks, up to three repair rounds per failed check group. Stop and report instead when:
- a step-0 contradiction changes the design, including the trust prompt;
- a protected test seems wrong;
- scope would need to grow;
- the same failure repeats without a new testable diagnosis.

Never mark an unrun check as passed.

Commit locally on the branch you were started on. That's `main` for a direct session, or the pipeline's `pipeline/SPEC-0018-…` branch when run through `implement_spec`. Never run `git push`, create or delete remote branches, tags, PRs or releases, or change remotes; Lucas pushes.

## 10. Report back

1. Start revision; step-0 expected vs actual, the failing-test baseline, and the child-trust finding.
2. Each V-check: command, output, pass/fail/not-run, repair rounds used.
3. O-ID → evidence; which §7 paths actually ran.
4. `git diff --stat`; the full diff of `tests/pipeline-tool.test.ts` and of any other protected file (the latter should be empty); the complete changed functions with their callers.
5. Deviations from §6 with reasons; anything the spec didn't anticipate.

## 11. Landing

Filled from the review.
