# SPEC-0018 integration report

## 1. Start, grounding and baseline (S00)

- Planner/pre-edit revision: `3ff1666fa71d72ccadf238568fb83d5ef14e38da`; `git status --short` was empty. Planning commit: `25b7b67e1e6a5782e9c6d696703812b03855dbaf`.
- Integration started at `ee844ddfee90dd1fd88c35a4501179fc583678d5`, after Luna commits `8b33377` and `ee844dd`. Its only pre-existing untracked paths were `.agent/recaps/2026-10-15-session-1.md` and `.agent/recaps/2026-10-15-session-2.md`. They were not staged or committed.
- Integration commit: `415ba3550bf50b81553e58a36782074aeac28144` (`Implement SPEC-0018 harness and target integration`). Work started and remained on the pipeline's detached integration worktree, not main. The outer runner owns fast-forwarding its existing review branch. No push, remote, tag, PR, release, main landing or history rewrite occurred.
- `/.agents/notes/index.md` was absent at planning and remains absent. Opened the indexed harness note; it is sealed and was left unchanged. No queue condition fired.
- The following is the planner's **pre-edit evidence**, retained from S00's brief, not a rebaseline after Luna. Its referenced logs remain available and have been copied alongside this report where present.

| Grounding row | Expected before edits | Actual before edits / disposition |
|---|---|---|
| Tool lookup | Walk above session cwd for both runner and docs/specs | Matched: `repositoryRoot` did this and spawned there. |
| Runner roots | Location-owned spec/status/branch/worktree | Matched. |
| run-plan invocation | Worktree's scripts/run-plan.mjs; location-owned REPO | Matched. |
| Planner contract | Relative lib/plan.ts | Matched. |
| Python defaults | tools/map in both scripts | Matched. |
| Spec IDs | Four-digit regex and row match | Matched. |
| .agent handoff | Unconditional restore and clean | Matched. |
| Tool exposure | Unset | Matched. |
| Hermetic configuration | PI_BUILD_SETTINGS and PI_BUILD_QUOTA_HOLD | Both supported. |
| Existing tool fixture | Not a repository; exact args/cwd | Matched. |
| Existing Node failures | Spec anticipated eight | **Not reproduced**: 137 tests, 136 passed, zero failed, one skipped. Baseline failing identity set is `{}`. |
| Real pi/jiti import.meta.url | Real module file URL | Required post-change runtime check, not counted as a planning pass. Verified below through pi's real SDK session and jiti loader. |
| Foreign worktree trust | No interactive blocking | Cheap resource-loading command exited 0 without a trust prompt; details below. |

Measured source existed at start revision even though the spec cites older revision `4684f86`. Installed pi was `1.2.0`, while deps.txt requires `0.99.1`; this did not change design or require installation repair. No design-changing contradiction was found.

### Step-0 commands and results

```sh
env -u PI_BUILD_PIPELINE -u PI_BUILD_SUBAGENT_ROLE -u PI_BUILD_TELEMETRY_DB node --experimental-strip-types --test tests/*.test.ts
./doctor.sh --offline
./doctor.sh --project .
uv run --project tools/map pytest -q
node --experimental-strip-types --test docs/specs/SPEC-0018-run-implement-spec-from-any-repo.tests/*.ts
```

| Check | Planner result | Original output |
|---|---|---|
| Existing Node suite | exit 0; 137 tests, 136 pass, 0 fail, 1 skip (recorded measurement databases unavailable) | `/tmp/spec18-start-suite-xZdrj4.tap` |
| Offline doctor | exit 1; `FAIL: pi version 1.2.0, deps.txt wants 0.99.1` | `/tmp/spec18-baseline-offline-90g1ZK.log` |
| Project doctor | exit 0 | `/tmp/spec18-baseline-project-twv2R2.log` |
| Map pytest | exit 2 during collection; smoke fixture imports missing `map_build.smoke_double` | `/tmp/spec18-baseline-map-7pvNPZ.log` |
| New protected contract | exit 1; 19 tests, 1 pass, 18 fail before implementation | `/tmp/spec18-contract-baseline-nhnFOi.tap` |

The new-contract failures are not pre-existing-suite regressions. Module-instantiation failures before new exports exist also affect the number of runnable subtests.

**Child trust:** planner created `/tmp/spec18-trust-oVVday/repo` outside pi-build, committed `.pi/settings.json`, added worktree `/tmp/spec18-trust-oVVday/work`, and from that worktree ran:

```sh
timeout 30s env -u PI_BUILD_PIPELINE -u PI_BUILD_SUBAGENT_ROLE -u PI_BUILD_TELEMETRY_DB pi --mode json --list-models
```

Exit 0, no blocking or prompt, no model request. Stdout was empty; stderr contained the model listing. Original logs: `/tmp/spec18-trust-oVVday/{stdout,stderr}.log`. Fixture/worktree removed. This is only the allowed cheap trust/resource check, not a full child-model execution. `childPiArgs` already supplies `--approve` and was not changed.

**Planning gate:** planner recorded `countVerifyChecks = 11`, `validatePlan = { ok: true, errors: [] }`, and no undeclared imports in either Luna test. Each acceptance test was run separately before implementation with `node --experimental-strip-types --test --test-reporter=tap <test>`: spec-ids had five behavioral failures and one unchanged-numeric pass; pipeline-decisions failed module instantiation because STOP_AND_REPORT was absent. No production/protected-test edits or repair rounds occurred during planning.

## 2. Implementation and verification (S03–S09)

All Sol tasks are complete: S00 baseline preservation; S03 runner target split and guarded handoff; S04 run-plan target/configuration split; S05 tool integration; S06 exactly three fixture changes; S07 README usage; S08 extension ownership documentation; S09 verification and this external report. The outer runner copies this report to `docs/specs/SPEC-0018-run-implement-spec-from-any-repo.plan/report.md` during handoff.

Luna results from the supplied results.jsonl:

| Task | Result | Model | Rounds | Provider cost | Sol changed task file |
|---|---|---|---|---|---|
| L01-spec-identifiers | pass | gpt-6-luna | 7 | $0.00395812 | No |
| L02-shared-decisions | pass | gpt-6-luna | 7 | $0.00339184 | No |

### Commands actually run during integration

**C1 — exact user-supplied combined command:**

```sh
node "--experimental-strip-types" "--test" "docs/specs/SPEC-0018-run-implement-spec-from-any-repo.plan/pipeline-decisions.test.ts" "docs/specs/SPEC-0018-run-implement-spec-from-any-repo.plan/spec-ids.test.ts" "docs/specs/SPEC-0018-run-implement-spec-from-any-repo.tests/pipeline-lib.test.ts" "docs/specs/SPEC-0018-run-implement-spec-from-any-repo.tests/runner.test.ts" "docs/specs/SPEC-0018-run-implement-spec-from-any-repo.tests/specs.test.ts" "docs/specs/SPEC-0018-run-implement-spec-from-any-repo.tests/tool.test.ts"
```

Initially at integration entry: exit 1, 40 tests, 27 pass / 13 fail, all failures in still-unimplemented runner/tool tasks (`spec18-integration-initial.tap`). After the Sol implementation round: exit 0, 40/40 pass (`spec18-integration-acceptance.tap`). Repeated after all edits: exit 0, 40/40 pass, zero skipped (`spec18-requested-final.tap`).

**C2 — protected specification command (V1–V8):**

```sh
node --experimental-strip-types --test docs/specs/SPEC-0018-run-implement-spec-from-any-repo.tests/*.ts
```

Exit 0; 26 tests / 26 pass / 0 fail / 0 skipped (`spec18-final-spec.tap`).

**C3/C4 — each Luna acceptance test separately:**

```sh
node --experimental-strip-types --test docs/specs/SPEC-0018-run-implement-spec-from-any-repo.plan/pipeline-decisions.test.ts
node --experimental-strip-types --test docs/specs/SPEC-0018-run-implement-spec-from-any-repo.plan/spec-ids.test.ts
```

Exit 0 each: 8/8 and 6/6 passed respectively (`spec18-final-decisions.tap`, `spec18-final-ids.tap`). No plan acceptance test was edited.

**C5 — V9 fixture regression:**

```sh
node --experimental-strip-types --test tests/pipeline-tool.test.ts
```

Exit 0; 3/3 passed (`spec18-final-tool.tap`), including streaming-before-completion, clean child environment, branch/cost/run-record result, failures/hold/preflight, and SIGTERM/resume behavior.

**C6 — V10 existing repository suite, same environment clearing as step 0:**

```sh
env -u PI_BUILD_PIPELINE -u PI_BUILD_SUBAGENT_ROLE -u PI_BUILD_TELEMETRY_DB node --experimental-strip-types --test tests/*.test.ts
```

Exit 0; 137 tests, 136 passed, 0 failed, 1 skipped (`spec18-final-suite.tap`). The skipped test is `recorded sets score to the §3.6.1 verdicts`: local measurement databases are unavailable, same as step 0. Complete existing-suite failing identities: **before `{}`, after `{}`**. No added regression or transient fixture failure remains.

**C7 — run-plan thinking regression:**

```sh
node --experimental-strip-types --test tests/run-plan-thinking.test.ts
```

Exit 0; 2/2 pass (`spec18-final-thinking.tap`). Model selection/thinking logic was not edited.

**C8 — typecheck eligibility, matching run-plan's final-grade contract:**

```sh
if [ -f tsconfig.json ]; then
  env -u PI_BUILD_PIPELINE -u PI_BUILD_SUBAGENT_ROLE -u PI_BUILD_TELEMETRY_DB npx tsc --noEmit
else
  printf 'TYPECHECK NOT RUN: no tsconfig.json (runner also records code:null)\n'
fi
node --experimental-strip-types --check bin/pi-implement
node --experimental-strip-types --check scripts/run-plan.mjs
node --experimental-strip-types --check extensions/pipeline.ts
```

**Typecheck NOT RUN / not applicable:** no tsconfig.json exists in this worktree (nor a package.json TypeScript project). Did not install a compiler or claim a typecheck pass. Syntax checks all exited 0. `spec18-typecheck.log` records the explicit not-run reason; the runner's grade uses `{ code: null, out: "no tsconfig.json" }` in this case.

**C9 — additional repository check baselines rechecked:**

```sh
./doctor.sh --offline
./doctor.sh --project .
uv run --project tools/map pytest -q
```

Offline doctor still exits 1 at the exact same pi-version mismatch (`spec18-final-offline.log`). Project doctor exits 0 (`spec18-final-project.log`). Map pytest still exits 2 during collection of `tests/fixtures/pipeline-smoke/SPEC-9001-add-smoke-double.tests/test_smoke_double.py`, `ModuleNotFoundError: No module named 'map_build.smoke_double'` (`spec18-final-map.log`). These two baseline failures were **not fixed** and are not counted as successful checks. No repair rounds spent on unrelated failures.

**C10 — actual pi/jiti runtime seam, no override and no model calls:**

```sh
env -u PI_BUILD_PIPELINE -u PI_BUILD_SUBAGENT_ROLE -u PI_BUILD_TELEMETRY_DB PI_OFFLINE=1 timeout 45s node /tmp/spec18-jiti-session.mjs "$PWD"
```

Exit 0 (`spec18-jiti-session.log`). The retained probe `spec18-jiti-session.mjs` imports installed pi 1.2.0's SDK, creates a real `AgentSession` with an in-memory session manager and isolated configuration, and loads this changed extension file through `DefaultResourceLoader`/pi's **jiti file loader**, not native Node import and not an inline/override factory. No production extension was added. It binds the runtime and executes its registered implement_spec against a throwaway external git repository without docs/specs. No `session.prompt` call occurs; session messages remain empty. Observed resolved module path:

```
/home/george-contis/var/pipeline-runs/SPEC-0018-run-implement-spec-from-any-repo/2026-10-15T13-08-36-219Z/work/extensions/pipeline.ts
```

The real runner returned `no docs/specs directory in /tmp/spec18-jiti-session-TpidOA/repo`; result `isError: true`, ending with the required stop sentence. This demonstrates that jiti supplies usable module-file identity for default harness discovery. It is a real SDK session, not an interactive TUI/model-driven session; the latter remains deferred. Isolated temp files were removed. No child model request, paid run or GPU task was performed by integration.

### V-check ledger and repair rounds

| V | Command | Output / status | Repair rounds used |
|---|---|---|---|
| V1 | C2 specs.test.ts portion; C1; C4 | **PASS**: 5 protected ID cases; all six plan ID cases. Alphanumeric forms, legacy queries, ambiguity, unknown IDs, row update. | 0 |
| V2 | C2 pipeline-lib.test.ts portion; C1; C3 | **PASS**: 8 protected shared-decision cases; all eight plan shared-decision cases. | 0 |
| V3 | C2/C1 foreign-repo dry-run case | **PASS**: --repo and from-inside JSON match; target-specific paths, commands, check count and namespaced runDir. | 1 integration round addressing initially unimplemented runner |
| V4 | C2/C1 pi-build dry-run case | **PASS**: numeric 15 resolves SPEC-0015; real target=harness; unnamespaced run directory. | Same round as V3, not an additional round |
| V5 | C2/C1 runner refusal cases | **PASS**: no docs/specs and no Python project exit 2; run-plan refuses run-dir inside --repo. | Same runner round |
| V6 | C2/C1 subdirectory tool success case | **PASS**: harness runner, target cwd, appended --repo; successful result has no stop sentence. | 1 integration round addressing initially unimplemented tool |
| V7 | C2/C1 error cases | **PASS**: outside repository, absent runner, exit 1/2/75; STOP suffix and existing resume/preflight detail. | Same tool round |
| V8 | C2/C1 declaration and no-override cases; C10 separately | **PASS**: direct exposure, local description suffix, actual runner refusal; additional jiti SDK runtime evidence above. | Same tool round; 0 further repairs |
| V9 | C5, fixture diff below | **PASS**: 3 existing cases; exactly three authorized fixture locations changed. | 0 beyond planned fixture adaptation |
| V10 | C6; C9 separately | **PASS** for existing Node-suite nonregression: empty failing sets before and after. Offline doctor and map collection remain separately **FAIL (baseline unchanged)**. | 0 |
| V11 | Explicit reporting alternative, not a runtime test | **NOT EXERCISED**: absent-.agent/index-row handoff needs full completion or a new extracted public seam; plan deliberately forbids extraction and paid full run here. Reviewed implementation below, not claimed tested. | 0 |

No failing check group used more than one of the allowed three rounds. No protected-test defect, undiagnosed repeated failure or design/scope-changing contradiction occurred. There were no post-integration implementation failures to repair.

## 3. Outcomes and §7 paths

| Outcome | Evidence and limitation |
|---|---|
| O1 | C2/C1 foreign terminal dry run and target refusals; fake-harness tool subdirectory case; C10 real jiti/default discovery. Source uses target for git/spec/tests/worktrees and harness for executables/imports/settings. Full model-driven foreign task execution, grading and handoff are deferred to Lucas's next real spec. |
| O2 | C2/C1 pi-build `15 --dry-run`, C3 legacy decisions, C5 streaming/env/cost/abort fixture, C6 unchanged-suite baseline, C7 thinking. --resume base/meta/worktree logic preserved and reviewed; a full resumed run was not executed. |
| O3 | C2 protected specs cases plus C4: arbitrary alphanumeric IDs, case-folding, exact ambiguity behavior, preserved numeric queries and index formatting. |
| O4 | C2/C1 error/direct-exposure cases, C5 abort/hold, C10 default runner refusal. Every implemented non-handoff return includes STOP_AND_REPORT. Genuine handoff now additionally requires a runRecord so plan-only's branch-only done event is not mistaken for one. Spawn-error/no-done/plan-only code paths were reviewed, not separately simulated by these checks. |
| O5 | Handoff source review only: skip nonexistent .agent, restore only tracked files, catch index/spec reads/marking/writes, append notice, and commit only report/run-record paths on failure. **No dynamic absent-.agent/missing-index-row handoff proof** (V11 not exercised). |

| §7 path | Actually run / limitation |
|---|---|
| Tool foreign target from src subdirectory | Yes, C2/C1 fake runner proves cwd/argv and handoff result. |
| Tool pi-build-compatible behavior | C5 fake installation/target fixture; real pi-build terminal dry run C2. No full real pi-build tool implementation run by integration. |
| Tool no override / real runner | Yes, protected native Node test C2 and independent real pi SDK/jiti session C10, target lacks docs/specs. |
| Terminal foreign --repo and inside target | Both C2/C1, matching JSON. |
| Terminal pi-build numeric 15 | C2/C1; unchanged old fields plus specified metadata. |
| Missing docs/specs | C2/C1, C10, exit 2 before preflight/resolution. |
| Python tests but no project | C2/C1, exit 2 naming .pi/pipeline.json before any model. |
| Symlinked harness | C2 helper discovery tests and C3 file/directory/nearest-ancestor aliases; no separate symlinked full pipeline run. |
| Nonrepository/missing directory | C2/C3 targetRepo cases; outside-repo tool does not spawn. |
| Missing runner | C2/C1 fake override with empty harness; checked before target lookup. |
| Failed/preflight/held run | C2/C1 fake exits 1/2/75; C5 preserves diagnostics/resume hint. |
| Abort | C5 real SIGTERM to fake runner, resumable error. |
| Ambiguous/unknown ID | C2/C4. |
| run-plan --repo containment | C2/C1 refusal before any model/grade; passing a real target is exercised, full foreign grading is not. |
| Handoff no .agent / missing index row | **Not exercised**, V11 reporting alternative. No new handoff export or paid simulation. |
| Child trust | Planner's cheap external-worktree pi --list-models check only, recorded above. |
| Full model-driven other-repo run | **Deferred** to Lucas's next real spec; not substituted with inline implementation or counted passed. |

### O5 review details (not a passing end-to-end test)

The runner's handoff block runs only after nested grade success. Cleanup checks both work and work/.agent existence; `git ls-files -- .agent` gates restore. Untracked-only .agent is cleaned without a failing restore. Index/spec reads, markImplemented and both writes share one try/catch. Index/spec paths enter handoffFiles only **after both writes succeed**. Thus a partial first write followed by a second-write failure is not staged by this handoff; no broad add is used. The catch emits/logs `index not updated: <reason>` and appends an `## Index` section to the already-written run record. It then proceeds to stage report/record, commit, remove both target-owned worktrees and emit final branch/runRecord handoff. This assumes the pipeline's existing clean review-worktree/staging discipline; no extraction or staging/progress protocol redesign was added.

## 4. Diffs, complete changed functions and callers

The implementation diff below uses planning commit `25b7b67` as the base so it includes both Luna changes and all Sol production/test/doc changes without pretending the plan/test creation is production work. The broader start-revision diff also contains the three planner-created plan/acceptance files; it is included separately. No protected spec test, existing test other than the allowed fixture, SPEC-0010, SPEC-0015, plan gate, pi-rework, router, settings, model/thinking, quota decision or progress protocol/rendering file changed. No source file or extension was added.

Production caller map:

| Changed function / entrypoint | Callers |
|---|---|
| lib/specs.ts listSpecs | resolveSpec; scripts/pi-rework.ts listSpecs adapter (bin/pi-rework route unchanged); spec/plan/existing spec tests |
| lib/specs.ts resolveSpec | bin/pi-implement top level; scripts/pi-rework.ts resolver; spec/plan/existing spec tests |
| lib/specs.ts markImplemented | bin/pi-implement handoff; protected/plan/existing specs tests |
| lib/pipeline.ts findHarnessRoot | extensions/pipeline.ts factory; protected/plan shared-decision tests |
| lib/pipeline.ts targetRepo | extensions/pipeline.ts execute; bin/pi-implement target selection; protected/plan tests |
| lib/pipeline.ts sameIdentity (new private helper) | pythonProjectFor and runDirBase |
| lib/pipeline.ts pythonProjectFor | bin/pi-implement preflight/configuration; protected/plan tests |
| lib/pipeline.ts runDirBase | bin/pi-implement shared dry-run/new-run/resume base; protected/plan tests |
| lib/pipeline.ts planPrompt (moved) | bin/pi-implement planning child; protected/plan tests; old local function removed |
| lib/pipeline.ts implementArgs | extensions/pipeline.ts execute; protected/plan/existing pipeline tests |
| lib/pipeline.ts preflight / PreflightInput | bin/pi-implement before models; protected/plan/existing pipeline tests |
| extensions/pipeline.ts pipelineExtension and nested execute | pi extension loader; protected and existing tool fixture; real jiti SDK probe. Removed repositoryRoot's sole caller is replaced by harness discovery and targetRepo. renderCall/renderResult bodies are unchanged. |
| bin/pi-implement top-level CLI/preflight/worktree/handoff flow | extensions/pipeline.ts spawn; terminal; protected runner tests. Existing nested helpers otherwise unchanged. |
| scripts/run-plan.mjs top-level REPO/pythonProject selections | bin/pi-implement harness-owned child; direct terminal; protected containment test |
| scripts/run-plan.mjs holdStatus | task loop and integration hold check; lookup now installation-owned |
| scripts/run-plan.mjs resumeCommand | stopForHold, reached from task/integration hold paths |
| tests/pipeline-tool.test.ts fixture | all three existing test cases; only setup/override and expected args changed |

Literal complete changed-source snapshots and the complete fixture diff follow in appendices. Full runner/extension/specs sources are included where the change is a top-level executable or encloses the changed functions; unrelated helper bodies in those snapshots are not claims of additional edits.

## 5. Deviations, invariant interpretation and deferred work

1. **Installation-owned hold lookup:** §6.4's terse REPO replacement also affects holdStatus, contrary to its suggestion that everything else merely reads target REPO. Retained separate HARNESS_ROOT for `bin/pi-continue`, necessary for O1's harness-owned quota behavior in a foreign repository. No quota decisions changed.
2. **Replayable run-plan hold diagnostic:** when explicit repo/Python flags are used, resumeCommand names the harness script, absolute plan, target repo and explicit Python flag (including empty string). Otherwise the original default command string is unchanged. This keeps resumed runs from silently reverting to the harness target/tools/map; event protocol and hold/exit semantics are unchanged.
3. **Handoff recognition:** the old branch-only done predicate also classified real --plan-only completion as a handoff. Added the already-existing runRecord field to the successful predicate, without changing event protocol or rendering, to meet the explicit every-non-handoff/plan-only error requirement. The legacy fixture intentionally passes planOnly:true but emits a genuine handoff with runRecord; it still succeeds unchanged apart from the three authorized fixture locations.
4. **Printed-path invariant:** interpret §8's invariant as ownership of target artifacts, not erasure of installation identity. Explicitly required dry-run harnessRoot and planner/runner/interface executable paths necessarily identify the harness; old relative spec/test fields remain relative. Foreign writable artifacts/run directories stay target-owned/namespaced. Tests temporarily create their own dependency link as fixture setup, not runner target artifacts. No target artifact was written to pi-build by the foreign dry-run/refusal checks.
5. **Baseline contradictions:** the anticipated eight existing-suite failures were absent; used measured empty failing set. Installed pi/dependency version mismatch and map fixture collection error were retained, not repaired. These do not change design/scope.
6. **Verification limits:** no tsconfig means no typecheck pass; V11 is explicitly not exercised; full model-driven/resumed external runs and actual foreign grading remain deferred. Native no-override tests are not presented as jiti proof: the separate real SDK session provides that evidence. No model-driven run or inline fallback was substituted.
7. **Protected tests/plan:** no spec test changes; the only existing-test diff is exactly §6.6's three fixture places. No plan acceptance test was edited, so there is no plan-test/spec contradiction to justify. Spec/header and docs/specs/index status remain unchanged during integration; the successful outer handoff owns implemented status and Implemented by (or the specified notice).
8. **Reporting/branch:** report is at the requested external run path for the outer handoff to copy. Local work was committed in the detached worktree the pipeline supplied, without switching/creating a branch or touching main. Generated recap files remain outside the commit.

## Appendix A — exact diffs

### Implementation diff stat (planning commit to integrated HEAD)

```text
 README.md                   |  4 +--
 agent/EXTENSIONS.md         |  2 +-
 bin/pi-implement            | 78 +++++++++++++++++++++++++++------------------
 extensions/pipeline.ts      | 40 +++++++++++------------
 lib/pipeline.ts             | 63 ++++++++++++++++++++++++++++++++++--
 lib/specs.ts                | 15 +++++----
 scripts/run-plan.mjs        | 13 +++++---
 tests/pipeline-tool.test.ts |  5 +--
 8 files changed, 151 insertions(+), 69 deletions(-)
```

### Full start-revision diff stat (includes planner artifacts)

```text
 README.md                                          |   4 +-
 agent/EXTENSIONS.md                                |   2 +-
 bin/pi-implement                                   |  78 +++++----
 .../pipeline-decisions.test.ts                     | 134 +++++++++++++++
 .../plan.json                                      | 183 +++++++++++++++++++++
 .../spec-ids.test.ts                               |  82 +++++++++
 extensions/pipeline.ts                             |  40 ++---
 lib/pipeline.ts                                    |  63 ++++++-
 lib/specs.ts                                       |  15 +-
 scripts/run-plan.mjs                               |  13 +-
 tests/pipeline-tool.test.ts                        |   5 +-
 11 files changed, 550 insertions(+), 69 deletions(-)
```

### Entire authorized existing-tool fixture diff

```diff
diff --git a/tests/pipeline-tool.test.ts b/tests/pipeline-tool.test.ts
index 635d31a..2c8b165 100644
--- a/tests/pipeline-tool.test.ts
+++ b/tests/pipeline-tool.test.ts
@@ -55,12 +55,13 @@ type Tool = { execute: (...args: any[]) => Promise<any>; renderCall: (...args: a
 async function fixture(t: any, mode = "success") {
   const root = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-tool-"));
   t.after(() => fs.rmSync(root, { recursive: true, force: true }));
+  execFileSync("git", ["init", "-q", root]);
   fs.mkdirSync(path.join(root, "docs", "specs"), { recursive: true });
   fs.mkdirSync(path.join(root, "bin"));
   const script = path.join(root, "bin", "pi-implement");
   fs.writeFileSync(script, runner, { mode: 0o755 });
   const registered: Tool[] = [];
-  await pipelineExtension({ registerTool(tool: Tool) { registered.push(tool); } } as any);
+  await pipelineExtension({ registerTool(tool: Tool) { registered.push(tool); } } as any, { harnessRoot: root });
   assert.equal(registered.length, 1);
   const tool = registered[0];
   const previous = process.env.FAKE_PIPELINE_MODE;
@@ -103,7 +104,7 @@ test("registers implement_spec; updates stream before handoff, cleans environmen
     assert.match(updates.at(-1).content[0].text, /Running tasks/);
     assert.equal(updates.at(-1).details.cost.editor, 0.12);
     assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, "invocation.json"), "utf8")), {
-      cwd: root, args: ["0015", "--progress", "json", "--plan-only", "--resume"], env: [null, null, null],
+      cwd: root, args: ["0015", "--progress", "json", "--plan-only", "--resume", "--repo", fs.realpathSync(root)], env: [null, null, null],
     });
   } finally {
     fs.writeFileSync(path.join(root, "release"), "yes");
```

### Every other protected-file diff: empty (0 bytes)

```sh
git diff 3ff1666 HEAD -- docs/specs/SPEC-0018-run-implement-spec-from-any-repo.tests tests ':!tests/pipeline-tool.test.ts' 'docs/specs/SPEC-0010*' 'docs/specs/SPEC-0015*'
```
Output:

```diff
```

Plan/acceptance-test diff against planning commit: `git diff 25b7b67 HEAD -- docs/specs/SPEC-0018-run-implement-spec-from-any-repo.plan` → empty (0 bytes).
All implementation changes are the eight files in the implementation stat; no existing test elsewhere changed. `git diff --check 25b7b67 HEAD` exited 0.

## Appendix B — complete changed functions/entrypoints

### `lib/specs.ts` (complete enclosing source)

```typescript
// lib/specs.ts — find a spec in /docs/specs by ID, slug, file name or path.
// Shared by bin/pi-rework and bin/pi-implement.

export interface SpecRef {
  id: string;
  slug: string;
  file: string; // SPEC-0007-build-codebase-map.md
}

export type Resolution = { ok: true; spec: SpecRef } | { ok: false; error: string };

const SPEC_FILE = /^SPEC-([0-9A-Za-z]+)-([a-z0-9-]+)\.md$/;

export function listSpecs(fileNames: string[]): SpecRef[] {
  return fileNames
    .map((f) => f.match(SPEC_FILE))
    .filter((m): m is RegExpMatchArray => m !== null && m[2] !== "run")
    .map((m) => ({ id: m[1], slug: m[2], file: m[0] }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// Accepts "7", "0007", "SPEC-0007", the slug, the file name, or a path ending in it.
export function resolveSpec(fileNames: string[], query: string): Resolution {
  const specs = listSpecs(fileNames);
  const q = query.trim().replace(/^.*\//, "").replace(/\.md$/, "");
  const idQuery = q.match(/^(?:SPEC-)?([0-9A-Za-z]+)$/i)?.[1];
  const normalizedId = idQuery && /^\d{1,4}$/.test(idQuery) ? idQuery.padStart(4, "0") : idQuery;
  const byFile = q.match(/^SPEC-([0-9A-Za-z]+)-[a-z0-9-]+$/i)?.[1];
  const candidates = [normalizedId, byFile].filter((id): id is string => id !== undefined);
  const hits = specs.filter((s) => candidates.some((id) => s.id.toLowerCase() === id.toLowerCase()) || s.slug === q);
  if (hits.length === 1) return { ok: true, spec: hits[0] };
  const list = specs.map((s) => `${s.id} ${s.slug}`).join(", ");
  if (hits.length > 1) return { ok: false, error: `"${query}" matches more than one spec: ${hits.map((s) => s.id).join(", ")}` };
  return { ok: false, error: `No spec "${query}". Specs: ${list || "none"}` };
}

export function markImplemented(
  indexText: string,
  specText: string,
  id: string,
  by: string,
): { index: string; spec: string } {
  const replaceCell = (line: string, cellIndex: number, value: string): string => {
    const cells = [...line.matchAll(/\|([^|]*)/g)];
    const cell = cells[cellIndex];
    if (!cell) return line;
    const content = cell[1];
    const leading = content.match(/^\s*/)?.[0] ?? "";
    const trailing = content.match(/\s*$/)?.[0] ?? "";
    return line.slice(0, cell.index! + 1) + leading + value + trailing + line.slice(cell.index! + 1 + content.length);
  };

  const lines = indexText.split(/(?<=\n)/);
  const matching: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i].replace(/\r?\n$/, "");
    if (!row.startsWith("|")) continue;
    const cells = [...row.matchAll(/\|([^|]*)/g)];
    const cellId = cells[0]?.[1].trim();
    if (cellId && /^[0-9A-Za-z]+$/.test(cellId) && cellId.toLowerCase() === id.toLowerCase()) matching.push(i);
  }
  if (matching.length !== 1) throw new Error(`Expected exactly one index row for ${id}`);
  const indexRow = matching[0];
  let updatedIndex = replaceCell(lines[indexRow], 2, "implemented");
  // Replace the Implemented by cell after the status edit; cell numbering is unchanged.
  const prefix = lines.slice(0, indexRow).join("");
  const changedRow = replaceCell(updatedIndex, 3, by);
  const updatedLines = [...lines];
  updatedLines[indexRow] = changedRow;
  updatedIndex = prefix + updatedLines.slice(indexRow).join("");

  const specLines = specText.split(/(?<=\n)/);
  let inHeaderTable = false;
  let statusLine = -1;
  for (let i = 0; i < specLines.length; i++) {
    const row = specLines[i].replace(/\r?\n$/, "");
    if (row.startsWith("|")) {
      inHeaderTable = true;
      const cells = [...row.matchAll(/\|([^|]*)/g)];
      if (cells[0]?.[1].trim() === "Status") { statusLine = i; break; }
    } else if (inHeaderTable) break;
  }
  if (statusLine >= 0) specLines[statusLine] = replaceCell(specLines[statusLine], 1, "implemented");
  return { index: updatedIndex, spec: specLines.join("") };
}

// Sibling paths, relative to /docs/specs.
export function specPaths(spec: SpecRef): { spec: string; tests: string; plan: string; runRecord: string } {
  const stem = spec.file.replace(/\.md$/, "");
  return { spec: spec.file, tests: `${stem}.tests`, plan: `${stem}.plan`, runRecord: `SPEC-${spec.id}-run.md` };
}
```

### `lib/pipeline.ts` (complete enclosing source)

```typescript
// lib/pipeline.ts — decisions the pipeline makes before and during a run.

import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { countVerifyChecks } from "./plan.ts";

const TEST_ENV_KEYS = ["PI_BUILD_PIPELINE", "PI_BUILD_SUBAGENT_ROLE", "PI_BUILD_TELEMETRY_DB"] as const;

export const STOP_AND_REPORT = "Do not implement this spec with other tools. Report this result to the user and wait for instructions.";

export function findHarnessRoot(fromPath: string): string | null {
  try {
    const real = realpathSync(fromPath);
    let current = statSync(real).isDirectory() ? real : dirname(real);
    while (true) {
      if (existsSync(join(current, "bin/pi-implement"))) return realpathSync(current);
      const parent = dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  } catch { return null; }
}

export function targetRepo(cwd: string): string | null {
  try {
    const top = execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return top ? realpathSync(top) : null;
  } catch { return null; }
}

function sameIdentity(a: string, b: string): boolean {
  try { return realpathSync(a) === realpathSync(b); }
  catch { return resolve(a) === resolve(b); }
}

export function pythonProjectFor(input: { target: string; harnessRoot: string; settings: unknown }): string | null {
  try {
    const config = JSON.parse(readFileSync(join(input.target, ".pi/pipeline.json"), "utf8")) as { pythonProject?: unknown };
    if (typeof config?.pythonProject === "string" && config.pythonProject.length > 0) return config.pythonProject;
  } catch { /* absent or unusable target config */ }
  if (sameIdentity(input.target, input.harnessRoot)) {
    const project = (input.settings as { pipeline?: { pythonProject?: unknown } } | null)?.pipeline?.pythonProject;
    return typeof project === "string" && project.length > 0 ? project : "tools/map";
  }
  return existsSync(join(input.target, "pyproject.toml")) ? "." : null;
}

export function runDirBase(input: { runRoot: string; target: string; harnessRoot: string; id: string; slug: string }): string {
  const name = `SPEC-${input.id}-${input.slug}`;
  return sameIdentity(input.target, input.harnessRoot)
    ? join(input.runRoot, name)
    : join(input.runRoot, basename(input.target), name);
}

export function planPrompt(input: { spec: string; planDir: string; checks: number; harnessRoot: string }): string {
  return `Read ${input.spec} and the repository. Write an implementation plan to ${input.planDir}/plan.json following the Plan interface in ${input.harnessRoot}/lib/plan.ts, and one acceptance test per Luna task in ${input.planDir}/.\n\nMap each verification V-number, 1 through ${input.checks}, to verifyMap key without the V (V3 is key "3"). Order tasks by the spec's stages. List every requirement and map every V-number to requirement ids or "process". Split tasks into one file each; assign to Luna only tasks needing no cross-file reasoning or open design decision; assign the rest to Sol. Each Luna brief must stand alone, with exact interfaces, constants, reading and forbidden edits. Tests import only declared interfaces and assert behaviour. Run validatePlan and undeclaredImports, confirm every acceptance test fails before implementation. Do not implement anything.`;
}

export function childPiArgs(input: {
  model: string;
  thinking: string;
  prompt: string;
  sessionDir: string;
  continuing?: boolean;
}): string[] {
  return [
    "--mode", "json",
    "--model", input.model,
    "--thinking", input.thinking,
    "--session-dir", input.sessionDir,
    ...(input.continuing ? ["--continue"] : []),
    "--approve",
    "-p", input.prompt,
  ];
}

export function implementArgs(input: { spec: string; planOnly?: boolean; resume?: boolean; repo?: string }): string[] {
  return [
    input.spec,
    "--progress", "json",
    ...(input.planOnly ? ["--plan-only"] : []),
    ...(input.resume ? ["--resume"] : []),
    ...(input.repo !== undefined ? ["--repo", input.repo] : []),
  ];
}

export function testEnv(base: Record<string, string | undefined>): Record<string, string | undefined> {
  const env = { ...base };
  for (const key of TEST_ENV_KEYS) delete env[key];
  return env;
}

export function costByRole(rows: { role: string | null; cost: number | null }[]): {
  planner: number;
  editor: number;
  integration: number;
  other: number;
  total: number;
} {
  const totals = { planner: 0, editor: 0, integration: 0, other: 0, total: 0 };
  for (const row of rows) {
    const cost = typeof row.cost === "number" && Number.isFinite(row.cost) ? row.cost : 0;
    const role = row.role === "planner" || row.role === "editor" || row.role === "integration" ? row.role : "other";
    totals[role] += cost;
    totals.total += cost;
  }
  return totals;
}

export function childEnv(
  base: Record<string, string | undefined>,
  role: "planner" | "editor" | "integration",
  telemetryDb: string,
): Record<string, string | undefined> {
  return {
    ...base,
    PI_BUILD_PIPELINE: "1",
    PI_BUILD_SUBAGENT_ROLE: role,
    PI_BUILD_TELEMETRY_DB: telemetryDb,
  };
}

export function pipelineRunRoot(settings: unknown, home: string): string {
  const pipeline = (settings as { pipeline?: { runRoot?: unknown } } | null)?.pipeline;
  return typeof pipeline?.runRoot === "string" && pipeline.runRoot.length > 0
    ? pipeline.runRoot
    : join(home, "var/pipeline-runs");
}

export function pipelineTelemetryDbs(root: string): string[] {
  const found: string[] = [];
  function visit(dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && (entry.name === "telemetry.db" || entry.name.endsWith("-telemetry.db"))) {
        if (statSync(path).isFile()) found.push(path);
      }
    }
  }
  visit(root);
  return found.sort();
}

export interface Command {
  cmd: string;
  args: string[];
}

const NODE_TEST = /\.test\.(?:ts|mts|js|mjs)$/;
const PY_TEST = /(?:^|\/)(?:test_[^/]*|[^/]*_test)\.py$/;

// One command per runner: all Node test files together, all Python test files together.
// Files matching neither are ignored.
export function testCommands(files: string[], opts: { pythonProject: string }): Command[] {
  const node = files.filter((f) => NODE_TEST.test(f)).sort();
  const py = files.filter((f) => PY_TEST.test(f)).sort();
  const out: Command[] = [];
  if (node.length) out.push({ cmd: "node", args: ["--experimental-strip-types", "--test", ...node] });
  if (py.length) out.push({ cmd: "uv", args: ["run", "--project", opts.pythonProject, "pytest", "-q", ...py] });
  return out;
}

export interface PreflightInput {
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
  return { checks, blocking, warnings };
}
```

### `extensions/pipeline.ts` (complete enclosing source)

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
    description: "Implement a spec from /docs/specs through the delegated pipeline — Sol plans, Luna implements each task, Sol integrates — streaming progress into the chat. Hands off on a branch and never writes main. If it fails: " + STOP_AND_REPORT,
    exposure: "direct",
    parameters: Type.Object({
      spec: Type.String({ description: "Spec ID, slug or path" }),
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

      const handedOff = !aborted && code === 0 && state.done?.ok === true && Boolean(state.done.branch) && Boolean(state.done.runRecord);
      let text = progressSummary(state);
      if (code === 75) text += "\nHeld by the quota gate: run `bin/pi-continue`, then call again with `resume: true`";
      else if (code === 2) {
        // Preflight can fail before it has emitted a done event; preserve the runner's diagnostics.
        const reasons = state.done?.summary || stderr.trim() || "Preflight blocked.";
        if (!text.includes(reasons)) text += `\nPreflight: ${reasons}`;
      } else if (aborted) text += "\nAborted; call again with `resume: true`.";
      else if (!handedOff && (spawnError || stderr.trim())) text += `\n${spawnError ?? stderr.trim()}`;
      if (!handedOff && !state.done && code !== 2 && code !== 75 && !aborted) text += `\nRunner exited ${code ?? "without a status"} without handoff.`;
      if (!handedOff) text += `\n${STOP_AND_REPORT}`;
      return { content: [{ type: "text", text }], details: state, isError: !handedOff };
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

### `bin/pi-implement` (complete enclosing source)

```typescript
#!/usr/bin/env -S node --experimental-strip-types
// Turn a checked-in spec into a review branch; never mutate the caller's branch.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { countVerifyChecks, pipelineThinking, undeclaredImports, validatePlan } from "../lib/plan.ts";
import { childEnv, childPiArgs, costByRole, pipelineRunRoot, planPrompt, preflight, pythonProjectFor, runDirBase, targetRepo, testCommands, testEnv } from "../lib/pipeline.ts";
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
const emit = (event) => { if (progress) process.stdout.write(`${JSON.stringify(event)}\n`); };
const finish = (ok, summary, extra = {}) => {
  if (done) return;
  done = true;
  emit({ type: "done", ok, summary, ...extra });
};
const exit = (text, code = 1) => {
  console.error(text);
  if (code === 75) emit({ type: "notice", text });
  finish(false, text);
  process.exit(code);
};
process.on("SIGTERM", () => {
  terminated = true;
  currentChild?.kill("SIGTERM");
  if (!currentChild) exit("Interrupted; run directory and worktree retained for --resume", 130);
});
const interrupted = () => { if (terminated) exit("Interrupted; run directory and worktree retained for --resume", 130); };
const stage = (name) => emit({ type: "stage", stage: name });
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
        if (event && event.type !== "done" && event.stage !== "grade" && event.stage !== "handoff") emit(event);
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
  if (result.code === 75) exit(`Quota hold; resume with bin/pi-implement ${query} --resume`, 75);
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
const specsDir = path.join(target, "docs/specs");
if (!fs.existsSync(specsDir)) exit(`no docs/specs directory in ${target}`, 2);
const resolution = resolveSpec(fs.readdirSync(specsDir), query);
if (!resolution.ok) exit(resolution.error, 2);
const spec = resolution.spec;
const paths = specPaths(spec);
const specRel = path.join("docs/specs", paths.spec);
const testRel = path.join("docs/specs", paths.tests);
const planRel = path.join("docs/specs", paths.plan);
const dirty = git(target, "status", "--porcelain").split("\n").filter(Boolean);
const settings = readPiSettings();
const pythonProject = pythonProjectFor({ target, harnessRoot, settings });
const testFiles = filesIn(path.join(target, testRel), testRel);
stage("preflight");
const check = preflight({ specText: read(path.join(target, specRel)), hasTestsDir: fs.existsSync(path.join(target, testRel)),
  held: readHold(defaultHoldPath(process.env)) !== null, dirty, testFiles, pythonProject });
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
const branch = flags.has("--resume") ? JSON.parse(read(metaPath)).branch : `pipeline/SPEC-${spec.id}-${spec.slug}-${stamp}`;
const work = path.join(dir, "branch");
if (!flags.has("--resume")) {
  fs.mkdirSync(dir, { recursive: true });
  git(target, "branch", branch, "HEAD");
  git(target, "worktree", "add", work, branch);
  write(metaPath, JSON.stringify({ branch, spec: specRel, stamp, startedAt: new Date().toISOString() }, null, 2));
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
  if (progress) { process.stderr.write(`${text}\n`); finish(true, text, { branch }); }
  else console.log(text);
  process.exit(0);
}
// The runner owns task and integration stages; its JSONL stream is forwarded as received.
const runner = await streamed(process.execPath, ["--experimental-strip-types", path.join(harnessRoot, "scripts/run-plan.mjs"),
  "--plan", workPlan, "--run-dir", dir, "--repo", work, "--python-project", pythonProject ?? "", ...(progress ? ["--progress", "json"] : []),
  ...(flags.has("--resume") ? ["--resume"] : [])], work,
  { log: path.join(dir, "runner.log"), forward: progress });
interrupted();
if (runner.code === 75) exit(`quota hold: bin/pi-implement ${query} --resume`, 75);
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
const summary = `${branch} ${paths.runRecord} — spec ${grade.specTests.code === 0 ? "pass" : "fail"}, plan ${grade.planTests.code === 0 ? "pass" : "fail"}`;
if (progress) { finish(true, summary, { branch, runRecord: path.join("docs/specs", paths.runRecord) }); }
else console.log(summary);
```

### `scripts/run-plan.mjs` — exact changed top-level selections and complete changed functions

```javascript
const HARNESS_ROOT = path.resolve(import.meta.dirname, "..");
const REPO = process.argv.includes("--repo") ? fs.realpathSync(argValue("--repo")) : HARNESS_ROOT;
const pythonProject = process.argv.includes("--python-project") ? argValue("--python-project") : settings.pipeline?.pythonProject || "tools/map";
```
```javascript
function holdStatus() {
  const bin = path.join(HARNESS_ROOT, "bin", "pi-continue");
  try {
    const out = execFileSync(bin, ["--status"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout || ""}${err.stderr || ""}` };
  }
}
```
```javascript
function resumeCommand(planPath, runDir) {
  if (!process.argv.includes("--repo") && !process.argv.includes("--python-project")) {
    return `node --experimental-strip-types scripts/run-plan.mjs --plan ${planPath} --run-dir ${runDir} --resume`;
  }
  return `node --experimental-strip-types ${JSON.stringify(path.join(HARNESS_ROOT, "scripts/run-plan.mjs"))} --plan ${JSON.stringify(path.resolve(REPO, planPath))} --run-dir ${JSON.stringify(runDir)} --repo ${JSON.stringify(REPO)}` +
    (process.argv.includes("--python-project") ? ` --python-project ${JSON.stringify(argValue("--python-project"))}` : "") + " --resume";
}
```

### Existing tool fixture — complete changed setup function

```typescript
async function fixture(t: any, mode = "success") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-tool-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q", root]);
  fs.mkdirSync(path.join(root, "docs", "specs"), { recursive: true });
  fs.mkdirSync(path.join(root, "bin"));
  const script = path.join(root, "bin", "pi-implement");
  fs.writeFileSync(script, runner, { mode: 0o755 });
  const registered: Tool[] = [];
  await pipelineExtension({ registerTool(tool: Tool) { registered.push(tool); } } as any, { harnessRoot: root });
  assert.equal(registered.length, 1);
  const tool = registered[0];
  const previous = process.env.FAKE_PIPELINE_MODE;
  process.env.FAKE_PIPELINE_MODE = mode;
  t.after(() => {
    if (previous === undefined) delete process.env.FAKE_PIPELINE_MODE;
    else process.env.FAKE_PIPELINE_MODE = previous;
  });
  return { root, tool, cwd: path.join(root, "docs", "specs") };
}
```

## Appendix C — retained output and reproducibility artifacts

These files are copied alongside this external report, retaining their basenames. The outer handoff copies the report into the plan directory; original run-level artifacts stay in this run directory.

- `spec18-integration-initial.tap`
- `spec18-integration-acceptance.tap`
- `spec18-requested-final.tap`
- `spec18-final-spec.tap`
- `spec18-final-decisions.tap`
- `spec18-final-ids.tap`
- `spec18-final-tool.tap`
- `spec18-final-suite.tap`
- `spec18-final-thinking.tap`
- `spec18-final-offline.log`
- `spec18-final-project.log`
- `spec18-final-map.log`
- `spec18-typecheck.log`
- `spec18-jiti-session.mjs`
- `spec18-jiti-session.log`
- `spec18-start-suite-xZdrj4.tap`
- `spec18-baseline-offline-90g1ZK.log`
- `spec18-baseline-project-twv2R2.log`
- `spec18-baseline-map-7pvNPZ.log`
- `spec18-contract-baseline-nhnFOi.tap`
- `spec18-protected.diff`
- `spec18-plan-acceptance.diff`
- `spec18-tool-fixture.diff`
- `spec18-callers.txt`
- `spec18-planner-trust-stdout.log` (planner child-trust output)
- `spec18-planner-trust-stderr.log` (planner child-trust output)

### Protected checks, complete final output (C2)

```text
✔ the harness root is found from the extension's own file, also through a symlink (2.229874ms)
✔ the target is the git top level of the session's directory, or null outside a repository (32.79433ms)
✔ the tool passes the target as --repo, after the existing arguments (1.074822ms)
✔ the Python project comes from the target's config, then pi-build's host setting, then pyproject.toml, else none (2.714871ms)
✔ run directories keep their old place for pi-build and are namespaced by repository otherwise (0.302596ms)
✔ preflight blocks Python tests without a Python project, and is unchanged when not told about tests (0.945399ms)
✔ the planner is pointed at the harness's Plan interface by absolute path (0.837368ms)
✔ the stop-and-report sentence is fixed (0.093184ms)
✔ a dry run against another repository resolves everything in that repository (299.580927ms)
✔ a dry run on pi-build itself keeps pi-build as both harness and target, and the old run directory (107.056525ms)
✔ a repository without /docs/specs is refused with exit 2 and a reason (87.988666ms)
✔ Python spec tests with no Python project are refused before any model call (86.764945ms)
✔ run-plan treats --repo as the repository (77.260115ms)
✔ alphanumeric IDs are listed, and run records are not specs (8.115319ms)
✔ an alphanumeric ID resolves by ID, prefixed ID, any case, file name, path and slug (0.976999ms)
✔ every form that resolved before still resolves to the same spec (0.367107ms)
✔ an ID shared by two specs is an error naming both; an unknown ID is an error (0.294501ms)
✔ markImplemented updates the row of an alphanumeric ID (0.570498ms)
✔ from a subdirectory of another repository, the harness's runner runs against that repository (126.416861ms)
✔ outside a git repository the tool refuses without starting the runner, and says not to implement inline (9.011196ms)
✔ a harness root without the runner is an error that says not to implement inline (4.057104ms)
✔ a fail result is an error ending with the stop-and-report sentence (28.887678ms)
✔ a preflight result is an error ending with the stop-and-report sentence (27.341024ms)
✔ a hold result is an error ending with the stop-and-report sentence (32.640452ms)
✔ the tool is declared directly and its description carries the stop-and-report sentence (5.614298ms)
✔ without an override the harness root is this checkout (98.017417ms)
ℹ tests 26
ℹ suites 0
ℹ pass 26
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 745.804781
```

### Real pi SDK/jiti discovery, complete output (C10)

```text
jiti-loaded extension paths: [
  '/home/george-contis/var/pipeline-runs/SPEC-0018-run-implement-spec-from-any-repo/2026-10-15T13-08-36-219Z/work/extensions/pipeline.ts'
]
{
  "content": [
    {
      "type": "text",
      "text": "00B1: Failed (0/0 tasks).\nno docs/specs directory in /tmp/spec18-jiti-session-TpidOA/repo\nCost: planner $0.00, editor $0.00, integration $0.00, other $0.00, total $0.00.\nDo not implement this spec with other tools. Report this result to the user and wait for instructions."
    }
  ],
  "details": {
    "spec": "00B1",
    "stage": "preflight",
    "tasks": [],
    "current": {
      "recent": []
    },
    "cost": {
      "planner": 0,
      "editor": 0,
      "integration": 0,
      "other": 0,
      "total": 0
    },
    "notices": [],
    "done": {
      "type": "done",
      "ok": false,
      "summary": "no docs/specs directory in /tmp/spec18-jiti-session-TpidOA/repo"
    }
  },
  "isError": true
}
PASS: real pi SDK session, jiti file loader, default import.meta.url harness discovery, real runner target refusal; zero prompts/model calls/messages.
```

### Runtime probe, complete source (verification only; not a production extension)

```javascript
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager } from '/home/george-contis/.nvm/versions/node/v24.18.0/lib/node_modules/@earendil-works/pi-coding-agent/dist/index.js';
const harness = fs.realpathSync(process.argv[2]);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec18-jiti-session-'));
let session;
try {
  const cwd = path.join(temp, 'repo');
  const agentDir = path.join(temp, 'agent');
  fs.mkdirSync(cwd); fs.mkdirSync(agentDir);
  execFileSync('git', ['init', '-q', cwd]);
  const settingsManager = SettingsManager.inMemory({});
  const resourceLoader = new DefaultResourceLoader({ cwd, agentDir, settingsManager,
    noExtensions: true, additionalExtensionPaths: [path.join(harness, 'extensions/pipeline.ts')],
    noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
  await resourceLoader.reload();
  const loaded = resourceLoader.getExtensions();
  assert.deepEqual(loaded.errors, []);
  console.log('jiti-loaded extension paths:', loaded.extensions.map(e => e.resolvedPath));
  ({ session } = await createAgentSession({ cwd, agentDir, resourceLoader, settingsManager,
    sessionManager: SessionManager.inMemory(cwd), noTools: 'builtin' }));
  await session.bindExtensions({});
  const runner = session.extensionRunner;
  const tool = runner.getToolDefinition('implement_spec');
  assert.ok(tool);
  assert.equal(tool.exposure, 'direct');
  const result = await tool.execute('spec18-no-model', { spec: '00B1' }, undefined, () => {}, runner.createToolContext('spec18-no-model'));
  console.log(JSON.stringify(result, null, 2));
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, new RegExp(`no docs/specs directory in ${cwd}`));
  assert.ok(result.content[0].text.endsWith('\nDo not implement this spec with other tools. Report this result to the user and wait for instructions.'));
  assert.equal(session.messages.length, 0);
  console.log('PASS: real pi SDK session, jiti file loader, default import.meta.url harness discovery, real runner target refusal; zero prompts/model calls/messages.');
} finally {
  session?.dispose();
  fs.rmSync(temp, { recursive: true, force: true });
}
```
