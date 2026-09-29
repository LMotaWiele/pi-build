# SPEC-0015 integration report

Start revision: `d644810bc65a0140b4fd79255b3a873c1099d58f` (integration worktree). Task results: `results.jsonl`, six Luna tasks T02/T03/T05/T09/T10/T12, all accepted on their assigned model (`gpt-6-luna`); Sol implemented remaining tasks here. No plan acceptance test was edited.

## Step 0 — expected versus actual

| Grounding | Expected | Actual |
|---|---|---|
| pi | 0.99.1 | `pi --version` → `0.99.1` |
| Codex catalog | 6.1 Sol, context 272000, $2 input/$0.10 cached/$10 output, off unsupported, minimal→low | `pi --list-models gpt-6.1-sol --offline` lists Codex 272K; installed pi-ai catalog has exactly those prices, window and thinking map |
| 0.99.1 API | exact `getModel`, JSON event stream, throwing bash, awaited handlers, compaction reason/willRetry, sendUserMessage, legacy Codex ID | prior-art/spec claim; JSON event handling checked against installed subagent example; the other API semantics were **not independently probed** |
| built-in extensions | determine default tool declarations | installed `docs/settings.md` says codemode and tool_search are registered **inactive** unless `defaultTools` opts in; mcp registers server tools only for configured/connected servers. `pi --help` lists read/bash/edit/write; **no authenticated session tool list was available** (doctor skips credential smoke), so live default set unverified |
| tiers | old 6/5.6-only matcher | old matcher confirmed; now version-general and 6.1→6→5.6 |
| SPEC-0009 host test | pins 6 Sol | removed as explicitly permitted; replacement SPEC-0015 tests pass |
| bounds test | literal 6 Sol | changed to CODEX-derived target |
| runner | plain `-p`, prose pi.log | changed to JSON streaming and finalText |
| test env | pipeline markers leaked | all runner/entrypoint/doctor test paths now use stripped env |
| telemetry | `subagent_role` available | `inference_calls` role/cost queried from each run database |
| version pin | deps 0.99.1 but installer/comments 0.87.1 | confirmed; installer/README/comments now 0.99.1 after V4 doctor succeeded |

## Stage 1 (O1)

- **V1 pass, 0 repairs:** `node --experimental-strip-types --test docs/specs/SPEC-0009-migrate-to-gpt6.tests/{tiers,models}.test.ts docs/specs/SPEC-0015-move-to-gpt-6-1-sol-and-run-the-pipeline-from-chat.tests/tiers.test.ts` → 17/17 passed; 6.1, 6, 5.6 fallback and later-version family covered. Luna's unavailable-medium fallback uses high as required by protected tests (deviation below).
- **V2 pass, 0 repairs:** `node --experimental-strip-types --test docs/specs/SPEC-0015-move-to-gpt-6-1-sol-and-run-the-pipeline-from-chat.tests/host-config.test.ts` → 4/4.
- **V3 pass in clean environment, 1 diagnosis:** `env -u PI_BUILD_PIPELINE -u PI_BUILD_SUBAGENT_ROLE -u PI_BUILD_TELEMETRY_DB node --experimental-strip-types --test tests/*.test.ts` → 108 passed, 0 failed, 1 skipped; `tests/bounds-split.test.ts` passes. Raw inherited-environment run failed at `tests/markdown.test.ts:191` because the **parent integration session** itself sets `PI_BUILD_PIPELINE=1`; the clean-env run and V7 pass. First attempt also failed because fake tool test could not resolve pi's global runtime dependencies; fixed its fixture, without changing spec tests.
- **V4 partial:** `pi --version` → `0.99.1`; `./doctor.sh --offline` and `PI_BUILD_PIPELINE=1 ./doctor.sh --offline` exit 0 following index/header repair and tool-test fixture repair. Built-in default tools assessed from installed settings docs, not an authenticated session; credential tier smoke skipped by doctor. Updated verified-version comments only after offline doctor passed.

## Stage 2 (O2)

- **V5 pass, 0 repairs:** `node --experimental-strip-types --test docs/specs/SPEC-0015-move-to-gpt-6-1-sol-and-run-the-pipeline-from-chat.tests/pipeline-hygiene.test.ts` → 4/4.
- **V6 pass, 1 repair:** `node --experimental-strip-types --test docs/specs/SPEC-0015-move-to-gpt-6-1-sol-and-run-the-pipeline-from-chat.tests/records.test.ts` → 3/3 after deleting SPEC-0009's explicitly superseded host test.
- **V7 pass, 1 diagnosis:** `PI_BUILD_PIPELINE=1 ./doctor.sh --offline` → 0; 109 repository tests (108 pass, one skipped), map 80 passed. Initial doctor found 0011/0014 index/header drift and missing 0015 index/title; repaired metadata without changing test assertions.

## Stage 3 (O3)

- **V8 pass, 0 repairs:** `node --experimental-strip-types --test docs/specs/SPEC-0015-move-to-gpt-6-1-sol-and-run-the-pipeline-from-chat.tests/progress.test.ts` → 7/7.
- **V9 pass, 1 fixture repair:** `node --experimental-strip-types --test tests/pipeline-tool.test.ts` → 3/3. Fake runner confirms updates before completion, branch/cost summary, failed run, quota 75, preflight 2 and SIGTERM on Esc. Test links installed pi's runtime dependencies transiently, then unlinks.
- **V10 NOT RUN:** live smoke requires an authenticated provider and a fresh scratch worktree of integrated HEAD. `./doctor.sh --offline` reports `skipped: no credentials — tier smoke`. No two-task live run, cost measurement, scratch branch or cleanup can honestly be claimed; no scratch worktree was created. Run-record cost aggregation is exercised by unit tests, not a live smoke.
- **V11 partial/pass for runnable checks:** `bin/pi-implement 9 --dry-run` exits 0 and emits JSON plan (terminal output route preserved; pre-spec byte-for-byte baseline unavailable); `./doctor.sh --offline` and `./doctor.sh --project .` exit 0. No provider call.
- **Typecheck NOT RUN:** worktree has no `tsconfig.json`; runner's specified typecheck is conditional on its presence. `test -f tsconfig.json` false. Node strip-types tests provide executable coverage, not a static typecheck.

## Final integrated acceptance (separate)

`node --experimental-strip-types --test docs/specs/SPEC-0015-move-to-gpt-6-1-sol-and-run-the-pipeline-from-chat.plan/T{02,03,05,09,10,12}.test.ts docs/specs/SPEC-0015-move-to-gpt-6-1-sol-and-run-the-pipeline-from-chat.tests/*.test.ts` → **30/30 pass** (22 protected spec tests plus eight plan tests). V3 clean-env and V7 pass; V11 runnable commands pass. **Full final acceptance is incomplete because V10 was not run.** SPEC-0015 stays `ready`, not `implemented`.

## Evidence, paths and implementation seams

- O1 → V1/V2/V3, catalog and version checks; §7 escalation/fallback/new Sol paths run as unit tests.
- O2 → V5/V6/V7; §7 inherited-test-markers path via doctor and unit tests. Live role totals not measured.
- O3 → V8/V9; §7 child activity/usage/notice, malformed line, done/failure, abort, quota hold and preflight exercised as tests. Terminal path V11 dry run; live handoff path V10 not run.
- `lib/progress.ts` defines strict JSONL stage/task/activity/usage/notice/done parsing, child message_end/toolCall/usage and extension notify translation, state reduction, compact/expanded rendering, model summary, and final assistant text recovery. `scripts/run-plan.mjs` emits task/integration stages and child events; `bin/pi-implement` owns preflight/plan/gate/grade/handoff and final done. `extensions/pipeline.ts` calls `implementArgs` and `testEnv`, executes runner from repository root, folds parsed lines into updates, and calls `progressSummary`; its renderCall labels `implement_spec <spec>` and renderResult delegates to `renderProgress`. `tests/pipeline-tool.test.ts` invokes execute/render registration with fake pi and runner. `lib/pipeline.ts` supplies childPiArgs, testEnv and costByRole; entrypoint scans planner, repair, editor and integration telemetry databases.
- `git diff --check` passes. Protected SPEC-0015 tests and all plan acceptance tests have empty diff; only protected exception is the expressly allowed deletion of SPEC-0009 `host-config.test.ts`. Full deletion diff appended below.

## Deviations and reasons

1. Protected tier test expects **high** when Luna's medium 6.1 Sol is unavailable; §6.1 says fallback keeps first target thinking. Used high in `nextTier` as mandated by the plan's explicit conflict resolution and protected acceptance; preserves intended escalation rather than dropping it.
2. Index task T09 touched only index, leaving 0011/0014 spec headers `ready`, and SPEC-0015 arrived with NNNN title/no index row. Doctor requires synchronized statuses and numbered title; updated those headers and added ready row. This is metadata hygiene, not changed outcomes.
3. The existing integration process injects PI_BUILD_PIPELINE into our shell. Direct V3 with that env fails an existing recap/explain predicate; tests invoked by the pipeline now get testEnv, and V3 was rerun clean. No protected tests modified.
4. The harness has no local node_modules; the V9 fake test transiently links pi's installed dependencies to resolve TypeBox/TUI under Node's ESM loader. The runtime extension still imports pi's actual packages.
5. No static typecheck (no tsconfig), live provider smoke (no authenticated credentials), authenticated built-in-tool inventory or original dry-run byte baseline. None marked passed.

## Diff stat and protected exception

Final `git diff --stat` includes modified documentation, tiers, runner, entrypoint, doctor and the SPEC-0009 deletion, plus new `lib/progress.ts`, `extensions/pipeline.ts`, and `tests/pipeline-tool.test.ts` (untracked files do not appear in unstaged stat; staged final stat below after commit). Full protected exception diff:

```diff
diff --git a/docs/specs/SPEC-0009-migrate-to-gpt6.tests/host-config.test.ts b/docs/specs/SPEC-0009-migrate-to-gpt6.tests/host-config.test.ts
deleted file mode 100644
index 11c7567..0000000
--- a/docs/specs/SPEC-0009-migrate-to-gpt6.tests/host-config.test.ts
+++ /dev/null
@@ -1,80 +0,0 @@
-// The live configuration after migration: what fresh sessions, the retry,
-// explain, and the pipeline will actually run on.
-import { test } from "node:test";
-import assert from "node:assert/strict";
-import { readFileSync } from "node:fs";
-import { dirname, resolve } from "node:path";
-import { fileURLToPath } from "node:url";
-
-const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
-const json = (rel: string) => JSON.parse(readFileSync(resolve(ROOT, rel), "utf8"));
-const host = json("settings/hosts/machina.json");
-
-const SOL = "openai-codex/gpt-6-sol";
-const LUNA = "openai-codex/gpt-6-luna";
-const ASTRA = "openai-codex/gpt-6-astra";
-
-function allStrings(v: unknown, out: string[] = []): string[] {
-  if (typeof v === "string") out.push(v);
-  else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out));
-  else if (v && typeof v === "object") Object.values(v).forEach((x) => allStrings(x, out));
-  return out;
-}
-
-// Pi resolves the default with getModel(defaultProvider, defaultModel), an exact
-// match on the bare id. A provider-prefixed defaultModel never resolves, and pi
-// then falls back to enabledModels[0]. Both are set so either path gives Sol.
-test("fresh sessions open on GPT-6 Sol: bare default id, in scope, and first", () => {
-  assert.equal(host.defaultProvider, "openai-codex");
-  assert.equal(host.defaultModel, "gpt-6-sol", "defaultModel is the bare id, without the provider prefix");
-  assert.ok(!host.defaultModel.includes("/"), "a provider-prefixed defaultModel never resolves");
-  assert.ok(host.enabledModels.includes(`${host.defaultProvider}/${host.defaultModel}`), "the default is in scope");
-  assert.equal(host.enabledModels[0], SOL, "the fallback is also Sol");
-  assert.ok(host.enabledModels.includes(LUNA));
-  assert.ok(host.enabledModels.includes(ASTRA));
-  assert.ok(!host.enabledModels.some((m: string) => m.includes("gpt-5.6")), "no GPT-5.6 model in the cycle list");
-});
-
-test("thinking levels: Sol and Luna at medium, Astra at high", () => {
-  assert.equal(host.modelThinkingLevels[SOL], "medium");
-  assert.equal(host.modelThinkingLevels[LUNA], "medium");
-  assert.equal(host.modelThinkingLevels[ASTRA], "high");
-});
-
-test("routing tiers name GPT-6 ids", () => {
-  assert.deepEqual(host.routing.tiers, { scout: LUNA, work: SOL, escalate: SOL, explain: LUNA });
-});
-
-test("the pipeline plans and integrates at high whatever the interactive level", () => {
-  assert.equal(host.pipeline?.plannerThinking, "high");
-  assert.equal(host.pipeline?.editorThinking, "medium");
-});
-
-test("GPT-5.6 Terra has no remaining role in the host configuration", () => {
-  assert.ok(!allStrings(host).some((s) => s.endsWith("gpt-5.6-terra")));
-});
-
-test("the example host keeps the same invariant", () => {
-  const ex = json("settings/hosts/example.json");
-  if (typeof ex.defaultModel === "string" && ex.defaultModel) {
-    assert.ok(!ex.defaultModel.includes("/"), "example defaultModel is a bare id");
-    if (Array.isArray(ex.enabledModels) && ex.enabledModels.length && ex.defaultProvider) {
-      assert.ok(ex.enabledModels.includes(`${ex.defaultProvider}/${ex.defaultModel}`));
-    }
-  }
-});
-
-test("the implement agent is pinned to GPT-6 Luna", () => {
-  const md = readFileSync(resolve(ROOT, ".pi/agents/implement.md"), "utf8");
-  const m = md.match(/^model:\s*(\S+)\s*$/m);
-  assert.equal(m?.[1], LUNA);
-});
-
-test("model overrides cover the GPT-6 ids, with no dollar overrides", () => {
-  const codex = json("agent/models.json").providers["openai-codex"].modelOverrides;
-  for (const id of ["gpt-6-sol", "gpt-6-luna"]) {
-    assert.equal(codex[id]?.contextWindow, 272000, id);
-    assert.deepEqual(codex[id]?.promptCache, { short: 1800, long: 1800 }, id);
-  }
-  for (const [id, o] of Object.entries(codex)) assert.ok(!("cost" in (o as object)), `${id} carries a cost override`);
-});

```
