# SPEC-0019 integration report

## Result

Implemented all Sol tasks S00, S05–S11 and integrated all four passing Luna tasks. The exact requested combined acceptance command passes **43/43**, including all 29 protected SPEC-0019 cases and 14 plan cases. All older spec suites pass. V13's final inherited-environment unit failing set is exactly the planner's baseline: one known markdown/explain assertion. Typecheck is **not run**, not passed: this worktree has no `tsconfig.json`.

No protected or plan acceptance test was edited. No real model-driven end-to-end landing was run. That and SPEC-0018's deferred absent-memory/missing-index handoff remain Lucas's next real-run acceptance. This integration checkout is detached, so changes are committed locally on its original detached history for the enclosing runner to grade and hand off; no target branch, remote, tag or release is touched here. Final implemented status is left to that enclosing graded handoff, not asserted during integration.

Run directory: `/home/george-contis/var/pipeline-runs/SPEC-0019-land-runs-and-summarize-every-exit/2026-10-15T14-16-37-622Z`.

## 1. Start, grounding and baseline (S00)

- Planner's pre-implementation revision: `d78058484227a8f49c57a2b9242dc933b04706fe`; clean tracked/untracked status. Historical evidence is in `docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.plan/planning-checks.json`.
- Integration start revision: `26f7c1098cd2f43300f40b241b27d7ece77386f9`, following the plan commit and four Luna implementation commits. Per-task `results.jsonl` reports L01–L04 acceptance pass, with no protected or out-of-scope edits.
- Pre-existing integration changes: four untracked files `.agent/recaps/2026-10-15-session-{1,2,3,4}.md`. They are excluded from this work/commit. No pre-existing tracked changes.
- `/.agents/notes/index.md` is absent. The indexed Harness setup note was opened; it is sealed and was not modified. No new queue condition fired.
- Grounding was audited by the planner before production edits. Integration reread the spec, plan, results, runner, helper implementations and test contracts. Luna's helpers already exist at integration start; runner/tool were still the baseline implementations. No design-changing contradiction was found.

| Grounding row | Expected before implementation | Actual/evidence |
|---|---|---|
| Preflight input | specText, hasTestsDir, held, dirty; optional testFiles/pythonProject | Matches planner audit. Luna added optional specPaths compatibly. Runner's shared `.trim()` would lose the first status column; fixed only raw porcelain capture. |
| Preflight reads | Target working copy | Matches runner read/test discovery; preserved. |
| Gate loop | Three attempts; repair after first two errors | Matches. Checks and repair prompts unchanged; only terminal classification inserted after gate log write. |
| exit/finish | exit calls finish(false), one done | Matches; done guard retained and summary added. |
| Metadata | branch/spec/stamp/startedAt | Matches baseline runner; base/baseBranch now added before review branch creation. |
| Handoff ending | Commit/removals then finish with branch/runRecord | Matches JSON baseline; terminal formerly bypassed finish. Both modes now finish, with landing afterward. |
| done schema | ok, optional branch/runRecord/summary | Matches baseline; Luna extended strings and stages compatibly. |
| Tool success | branch AND runRecord; plan-only error | Matches; replaced with specified landed/kept/plan-only predicates. |
| Tool description | Never writes main | Matches; replaced only obsolete promise; Sol/Luna and stop sentences retained. |
| Telemetry | inference_calls cost_usd/prompt_tokens/completion_tokens/subagent_role | Repository schema and protected SQLite fixture match. No uploaded DB was supplied for separate audit; actual fixture DB queries pass. |
| node:sqlite | Works without flag | Node v24.18.0; protected summary tests and all read-only SQLite queries pass. |
| Python zipfile | python3 on PATH | `python3 -m zipfile -h` exits 0; real local zip extraction/install tests pass. |
| Index header | ID/Title/Status/Implemented by/Date first added/Former path | Matches actual specs index and installer fixtures. |
| Old failures | None expected on Lucas's machine | Not reproduced: planner recorded one markdown assertion. It does not change this design and is not repaired here. |

### Baseline comparison

Planner baseline:

```text
node --experimental-strip-types --test tests/*.test.ts
exit 1; tests 131; pass 129; fail 1; skip 1
failure: tests/markdown.test.ts:184
  session recap predicate, explain gate, known.md, tier map
  line 191: explainAfterTurn(['a.ts'], false): false !== true
```

All older Node suites passed independently: SPEC-0005 7, 0006 39, 0009 13, 0010 42, 0011 23, 0014 11, 0015 22, 0018 26. SPEC-0014 Python 9 passed. New unimplemented SPEC-0019 was 2 pass/14 failed entries (missing modules/exports collapse file-level counts).

The first integration combined acceptance run was 29 pass/8 fail entries: missing installer, unfinished runner lifecycle/source integration and unfinished landed/plan-only/description tool behavior. These are missing Sol tasks, not regressions in Luna tasks.

The initial integration unit invocation also briefly failed `tests/quota-gate-refresh.test.ts` with `ERR_MODULE_NOT_FOUND @earendil-works/pi-tui`. It ran concurrently with the new spec suite, whose fixtures create/delete the same `node_modules` symlink. This is a test-runtime dependency lifetime issue, not a production change. Some sequential reruns passed, but it also recurred inside a parallel-file unit batch when the tool fixture's temporary symlink disappeared before another file imported pi packages. Final verification pre-provisioned the same installed-pi dependency symlink for the whole unit invocation, then removed it. Both the failing diagnostic logs and the final stabilized logs are retained; no source/test edit was made. Final inherited unit results match the planner's single markdown failure exactly. Clearing only the three pipeline-child markers (the existing testEnv policy) gives 130 pass/0 fail/1 skip, showing the markdown assertion is environment-sensitive. This environment control was performed after initial runner work, not represented as a pre-edit planner baseline.

## 2. Commands, V-checks and repairs (S11)

All commands run from the worktree. Raw output and the supplemental check source are preserved in this run's `verification/` directory. `C` below is exactly:

```sh
node --experimental-strip-types --test \
 docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.plan/landing.test.ts \
 docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.plan/preflight-gate.test.ts \
 docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.plan/progress.test.ts \
 docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.plan/summary.test.ts \
 docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.tests/install.test.ts \
 docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.tests/land.test.ts \
 docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.tests/preflight-gate.test.ts \
 docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.tests/progress-tool.test.ts \
 docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.tests/runner.test.ts \
 docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.tests/summary.test.ts
```

```text
C: exit 0; tests 43; pass 43; fail 0; skip 0
log: verification/requested-final.log
```

| Check | Command and exact exercised contract | Final output/status | Repair rounds |
|---|---|---|---|
| V1 | C, preflight-gate `uncommitted changes…`, including XY/rename/untracked ancestor boundaries | PASS | 0; Luna implementation already passed |
| V2 | C, preflight-gate `a changed verification count…` | PASS | 0; wiring completed in Sol round 1 |
| V3 | C, runner `a run whose spec and tests are uncommitted…` | PASS: exit 2, no pipeline branch/run directory/pi | 1: real-only specPaths and raw porcelain |
| V4 | C, runner `a dry run only warns…` | PASS: exit 0 and warning | 0; added full matching-path notice |
| V5 | C, runner `a committed spec passes preflight…` | PASS: metadata base/baseBranch, failed-plan summary, main unchanged | 1: metadata and finish lifecycle |
| V6 | C, land two success cases | PASS: ff, no merge commit, review deletion, unrelated edits retained | 0 |
| V7 | C, land refusal matrix | PASS: moved/switched/detached/conflict/disabled, refs unchanged | 0 |
| V8 | C, summary failed/finished/empty fixtures | PASS: gate/errors/tasks/grade/SQLite totals/report link | 0; review refinement for alphanumeric IDs tested separately |
| V9 | C, progress-tool done validation and landed rendering; plan progress expanded/compact compatibility | PASS | 0; review refinement ensures failure status dominates inconsistent landed field |
| V10 | C, progress-tool landed/kept/plan-only/failed/description fake runner cases | PASS | 1: success predicates, continuation and description |
| V11 | C, seven protected installer cases | PASS 7/7 | 1: previously missing Sol module implemented; no subsequent test-driven repair |
| V12 | C, both downloaded-zip runner cases and `.zip` parameter assertion | PASS: preview unchanged; ~/ install commit becomes run base | 1: source recognition/install/query integration |
| V13 | Commands below | Baseline-equivalent inherited units; clean units and older specs PASS | 0 production repairs; stable installed-pi dependency symlink removes fixture lifetime issue |

One initial missing-Sol-task completion round made the complete requested command pass. A subsequent source review refined failure-status precedence, alphanumeric summary IDs, propagation of child exit 130, resumable installed-ID instructions for downloaded placeholders, and Git C-quoted porcelain decoding; all checks were rerun and remain green. No failed check group used more than three repair rounds. No protected-test defect or scope growth was encountered.

### Independent plan acceptances

Each command was also run separately:

```sh
node --experimental-strip-types --test docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.plan/landing.test.ts
# exit 0; 3/3 pass
node --experimental-strip-types --test docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.plan/preflight-gate.test.ts
# exit 0; 4/4 pass
node --experimental-strip-types --test docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.plan/progress.test.ts
# exit 0; 4/4 pass
node --experimental-strip-types --test docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.plan/summary.test.ts
# exit 0; 3/3 pass
node --experimental-strip-types --test docs/specs/SPEC-0019-land-runs-and-summarize-every-exit.tests/*.ts
# exit 0; 29/29 pass (also run with pipeline markers cleared)
```

Logs: `verification/plan-*.test.ts.log` and `verification/SPEC-0019-land-runs-and-summarize-every-exit.tests.log`.

### Typecheck and syntax

```sh
if test -f tsconfig.json; then npx tsc --noEmit; else echo 'typecheck: not run — no tsconfig.json'; fi
# NOT RUN: no tsconfig.json (same conditional policy as scripts/run-plan.mjs)
node --check bin/pi-implement
# exit 0
```

No config or package was fabricated to claim a passing typecheck. See `verification/typecheck.log`.

### Regression commands

The final unit commands run with a stable link to the already-installed pi dependencies, matching the existing tool-test fixture's dependency arrangement but retaining it for the complete invocation (no install or package change):

```sh
piPackage=$(dirname "$(dirname "$(dirname "$(readlink -f "$(command -v pi)")")")")
ln -s "$piPackage/node_modules" node_modules
# Run the two unit commands below, sequentially; then:
unlink node_modules
```

Both unit commands below were run between link creation/removal. This is environment preparation, not test skipping or assertion weakening. Earlier runs without the link are in `verification/unit-fixture-race-{clean,inherited}.log`.

```sh
node --experimental-strip-types --test tests/pipeline-tool.test.ts
# exit 0; 3/3 pass; streaming/env/abort still pass
node --experimental-strip-types --test docs/specs/SPEC-0018-run-implement-spec-from-any-repo.tests/*.ts
# exit 0; 26/26 pass
node --experimental-strip-types --test docs/specs/SPEC-0015-move-to-gpt-6-1-sol-and-run-the-pipeline-from-chat.tests/*.ts
# exit 0; 22/22 pass
node --experimental-strip-types --test tests/*.test.ts
# final inherited environment: exit 1; 131 tests; 129 pass; 1 fail; 1 skip
# failing identity exactly the planner's markdown test (line 191)
env -u PI_BUILD_PIPELINE -u PI_BUILD_SUBAGENT_ROLE -u PI_BUILD_TELEMETRY_DB \
 node --experimental-strip-types --test tests/*.test.ts
# exit 0; 131 tests; 130 pass; 0 fail; 1 skip
```

For older spec suites, the same `env -u` prefix was used before each independent `node --experimental-strip-types --test docs/specs/<suite>/*.ts` command. All were rerun, not merely copied from baseline:

| Suite | Final pass/fail | Exit |
|---|---|---|
| SPEC-0005-configure-production-harness.tests | 7/0 | 0 |
| SPEC-0006-translate-specs-with-sol.tests | 39/0 | 0 |
| SPEC-0009-migrate-to-gpt6.tests | 13/0 | 0 |
| SPEC-0010-make-pi-ready-for-spec-development.tests | 42/0 | 0 |
| SPEC-0011-make-explain-a-learning-aid-again.tests | 23/0 | 0 |
| SPEC-0014-complete-the-codebase-map.tests | 11/0 | 0 |
| SPEC-0015-move-to-gpt-6-1-sol-and-run-the-pipeline-from-chat.tests | 22/0 | 0 |
| SPEC-0018-run-implement-spec-from-any-repo.tests | 26/0 | 0 |

```sh
uv run --project tools/map pytest -q docs/specs/SPEC-0014-complete-the-codebase-map.tests/test_map_views.py
# exit 0; 9 passed in 0.27s
```

Logs are `verification/SPEC-*.tests.log`, `unit-final-{inherited,clean}.log`, `spec0019-tool-regression.log`, and `map-views.log`. Raw first-run/round-1 outputs are also retained. No unrelated old failure was fixed or hidden.

### Additional hermetic lifecycle/transaction evidence

```sh
node --experimental-strip-types /tmp/spec0019-integration/supplemental.mjs
# exit 0; all 15 printed PASS groups (source copied to verification/supplemental.mjs)
# reproducible from worktree via:
node --experimental-strip-types /home/george-contis/var/pipeline-runs/SPEC-0019-land-runs-and-summarize-every-exit/2026-10-15T14-16-37-622Z/verification/supplemental.mjs
```

Output in `verification/supplemental-final.log`:

```text
PASS Git-quoted UTF-8/control paths and arrow-containing rename names
PASS plan-only JSON summary
PASS plan-only terminal summary
PASS count mismatch exits before repair
PASS child exit 75 summary and resume routes
PASS child exit 130 summary and resume routes
PASS installed placeholder hold resumes installed ID, not renumbering download
PASS SIGTERM interruption
PASS SIGINT interruption
PASS summary write failure preserves success and one done
PASS partial setup failure summary
PASS malformed resume summary
PASS install staged/unstaged isolation, remove absent tests, hook-failure rollback
PASS zip traversal refusal without target/index mutation
PASS failure status precedence and alphanumeric summary ID
```

These use temporary local git repositories and a deterministic fake `pi`, not any provider/model call. Count mismatch rewrites the fake planner's working spec and verifies exactly one fake pi invocation and no repair log. Partial setup makes the fake git refuse review-branch creation after the directory exists. Summary failure makes summary.md a directory, checking original success/exit 0 and exactly one done without summaryPath. Signal cases send actual SIGTERM/SIGINT and verify exit 130, summary, and unchanged main. Installer assertions inspect unrelated staged and unstaged versions separately, then force a rejecting pre-commit hook and verify scoped files, full index bytes and HEAD are restored.

## 3. Outcomes and §7 path coverage

| Outcome | Evidence |
|---|---|
| O1 | V1/V3/V4/V5, raw status preservation; real calls pass specPaths, dry calls warn all matches; blockers precede mkdir/branch/worktree/model. |
| O2 | V2 plus supplemental real runner/fake planner count mismatch; classification follows gate-N.log and precedes any repair call. Ordinary errors still get two repairs. |
| O3 | V5/V8/V9/V10 and supplemental plan-only both modes, hold, child interruption, actual signals, setup failure, malformed resume, write failure. Done guard set before summary attempt; errors do not replace original outcome/code. |
| O4 | V6/V7/V10 and source review: target helper invoked only after passing grade, handoff commit, both removals; legacy metadata skips helper. Full model-driven landing NOT RUN. |
| O5 | V10 plus plan-only CLI both modes: success/no stop, review worktree retained, exact tool continuation sentence. Non-planOnly malformed handoff still fails via predicate review. |
| O6 | V11/V12 plus staged/unstaged isolation, whole tests deletion, rollback and traversal checks. Installer commit intentionally advances starting branch before recording base; failed planning leaves that commit unchanged. |

§7 paths actually run: dirty real ancestor `docs/`, dirty dry preview, committed-spec failing planner; all porcelain forms in helper tests; changed-count decision and runner wiring with stub planner; successful ff with local edits; all five refusal classes; failed/landed/empty summary fixtures; done fields/renderers/invalid types; landed/kept/plan-only/failed tool fixtures; placeholder zip under docs/specs and root explicit zip; .md with siblings; revised and identical reinstall; clash/no-spec/two-spec refusal; dry and missing specs/index; zip dry runner; ~/Downloads real install into failing-planner run. Supplemental exercises add actual signal handling and transactional failure evidence.

Reviewed, not end-to-end model-exercised: real final-grade → handoff commit → remove both worktrees → landing; legacy successful resume's missing-base branch; forwarded task/integration stage tracking. Legacy metadata is never inferred from current HEAD. Internal .md stays on resolver route by realpath containment; external no-tests install is permitted but then real preflight blocks normally. Missing source files take the existing resolver route. The source-query string reaches the runner unchanged from the tool and ~/ expansion happens there.

The §8 branch-movement invariant is interpreted with §6.7's explicit O6 pre-run path-scoped install-commit exception. Otherwise only the post-grade landReviewBranch ff moves the target's checked-out branch. Review-branch handoff merges remain ff-only in review worktrees. No reset, rebase, force-ref update or merge commit was introduced. Existing forced worktree removal is unchanged and is not a force branch move.

## 4. Changes, functions and callers

Production diff relative to the planner start (includes existing Luna commits plus Sol integration):

```text
 README.md              |   2 +-
 agent/EXTENSIONS.md    |   2 +-
 bin/pi-implement       | 124 +++++++++++++----
 extensions/pipeline.ts |  17 ++-
 lib/install-spec.ts    | 365 +++++++++++++++++++++++++++++++++++++++++++++++++
 lib/pipeline.ts        |  96 +++++++++++++
 lib/progress.ts        |  25 ++--
 lib/run-summary.ts     |  99 ++++++++++++++
 8 files changed, 689 insertions(+), 41 deletions(-)
```

Integration-only production diff (against 26f7c10): eight files, 504 insertions, 40 deletions. The plan/report.md evidence copy is additional documentation, not production behavior. Literal full working/staged diff stats are appended below after source snapshots.

Protected file checks:

```sh
git diff d780584 -- 'tests/*.test.ts' ':(glob)docs/specs/*.tests/**'
# empty, 0 bytes
# Full protected diff:
```

```diff
```

```sh
git diff 26f7c10 -- ':(glob)docs/specs/SPEC-0019*.plan/*.test.ts'
# empty, 0 bytes: NO plan acceptance correction was made
git diff d780584 -- scripts/run-plan.mjs lib/plan.ts lib/specs.ts lib/quota.ts settings
# empty, 0 bytes
git diff --check
# exit 0
```

Complete changed production functions, not just diff fragments, are included in the source appendix. Caller inventory:

- `lib/pipeline.ts`: `uncommittedSpecPaths` called by `preflight` and runner dry warning; `preflight` called by runner and protected/unit/plan tests. `gateRepairable` called by runner gate and acceptance tests. `landReviewBranch` called only by runner post-grade/post-removal landing and helper tests. Interface `PreflightInput.specPaths` is optional; unchanged callers preserve old behavior.
- `lib/run-summary.ts`: `buildSummary` called by runner `finish` and summary fixtures. Its readJson/walk callbacks are local; SQLite handles are read-only/finally closed. No writes/model calls in formatter.
- `lib/progress.ts`: extended stage/done unions and STAGES; `parseProgressLine` called by runner stream forwarder, tool execute and existing run-plan progress consumers/tests. `progressSummary`/`renderProgress` called by tool updates/result renderer and tests; reduction/child translation/final text unchanged.
- `lib/install-spec.ts`: `installSpec` called by runner source handling and installer tests. Local `exists`, `snapshot`, `checkAncestors`, `equalTrees`, `replaceTree`, `textTree`, `sourceTree`, `cells`, `errorText`, and Python EXTRACT string support that entry point only. `listSpecs` is reused unchanged. Path-scoped commit uses a private index while holding/restoring the original index and scoped snapshots on pre-commit failure; unrelated staged content is not committed.
- `bin/pi-implement`: top-level source/install, preflight, metadata/setup, gate, plan-only and successful landing callers; `finish` used by dry preview, plan-only, handoff and `exit`; `exit` used by validation/failure/hold handlers and uncaught errors; `interrupt` handles SIGTERM/SIGINT; `interrupted` called after child operations; `stage` called locally and by forwarded stage events; `streamed` called by tests, pi and run-plan invocation; `pi` called by planner/ordinary gate repair. All complete runner code appears below to include its top-level callers. Existing run-record/report construction is unchanged.
- `extensions/pipeline.ts`: `pipelineExtension` is loaded by pi and tool fixtures; registered `execute` invoked by the harness. Only completion predicates/text/schema descriptions changed, preserving factory/ownership/env/abort/spawn/render APIs. renderers call progress helpers as before.
- README Developing with pi paragraph and agent/EXTENSIONS.md Pipeline tool subsection only; no other documentation prose changed.

## 5. Deviations and unanticipated seams

1. No specification or plan acceptance test edit. No weakened check, skipped test, planner/gate check change, model/thinking/quota change, new extension or production dependency.
2. Raw porcelain must not use the existing trimmed git helper; the separate raw capture prevents first-line unstaged changes being missed. Review also found Git C-quotes test paths containing spaces/control/UTF-8 bytes; the helper now decodes them and locates rename arrows outside quotes. An additional actual-Git-status check covers those names so O1 really covers every tests descendant.
3. Continuation instructions use the resolved installed ID after source installation, not the original SPEC-NNNN download path (which would allocate another ID). The original caller string remains unchanged for installation/diagnostics. A downloaded-placeholder hold check verifies this resumable route. Install/land stages were added to the progress stage union to keep the actual runner events valid. Terminal run-plan invocation also requests its existing JSON stream so stage tracking works in terminal mode without changing run-plan.mjs. Only entrypoint stdout events are emitted externally in progress mode.
4. Safe summaries cover malformed resumes and partial fresh setup by recording the directory before fallible setup work. Added SIGINT alongside existing SIGTERM and propagated child 130 for resumable outcomes.
5. Existing grammar accepts alphanumeric IDs, so summary ID extraction now follows that grammar; inconsistent failed done+landed data still says Failed. These small review refinements were tested without editing acceptance tests.
6. Installer validation conservatively rejects selected symlinks, nested Git metadata, unsafe archive names and nonregular destinations; scratch is removed in finally. Ordinary refusals happen before mutation; commit failures roll back scoped files/index without resetting any ref. After a successfully committed transaction, a later exceptional metadata-read failure propagates rather than attempting an illegal ref rollback.
7. O6 explicitly requires a local starting-branch commit before pipeline setup. This necessary exception to the broad invariant is limited to the installed spec/tests/index paths. The run base is captured afterward.
8. No standalone tsc project exists. Not run is reported honestly. No package/config or out-of-scope file was added to manufacture typecheck success.
9. Inherited integration markers alter explain behavior; the one known markdown failure remains unchanged. The transient fixture dependency lifetime issue is documented; final baseline-equivalent verification with a stable installed-pi dependency link passed all other units. The temporary link was removed afterward. No quota/router/test edit was made to hide it.
10. Full model-driven external run/landing and SPEC-0018 absent-memory/index handoff are intentionally not run. This report does not claim their acceptance. Integration is on an existing detached pipeline worktree, not a human checked-out branch; own work is committed locally there, without pushing or rewriting earlier commits. The installer module was delegated to a Sol-model code helper; parent reviewed it and ran all tests because that helper had no execution tool.

## Source appendix — complete changed functions and runner callers

The following are snapshots of the integrated source at verification time. These are evidence, not new runtime modules.

### `lib/pipeline.ts`

```typescript
export interface PreflightInput {
  specPaths?: { spec: string; tests: string };
  specText: string;
  hasTestsDir: boolean;
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

export function uncommittedSpecPaths(dirty: string[], paths: { spec: string; tests: string }): string[] {
  const matches: string[] = [];
  for (const line of dirty) {
    const status = line.slice(0, 2);
    const rawPath = line.slice(3);
    let destination = 0;
    if (status.includes("R")) {
      let quoted = false;
      for (let i = 0; i < rawPath.length; i++) {
        if (quoted && rawPath[i] === "\\") { i++; continue; }
        if (rawPath[i] === '"') quoted = !quoted;
        else if (!quoted && rawPath.startsWith(" -> ", i)) destination = i + 4;
      }
    }
    let path = rawPath.slice(destination);
    // Git C-quotes paths with spaces/control characters, and may octal-escape
    // UTF-8 bytes. Decode before checking the tests-directory boundary.
    if (path.startsWith('"') && path.endsWith('"')) {
      const chunks: Buffer[] = [];
      const escapes: Record<string, string> = { a: "\u0007", b: "\b", t: "\t", n: "\n", v: "\v", f: "\f", r: "\r" };
      for (const part of path.slice(1, -1).matchAll(/\\([0-7]{1,3}|.)|([^\\]+)/g)) {
        chunks.push(part[2] !== undefined ? Buffer.from(part[2]) : /^[0-7]+$/.test(part[1])
          ? Buffer.from([parseInt(part[1], 8)]) : Buffer.from(escapes[part[1]] ?? part[1]));
      }
      path = Buffer.concat(chunks).toString("utf8");
    }
    const exact = path === paths.spec || path === paths.tests || path === `${paths.tests}/`;
    const descendant = path.startsWith(`${paths.tests}/`);
    const untrackedDirectory = status === "??" && path.endsWith("/") &&
      (paths.spec.startsWith(path) || paths.tests.startsWith(path));
    if (exact || descendant || untrackedDirectory) matches.push(path);
  }
  return matches;
}

export function gateRepairable(errors: string[]): boolean {
  return !errors.includes("verification count changed");
}

export function landReviewBranch(input: {
  target: string;
  branch: string;
  base: string;
  baseBranch: string | null;
  enabled: boolean;
}): { landed: boolean; onto?: string; reason: string } {
  if (!input.enabled) return { landed: false, reason: "Landing disabled" };
  if (input.baseBranch === null) return { landed: false, reason: "Base branch is detached" };

  let currentBranch: string | null;
  let currentBase: string;
  try {
    currentBranch = execFileSync("git", ["-C", input.target, "symbolic-ref", "--short", "-q", "HEAD"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }).trim() || null;
  } catch (error) {
    if ((error as { status?: number }).status === 1) currentBranch = null;
    else return { landed: false, reason: "Unable to read target HEAD state" };
  }
  if (currentBranch !== input.baseBranch) {
    return { landed: false, reason: `Target is on ${currentBranch ?? "detached HEAD"}, not ${input.baseBranch}` };
  }
  try {
    currentBase = execFileSync("git", ["-C", input.target, "rev-parse", input.baseBranch], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return { landed: false, reason: "Unable to read target base state" };
  }
  if (currentBase !== input.base) return { landed: false, reason: "Base branch moved" };

  try {
    execFileSync("git", ["-C", input.target, "merge", "--ff-only", input.branch], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = (error as { stderr?: Buffer | string }).stderr;
    const firstErrorLine = (Buffer.isBuffer(stderr) ? stderr.toString("utf8") : String(stderr ?? ""))
      .split(/\r?\n/).find((line) => line.trim().length > 0) ?? "git merge failed";
    return { landed: false, reason: `fast-forward failed: ${firstErrorLine}` };
  }
  try {
    execFileSync("git", ["-C", input.target, "branch", "-d", input.branch], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
  } catch { /* landing succeeded; branch cleanup is best-effort */ }
  return { landed: true, onto: input.baseBranch, reason: `Successfully landed on ${input.baseBranch}` };
}

// Everything that must hold before the first model call.
export function preflight(input: PreflightInput): Preflight {
  const blocking: string[] = [];
  const warnings: string[] = [];
  let checks: number | null = null;
  try {
    checks = countVerifyChecks(input.specText);
  } catch (err) {
    blocking.push(`spec: ${(err as Error).message}`);
  }
  if (!input.hasTestsDir) blocking.push("spec has no .tests/ directory: the pipeline grades against the spec's tests");
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

### `lib/run-summary.ts`

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

### `lib/install-spec.ts`

```typescript
// Install a downloaded spec as a path-scoped, pre-run commit. Never reset a ref.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { listSpecs } from "./specs.ts";

export type InstallResult = {
  ok: true;
  id: string;
  slug: string;
  spec: string;
  tests: string | null;
  title: string;
  indexRow: string;
  committed: boolean;
  commit?: string;
} | { ok: false; error: string };

type Entry = { kind: "directory"; mode: number } | { kind: "file"; mode: number; data: Buffer };
type Tree = Map<string, Entry>;

function exists(file: string): boolean {
  try { fs.lstatSync(file); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

// Reject links rather than following even an apparently safe link: replacing a
// directory must not remove or overwrite somebody else's tree through an alias.
function snapshot(file: string): Tree {
  const tree: Tree = new Map();
  if (!exists(file)) return tree;
  const walk = (absolute: string, relative: string) => {
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Symlink is not an install path: ${absolute}`);
    const mode = stat.mode & 0o777;
    if (stat.isFile()) tree.set(relative, { kind: "file", mode, data: fs.readFileSync(absolute) });
    else if (stat.isDirectory()) {
      tree.set(relative, { kind: "directory", mode });
      for (const name of fs.readdirSync(absolute).sort()) walk(path.join(absolute, name), relative ? `${relative}/${name}` : name);
    } else throw new Error(`Not a regular file or directory: ${absolute}`);
  };
  walk(file, "");
  return tree;
}

function checkAncestors(root: string, file: string): void {
  const relative = path.relative(root, file);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Destination escapes target: ${file}`);
  }
  let current = root;
  for (const part of relative.split(path.sep).slice(0, -1)) {
    current = path.join(current, part);
    if (!exists(current)) continue;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Unsafe destination directory: ${current}`);
  }
}

function equalTrees(a: Tree, b: Tree): boolean {
  if (a.size !== b.size) return false;
  for (const [name, entry] of a) {
    const other = b.get(name);
    if (!other || entry.kind !== other.kind || entry.mode !== other.mode) return false;
    if (entry.kind === "file" && (other.kind !== "file" || !entry.data.equals(other.data))) return false;
  }
  return true;
}

function replaceTree(file: string, tree: Tree): void {
  // Unlink before writing; a regular destination file can itself be a hard link.
  fs.rmSync(file, { recursive: true, force: true });
  for (const [relative, entry] of tree) {
    const destination = relative ? path.join(file, relative) : file;
    if (entry.kind === "directory") fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
    else {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, entry.data, { mode: entry.mode });
      fs.chmodSync(destination, entry.mode);
    }
  }
  // Apply directory permissions last so read-only source directories work too.
  for (const [relative, entry] of [...tree].reverse()) {
    if (entry.kind === "directory") fs.chmodSync(relative ? path.join(file, relative) : file, entry.mode);
  }
}

function textTree(text: string, mode = 0o644): Tree {
  return new Map([["", { kind: "file", mode, data: Buffer.from(text) }]]);
}

function sourceTree(tree: Tree, id: string, placeholder: boolean): Tree {
  for (const entry of tree.values()) {
    // Preserve executable tests, but don't propagate arbitrary archive permissions.
    entry.mode = entry.kind === "directory" ? 0o755 : entry.mode & 0o111 ? 0o755 : 0o644;
    if (placeholder && entry.kind === "file") {
      const text = entry.data.toString("utf8");
      if (!text.includes("\0") && Buffer.from(text).equals(entry.data)) {
        entry.data = Buffer.from(text.replaceAll("SPEC-NNNN", `SPEC-${id}`));
      }
    }
  }
  return tree;
}

// Validate the *whole* archive before extracting anything. zipfile.extractall
// alone silently normalizes traversal names and does not reject Unix symlinks.
const EXTRACT = String.raw`
import pathlib, re, shutil, stat, sys, zipfile
root = pathlib.Path(sys.argv[2]).resolve()
with zipfile.ZipFile(sys.argv[1]) as archive:
    entries = []
    seen = set()
    for entry in archive.infolist():
        name = entry.orig_filename
        parts = name.rstrip('/').split('/')
        if (not name or '\\' in name or name.startswith('/') or re.match(r'^[A-Za-z]:', name)
                or any(p in ('', '.', '..') for p in parts) or '\x00' in name):
            raise ValueError('Unsafe zip entry: ' + repr(name))
        destination = root.joinpath(*parts)
        if not destination.is_relative_to(root):
            raise ValueError('Zip entry escapes scratch: ' + name)
        mode = entry.external_attr >> 16
        kind = stat.S_IFMT(mode)
        if kind not in (0, stat.S_IFREG, stat.S_IFDIR) or stat.S_ISLNK(mode):
            raise ValueError('Non-regular zip entry: ' + name)
        key = '/'.join(parts)
        if key in seen:
            raise ValueError('Duplicate zip entry: ' + name)
        seen.add(key)
        entries.append((entry, destination, mode))
    files = {str(dst) for entry, dst, mode in entries if not entry.is_dir()}
    for entry, dst, mode in entries:
        if any(str(parent) in files for parent in dst.parents):
            raise ValueError('File used as a zip directory: ' + entry.filename)
    for entry, dst, mode in entries:
        if entry.is_dir():
            dst.mkdir(parents=True, exist_ok=True)
        else:
            dst.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(entry) as source, dst.open('xb') as target:
                shutil.copyfileobj(source, target)
            dst.chmod(0o755 if mode & 0o111 else 0o644)
`;

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function errorText(error: unknown): string {
  const stderr = (error as { stderr?: Buffer | string })?.stderr?.toString().trim();
  return stderr || (error instanceof Error ? error.message : String(error));
}

export function installSpec(input: { target: string; source: string; today: string; dryRun?: boolean }): InstallResult {
  let scratch: string | undefined;
  let indexLock: string | undefined;
  let lockFd: number | undefined;
  let originalIndex: Buffer | undefined;
  let indexFile: string | undefined;
  let indexChanged = false;
  let committed = false;
  const changed: { file: string; before: Tree }[] = [];
  const createdDirectories: string[] = [];
  try {
    const target = fs.realpathSync(input.target);
    const gitEnvironment = { ...process.env };
    // The caller's Git context must not redirect a target install into its own
    // repository or index (for example when called from a Git hook).
    for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_PREFIX"]) delete gitEnvironment[key];
    const git = (args: string[], env?: NodeJS.ProcessEnv) => execFileSync("git", ["-C", target, ...args], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      env: { ...gitEnvironment, GIT_LITERAL_PATHSPECS: "1", ...env },
      maxBuffer: 64 * 1024 * 1024,
    });
    const root = fs.realpathSync(git(["rev-parse", "--show-toplevel"]).trim());
    if (root !== target) throw new Error("Install target must be the repository root");
    const source = path.resolve(input.source);
    const extension = path.extname(source);
    if (extension !== ".md" && extension !== ".zip") throw new Error("Source must be a .md or .zip file");
    if (!fs.lstatSync(source).isFile()) throw new Error("Source must be a regular file (not a symlink)");

    scratch = fs.mkdtempSync(path.join(os.tmpdir(), "pi-install-spec-"));
    let candidate: string;
    if (extension === ".zip") {
      const extracted = path.join(scratch, "source");
      fs.mkdirSync(extracted);
      execFileSync("python3", ["-c", EXTRACT, source, extracted], { stdio: ["ignore", "pipe", "pipe"] });
      const candidates: string[] = [];
      for (const directory of [extracted, path.join(extracted, "docs/specs")]) {
        if (!exists(directory)) continue;
        if (!fs.lstatSync(directory).isDirectory()) throw new Error(`Not a source directory: ${directory}`);
        for (const spec of listSpecs(fs.readdirSync(directory))) {
          const file = path.join(directory, spec.file);
          if (fs.lstatSync(file).isFile()) candidates.push(file);
        }
      }
      if (candidates.length !== 1) throw new Error(`Source must contain exactly one spec, found ${candidates.length}`);
      candidate = candidates[0];
    } else candidate = source;
    const selected = listSpecs([path.basename(candidate)]);
    if (selected.length !== 1) throw new Error("Source must contain exactly one SPEC-<ID>-<slug>.md (not a run record)");
    const ref = selected[0];
    const sourceTests = candidate.replace(/\.md$/, ".tests");
    if (exists(sourceTests) && !fs.lstatSync(sourceTests).isDirectory()) throw new Error("Sibling tests must be a regular directory");
    // Read every selected source file now, before any target mutation.
    const rawSpec = snapshot(candidate);
    const rawTests = snapshot(sourceTests);
    const specEntry = rawSpec.get("");
    if (specEntry?.kind !== "file") throw new Error("Spec is not a regular file");

    const specDirectory = path.join(target, "docs/specs");
    const index = path.join(specDirectory, "index.md");
    checkAncestors(target, index);
    const oldIndex = snapshot(index);
    const oldIndexEntry = oldIndex.get("");
    if (oldIndexEntry && oldIndexEntry.kind !== "file") throw new Error("Spec index is not a regular file");
    let indexText = oldIndexEntry?.kind === "file" ? oldIndexEntry.data.toString("utf8") :
      "# Specifications\n\n| ID | Title | Status | Implemented by | Date first added |\n|---|---|---|---|---|\n";
    const indexLines = indexText.split(/\r?\n/);
    const headerPosition = indexLines.findIndex((line) => line.trim().startsWith("|") && cells(line)[0] === "ID");
    if (headerPosition < 0) throw new Error("Spec index has no ID table header");
    const headers = cells(indexLines[headerPosition]);
    if (!headers.includes("Title") || !headers.includes("Status")) throw new Error("Spec index needs Title and Status columns");
    const rows = indexLines.slice(headerPosition + 1).filter((line) => line.trim().startsWith("|") && /^[0-9A-Za-z]+$/.test(cells(line)[0]));
    const existing = listSpecs(exists(specDirectory) ? fs.readdirSync(specDirectory) : []);
    let id = ref.id;
    const placeholder = id === "NNNN";
    if (placeholder) {
      let maximum = 0n;
      for (const value of [...existing.map((spec) => spec.id), ...rows.map((row) => cells(row)[0])]) {
        if (/^\d+$/.test(value) && BigInt(value) > maximum) maximum = BigInt(value);
      }
      id = (maximum + 1n).toString().padStart(4, "0");
    }
    for (const spec of existing) {
      if (spec.id.toLowerCase() === id.toLowerCase() && spec.slug !== ref.slug) {
        throw new Error(`SPEC-${id} is already used by ${spec.slug}`);
      }
    }
    const newSpec = sourceTree(rawSpec, id, placeholder);
    const newTests = sourceTree(rawTests, id, placeholder);
    const testFiles = [...newTests].filter(([, entry]) => entry.kind === "file").map(([name]) => name);
    if ([...newTests.keys()].some((name) => name.split("/").some((part) => part.toLowerCase() === ".git"))) {
      throw new Error("Tests must not contain Git repository metadata");
    }
    const text = (newSpec.get("") as Extract<Entry, { kind: "file" }>).data.toString("utf8");
    const title = text.match(/^#[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/m)?.[1]?.trim();
    if (!title) throw new Error("Spec must have an H1 title");
    const header = text.split(/^##\s/m, 1)[0];
    const status = header.match(/^\|\s*Status\s*\|\s*([^|\r\n]+)\|/mi)?.[1]?.trim() || "ready";
    const matchingRows = rows.filter((row) => cells(row)[0].toLowerCase() === id.toLowerCase());
    if (matchingRows.length > 1) throw new Error(`Index contains duplicate rows for SPEC-${id}`);
    const escapeCell = (value: string) => value.replaceAll("|", "\\|");
    const indexRow = matchingRows[0] ?? `| ${headers.map((column) => {
      if (column === "ID") return id;
      if (column === "Title") return escapeCell(title);
      if (column === "Status") return escapeCell(status);
      return column.startsWith("Date") ? input.today : "—";
    }).join(" | ")} |`;
    if (!matchingRows.length) indexText = indexText.replace(/\s*$/, "") + "\n" + indexRow + "\n";

    const stem = `docs/specs/SPEC-${id}-${ref.slug}`;
    const spec = `${stem}.md`;
    const tests = `${stem}.tests`;
    const plans = [
      { relative: spec, after: newSpec },
      { relative: tests, after: newTests },
      { relative: "docs/specs/index.md", after: textTree(indexText, oldIndexEntry?.mode ?? 0o644) },
    ].map((plan) => {
      const file = path.join(target, plan.relative);
      checkAncestors(target, file);
      const before = snapshot(file);
      const entry = before.get("");
      if (entry && entry.kind !== (plan.relative === tests ? "directory" : "file")) {
        throw new Error(`Wrong destination type: ${plan.relative}`);
      }
      return { ...plan, file, before };
    });
    const result: Extract<InstallResult, { ok: true }> = {
      ok: true, id, slug: ref.slug, spec, tests: rawTests.size ? tests : null,
      title, indexRow, committed: false,
    };
    if (input.dryRun) return result;

    // A private index keeps add/commit from sweeping unrelated staged work. Hold
    // the real index lock throughout, so restoring its original bytes on failure
    // also preserves flags, partial staging and unrelated entries exactly.
    indexFile = git(["rev-parse", "--path-format=absolute", "--git-path", "index"]).trim();
    if (exists(indexFile) && !fs.lstatSync(indexFile).isFile()) throw new Error("Git index is not a regular file");
    const lock = `${indexFile}.lock`;
    lockFd = fs.openSync(lock, "wx", 0o600);
    indexLock = lock;
    originalIndex = exists(indexFile) ? fs.readFileSync(indexFile) : undefined;
    const temporaryIndex = path.join(scratch, "index");
    if (originalIndex) fs.writeFileSync(temporaryIndex, originalIndex);
    const env = { GIT_INDEX_FILE: temporaryIndex };
    if (!originalIndex) git(["read-tree", "--empty"], env);
    const head = (() => { try { return git(["rev-parse", "--verify", "HEAD"]).trim(); } catch { return undefined; } })();
    const scope = [spec, tests, "docs/specs/index.md"];
    const stagedScope = git(["ls-files", "-z", "--", ...scope], env).split("\0").filter(Boolean);
    const trackedTests = head ? git(["ls-tree", "-r", "--name-only", head, "--", tests]).length > 0 : false;
    const paths = [spec, ...(testFiles.length || trackedTests ? [tests] : []), "docs/specs/index.md"];
    for (const directory of [path.join(target, "docs"), specDirectory]) {
      if (!exists(directory)) { fs.mkdirSync(directory); createdDirectories.push(directory); }
    }
    for (const plan of plans) {
      if (!equalTrees(plan.before, plan.after)) {
        changed.push({ file: plan.file, before: plan.before });
        replaceTree(plan.file, plan.after);
      }
    }
    // Remove old scoped entries first, including staged-only tests and staged
    // deletions, then add only files that actually exist. Empty, never-tracked
    // test directories are not valid Git pathspecs.
    if (stagedScope.length) git(["update-index", "--force-remove", "--", ...stagedScope], env);
    git(["add", "-A", "--", spec, "docs/specs/index.md", ...(testFiles.length ? [tests] : [])], env);
    const diff = git(["diff", "--cached", "--name-only", ...(head ? [head] : []), "--", ...scope], env);

    // Publish the prepared index before the commit: all fallible file writes
    // precede the ref update. Git uses the private index, so our real-index lock
    // does not interfere with its own path-scoped commit lock.
    indexChanged = true;
    fs.copyFileSync(temporaryIndex, indexFile);
    if (!diff.trim()) return result;
    const messageTitle = title.replace(new RegExp(`^SPEC-${id}\\s*[:—–-]?\\s*`, "i"), "");
    git(["commit", "-m", `Add SPEC-${id}: ${messageTitle}`, "--", ...paths], env);
    committed = true;
    result.committed = true;
    result.commit = git(["rev-parse", "HEAD"]).trim();
    return result;
  } catch (error) {
    // No ref-moving rollback. A successful commit is the transaction boundary;
    // failures before it restore only our destinations and the locked index.
    if (committed) throw error;
    const failures: string[] = [];
    for (const entry of changed.reverse()) {
      try { replaceTree(entry.file, entry.before); } catch (rollbackError) { failures.push(errorText(rollbackError)); }
    }
    for (const directory of createdDirectories.reverse()) {
      try { fs.rmdirSync(directory); } catch (rollbackError) { failures.push(errorText(rollbackError)); }
    }
    if (indexChanged && indexFile) {
      try {
        if (originalIndex) fs.writeFileSync(indexFile, originalIndex);
        else fs.rmSync(indexFile, { force: true });
      } catch (rollbackError) { failures.push(errorText(rollbackError)); }
    }
    return { ok: false, error: errorText(error) + (failures.length ? `; rollback failed: ${failures.join("; ")}` : "") };
  } finally {
    try {
      if (lockFd !== undefined) fs.closeSync(lockFd);
    } finally {
      try {
        if (indexLock) fs.rmSync(indexLock, { force: true });
      } finally {
        if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
      }
    }
  }
}
```

### `lib/progress.ts`

```typescript
// The JSONL contract between the pipeline runner and the chat tool. Child pi JSON
// events are translated here; only ProgressEvent objects go on runner stdout.
export type ProgressStage = "preflight" | "plan" | "gate" | "tasks" | "integration" | "grade" | "handoff" | "install" | "land";
export type ProgressRole = "planner" | "editor" | "integration" | "other";

export type ProgressEvent =
  | { type: "stage"; stage: ProgressStage }
  | { type: "task_start"; id: string; title: string; model: string }
  | { type: "task_end"; id: string; pass: boolean; rounds: number; cost: number; result?: string }
  | { type: "activity"; role: string; taskId?: string; tool: string; target: string }
  | { type: "usage"; role: string; taskId?: string; cost: number }
  | { type: "notice"; text: string }
  | { type: "done"; ok: boolean; branch?: string; runRecord?: string; summary?: string; landed?: string; summaryPath?: string };

export interface ProgressTask {
  id: string;
  title: string;
  model: string;
  status: "running" | "pass" | "fail";
  rounds?: number;
  cost?: number;
  result?: string;
}

export interface ProgressState {
  spec: string;
  stage: ProgressStage;
  tasks: ProgressTask[];
  current: { role?: string; taskId?: string; recent: string[] };
  cost: Record<ProgressRole | "total", number>;
  notices: string[];
  done: Extract<ProgressEvent, { type: "done" }> | null;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

const STAGES: readonly string[] = ["preflight", "plan", "gate", "tasks", "integration", "grade", "handoff", "install", "land"];

// A bad/stray stdout line must never turn into UI state.
export function parseProgressLine(line: string): ProgressEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!record(value)) return null;
  switch (value.type) {
    case "stage":
      return typeof value.stage === "string" && STAGES.includes(value.stage) ? value as ProgressEvent : null;
    case "task_start":
      return typeof value.id === "string" && typeof value.title === "string" && typeof value.model === "string"
        ? value as ProgressEvent : null;
    case "task_end":
      return typeof value.id === "string" && typeof value.pass === "boolean" && nonnegative(value.rounds) &&
        Number.isInteger(value.rounds) && nonnegative(value.cost) && optionalString(value.result)
        ? value as ProgressEvent : null;
    case "activity":
      return typeof value.role === "string" && optionalString(value.taskId) &&
        typeof value.tool === "string" && typeof value.target === "string" ? value as ProgressEvent : null;
    case "usage":
      return typeof value.role === "string" && optionalString(value.taskId) && nonnegative(value.cost)
        ? value as ProgressEvent : null;
    case "notice":
      return typeof value.text === "string" ? value as ProgressEvent : null;
    case "done":
      return typeof value.ok === "boolean" && optionalString(value.branch) &&
        optionalString(value.runRecord) && optionalString(value.summary) && optionalString(value.landed) &&
        optionalString(value.summaryPath) ? value as ProgressEvent : null;
    default:
      return null;
  }
}

function clipped(value: string): string {
  return value.length <= 80 ? value : `${value.slice(0, 79)}…`;
}

// Pi 0.99 JSON mode emits assistant messages on message_end, and extension UI
// notifications separately. Text and tool results are not activity events.
export function childEventToProgress(role: string, taskId: string | undefined, event: unknown): ProgressEvent[] {
  if (!record(event)) return [];
  if (event.type === "extension_ui_request") {
    return event.method === "notify" && typeof event.message === "string"
      ? [{ type: "notice", text: event.message }] : [];
  }
  if (event.type !== "message_end" || !record(event.message) || event.message.role !== "assistant") return [];
  const message = event.message;
  const events: ProgressEvent[] = [];
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (!record(part) || part.type !== "toolCall" || typeof part.name !== "string") continue;
      const args: Record<string, unknown> = record(part.arguments) ? part.arguments : {};
      const target = [args.path, args.file_path, args.command, args.cmd, args.url]
        .find((candidate) => typeof candidate === "string");
      events.push({ type: "activity", role, ...(taskId === undefined ? {} : { taskId }),
        tool: part.name, target: clipped(typeof target === "string" ? target : "") });
    }
  }
  if (record(message.usage) && record(message.usage.cost) && nonnegative(message.usage.cost.total)) {
    events.push({ type: "usage", role, ...(taskId === undefined ? {} : { taskId }), cost: message.usage.cost.total });
  }
  return events;
}

export function initialProgress(spec: string): ProgressState {
  return {
    spec, stage: "preflight", tasks: [], current: { recent: [] },
    cost: { planner: 0, editor: 0, integration: 0, other: 0, total: 0 },
    notices: [], done: null,
  };
}

export function reduceProgress(state: ProgressState, event: ProgressEvent): ProgressState {
  switch (event.type) {
    case "stage": return { ...state, stage: event.stage };
    case "task_start": {
      const task: ProgressTask = { id: event.id, title: event.title, model: event.model, status: "running" };
      const index = state.tasks.findIndex((entry) => entry.id === event.id);
      const tasks = [...state.tasks];
      if (index < 0) tasks.push(task);
      else tasks[index] = task;
      return { ...state, tasks, current: { ...state.current, taskId: event.id } };
    }
    case "task_end":
      return { ...state, tasks: state.tasks.map((task) => task.id === event.id
        ? { ...task, status: event.pass ? "pass" as const : "fail" as const,
          rounds: event.rounds, cost: event.cost, result: event.result } : task) };
    case "activity": {
      const line = `${event.role}${event.taskId ? ` ${event.taskId}` : ""}: ${event.tool}${event.target ? ` ${event.target}` : ""}`;
      return { ...state, current: { role: event.role, taskId: event.taskId,
        recent: [...state.current.recent, line].slice(-8) } };
    }
    case "usage": {
      const role: ProgressRole = event.role === "planner" || event.role === "editor" || event.role === "integration"
        ? event.role : "other";
      return { ...state, cost: { ...state.cost, [role]: state.cost[role] + event.cost,
        total: state.cost.total + event.cost },
        current: { ...state.current, role: event.role, taskId: event.taskId } };
    }
    case "notice": return { ...state, notices: [...state.notices, event.text] };
    case "done": return { ...state, done: event };
  }
}

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function renderProgress(state: ProgressState, expanded: boolean): string[] {
  const passed = state.tasks.filter((task) => task.status === "pass").length;
  const headline = `${state.spec} · ${state.stage} · ${passed}/${state.tasks.length} tasks · ${money(state.cost.total)}`;
  if (!expanded) {
    const latest = state.done?.summary ?? state.notices.at(-1) ?? state.current.recent.at(-1);
    const lines = latest ? [headline, latest] : [headline];
    if (state.done?.landed !== undefined) lines.push(state.done.ok ? `Landed on ${state.done.landed}` : "Failed");
    if (state.done?.summaryPath) lines.push(`Summary: ${state.done.summaryPath}`);
    return lines;
  }
  return [headline,
    ...state.tasks.map((task) => `${task.id} ${task.title} (${task.model}) — ${task.status}${task.rounds === undefined ? "" : `, ${task.rounds} rounds`}${task.result ? `: ${task.result}` : ""}`),
    ...state.current.recent,
    ...state.notices.map((notice) => `Notice: ${notice}`),
    ...(state.done ? [!state.done.ok ? "Failed" : state.done.landed !== undefined ? `Landed on ${state.done.landed}` : "Handed off",
      ...(state.done.landed === undefined && state.done.branch ? [`Branch: ${state.done.branch}`] : []),
      ...(state.done.runRecord ? [`Run record: ${state.done.runRecord}`] : []),
      ...(state.done.summaryPath ? [`Summary: ${state.done.summaryPath}`] : [])] : []),
  ];
}

export function progressSummary(state: ProgressState): string {
  const status = state.done ? (!state.done.ok ? "Failed" : state.done.landed !== undefined ? `Landed on ${state.done.landed}` : "Handed off") : `Running ${state.stage}`;
  const passed = state.tasks.filter((task) => task.status === "pass").length;
  const cost = state.cost;
  return [
    `${state.spec}: ${status} (${passed}/${state.tasks.length} tasks).`,
    state.done?.summary,
    state.done?.landed === undefined && state.done?.branch && `Branch: ${state.done.branch}`,
    state.done?.summaryPath && `Summary: ${state.done.summaryPath}`,
    state.done?.runRecord && `Run record: ${state.done.runRecord}`,
    `Cost: planner ${money(cost.planner)}, editor ${money(cost.editor)}, integration ${money(cost.integration)}, other ${money(cost.other)}, total ${money(cost.total)}.`,
  ].filter((part): part is string => typeof part === "string" && part.length > 0).join("\n");
}

// The last assistant message, not the last JSON event (often agent_end), is the
// child's final reply. Tool calls and malformed/interleaved log lines are ignored.
export function finalText(log: string): string {
  let text = "";
  for (const line of log.split(/\r?\n/)) {
    let event: unknown;
    try { event = JSON.parse(line); } catch { continue; }
    if (!record(event) || event.type !== "message_end" || !record(event.message) ||
      event.message.role !== "assistant" || !Array.isArray(event.message.content)) continue;
    const parts = event.message.content.filter((part): part is Record<string, unknown> =>
      record(part) && part.type === "text" && typeof part.text === "string");
    text = parts.map((part) => part.text).join("");
  }
  return text;
}
```

### `extensions/pipeline.ts`

```typescript
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { findHarnessRoot, implementArgs, STOP_AND_REPORT, targetRepo, testEnv } from "../lib/pipeline.ts";
import { initialProgress, parseProgressLine, progressSummary, reduceProgress, renderProgress } from "../lib/progress.ts";

export default async function pipelineExtension(pi: ExtensionAPI, options: { harnessRoot?: string } = {}): Promise<void> {
  const moduleFile = fileURLToPath(import.meta.url);
  const harness = options.harnessRoot ?? findHarnessRoot(moduleFile);
  const { Type } = await import("typebox");
  pi.registerTool({
    name: "implement_spec",
    label: "Implement spec",
    description: "Implement a spec from /docs/specs through the delegated pipeline — Sol plans, Luna implements each task, Sol integrates — streaming progress into the chat. A passing run fast-forwards the branch you started on if it has not moved; otherwise it leaves a review branch. If it fails: " + STOP_AND_REPORT,
    exposure: "direct",
    parameters: Type.Object({
      spec: Type.String({ description: "Spec ID, slug or path, or a downloaded .md or .zip to install and then run" }),
      planOnly: Type.Optional(Type.Boolean({ description: "Plan without implementing" })),
      resume: Type.Optional(Type.Boolean({ description: "Resume a held or interrupted run" })),
    }),
    async execute(_id, params, signal, onUpdate, ctx) {
      let state = initialProgress(params.spec);
      if (!harness || !existsSync(join(harness, "bin", "pi-implement"))) return {
        content: [{ type: "text" as const, text: `No pipeline runner found ${harness ? `in ${harness}` : `above ${moduleFile}`}.\n${STOP_AND_REPORT}` }],
        details: state,
        isError: true,
      };
      const target = targetRepo(ctx.cwd);
      if (!target) return {
        content: [{ type: "text" as const, text: `implement_spec needs a git repository; ${ctx.cwd} is not inside one.\n${STOP_AND_REPORT}` }],
        details: state,
        isError: true,
      };

      let stderr = "";
      let aborted = signal?.aborted ?? false;
      let spawnError: string | undefined;
      const code = await new Promise<number | null>((resolveExit) => {
        if (aborted) { resolveExit(130); return; }
        const child = spawn(join(harness, "bin", "pi-implement"), implementArgs({ ...params, repo: target }), {
          cwd: target,
          env: testEnv(process.env),
          stdio: ["ignore", "pipe", "pipe"],
        });
        let buffer = "";
        const line = (text: string) => {
          const event = parseProgressLine(text.trim());
          if (!event) return;
          state = reduceProgress(state, event);
          onUpdate?.({ content: [{ type: "text", text: progressSummary(state) }], details: state });
        };
        child.stdout.on("data", (data: Buffer) => {
          buffer += data.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const item of lines) line(item);
        });
        child.stderr.on("data", (data: Buffer) => { stderr = (stderr + data.toString()).slice(-16_384); });
        const abort = () => { aborted = true; child.kill("SIGTERM"); };
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
        child.on("error", (error) => { spawnError = error.message; });
        child.on("close", (exitCode) => {
          signal?.removeEventListener("abort", abort);
          if (buffer.trim()) line(buffer);
          resolveExit(exitCode);
        });
      });

      const handedOff = !aborted && code === 0 && state.done?.ok === true && Boolean(state.done.branch || state.done.landed) && Boolean(state.done.runRecord);
      const planned = Boolean(params.planOnly) && !aborted && code === 0 && state.done?.ok === true && Boolean(state.done.branch) && !state.done.runRecord;
      const succeeded = handedOff || planned;
      let text = progressSummary(state);
      if (planned) text += `\nPlan gate passed on \`${state.done!.branch}\`. To implement it, call implement_spec again with resume: true.`;
      if (code === 75) text += "\nHeld by the quota gate: run `bin/pi-continue`, then call again with `resume: true`";
      else if (code === 2) {
        // Preflight can fail before it has emitted a done event; preserve the runner's diagnostics.
        const reasons = state.done?.summary || stderr.trim() || "Preflight blocked.";
        if (!text.includes(reasons)) text += `\nPreflight: ${reasons}`;
      } else if (aborted) text += "\nAborted; call again with `resume: true`.";
      else if (!succeeded && (spawnError || stderr.trim())) text += `\n${spawnError ?? stderr.trim()}`;
      if (!succeeded && !state.done && code !== 2 && code !== 75 && !aborted) text += `\nRunner exited ${code ?? "without a status"} without handoff.`;
      if (!succeeded) text += `\n${STOP_AND_REPORT}`;
      return { content: [{ type: "text", text }], details: state, isError: !succeeded };
    },
    renderCall(args, theme) {
      return new Text(theme.fg("toolTitle", theme.bold("implement_spec ")) + theme.fg("accent", args.spec), 0, 0);
    },
    renderResult(result, { expanded }, theme) {
      const lines = result.details ? renderProgress(result.details, expanded) :
        result.content.filter((part) => part.type === "text").map((part) => part.text);
      if (result.isError) {
        const message = result.content.find((part) => part.type === "text");
        if (message?.type === "text") {
          for (const line of message.text.split("\n")) {
            if (!lines.some((shown) => shown.includes(line))) lines.push(line);
          }
        }
      }
      return new Text(lines.map((line) => theme.fg(result.isError ? "error" : "toolOutput", line)).join("\n"), 0, 0);
    },
  });
}
```

### `bin/pi-implement`

```typescript
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
  const cmds = testCommands(files, { pythonProject });
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
const testFiles = filesIn(path.join(target, testRel), testRel);
stage("preflight");
const check = preflight({ specText: read(path.join(target, specRel)), hasTestsDir: fs.existsSync(path.join(target, testRel)),
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
const levels = pipelineThinking(settings);
const commands = testCommands(testFiles, { pythonProject: pythonProject ?? "" });
const base = runDirBase({ runRoot: pipelineRunRoot(settings, os.homedir()), target, harnessRoot, id: spec.id, slug: spec.slug });
if (flags.has("--dry-run")) {
  const text = JSON.stringify({ spec: specRel, tests: testRel, plan: planRel, runRecord: paths.runRecord,
    checks: check.checks, planner: `${planner} at ${levels.planner}`, editor: `${editor} at ${levels.editor}`, commands,
    target, harnessRoot, runDir: base, pythonProject }, null, 2);
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
const workPlan = path.join(work, planRel, "plan.json");
const specTests = filesIn(path.join(work, testRel), testRel);
stage("plan");
if (!fs.existsSync(workPlan)) {
  const created = await pi(work, planner, levels.planner, planPrompt({ spec: specRel, planDir: planRel, checks: check.checks, harnessRoot }),
    path.join(dir, "planner.log"), path.join(dir, "planner-telemetry.db"));
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
  if (fixed.code !== 0) exit(`plan repair failed: ${fixed.output}`);
}
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
const record = `# SPEC-${spec.id} run\n\nImplemented by: pi pipeline\n\nBranch: ${branch}\nPlan: ${planRel}; gate: ${gate}; checks: ${check.checks}\n\n` +
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

## Literal diff statistics before final porcelain review and before adding the report copy

`git diff --cached --stat` (integration code/docs):

```text
 README.md              |   2 +-
 agent/EXTENSIONS.md    |   2 +-
 bin/pi-implement       | 124 +++++++++++++----
 extensions/pipeline.ts |  17 ++-
 lib/install-spec.ts    | 365 +++++++++++++++++++++++++++++++++++++++++++++++++
 lib/progress.ts        |   6 +-
 lib/run-summary.ts     |   4 +-
 7 files changed, 483 insertions(+), 37 deletions(-)
```

`git diff --stat d780584` (includes already-committed plan artifacts and Luna code):

```text
 README.md                                          |   2 +-
 agent/EXTENSIONS.md                                |   2 +-
 bin/pi-implement                                   | 124 +++++--
 .../landing.test.ts                                |  81 +++++
 .../plan.json                                      | 232 +++++++++++++
 .../planning-checks.json                           | 128 ++++++++
 .../preflight-gate.test.ts                         |  67 ++++
 .../progress.test.ts                               |  59 ++++
 .../summary.test.ts                                | 102 ++++++
 extensions/pipeline.ts                             |  17 +-
 lib/install-spec.ts                                | 365 +++++++++++++++++++++
 lib/pipeline.ts                                    |  78 +++++
 lib/progress.ts                                    |  25 +-
 lib/run-summary.ts                                 |  99 ++++++
 14 files changed, 1340 insertions(+), 41 deletions(-)
```

These statistics exclude the then-untracked report copy itself and all pre-existing session recaps.

## Final production diff statistics (after porcelain review, before report staging)

```text
 README.md              |   2 +-
 agent/EXTENSIONS.md    |   2 +-
 bin/pi-implement       | 124 +++++++++++++----
 extensions/pipeline.ts |  17 ++-
 lib/install-spec.ts    | 365 +++++++++++++++++++++++++++++++++++++++++++++++++
 lib/pipeline.ts        |  24 +++-
 lib/progress.ts        |   6 +-
 lib/run-summary.ts     |   4 +-
 8 files changed, 504 insertions(+), 40 deletions(-)
```
