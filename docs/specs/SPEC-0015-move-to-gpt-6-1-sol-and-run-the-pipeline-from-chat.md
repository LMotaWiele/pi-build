# SPEC-0015: Move to GPT-6.1 Sol, fix the pipeline's loose ends, and run the pipeline from the chat

| Field | Value |
|---|---|
| Status | implemented |
| Size | staged (3 stages) |
| Kind | build |
| Parent | SPEC-0010 |
| Date | 2026-09-30 |
| Checkpoint | continuous |
| Run record | /docs/specs/SPEC-0015-run.md |

Replace `NNNN` in this file's name, its `.tests/` directory and the run record with the next free spec ID — `0015` as of `e447f0b`. Confirm it is free.

Executor: `bin/pi-implement`, from a terminal — the last time; from then on, the tool this spec adds. **Before running:** Lucas updates pi with `pi update` and `pi update --extensions`, and `./doctor.sh --offline` passes.

## 1. Intent

Three things, in order of how much they matter to daily work.

**The pipeline runs outside pi.** Lucas's work is mostly spec-based, and the route runs as a separate process, with children in plain `-p` mode that print nothing until they finish. His pi session sits idle and he cannot see what the run is doing. Pi's own `subagent` example shows the established pattern: run each child with `--mode json`, read its event stream, and report through a tool's `onUpdate`, so the work streams into the chat. Lucas's decision: **the pipeline runs from the chat as a tool call**, holding the session while it works; for other work he opens another pi.

**GPT-6.1 Sol shipped** on 2026-09-29. In the Codex catalog it costs the same as GPT-6 Sol except cached input, which halves to $0.10 per million — roughly 40% off Sol's cost on this cache-heavy workload. Through Codex its context stays 272,000 tokens. There is no Luna 6.1. `familyOf` in `lib/tiers.ts` matches only `gpt-5.6-…` and `gpt-6-…`, so moving the host file alone would silently switch off escalation for every Sol session.

**SPEC-0014's review found three loose ends:** `PI_BUILD_PIPELINE=1` leaks into the tests a run executes, so tests assuming a normal session fail inside it; the run record leaves out integration's cost, the largest share; and `0011` and `0014` still read `ready`.

Outcomes:
- **O1**: GPT-6.1 Sol is the default and the top of the ladder — Luna → 6.1 Sol at medium → 6.1 Sol at high → stop — falling back to GPT-6 Sol, then GPT-5.6 Sol, when a Sol does not resolve. Any Sol version is recognised as a Sol. Pi is pinned at 0.99.1.
- **O2**: Tests inside a run see a normal session; the run record splits cost by role, integration included; the index is correct.
- **O3**: Asking pi to implement a spec runs the pipeline as a tool call in the chat, streaming stage, tasks, each tool call, cost and notices, abortable with Esc and resumable.

## 2. Priority

The chat tool is what makes the route usable day to day. GPT-6.1 Sol cuts the cost of every session. Deferred: a background mode; automatic merging to `main`; adopting pi 0.99's virtual models in place of `pi-smart-router`.

## 3. Prior art

- **Pi's `subagent` example** (`examples/extensions/subagent/index.ts` in pi 0.99.1): children run as `pi --mode json -p`; the parent reads stdout line by line, handling `message_end` (assistant messages with `toolCall` parts and `usage.cost.total`) and `tool_result_end`; it streams with `onUpdate({ content, details })`, renders with `renderResult(result, { expanded })`, and kills the child on the abort signal. Adopt the pattern.
- **In JSON mode, extension UI calls arrive as events:** `{ type: "extension_ui_request", method: "notify", … }`. The quota gate's pause notices reach the parent this way. Adopt.
- **The harness's own tool registration:** `extensions/memory-gate.ts` loads `Type` with `await import("typebox")`. Follow it.

## 4. Grounding

| Fact | Expected | Tag | Source |
|---|---|---|---|
| Installed pi | 0.99.1 after Lucas's update | agent-verify | `pi --version` |
| GPT-6.1 Sol in pi-ai 0.99.1's `openai-codex` catalog | $2 in, $0.10 cached, $10 out; context 272,000; `off` unsupported, `minimal` → `low` | measured | `providers/data/openai-codex.json` |
| Pi 0.99.1 behaviours the harness uses | `getModel` exact match; default kept when in `enabledModels`; bash throws on non-zero exit; handlers awaited; `session_before_compact` carries `reason` and `willRetry`; `sendUserMessage`; `--mode json`; provider id `openai-codex`, labelled "legacy" | measured | 0.99.1 bundle |
| Pi 0.99's built-in `codemode`, `tool_search` and `mcp` extensions | whether any declares tools by default | agent-verify | a session's tool list; record it |
| `lib/tiers.ts` | `CODEX.sol` `gpt-6-sol`, `CODEX.solFallback` `gpt-5.6-sol`; `familyOf` matches `gpt-(5.6\|6)-…` only | measured | `e447f0b` |
| `SPEC-0009`'s protected `host-config.test.ts` | pins `gpt-6-sol` | measured | same |
| `tests/bounds-split.test.ts` | asserts escalation to the literal `openai-codex/gpt-6-sol` | measured | same |
| Runner child arguments | `piArgs` in `scripts/run-plan.mjs`; `-p` without `--mode json` | measured | same |
| Runner reads child output as text | `pi.log` read as the task's final output near line 503 | measured | same |
| Test commands' environment | inherits `PI_BUILD_PIPELINE`, `PI_BUILD_SUBAGENT_ROLE`, `PI_BUILD_TELEMETRY_DB` | measured | `SPEC-0014-run.md` |
| Rows carry `subagent_role` | yes, since SPEC-0014 | measured | `lib/telemetry.ts` |
| Pin | `deps.txt` `pi 0.99.1`, updated by Lucas before this run because doctor checks it; `install.sh` `PI_VERSION` default `0.87.1`; README, `extensions/quota-gate.ts` and `lib/settings-keys.ts` name 0.87.1 | measured | same; Lucas, 2026-09-30 |

**Step 0:** verify every row and record expected against actual. Where the repository differs, follow §9.

## 5. Scope

In: `deps.txt`, `lib/settings-keys.ts`, `extensions/quota-gate.ts` (comment only), `lib/tiers.ts`, `lib/pipeline.ts`, new `lib/progress.ts`, `scripts/run-plan.mjs`, `bin/pi-implement`, `doctor.sh`, new `extensions/pipeline.ts`, `agent/EXTENSIONS.md`, both host files, `agent/models.json`, `install.sh`, the README, `docs/specs/index.md`, `tests/bounds-split.test.ts`, and `SPEC-0009`'s `.tests/` and §11.

Out: a background mode; merging to `main`; `pi-smart-router`; any change to what the route does — only where it runs and what it reports.

The run's own sessions load the harness from the main checkout, so this run does not change the code it runs on. After merging, start a fresh pi session to load the new tool and settings.

## 6. Changes

### 6.0 Architecture

The tool `implement_spec` in `extensions/pipeline.ts` spawns `bin/pi-implement <spec> --progress json`. The runner writes progress events, one JSON object per line, on stdout and human output on stderr. Its children run with `--mode json`; it reads their event streams, keeps them as `pi.log`, and forwards `childEventToProgress` events. The tool folds events with `reduceProgress`, streams `onUpdate`, renders with `renderProgress`, and returns `progressSummary` to the model. Seams: `lib/progress.ts` is the only definition of the protocol; `childPiArgs` is the only place child arguments are built; `testEnv` is the only environment tests run in.

### 6.1 Stage 1: GPT-6.1 Sol and pi 0.99.1

Depends on: nothing. Outcomes: O1.

- `lib/tiers.ts`: `CODEX.sol` `openai-codex/gpt-6.1-sol`, `CODEX.solFallback` `openai-codex/gpt-6-sol`, new `CODEX.solLegacy` `openai-codex/gpt-5.6-sol`. `familyOf` matches any `gpt-<major>[.<minor>]-(luna|terra|sol|astra)`. Every escalation to Sol tries `sol`, then `solFallback`, then `solLegacy`, keeping the thinking level of the first target.
- `settings/hosts/machina.json`: `defaultModel` `gpt-6.1-sol`; `enabledModels` `[openai-codex/gpt-6.1-sol, openai-codex/gpt-6-luna, openai-codex/gpt-6-astra]`; `modelThinkingLevels` 6.1 Sol and Luna at `medium`, Astra at `high`; `routing.tiers` `work` and `escalate` 6.1 Sol, `scout` and `explain` Luna.
- `agent/models.json`: add `gpt-6.1-sol` under `openai-codex.modelOverrides` with the same `contextWindow` and `promptCache` as the GPT-6 entries. No `cost`.
- **Supersede `SPEC-0009`'s `host-config.test.ts`:** delete it; this spec's `host-config.test.ts` replaces it. Append to `SPEC-0009`'s §11 one line saying so.
- `tests/bounds-split.test.ts`: escalation targets come from `CODEX`, not literals.
- `install.sh`: `PI_VERSION` default `0.99.1`; README: every `0.87.1` becomes `0.99.1`; `deps.txt` stays `pi 0.99.1`. `extensions/quota-gate.ts`'s verified-version comment and `lib/settings-keys.ts`'s header name 0.99.1 once V4 has passed.

Preserve: `SPEC-0009`'s `tiers.test.ts` and `models.test.ts` pass unchanged.

Checks: V1, V2, V3, V4. Exit: all pass.

### 6.2 Stage 2: Loose ends

Depends on: Stage 1. Outcomes: O2.

- `lib/pipeline.ts`: `testEnv(base)` returns a copy without `PI_BUILD_PIPELINE`, `PI_BUILD_SUBAGENT_ROLE` and `PI_BUILD_TELEMETRY_DB`. Every test command the runner and `bin/pi-implement` run uses it. `doctor.sh` runs its tests without those three variables.
- `lib/pipeline.ts`: `costByRole(rows)` sums `{ role, cost }` rows into `planner`, `editor`, `integration`, `other` and `total`. The run record's cost section reads every run database's `inference_calls` (`subagent_role`, `cost_usd`) through it, and lists all five.
- `docs/specs/index.md`: `0011` → `implemented`, by `pi`; `0014` → `implemented`, by `pi pipeline`.

Checks: V5, V6, V7. Exit: all pass.

### 6.3 Stage 3: The pipeline as a chat tool

Depends on: Stage 2. Outcomes: O3.

- `lib/pipeline.ts`: `childPiArgs({ model, thinking, prompt, sessionDir, continuing })` — `--mode json` first, `-p <prompt>` last. Replaces `piArgs`, and the planner's arguments in `bin/pi-implement`. `implementArgs({ spec, planOnly, resume })` — the tool's argument list.
- `lib/progress.ts`: the protocol — `ProgressEvent` (`stage`, `task_start`, `task_end`, `activity`, `usage`, `notice`, `done`), `childEventToProgress`, `parseProgressLine`, `initialProgress`, `reduceProgress`, `renderProgress`, `progressSummary`, `finalText` — with the behaviour this spec's `progress.test.ts` fixes.
- **Runner.** With `--progress json`, `bin/pi-implement` writes only progress events to stdout, and everything else to stderr: stages in order — `preflight`, `plan`, `gate`, `tasks`, `integration`, `grade`, `handoff`; `task_start` and `task_end` for each Luna task, with its id, title, model, result, rounds and cost; each child's `activity` and `usage` through `childEventToProgress` with its role and task; a `notice` for each gate round, quota hold, escalation or warning; and a final `done`. Without the flag, output is unchanged. A child's stdout is written to its `pi.log` as it arrives; anything that read `pi.log` as text now reads `finalText(log)`. On `SIGTERM`, the runner terminates its current child, keeps the worktree and run directory for `--resume`, emits `done` with `ok: false`, and exits 130.
- **Tool.** `extensions/pipeline.ts` registers `implement_spec`. Description: *Implement a spec from /docs/specs through the delegated pipeline — Sol plans, Luna implements each task, Sol integrates — streaming progress into the chat. Hands off on a branch and never writes main.* Parameters: `spec` (an ID, slug or path), optional `planOnly` and `resume`. It spawns `<repo>/bin/pi-implement` with `implementArgs`, from the repository root of `ctx.cwd`, in `testEnv(process.env)`. It folds each stdout line through `parseProgressLine` and `reduceProgress`, calling `onUpdate({ content: [{ type: "text", text: progressSummary(state) }], details: state })`. It renders the call as `implement_spec <spec>` and the result as `renderProgress(details, expanded)`. It kills the runner with `SIGTERM` on the abort signal. It returns `progressSummary(state)`, with `isError` unless the run handed off. Exit 75 returns *Held by the quota gate: run `bin/pi-continue`, then call again with `resume: true`*; exit 2 returns the preflight's reasons.
- `agent/EXTENSIONS.md`: `extensions/pipeline.ts` owns the `implement_spec` tool and subscribes to no events. README, *Developing with pi*: ask pi to implement a spec, and it runs as a tool call in the chat; the terminal command still works.

Preserve: the route's behaviour, gates and hand-off; `bin/pi-implement` without `--progress`.

Checks: V8, V9, V10, V11. Exit: all pass.

## 7. Paths

| Path | Trigger | Planned check or justified exclusion |
|---|---|---|
| Sol session escalates | a stuck Sol at medium | V1 — to 6.1 Sol at high |
| 6.1 Sol or 6 Sol unavailable | registry lacks it | V1 — next Sol down; none, no retry |
| a later Sol version | `gpt-6.2-sol` in a host file | V1 — still a Sol |
| tests inside a run | `PI_BUILD_PIPELINE=1` inherited | V5, V7 |
| run record costs | a completed run | V5, V10 |
| a child's tool call, usage, notice | JSON-mode events | V8 |
| malformed progress line | a stray write to stdout | V8 — dropped |
| run ends, handed off or failed | `done` | V8, V10 |
| abort with Esc | tool signal | V9 — runner terminated, resumable |
| quota hold at start | exit 75 | V9 — resume instructions |
| preflight blocked | exit 2 | V9 — reasons returned |
| terminal use | no `--progress` | V11 — output unchanged |

## 8. Verification

| Outcome | Change | Check ID: falsifiable condition |
|---|---|---|
| O1 | §6.1 | V1: `tiers.test.ts` passes, 4 tests, and `SPEC-0009`'s `tiers.test.ts` and `models.test.ts` still pass |
| O1 | §6.1 | V2: `host-config.test.ts` passes, 4 tests |
| O1 | §6.1 | V3: `node --experimental-strip-types --test tests/*.test.ts` reports no failure absent from the start-revision baseline, including `tests/bounds-split.test.ts` |
| O1 | §6.1 | V4: `pi --version` prints 0.99.1; `./doctor.sh --offline` reports nothing beyond the baseline; the built-in extensions' default tools are recorded |
| O2 | §6.2 | V5: `pipeline-hygiene.test.ts` passes, 4 tests |
| O2 | §6.2 | V6: `records.test.ts` passes, 3 tests |
| O2 | §6.2 | V7: `PI_BUILD_PIPELINE=1 ./doctor.sh --offline` exits 0 |
| O3 | §6.3 | V8: `progress.test.ts` passes, 7 tests |
| O3 | §6.3 | V9: a test in `tests/` registers `extensions/pipeline.ts` with a fake pi and a fake runner script, and shows `onUpdate` streaming, the final summary, `isError` on failure, exit 75 and exit 2 handled, and abort terminating the runner |
| O3 | §6.3 | V10: **live smoke.** In a scratch worktree of `HEAD` with `tests/fixtures/pipeline-smoke/SPEC-9001-add-smoke-double.md` and its `.tests/` in `docs/specs/`, `bin/pi-implement 9001 --progress json > events.jsonl` exits 0. Every non-empty line of `events.jsonl` parses with `parseProgressLine`; stages appear in order; there are two `task_start` and two passing `task_end` events, `activity` events, `usage` for planner, editor and integration, and a final `done` with `ok: true` and a branch. The run record lists integration's cost. Remove the scratch worktree and branches afterwards |
| O3 | §6.3 | V11: `bin/pi-implement 9 --dry-run` output is unchanged from before this spec, and `./doctor.sh --offline` and `./doctor.sh --project .` exit 0 |

**Protected:** this spec's `.tests/`; every other spec's `.tests/`, except `SPEC-0009`'s `host-config.test.ts`, which §6.1 removes.

Invariants: no escalation is ever lost to an unrecognised model version; tests never see pipeline markers; stdout under `--progress json` carries only progress events.

Final integrated acceptance: all of this spec's `.tests/` — 22 tests — pass with V3, V7 and V11 at the final commit, and V10's evidence is in the run record.

After landing, not checks: in a fresh pi session, Lucas asks pi to implement the next spec, and watches it in the chat.

## 9. Decisions, repairs and stops

Everything here is committed and reversible with git, so **decide and continue** rather than stop. When this spec conflicts with the repository or with itself, when a check fails, or when a seam differs from §6, make the smallest change that serves the outcomes in §1, record it in the run record as a deviation with the reason, and carry on. Fix failing checks for as long as each attempt brings a new, testable diagnosis.

Stop only for what git cannot undo, or what would change this spec's intent:
- writing outside the repository, except the scratch worktree in V10 and pipeline run directories;
- spending well beyond an ordinary run — a quota hold is handled by the gate, not by stopping;
- dropping or redefining an outcome in §1, or editing a protected test.

Never mark an unrun check as passed.

## 10. Report back

1. Start revision; step-0 expected against actual, including the built-in extensions' default tools.
2. Per stage: each V-check's command, output, pass/fail/not-run and repair rounds.
3. Final integrated acceptance, separately.
4. O-ID → evidence; which §7 paths ran.
5. `git diff --stat`; the full diff of any protected file, which should be empty; the progress protocol as implemented; `implement_spec`'s `execute` and render functions with their callers.
6. Deviations with reasons.

## 11. Landing

Filled from the review.
