File: /docs/specs/SPEC-NNNN-run-implement-spec-from-any-repo.md
# SPEC-0018: Run implement_spec against any repository

| Field | Value |
|---|---|
| Status | ready |
| Size | M |
| Kind | fix |
| Parent | SPEC-0015 |
| Date | 2026-10-15 |

Read `/.agents/notes/index.md` if present. Record the revision you start from and any pre-existing uncommitted changes; don't fold unrelated work into this change. Take the next free `SPEC-NNNN` ID from `/docs/specs/index.md` and rename this file to match.

## 1. Intent

The delegated pipeline (Sol plans at high, Luna implements each task at medium, Sol integrates at high) is the intended route for spec work in every project, not only in pi-build. Today it only works when the target is pi-build itself. Calling `implement_spec` for SPEC-00B1 from a pi session in another repository returned "No pipeline runner found above this checkout." The session then implemented the spec inline with Sol at medium, with no plan gate, no Luna and no per-task grading.

Two causes, both fixed here:

- **Location.** As SPEC-0015 specified it, the tool spawns `<repo root of ctx.cwd>/bin/pi-implement`. That conflates *where the harness lives* (pi-build) with *which repository is the target* (the session's repo). The runner also assumes the target is pi-build: spec resolution, preflight, branch, worktree, test commands and `pipeline.pythonProject` (default `tools/map`).
- **Fallback.** The tool's error gave the model nothing to act on, so it continued inline. That silently swaps the chosen route for the expensive one. A failed `implement_spec` must stop and report, not degrade.

Agreed decisions:
- The harness root comes from the extension's own file, not from the session's working directory. The session's repository is the target.
- Target-specific test settings live in the target repository. pi-build's host setting stays its own default.
- Spec IDs need not be all digits (`00B1`).
- The tool's failure text tells the model not to implement inline. This goes in the tool's result and description only, never in a guideline field that renders into every session's system rules. (A stray `"Do not commit."` guideline did exactly that before and broke a run.)

Required outcomes:
- O1: From a pi session whose working directory is anywhere inside a git repository with `/docs/specs/`, `implement_spec` runs the pipeline against that repository. The spec, preflight, branch, worktree, tests and run record all belong to the target; the runner and harness code come from pi-build. `bin/pi-implement --repo <path>` does the same from a terminal.
- O2: With pi-build as the target, behaviour is unchanged. That covers terminal use without `--repo`, `--dry-run` output, run-directory paths, and `--resume` of runs started before this change.
- O3: `resolveSpec` accepts alphanumeric IDs (`00B1`, `SPEC-00B1`, any case) alongside the forms it accepts today.
- O4: Every `implement_spec` result that is not a hand-off says to report to the user and not implement the spec with other tools. The tool is registered with `direct` exposure.

## 2. Priority

This blocks the delegated route for every project except pi-build, and its failure mode is silent: the work still gets done, at the wrong cost and without grading. Deferred:
- A `/implement <spec>` command that calls the runner without a model choosing the tool. Revisit if O4 doesn't stop inline bypasses in practice.
- Landing on `main` automatically after a passing final grade. Separate decision.

## 3. Prior art

- Host-provided plugin root versus project working directory is the established split. Claude Code plugins get `${CLAUDE_PLUGIN_ROOT}` for their own files and run against the project cwd; `git -C <path>` and `npm --prefix <path>` take the target as an argument. This spec adopts both halves: a harness root derived from the extension module, and an explicit `--repo` target.
- pi loads local TypeScript extensions through `jiti` (pi docs, Extensions). jiti provides `import.meta.url` as the module's file URL, which is how the extension finds its own location. pi's `ExtensionContext` exposes no extension path. Verify the jiti behaviour at step 0 (§4).
- pi tool exposure defaults to `direct` (pi docs, Extensions). Set it explicitly anyway, so a later default change can't hide the tool behind tool search.

## 4. Grounding

| Fact | Expected | Tag | Source |
|---|---|---|---|
| How `extensions/pipeline.ts` finds the runner | repository root of `ctx.cwd` + `/bin/pi-implement`; error "No pipeline runner found above this checkout" when absent | in-context | SPEC-0015 §6; Lucas's report |
| The failing session's working directory | a repository other than pi-build | derived | `00B1` is not pi-build's numbering; confirm with Lucas if unclear, record either way |
| `import.meta.url` inside an extension loaded by pi | `file://` URL of the extension's real file | agent-verify | pi loads extensions with jiti |
| Extensions reached through a symlink | `~/.pi/agent/settings.json` is a symlink into the working tree; the extension path may be symlinked too | in-context | earlier audit |
| `resolveSpec` ID pattern | digits only; `14` → `SPEC-0014` | agent-verify | `lib/specs.ts` |
| `implement_spec` exposure | unset (default `direct`) | agent-verify | `extensions/pipeline.ts` |
| Where the "no inline" text could go | tool result text and `description`; any `promptGuidelines`-style field renders into every session's rules | in-context | the `"Do not commit."` incident |
| `pipeline.pythonProject` | host setting, default `tools/map` | in-context | SPEC-0010 |
| Run directory | `~/var/pipeline-runs/SPEC-<id>-<slug>/<stamp>` | in-context | SPEC-0010 |
| Worktree location and branch name | branch `pipeline/SPEC-<id>-<slug>-<stamp>` at `HEAD`; worktree path agent-verify | in-context / agent-verify | SPEC-0010 |
| Child pi sessions in a new worktree of another repo | start without an interactive project-trust prompt, in JSON mode | agent-verify | pi project trust; not documented for JSON mode |
| Every place the runner reads the target | spec dir, `git status`, branch, worktree, plan dir, test commands, final grade, run record, `--resume` lookup | agent-verify | `bin/pi-implement`, `lib/pipeline.ts`, `lib/specs.ts` |

Step 0: before editing, verify every row that describes repo or environment state (whatever its tag) and report expected vs actual. Then:
- Capture the V5 baseline (§8).
- Reproduce the failure. Make a throwaway git repo outside pi-build with `/docs/specs/SPEC-00B1-demo.md`, start `pi` there, and ask it to call `implement_spec` with `planOnly` for `00B1`. Record the result text. If `implement_spec` succeeds there already, stop and report.
- For the child-trust row, start a child the way the runner does, in a worktree of that throwaway repo with a `.pi/` directory present, and see whether it blocks on trust. Use the cheapest command that loads project resources and makes no model call. If it blocks and pi offers no non-interactive way past it, stop and report; that changes the design.

If a contradiction changes the design, outcomes, scope or verification, stop and report. Otherwise record it and continue.

## 5. Scope

In: harness-root location in the tool; a `--repo` target in the runner, threaded through every target-scoped read and write; per-target Python test settings; alphanumeric spec IDs; non-hand-off result text; explicit `direct` exposure.

Out: a `/implement` command; auto-landing on `main`; changes to the plan prompt, the plan gate, model or thinking choices, quota gating, or the progress protocol; migrating other repositories' spec IDs.

## 6. Changes

### 6.1 Harness root and target in the tool
Outcomes: O1, O2. Where: `extensions/pipeline.ts` (agent confirms).

Change:
- Resolve the harness root once, at extension load. Start at `realpath(fileURLToPath(import.meta.url))`, walk up to the first directory containing `bin/pi-implement`, and use that directory. If step 0 shows `import.meta.url` doesn't give the real file, use a host setting `pipeline.harnessRoot` instead and record the deviation.
- Resolve the target per call as `git -C <ctx.cwd> rev-parse --show-toplevel`.
- Spawn `<harnessRoot>/bin/pi-implement <spec> --repo <target> --progress [--plan-only] [--resume]`, with cwd = target, in `testEnv(process.env)` as today.

Preserve: progress streaming, abort with `SIGTERM`, the exit-code handling for 75 and 2, rendering.

Seams:
- Harness root not found: error result naming the extension path it searched from, with the §6.5 sentence.
- `ctx.cwd` not in a git repository: error result "implement_spec needs a git repository; <cwd> is not inside one", with the §6.5 sentence.
- Target has no `/docs/specs/`: the runner's error, passed through.
- The tool owns cancel (abort → `SIGTERM`). The runner owns everything inside the run.

### 6.2 `--repo` in the runner
Outcomes: O1, O2. Where: `bin/pi-implement`, `lib/pipeline.ts`, `lib/specs.ts` (agent confirms).

Change: add `--repo <path>`. Default: the git toplevel of `process.cwd()`, so terminal use from pi-build is unchanged. Split every path the runner uses into two groups:
- **Target** (from `--repo`): spec directory, `git status` for the dirty check, branch and worktree creation, the plan and acceptance-test directory, test commands, the final grade, and the run report committed on the branch.
- **Harness** (from the runner's own location): prompts and templates, host settings, the quota hold file, `lib/` code.

Run directory:
- When the target is the harness repository: `~/var/pipeline-runs/SPEC-<id>-<slug>/<stamp>`, unchanged, so existing `--resume` works.
- Otherwise: `~/var/pipeline-runs/<target-basename>/SPEC-<id>-<slug>/<stamp>`, so two repositories with the same spec ID don't collide.
- `--resume` looks up the run under the same rule.

Preserve: `--dry-run`, `--plan-only` and `--resume` semantics; exit codes; the progress line format.

`--dry-run` additionally prints the target repo and the harness root.

### 6.3 Per-target Python test settings
Outcomes: O1, O2. Where: `lib/pipeline.ts` (agent confirms).

Change: resolve `pythonProject`, first match wins:
1. `<target>/.pi/pipeline.json` → `pythonProject`, a path relative to the target.
2. If the target is the harness repository: the host setting `pipeline.pythonProject` (default `tools/map`).
3. The target root, if it contains `pyproject.toml`.
4. None.

With none:
- A Python test file among the spec's tests is a preflight blocking reason (exit 2): "Python tests but no Python project; add `.pi/pipeline.json` with `pythonProject`".
- A Python acceptance test written during the run fails grading with the same message.

Preserve: Node grading; pi-build's Python grading through `tools/map`.

### 6.4 Spec IDs
Outcomes: O3. Where: `lib/specs.ts` `resolveSpec`.

Change: a spec file is `SPEC-<ID>-<slug>.md` with `<ID>` matching `[0-9A-Za-z]+`. Input resolution:
- An existing path → that file.
- `SPEC-<x>` or `<x>` → case-insensitive exact ID match.
- A digits-only `<x>` shorter than an ID → zero-padded match (`14` → `0014`), as today.
- Otherwise slug match, as today.

More than one match is an error listing the candidates. No match is an error naming the spec directory searched.

Preserve: every input form that resolves today resolves to the same file. `scripts/pi-rework.ts` keeps working through the shared function.

### 6.5 Results that stop the model, and exposure
Outcomes: O4. Where: `extensions/pipeline.ts`.

Change: every result other than a hand-off (runner or harness root missing, not a git repo, no spec directory, spec not resolved, preflight blocked, quota hold, run failed, aborted) is `isError: true` and ends with:

> Do not implement this spec with other tools. Report this result to the user and wait for instructions.

Add the same sentence to the tool's `description`. Do not add it to a guidelines or system-prompt field. Register the tool with `exposure: "direct"` explicitly.

Preserve: hand-off results unchanged; the quota-hold result keeps its resume instructions before the new sentence.

## 7. Paths

| Path | Trigger | Planned check or justified exclusion |
|---|---|---|
| happy, other repo | session in a non-pi-build repo, `00B1` | V2, V3 |
| happy, pi-build | session in pi-build, existing spec | V5 |
| terminal, other repo | `bin/pi-implement 00B1 --repo <tmp> --dry-run` | V2 |
| harness reached via symlink | extension path is a symlink | V1 |
| session in a subdirectory | `ctx.cwd` = `<tmp>/src` | V3 |
| not a git repo | `ctx.cwd` = a plain directory | V7 |
| no `/docs/specs/` | git repo without it | V7 |
| ambiguous or unknown spec ID | two files share an ID; ID absent | V4 |
| dirty target | uncommitted change in target | V6 |
| Python tests, no Python project | spec lists a `.py` test, no config | V8 |
| same spec ID in two repos | run-directory naming | V2 (path printed by dry-run) |
| resume of a pre-change pi-build run | existing run directory | V5 (path unchanged); live resume not exercised: needs a held run |
| quota hold, preflight block, failed run, abort | exits 75, 2, nonzero, `SIGTERM` | V7 (result text); live abort not re-exercised: SPEC-0015's V9 covers it and this spec doesn't change it |
| child blocks on project trust | `.pi/` in an untrusted worktree | step 0; stop if it blocks |
| full model-driven run in another repo | real spec | not in this spec: Lucas's next real use is the acceptance |

## 8. Verification

| Outcome | Change | Check ID: falsifiable condition |
|---|---|---|
| O1 | §6.1 | V1: the harness-root function returns pi-build's root when given the extension's real path and when given a symlink to it; it returns an error when no ancestor has `bin/pi-implement` |
| O1, O3 | §6.2, §6.4 | V2: in a temp git repo outside pi-build with `/docs/specs/SPEC-00B1-demo.md` (with a `## N. Verification` table), `bin/pi-implement 00B1 --repo <tmp> --dry-run` exits 0. Its output names the spec under `<tmp>`, the target `<tmp>`, the harness root = pi-build, test commands rooted in `<tmp>`, and a run directory under `~/var/pipeline-runs/<tmp-basename>/`. Running it from inside `<tmp>` without `--repo` gives the same output |
| O1 | §6.1 | V3: the tool's invocation builder, given `ctx.cwd = <tmp>/src`, returns command `<pi-build>/bin/pi-implement`, args containing `--repo <tmp>`, and cwd `<tmp>` |
| O3 | §6.4 | V4: `resolveSpec` table test: `00B1`, `SPEC-00B1`, `spec-00b1`, a path, `14` → `SPEC-0014`, a slug, all resolve correctly; a duplicated ID errors with both candidates; an absent ID errors naming the directory |
| O2 | §6.2 | V5: for two existing pi-build specs, `bin/pi-implement <id> --dry-run` from pi-build matches the baseline captured at step 0, except for the two new lines (target, harness root) |
| O1 | §6.2 | V6: a dirty `<tmp>` makes the dry-run exit 2 with the dirty reason; a dirty pi-build does not block a `<tmp>` run |
| O4 | §6.1, §6.5 | V7: for each non-hand-off case (harness root missing, not a git repo, no spec dir, unresolved spec, exit 2, exit 75, nonzero exit, abort), the tool result has `isError: true` and ends with the §6.5 sentence; the exit-75 text still contains the resume instructions; the `description` contains the sentence; no guideline or system-prompt field changed (diff of the registration) |
| O1, O2 | §6.3 | V8: `pythonProject` resolution table test: `.pi/pipeline.json` wins; pi-build without that file → `tools/map`; other repo with `pyproject.toml` → its root; neither → none; none + a `.py` spec test → preflight exit 2 with the message |
| O4 | §6.5 | V9: the registration sets `exposure: "direct"`; in a fresh pi session in `<tmp>`, `implement_spec` appears in the declared tools (not only through tool search) |
| O1–O4 | all | V10: the full existing test suite passes |

You write and run the commands. V2, V3, V6 and V8 use temp repositories created by the test and removed afterwards; never point a check at a real repository other than pi-build. No check may make a model call.

Protected (never edit, skip or weaken to pass): every existing test file; the V5 baseline captured at step 0; SPEC-0010 and SPEC-0015.

Invariants: for any target, nothing the runner writes lands in the harness repository's working tree unless the target is the harness repository; every path the runner prints for a non-pi-build target is under that target or under `~/var/pipeline-runs/<target-basename>/`.

## 9. Stop conditions and repairs

If a check fails because of a local implementation error inside this scope, diagnose, fix and rerun the affected checks, up to three repair rounds per failed check group. Stop and report instead when:
- a step-0 contradiction changes the design, including `import.meta.url` being unusable *and* no host-setting fallback being possible, or a child session blocking on project trust;
- a seam differs from §6;
- scope would need to grow;
- a protected file seems wrong;
- an external prerequisite is missing;
- the same failure repeats without a new testable diagnosis.

Never mark an unrun check as passed.

Commit locally on the branch you were started on (`main` for a direct session, the pipeline's `pipeline/SPEC-…` branch when run through `implement_spec`), at the end of the change and at any point you'd want to roll back to. Never run `git push`, create or delete remote branches, tags, PRs or releases, or change remotes. Lucas pushes.

## 10. Report back

1. Start revision; step-0 expected vs actual, the reproduction's result text, and the child-trust finding.
2. Each V-check: command, output, pass/fail/not-run, repair rounds used.
3. O-ID → evidence; which §7 paths actually ran.
4. `git diff --stat` for the whole change, the full diff of any protected file (should be empty), and the complete changed functions with their callers.
5. Deviations from §6 with reasons; anything the spec didn't anticipate.
6. Landing row for `/docs/specs/index.md`, written as part of the local commit.

## 11. Landing

Filled from the review.
