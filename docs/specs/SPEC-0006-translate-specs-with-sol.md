# SPEC — spec translation: Sol plans, Luna implements, measured against Grok

**Place at `docs/SPEC-spec-translation.md`.**
**Acceptance tests:** `docs/SPEC-spec-translation.tests/` — may not be edited by the implementer.
**Reference implementation:** `docs/SPEC-spec-translation.reference/` — copy into place; passes the tests as delivered.

**Status:** implemented
**Executor:** Grok Build
**Written:** 2026-09-27
**Relation to other specs:** `docs/SPEC-production-config.md` §3 (specs ship tests) stands and this spec depends on it. Its §1 and §4 are superseded here. Its §2 and §5 are unchanged and not required by this spec. `docs/SPEC-routing-orchestration.md` is closed; no further suite runs.

---

## 0. The question

**On a real spec, does work translated by Sol and implemented by Luna match Grok Build's result, and at what quota cost?**

Everything in this spec is instrumentation for that one comparison. Nothing here measures anything else.

### 0.1 What carries in

| Finding | Consequence here |
|---|---|
| Luna is reliable where every requirement is checked and drops what is not. | Sol turns every requirement into a task with its own acceptance test. |
| Most failures on the repaired suite were specification problems: a hidden test contradicting its prompt, an ambiguous sentence, a stated requirement ignored. | Sol resolves ambiguity in each brief, and spec tests ship with the spec. |
| Checkers written after implementation flagged clean passes as often as failures. | Correctness is decided by execution only. |
| Jev scored 76 of 77 on questions its input can answer, and could not judge correctness from text. | Both batteries ask facts, never judgments. The battery test enforces it. |
| In-session subagent dispatch produced three void sets: a read-only default agent twice, and a single-level join. | Tasks run through a script, one `pi` process each. See 0.2. |
| Two tasks flipped pass/fail between near-identical runs. | One spec yields many tasks; no suite, no fitted rule. |

### 0.2 A runner, not in-session dispatch

The architect/editor pattern does not need nested sessions — Aider runs architect then editor in sequence. Here `scripts/run-plan.mjs` runs each Luna task as its own `pi` process. Each task gets its own bounds and its own quota gate, its telemetry needs no cross-session join, and no agent definition can be silently substituted.

### 0.3 Budget is quota, not dollars

About 40% of this week's Codex quota remains. §1's gate enforces the limit you set; every step records usage before and after, which finally gives the mapping from provider dollars to quota percent that this program never had.

Expect 5-hour holds during Sol phases. A reported case shows a Sol session with a large cached context taking the 5-hour window from 0 to 100% in about 23 minutes while the weekly window moved one point. That is the gate doing its job, not a fault.

### 0.4 Executor rules

Grok Build edits this repository and runs `pi` as a subprocess. Grok's own tripwire: **$15 or 150 Grok calls**. Cursor's session quota is not visible to pi; the gate covers Codex only.

**Do not:** run a Sol-solo arm; build a new suite; edit files under `docs/SPEC-*.tests/` or a plan's acceptance tests during implementation; place `pi` flags after `--` or after the prompt — that launch previously turned `--model` into a user message and ran the wrong model.

---

## 1. Quota gate — built first, protects everything after

### 1.1 Behaviour

| Trigger | Hold | Interactive | Headless |
|---|---|---|---|
| Session opens with a window over its threshold | soft | Ask before the first inference | Exit 75 before the first inference |
| A response's usage headers cross a threshold | soft | Ask at the next round boundary; the turn pauses in place until answered | Abort at the next round boundary; exit 75 |
| Provider returns 429 with usage-limit text | hard | Notify; ask at the next prompt | Exit 75 |
| Hold file exists at the next prompt | as recorded | Ask | Exit 75 before any inference |

**Confirming** a soft hold suspends that window's threshold until the window resets; an exhausted window (100%) holds regardless. Confirming a hard hold clears it with a warning, since the provider will refuse again until reset. **Nothing is ever lifted automatically.** Headless holds are confirmed with `bin/pi-continue`.

### 1.2 What it rests on

Researched 2026-09-27; each item is a fact the code depends on.

- **Usage endpoint.** `GET https://chatgpt.com/backend-api/wham/usage` with the OAuth token pi already stores returns plan type, windows, reset times and credits without a model request.
- **Response shape.** `rate_limit.primary_window` and `secondary_window`, each with `limit_window_seconds`, `reset_at` and `used_percent`.
- **Label by duration, never by slot.** Some plans expose only a weekly window, and it arrives in the primary slot. A live response has shown a lone `primary_window` with `limit_window_seconds: 604800`.
- **Live usage on every response.** `x-codex-primary-used-percent` and the matching `secondary` headers arrive on Codex responses, and existing extensions read them from pi's `after_provider_response` event.
- **The hard stop.** Codex signals exhaustion as `usage_limit_reached`, detected alongside a 429.
- **Rolling windows.** A new window begins on the first request after the old one expires; `reset_at` is stamped then, and polling the usage endpoint does not re-anchor it. Polling is safe.
- **Tokens.** Resolve them through `ctx.modelRegistry.getApiKeyForProvider()`; pi handles OAuth refresh. OpenAI refresh tokens are single-use, so a second refresher breaks pi's login. **The gate never refreshes and never reads `auth.json`.**

### 1.3 Why a soft threshold as well as the hard stop

The hard stop arrives as a 429 mid-turn, and pi has had a regression where a 429 with an abruptly closed connection left the agent stuck in "Working" indefinitely. A threshold stops at a round boundary, before the provider refuses. Defaults are 95% for both windows. **You set the weekly threshold at step 0** to leave the reserve you want.

### 1.4 Files

Copy from the reference tree:

| File | Status |
|---|---|
| `lib/quota.ts` | All decisions. Tested by `quota.test.ts`. |
| `extensions/quota-gate.ts` | Pi wiring only. Every pi API touchpoint marked `VERIFY`. |
| `scripts/pi-continue.ts`, `bin/pi-continue` | Confirm a hold from outside pi. `--status` exits 75 while held. |

Add `quotaGate: { "fiveHour": 95, "weekly": 95 }` to `settings/hosts/machina.json` and `settings/hosts/example.json`, and wire `loadQuotaSettings()` to the settings loader `bounds.ts` uses. `doctor.sh --offline` already fails on an unread key, which forces the wiring. Environment `PI_BUILD_QUOTA_5H` and `PI_BUILD_QUOTA_WEEKLY` override settings.

### 1.5 VERIFY, before anything runs

Each `VERIFY` in `extensions/quota-gate.ts` is checked against the installed `@earendil-works/pi-coding-agent` 0.87.0 source, and the verified shape is recorded in one INDEX row. If a touchpoint does not exist:

| Missing | Fallback |
|---|---|
| `after_provider_response` or its headers | Poll the usage endpoint at each `message_end` instead. It is a GET with no model call. |
| `ctx.hasUI` / `ctx.ui.confirm` | Treat every session as headless. |
| `message_end` handlers are not awaited | Keep the abort branch only; never rely on the confirm pausing the turn. |
| `getApiKeyForProvider` | Header-only mode: slots stay labelled `other` and hold at 100%. Record it; the soft threshold is then unavailable. |

### 1.6 Coordination

- **Bounds retry must not run while held.** In `extensions/bounds.ts`, the retry is allowed only when `readHold(defaultHoldPath(process.env))` is null. Add a test for it with the other bounds tests.
- **Children share the hold.** The hold file is per user, `~/.pi/agent/quota-hold.json`, so every `pi` process honours one hold.
- **No section keys.** Record the gate's events and order in `agent/EXTENSIONS.md`.

### 1.7 Live check

With `PI_BUILD_QUOTA_5H=1`, run a headless `pi` on Luna with a one-word prompt. Expect exit 75, a hold file with reason `5h`, and **no inference row** in `telemetry.db`. Then `bin/pi-continue --yes` and confirm the next run proceeds. Cost: one usage GET, no model call.

---

## 2. Tooling — no model spend

### 2.1 Libraries

Copy from the reference tree: `lib/plan.ts` (plan validation, task order, import audit), `lib/conformance.ts` (mechanical checks of a task's diff), and the two batteries under `extensions/jev/`. All tested.

### 2.2 Plan layout

```
docs/SPEC-<name>.md
docs/SPEC-<name>.tests/          spec tests, written with the spec
docs/SPEC-<name>.plan/plan.json  written by Sol
docs/SPEC-<name>.plan/T<n>.test.ts  one acceptance test per Luna task, written by Sol
```

`plan.json` follows the `Plan` interface in `lib/plan.ts`. `verifyMap` maps every numbered Verify item of the spec to requirement ids, or to `"process"` for items that describe process rather than behaviour.

### 2.3 `scripts/run-plan.mjs`

```
scripts/run-plan.mjs --plan docs/SPEC-<name>.plan/plan.json --run-dir ~/var/pipeline-runs/<name>/<stamp> [--resume]
```

1. Create a git worktree at the plan's commit. Record the commit.
2. For each task in `taskOrder(plan)` with `assignee: "luna"`, skipping ids already in `results.jsonl` when resuming:
   1. `bin/pi-continue --status`; on exit 75, stop with exit 75 and print the resume command.
   2. Run the difficulty battery on the brief and the task's acceptance test source.
   3. Launch `pi --model <luna id> --thinking <host setting> -p "<prompt>"` with `PI_BUILD_RETRY=0` — **flags before the prompt**. The prompt is the brief, the acceptance test's path, and one line: *you may run this test; you may not edit it*.
   4. On the first run only, assert the first inference row's model is the Luna pin; abort the run if not.
   5. On child exit 75, stop with exit 75.
   6. Restore every protected file — spec tests and all plan tests — from the plan commit.
   7. Run the task's acceptance test. Record pass or fail.
   8. `git diff` → `parseUnifiedDiff` → `checkConformance`, with the spec-test directory and all plan tests as protected paths.
   9. Run the quality battery on the brief, the task file's diff, and the implementer's final output.
   10. Commit the task in the worktree, so every task's diff stands alone.
   11. Append one row to `results.jsonl`.
3. Run the Sol integration session, §4.
4. Final grade: restore protected files; typecheck; spec tests; all plan tests. Record everything.

### 2.4 Jev wiring

Use `extensions/jev/adapter.ts`, mapping each battery entry's `id` and `text` into the adapter's question format. The state for each call stays within the adapter's 4,000-token budget; truncate the diff last, and record any truncation on the row.

Compute the script anchors for answer accuracy:

| Question | Truth |
|---|---|
| D1 | `undeclaredImports(test source, task.interfaces)` is empty |
| D6 | some file outside the task imports a symbol the target file exports |
| D9 | `task.dependsOn` is non-empty |
| D10 | another task's `dependsOn` contains this task |
| D11 | the target file is absent at the plan commit |
| Q8 | an added line matches `/TODO|FIXME|stub|placeholder|not implemented/i` |
| Q10 | `removedExports` is non-empty |

---

## 3. The translation prompt

Sol, high thinking, one session, launched with flags before the prompt:

> Read `<spec path>` and the repository. Write an implementation plan to `<plan dir>/plan.json` following the `Plan` interface in `lib/plan.ts`, and one acceptance test per Luna task in `<plan dir>/`.
>
> 1. List every requirement the spec states. Map every numbered Verify item to requirement ids, or to `"process"` if it describes process.
> 2. Split the work into tasks of **one file each**. Assign a task to Luna only if it needs no reasoning across files and no design decision the spec leaves open. Assign everything else to yourself as `"sol"`.
> 3. Each Luna brief must stand alone: every file to read, every exported name and signature, the value and reason for every constant, and what not to touch. Where a spec sentence can be read two ways, state which reading applies.
> 4. Each acceptance test imports only names declared in its task's `interfaces`, and asserts behaviour, not implementation details.
> 5. Run `validatePlan` and `undeclaredImports` over your plan and fix every error. Run each acceptance test at the current tree and confirm it fails.
>
> Do not implement anything.

**Gate to execution:** `validatePlan` returns ok; `undeclaredImports` is empty for every plan test; every plan test fails at the plan commit. If Sol cannot reach that in its session, stop and report — the translation prompt is what needs work, and running Luna on a broken plan measures nothing.

---

## 4. The integration prompt

Sol, high thinking, one session, after every Luna task has run:

> The plan is `<plan.json>`; per-task results are `<results.jsonl>`. Run the typecheck, the spec tests in `<spec tests dir>`, and every plan acceptance test. Fix every failure, and implement every task assigned to `"sol"`.
>
> You may not edit the spec tests. You may edit a plan acceptance test only if it contradicts the spec — record each such edit and why, because it is an error in your own plan.

The worktree's commit history shows exactly which task files Sol edited. That is the ground truth for *Sol had to fix this task*.

---

## 5. Steps

| Step | What | Spend | Proceeds when |
|---|---|---|---|
| 0 | §1 and §2 installed, VERIFY points resolved, live check passed. Record current usage; **you set the weekly threshold**. | One usage GET | Live check passes |
| 1 | Plan only, small spec | Sol, one session | §3's gate passes |
| 2 | Run the plan: Luna tasks, integration, final grade | Luna per task, one Sol session | Every Luna task attempted, integration ran, spec tests graded — **not** a pass-rate gate |
| 3 | Head-to-head on a real spec | Grok as normal; pi through steps 1–2 | — |

**Step 1–2 spec:** `docs/SPEC-production-config.md` §2 and §5.2 — the tiered retry and the rework log — which is real work you want anyway. It needs a `.tests/` directory before step 1; the spec's author supplies it.

**Step 3 spec:** your next real spec of the 500k kind, with its `.tests/` directory. Two worktrees from the same commit. Grok Build runs it as normal, and may see the spec tests; so does the pipeline. Neither sees the other's output.

Record Codex usage percentages before and after every step, and Grok's cost from `usage.json` as `costUsdTicks / 1e10`.

---

## 6. Report

### 6.1 Per task

Task id, assignee, difficulty answers with confidences, acceptance test first-try result, conformance findings, quality answers, whether Sol edited the task's file during integration, provider cost, rounds, wall clock.

### 6.2 Per spec, and the head-to-head

| | Grok | Pipeline |
|---|---|---|
| Spec tests passed / total | | |
| Typecheck | | |
| Blind review, §6.4 | | |
| Codex 5h and weekly used, before → after | — | |
| Grok cost | | — |
| Wall clock | | |
| Holds, and how long each lasted | — | |
| Your interventions | | |

Pipeline row also: Luna first-try pass rate, tasks Sol fixed, tasks Sol kept.

### 6.3 Jev

- **Answer accuracy** on the seven anchored questions, per question, with counts.
- **Per question,** a 2×2 count of answer against outcome — first-try failure, Sol-fixed, spec-test failure traced to the task.
- **Descriptive only.** With 15 and 10 questions against tens of tasks, some question will look predictive by chance. Mark a question *candidate signal* only if its failure rate differs by 30 points or more between yes and no, with at least five tasks in every cell. No rule is fitted from one spec.

### 6.4 Blind review

Before review, assign labels A and B to the two diffs by coin flip; record the mapping with a salt, and show only its SHA-256 until the review is done. Rubric per diff: requirements missing, defects found, rough share of lines you would rewrite, and whether you would merge it as is.

---

## 7. Decision after step 3

Pre-committed. At most one change and one re-run follow, then this is settled for daily use.

| If | Then |
|---|---|
| Pipeline matches or beats Grok on spec tests and review, at lower quota cost | Adopt it as the default for spec work. |
| Matches on quality, costs more | Keep Grok for spec work unless Grok's quota is the binding constraint that week. |
| Worse on quality; Sol fixed most Luna tasks at integration | The plan works and the editors are weak. One change: Terra editors instead of Luna. Re-run on the next spec. |
| Worse on quality; missing requirements trace back to the plan | The translation is the weak point. One change: the §3 prompt. Re-run on the next spec. |
| Luna's first-try rate is high and integration is light | Strongest case for the pipeline. Candidate-signal Jev questions become the first place to look for work that can skip Sol integration. |

---

## 8. Verify

1. `quota.test.ts` passes.
2. `plan.test.ts` passes.
3. `conformance.test.ts` passes.
4. `batteries.test.ts` passes.
5. The §1.7 live check exits 75 before any inference, and runs normally after `bin/pi-continue --yes`.
6. The bounds retry does not run while a hold file exists.
7. One INDEX row records each `VERIFY` touchpoint's verified shape, or the fallback taken.
8. Each step's report exists under `.agent/explain/`.
9. `./doctor.sh --offline` and `./doctor.sh --project .` exit 0.

Items 1–4 are the files in `docs/SPEC-spec-translation.tests/`. Items 5–6 are behavioural and get the implementer's own tests. Items 7–9 are process.

---

## Appendix A — `extensions/quota-gate.ts`

```ts
// extensions/quota-gate.ts — hold work when the Codex subscription's 5-hour or
// weekly window is used up, until a person confirms continuation.
//
// All decisions are made by lib/quota.ts (tested). This file only moves data
// between pi and that module. Every pi API touchpoint is marked VERIFY: check
// it against the installed @earendil-works/pi-coding-agent 0.87.0 before use,
// and record the verified shape in INDEX.
//
// Behaviour:
//   session_start          poll /backend-api/wham/usage once; if a hold file exists, surface it
//   after_provider_response update usage from x-codex-*-used-percent headers; set a soft hold on threshold
//   message_end (assistant) at each round boundary: if held, ask (interactive) or stop (headless)
//   before_agent_start     if held, ask (interactive) or exit 75 before any inference (headless)
//   agent_end              a 429 usage-limit error sets a hard hold
//
// Headless runs exit with code 75 (EX_TEMPFAIL) while held. bin/pi-continue
// clears a hold from outside pi. No hold is ever lifted automatically.

import {
  applyHeaderUsage,
  clearHold,
  continuationFor,
  defaultHoldPath,
  defaultOverridePath,
  fetchUsage,
  accountIdFromToken,
  isUsageLimitError,
  parseCodexHeaders,
  readHold,
  readOverrides,
  resolveThresholds,
  shouldHold,
  writeHold,
  writeOverrides,
  type Hold,
  type QuotaWindow,
} from "../lib/quota.ts";

const PROVIDER = "openai-codex";
export const HOLD_EXIT_CODE = 75;

// VERIFY: the type import other extensions in this repo use for the API object.
type PiAPI = any;
type Ctx = any;

export default function quotaGate(pi: PiAPI) {
  const env = process.env as Record<string, string | undefined>;
  const holdPath = defaultHoldPath(env);
  const overridePath = defaultOverridePath(env);
  // VERIFY: read `quotaGate` from host settings through the same loader bounds.ts uses.
  const thresholds = resolveThresholds(loadQuotaSettings(), env);
  let windows: QuotaWindow[] = [];

  // ---- pi adapters: the only lines that depend on pi's API shape ----------

  function isCodex(ctx: Ctx): boolean {
    return ctx?.model?.provider === PROVIDER; // VERIFY: where the active provider id lives on ctx
  }

  async function token(ctx: Ctx): Promise<string | null> {
    try {
      // VERIFY: documented by pi-keep-going; pi performs OAuth refresh itself.
      const t = await ctx.modelRegistry.getApiKeyForProvider(PROVIDER);
      return typeof t === "string" && t ? t : null;
    } catch {
      return null;
    }
  }

  function hasUI(ctx: Ctx): boolean {
    return Boolean(ctx?.hasUI); // VERIFY: interactive-mode flag on ctx
  }

  async function confirm(ctx: Ctx, title: string, body: string): Promise<boolean> {
    return Boolean(await ctx.ui.confirm(title, body)); // VERIFY: ctx.ui.confirm signature
  }

  function notify(ctx: Ctx, text: string): void {
    if (hasUI(ctx)) ctx.ui.notify(text, "warning"); // VERIFY: ctx.ui.notify signature
    else console.error(`[quota-gate] ${text}`);
  }

  function responseHeaders(event: any): Record<string, string | undefined> {
    return event?.headers ?? {}; // VERIFY: after_provider_response payload shape
  }

  function lastError(event: any): { status?: number; message?: string } | null {
    // VERIFY: where agent_end exposes the terminating provider error.
    const e = event?.error ?? event?.messages?.at?.(-1)?.error ?? null;
    if (!e) return null;
    return { status: e.status ?? e.statusCode, message: String(e.message ?? e.errorMessage ?? "") };
  }

  // ---- logic --------------------------------------------------------------

  function record(kind: string, data: unknown): void {
    try {
      pi.appendEntry("pi-build-quota", { kind, at: new Date().toISOString(), data }); // VERIFY
    } catch {
      /* telemetry must never block the gate */
    }
  }

  function describe(hold: Hold): string {
    const parts = hold.windows.map((w) => {
      const reset = w.resetAt ? new Date(w.resetAt * 1000).toLocaleString() : "unknown";
      return `${w.label} ${w.usedPercent}% (resets ${reset})`;
    });
    return `${hold.hard ? "Provider refused" : "Threshold reached"}: ${hold.reason}. ${parts.join(", ")}`;
  }

  function setSoftHoldIfNeeded(): void {
    if (readHold(holdPath)) return;
    const d = shouldHold(windows, thresholds, readOverrides(overridePath));
    if (!d.hold) return;
    const hold: Hold = { reason: d.reason!, hard: false, setAt: new Date().toISOString(), windows };
    writeHold(holdPath, hold);
    record("hold", hold);
  }

  // Returns true when work may continue.
  async function resolveHold(ctx: Ctx): Promise<boolean> {
    const hold = readHold(holdPath);
    if (!hold) return true;
    if (!hasUI(ctx)) {
      notify(ctx, `${describe(hold)} Run bin/pi-continue to resume.`);
      return false;
    }
    const fresh = isCodex(ctx) ? await poll(ctx) : null;
    const now = fresh ? { ...hold, windows: fresh } : hold;
    const ok = await confirm(ctx, "Quota hold", `${describe(now)}\n\nContinue anyway?`);
    if (!ok) return false;
    const c = continuationFor(now, Date.now() / 1000);
    clearHold(holdPath);
    if (c.override) writeOverrides(overridePath, [...readOverrides(overridePath), c.override]);
    if (c.warning) notify(ctx, c.warning);
    record("continued", { hold: now, continuation: c });
    return true;
  }

  async function poll(ctx: Ctx): Promise<QuotaWindow[] | null> {
    const t = await token(ctx);
    if (!t) return null;
    const ws = await fetchUsage(t, accountIdFromToken(t));
    if (ws && ws.length) {
      windows = ws;
      record("snapshot", ws);
    }
    return ws;
  }

  // ---- events -------------------------------------------------------------

  pi.on("session_start", async (_event: any, ctx: Ctx) => {
    if (isCodex(ctx)) await poll(ctx);
    setSoftHoldIfNeeded(); // a session that opens over threshold holds before its first inference
    const hold = readHold(holdPath);
    if (hold) notify(ctx, `${describe(hold)} Work is on hold until you confirm.`);
  });

  pi.on("after_provider_response", (event: any, ctx: Ctx) => {
    if (!isCodex(ctx)) return;
    const usage = parseCodexHeaders(responseHeaders(event));
    if (!usage.length) return;
    // Without a usage snapshot a slot's duration is unknown. Never guess it:
    // track the slot as "other", which holds only at 100%.
    if (!windows.length) {
      windows = usage.map((u) => ({ slot: u.slot, label: "other" as const, windowSeconds: 0, usedPercent: u.usedPercent, resetAt: null }));
    } else {
      windows = applyHeaderUsage(windows, usage);
    }
    setSoftHoldIfNeeded();
  });

  pi.on("message_end", async (event: any, ctx: Ctx) => {
    if (event?.message?.role !== "assistant") return; // VERIFY: message_end payload
    if (!readHold(holdPath)) return;
    // VERIFY: pi awaits this handler; if it does not, the confirm below cannot
    // pause the turn, and the else-branch abort is the only safe behaviour.
    if (!(await resolveHold(ctx))) ctx.abort();
  });

  pi.on("before_agent_start", async (_event: any, ctx: Ctx) => {
    if (await resolveHold(ctx)) return;
    if (!hasUI(ctx)) process.exit(HOLD_EXIT_CODE); // before any inference; same pattern as routing's halt()
    ctx.abort();
  });

  pi.on("agent_end", (event: any, ctx: Ctx) => {
    const err = lastError(event);
    if (!err || !isUsageLimitError(err)) {
      if (!hasUI(ctx) && readHold(holdPath)) process.exitCode = HOLD_EXIT_CODE;
      return;
    }
    const hold: Hold = { reason: "usage_limit", hard: true, setAt: new Date().toISOString(), windows };
    writeHold(holdPath, hold);
    record("hold", hold);
    notify(ctx, `${describe(hold)} Work is on hold until you confirm.`);
    if (!hasUI(ctx)) process.exitCode = HOLD_EXIT_CODE;
  });
}

function loadQuotaSettings(): { fiveHour?: unknown; weekly?: unknown } | undefined {
  // VERIFY: replace with the repo's settings loader; key is `quotaGate`.
  return undefined;
}
```

## Appendix B — `lib/quota.ts`

```ts
// lib/quota.ts — pure quota logic for the Codex subscription gate.
// Everything here is testable without pi. The pi wiring lives in
// extensions/quota-gate.ts and touches this module only through these exports.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type Slot = "primary" | "secondary";
export type WindowLabel = "5h" | "weekly" | "other";

export interface QuotaWindow {
  slot: Slot;
  label: WindowLabel;
  windowSeconds: number;
  usedPercent: number;
  resetAt: number | null; // epoch seconds
}

export interface SlotUsage {
  slot: Slot;
  usedPercent: number;
}

export interface Thresholds {
  fiveHour: number;
  weekly: number;
}

export interface Override {
  label: WindowLabel;
  until: number; // epoch seconds
}

export interface HoldDecision {
  hold: boolean;
  reason: WindowLabel | null;
  window: QuotaWindow | null;
}

export type HoldReason = WindowLabel | "usage_limit" | "unreadable";

export interface Hold {
  reason: HoldReason;
  hard: boolean; // true: the provider refused (429). false: a threshold was crossed.
  setAt: string; // ISO timestamp
  windows: QuotaWindow[];
}

export interface Continuation {
  clear: true;
  override: Override | null;
  warning: string | null;
}

export const DEFAULT_THRESHOLDS: Thresholds = { fiveHour: 95, weekly: 95 };
export const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

// Windows are labelled by duration, never by slot: some plans report only a
// seven-day window, and it arrives in the primary slot.
export function labelWindow(windowSeconds: number): WindowLabel {
  if (windowSeconds >= 4.5 * 3600 && windowSeconds <= 5.5 * 3600) return "5h";
  if (windowSeconds >= 6 * 86400 && windowSeconds <= 8 * 86400) return "weekly";
  return "other";
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

// Body of GET /backend-api/wham/usage. Malformed input yields [] — never throws.
export function parseUsageResponse(body: unknown): QuotaWindow[] {
  if (!body || typeof body !== "object") return [];
  const rl = (body as Record<string, unknown>).rate_limit;
  if (!rl || typeof rl !== "object") return [];
  const out: QuotaWindow[] = [];
  for (const slot of ["primary", "secondary"] as const) {
    const w = (rl as Record<string, unknown>)[`${slot}_window`];
    if (!w || typeof w !== "object") continue;
    const rec = w as Record<string, unknown>;
    const windowSeconds = num(rec.limit_window_seconds);
    const usedPercent = num(rec.used_percent);
    if (windowSeconds === null || usedPercent === null) continue;
    out.push({
      slot,
      label: labelWindow(windowSeconds),
      windowSeconds,
      usedPercent,
      resetAt: num(rec.reset_at),
    });
  }
  return out;
}

// x-codex-{primary,secondary}-used-percent on every Codex response.
// Headers carry slot and percent only; the slot's duration comes from the
// last usage-endpoint snapshot, via applyHeaderUsage.
export function parseCodexHeaders(headers: Record<string, string | undefined>): SlotUsage[] {
  const lower: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  const out: SlotUsage[] = [];
  for (const slot of ["primary", "secondary"] as const) {
    const v = num(lower[`x-codex-${slot}-used-percent`]);
    if (v !== null) out.push({ slot, usedPercent: v });
  }
  return out;
}

export function applyHeaderUsage(windows: QuotaWindow[], usage: SlotUsage[]): QuotaWindow[] {
  return windows.map((w) => {
    const u = usage.find((x) => x.slot === w.slot);
    return u ? { ...w, usedPercent: u.usedPercent } : w;
  });
}

// A hard quota refusal. A plain 429 without usage-limit text is burst
// throttling and is left to pi's own retry.
export function isUsageLimitError(err: { status?: number; message?: string }): boolean {
  if (err.status !== 429) return false;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("usage_limit_reached") || m.includes("usage limit");
}

const PRIORITY: WindowLabel[] = ["weekly", "5h", "other"];

export function shouldHold(
  windows: QuotaWindow[],
  t: Thresholds,
  overrides: Override[] = [],
  nowSec: number = Date.now() / 1000,
): HoldDecision {
  const suspended = (label: WindowLabel) => overrides.some((o) => o.label === label && nowSec < o.until);
  const over = windows.filter((w) => {
    if (w.usedPercent >= 100) return true; // exhausted: no override applies
    if (suspended(w.label)) return false;
    if (w.label === "5h") return w.usedPercent >= t.fiveHour;
    if (w.label === "weekly") return w.usedPercent >= t.weekly;
    return false; // "other" windows hold only when exhausted
  });
  if (over.length === 0) return { hold: false, reason: null, window: null };
  over.sort((a, b) => PRIORITY.indexOf(a.label) - PRIORITY.indexOf(b.label));
  return { hold: true, reason: over[0].label, window: over[0] };
}

function clampPercent(v: unknown): number | null {
  const n = num(v);
  if (n === null || n <= 0) return null;
  return Math.min(100, n);
}

// Environment wins over settings. Invalid values fall back.
export function resolveThresholds(
  settings: { fiveHour?: unknown; weekly?: unknown } | undefined,
  env: Record<string, string | undefined>,
): Thresholds {
  return {
    fiveHour:
      clampPercent(env.PI_BUILD_QUOTA_5H) ?? clampPercent(settings?.fiveHour) ?? DEFAULT_THRESHOLDS.fiveHour,
    weekly:
      clampPercent(env.PI_BUILD_QUOTA_WEEKLY) ?? clampPercent(settings?.weekly) ?? DEFAULT_THRESHOLDS.weekly,
  };
}

export function defaultHoldPath(env: Record<string, string | undefined>): string {
  return env.PI_BUILD_QUOTA_HOLD ?? join(homedir(), ".pi", "agent", "quota-hold.json");
}

export function defaultOverridePath(env: Record<string, string | undefined>): string {
  return env.PI_BUILD_QUOTA_OVERRIDE ?? join(homedir(), ".pi", "agent", "quota-override.json");
}

export function writeHold(path: string, hold: Hold): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(hold, null, 2));
}

// Fails safe: a hold file that exists but cannot be read is a hold.
export function readHold(path: string): Hold | null {
  if (!existsSync(path)) return null;
  try {
    const h = JSON.parse(readFileSync(path, "utf8"));
    if (h && typeof h.reason === "string" && typeof h.hard === "boolean") return h as Hold;
  } catch {
    // fall through
  }
  return { reason: "unreadable", hard: true, setAt: "", windows: [] };
}

export function clearHold(path: string): void {
  rmSync(path, { force: true });
}

export function readOverrides(path: string): Override[] {
  if (!existsSync(path)) return [];
  try {
    const v = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(v) ? v.filter((o) => o && typeof o.label === "string" && typeof o.until === "number") : [];
  } catch {
    return [];
  }
}

export function writeOverrides(path: string, overrides: Override[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(overrides, null, 2));
}

// What confirming a hold does. A soft hold suspends that window's threshold
// until the window resets; a hard hold only clears, because the provider will
// refuse again until reset.
export function continuationFor(hold: Hold, nowSec: number): Continuation {
  if (hold.hard) {
    const reset = hold.windows.map((w) => w.resetAt).filter((r): r is number => r !== null && r > nowSec);
    const when = reset.length ? new Date(Math.min(...reset) * 1000).toISOString() : "an unknown time";
    return {
      clear: true,
      override: null,
      warning: `The provider refused further use (${hold.reason}). Calls will fail again until ${when}.`,
    };
  }
  const label = hold.reason as WindowLabel;
  const w = hold.windows.find((x) => x.label === label);
  const until = w?.resetAt && w.resetAt > nowSec ? w.resetAt : Math.floor(nowSec) + 3600;
  return { clear: true, override: { label, until }, warning: null };
}

// Account id for the chatgpt-account-id header. VERIFY against a live token:
// the claim path below is the one Codex tokens are understood to carry.
export function accountIdFromToken(jwt: string): string | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const id = payload?.["https://api.openai.com/auth"]?.chatgpt_account_id;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

// One read-only poll. Never refreshes tokens: pi owns refresh, and OpenAI
// refresh tokens are single-use, so a second refresher breaks pi's login.
export async function fetchUsage(
  token: string,
  accountId: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<QuotaWindow[] | null> {
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    if (accountId) headers["chatgpt-account-id"] = accountId;
    const res = await fetchImpl(USAGE_URL, { method: "GET", headers });
    if (!res.ok) return null;
    return parseUsageResponse(await res.json());
  } catch {
    return null;
  }
}
```

## Appendix C — `scripts/pi-continue.ts` and `bin/pi-continue`

```ts
// scripts/pi-continue.ts — confirm continuation after a quota hold, from outside pi.
// Never reads or refreshes credentials. pi polls usage again at its next
// session_start and re-holds by itself if the window is still over threshold.
//
//   bin/pi-continue          show the hold, ask y/N
//   bin/pi-continue --yes    confirm without asking
//   bin/pi-continue --status show the hold and exit (0 = no hold, 75 = held)

import { createInterface } from "node:readline/promises";
import {
  clearHold,
  continuationFor,
  defaultHoldPath,
  defaultOverridePath,
  readHold,
  readOverrides,
  writeOverrides,
} from "../lib/quota.ts";

const env = process.env as Record<string, string | undefined>;
const holdPath = defaultHoldPath(env);
const overridePath = defaultOverridePath(env);
const args = new Set(process.argv.slice(2));

const hold = readHold(holdPath);
if (!hold) {
  console.log("No quota hold.");
  process.exit(0);
}

const nowSec = Date.now() / 1000;
console.log(`Hold: ${hold.reason} (${hold.hard ? "provider refused" : "threshold reached"}) since ${hold.setAt || "unknown"}`);
for (const w of hold.windows) {
  const reset = w.resetAt ? new Date(w.resetAt * 1000).toLocaleString() : "unknown";
  const passed = w.resetAt && w.resetAt <= nowSec ? " — reset time has passed" : "";
  console.log(`  ${w.label.padEnd(6)} ${String(w.usedPercent).padStart(3)}%  resets ${reset}${passed}`);
}

if (args.has("--status")) process.exit(75);

let ok = args.has("--yes");
if (!ok) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  ok = /^y(es)?$/i.test((await rl.question("Continue? [y/N] ")).trim());
  rl.close();
}
if (!ok) {
  console.log("Still on hold.");
  process.exit(1);
}

const c = continuationFor(hold, nowSec);
clearHold(holdPath);
if (c.override) {
  writeOverrides(overridePath, [...readOverrides(overridePath), c.override]);
  console.log(`Threshold for ${c.override.label} suspended until ${new Date(c.override.until * 1000).toLocaleString()}.`);
}
if (c.warning) console.log(`Warning: ${c.warning}`);
console.log("Hold cleared.");
```

```bash
#!/usr/bin/env bash
exec node --experimental-strip-types --no-warnings "$(dirname "$0")/../scripts/pi-continue.ts" "$@"
```

## Landing

Steps 0–2 implemented. Step 3 withdrawn by Lucas on 2026-09-29 in favour of using both harnesses in production.
