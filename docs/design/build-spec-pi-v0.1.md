# Build spec — Pi harness v0.1

**Place at:** `docs/design/build-spec-pi-v0.1.md`
**Audience:** coding agent. Creates the `pi-build` repo (config + four new extensions), installs and pins six third-party extensions, and adds one skill. No changes to any project's `src/`. No new `.md` beyond this one and the files this spec names.
**Read first:** `AGENTS.md`, `.agent/notes/INDEX.md`, this file in full.
**Status:** spec, ready to build. Files were written on 2026-09-21 against `@earendil-works/pi-coding-agent@0.87.0`. Step 19 (a week of real use) has not been run. Do not invent the §16 table.
**Supersedes:** `docs/design/pi-setup.md` §7 (phased rollout), `docs/design/pi-build-v0.1.md`

The design below is unchanged. Where a VERIFY check disagreed with a sample value, the built file uses the live value and `.agent/notes/INDEX.md` § Active next has a row (source `human`, added 2026-09-21). Those rows are the corrections. §4.3 is the API map.

---

## §0 How to read this spec

### 0.1 It is self-contained on purpose

Every design choice below carries its justification inline, usually a measured number. That is deliberate: without the reason, a later reader treats a decision as arbitrary and "improves" it. If you disagree with a choice, the number that justified it is in the same paragraph — argue with that, not with the choice.

### 0.2 Handling unknowns

This spec was written without access to the installed pi version. Some things are marked **VERIFY** or **DISCOVER**. Two protocols, and they differ:

- **DISCOVER** — the answer exists in pi's source, docs, or type definitions. Go find it, record it in §4's table, then proceed. Do not ask.
- **VERIFY** — a factual claim that may be stale (a price, an API shape, a model id). Check it against the live source. If it is wrong, use the correct value and append a row to `.agent/notes/INDEX.md` § Active next noting the correction. Do not silently proceed on a value you found to be wrong.

If something is neither, and you genuinely cannot proceed: **stop and ask**. Do not invent an interface and build against it.

### 0.3 Global constraints

- **No commits, no pushes, no PRs.** Build the files; the human commits.
- **No new top-level directories** beyond those named in §3.
- **Every third-party package is pinned** by tag or commit. Never install unpinned.
- Write TypeScript. Pi runs extension entry points directly — no build step — so no bundler, no transpile step, no `dist/`.
- Each extension is independently disable-able via its settings block. If one fails to load, the others must still work.

---

## §1 Glossary

These names appear throughout and are part of the contract. Do not rename them.

| Term | Means |
|---|---|
| **tier** | A named model role: `scout`, `work`, `escalate`, `explain`. Not a model id — the mapping lives in settings. |
| **turn** | One user prompt and everything the agent does until it stops. Contains many inference calls. |
| **loop index** | The count of inference calls inside the current turn. Measured p75 = 54, p90 = 101, max = 183. |
| **decision** | One call to Jev returning typed answers to a named question set. Costs ~$0.00008. |
| **state projection** | The ≤4k-token summary built for a decision. Never the conversation. |
| **note** | A file under `.agent/notes/` with the front-matter schema in `.agent/notes/README.md`. |
| **queue** | `.agent/notes/INDEX.md § Active next`. The single authority on what happens next. |
| **explanation** | A walkthrough under `.agent/explain/`. Never a note, never indexed. |
| **prefix** | The cached portion of the prompt. Average measured size ~119k tokens. |

---

## §2 What you are building

A configuration repo (`pi-build`) that reconstructs a complete pi setup on any machine, plus four new extensions that make the existing markdown memory system cheap to use.

### 2.1 The problem being solved

Telemetry from the outgoing harness, nine days and one detailed session:

| Observation | Value | Consequence |
|---|---|---|
| Average prompt size | ~119k tokens | every avoidable tool call is expensive |
| Cache hit rate | 92.4% | good, and load-bearing — cache is worth 5.4x |
| Cache read price (outgoing vendor) | 25% of input vs 10% convention | 43% of the bill |
| Reasoning share of output | 76% at `effort: high` on every call | largest config-only saving |
| Repeat file reads | 53%, of which 17/64 pure waste | the read-guard's target |
| Notes files opened per task | 4, where the protocol permits 1 | the memory-gate's target |
| Measured session cost | $13.02 for 12 prompts | the baseline to beat |

Three fixes, in descending order of value: **provider change**, **thinking levels**, **fewer reads**. Routing is fourth. Build all of it, but if cost does not fall on the first three, the config is wrong and routing will not rescue it.

The $13.02 figure is `costUsdTicks / 1e9` summed over the twelve `turn_completed` events (13,017,950,600 ticks). Retired baseline prices, kept out of `models.json` because that file rejects unknown keys: grok-4.6-build input $3.40 / cached $0.85 (25% of input) / output $10.20 per 1M.

### 2.2 Component map

```
pi-build (config repo)
├── settings + models          → §5
├── extensions/
│   ├── memory-gate            → §6   notes become prefix, not tool calls
│   ├── read-guard             → §7   stop re-reading unchanged files
│   ├── recap                  → §8   survive compaction
│   ├── explain                → §9   walkthrough per edit turn
│   ├── jev/                   → §10  decision adapter + state builder
│   └── routing                → §11  tier selection + bounds
└── skills/notes-protocol/     → §14  README.md becomes instructions

adopted, pinned                → §12  web access, subagents, plan mode,
                                      post-edit typecheck
```

Audit, status bar, and todos were not installed. See §4.3 and §12.

---

## §3 Repo layout and file manifest

Create exactly this, plus the files later sections require (`scripts/report.sql`, `.agent/notes/README.md`, `.agent/notes/INDEX.md`, `settings/web-search.json`, and the copied plan-mode and post-edit-typecheck extensions). No `prompts/` or `themes/` directory: those keys were omitted so a missing directory cannot fail load. No `package.json`. Tests run with `node --experimental-strip-types --test`.

```
~/src/pi-build/
├── README.md
├── install.sh                       # §15.1
├── doctor.sh                        # §15.2
├── deps.txt
├── .mise.toml                       # pinned Node 22.19.0
├── secrets.example.env              # variable NAMES only, never values
├── .gitignore                       # auth.json, trust.json, npm/, *.db, sessions
├── settings/
│   ├── hosts/machina.json           # §5.1 — symlinked to ~/.pi/agent/settings.json
│   └── web-search.json              # what pi-web-access actually reads
├── agent/
│   ├── AGENTS.md
│   └── models.json                  # §5.2 — symlinked to ~/.pi/agent/models.json
├── skills/
│   └── notes-protocol/SKILL.md      # §14.1
├── extensions/
│   ├── memory-gate.ts               # §6
│   ├── read-guard.ts                # §7
│   ├── recap.ts                     # §8
│   ├── explain.ts                   # §9
│   ├── routing.ts                   # §11
│   ├── post-edit-typecheck.ts       # copied, §12
│   ├── plan-mode/                   # copied, §12. index.ts + utils.ts only
│   └── jev/
│       ├── adapter.ts               # §10.1
│       ├── state-builder.ts         # §10.2
│       ├── questions.ts             # §10.3
│       └── fixtures/                # §10.4
├── lib/
│   ├── markdown.ts                  # §6.2
│   └── telemetry.ts                 # §13
├── scripts/report.sql               # §13
├── tests/
│   ├── markdown.test.ts
│   ├── state-builder.test.ts
│   └── read-guard.test.ts
└── .agent/notes/
    ├── README.md                    # canonical protocol, skill source
    └── INDEX.md                     # queue, including VERIFY rows
```

**Never tracked:** `auth.json`, `trust.json`, `~/.pi/agent/npm/`, `*.db`, session files. `secrets.example.env` stays tracked (`!secrets.example.env`).

Hostname on this machine is `george-contis-Machina-Ub`. `install.sh` uses `settings/hosts/${PI_HOST:-hostname}.json` and falls back to `machina.json` when that file is absent. `PI_HOST=machina` selects it directly.

---

## §4 DISCOVER — pi's extension API

Discovered against the installed package `@earendil-works/pi-coding-agent@0.87.0` and its `packages/coding-agent` sources. Every capability in §4.2 exists. Nothing below was invented to fill a gap.

### 4.3 Record the mapping here

| Capability | pi API | Notes |
|---|---|---|
| Register a tool | `pi.registerTool({ name, label, description, promptSnippet, promptGuidelines, parameters: Type.Object(...), execute })` | `execute(toolCallId, params, signal, onUpdate, ctx)` returns `{ content: [{ type: "text", text }], details, isError? }`. `Type` is from `typebox`. memory-gate registers `note_open`, `note_update`, `queue_append`, `explain_write`. Jev is not a pi tool. |
| Intercept and block a tool call | `pi.on("tool_call")` returns `{ block: true, reason }` | `event.input` is mutable. The first `block: true` wins. A block becomes an error result and does **not** emit `tool_result`. memory-gate blocks raw notes reads only when `memoryGate.blockRawNotesReads === true`. Bounds must not count those blocks as tool failures. |
| Observe a tool result | `pi.on("tool_result")` | Content is mutable. read-guard does **not** block a repeat read. It lets the read run, then replaces `content` and sets `isError: false`. Outcome `deduped`. |
| Session start | `session_start` (`startup\|reload\|new\|resume\|fork`) | Async factories are awaited before this event. The prefix itself is injected on `before_agent_start`, because that is when the system prompt is assembled. |
| Session end | `session_shutdown` (`quit\|reload\|new\|resume\|fork`) | Recap writes when the reason is `quit` or an earlier `agent_end` had `stopReason: "aborted"`. |
| Compaction | `session_compact` | Fires after compaction. recap re-injects the marked block and calls `markContextDropped()`. |
| Inject prefix text | `before_agent_start` mutates `event.systemPromptOptions.sections` | Section name `pi_build_memory` (`/^[a-z][a-z0-9_-]*$/`). Markers `<!-- pi-build:memory -->` … `<!-- /pi-build:memory -->`. Do not return `systemPrompt`; that replaces the whole prompt and misses the cache. |
| Read the active model | `ctx.modelRegistry.find(provider, id)` | routing resolves `openai/gpt-5.6-terra` and `openai-codex/gpt-5.6-sol` that way. |
| Switch model / spawn subagent | `pi.setModel` + `pi.setThinkingLevel`, only when the user prompt text changes | Never mid-loop. Explain and recap spawn `pi --mode json --no-session --model openai/gpt-5.6-luna --thinking off --tools read`. Escalation uses mjakl's `subagent` tool. Thinking levels include `off`. |
| Token usage | assistant `message_end` → `message.usage` | `input`, `output`, `cacheRead`, `cacheWrite`, `reasoning`, `cost.total`. Mapped to the §13 columns. |
| Cache warming override | `cache_warming_decision` may return `{ action: "warm" \| "stop" }` | The event is overridable. v0.1 still sets global `cacheWarming: "off"`. v0.2 can stop warming when the provider is subscription-backed. |
| Abort the turn | `ctx.abort()` | bounds calls it once, logs `tool_name=bound`, `outcome=blocked`, `blocked_by=bounds`, and does not prompt. |
| Read range | built-in `read` takes `path`, `offset` (1-indexed line), `limit` | The spec's `start`/`end` parameters are dropped. `force` is **not** in the schema. `event.input.force` is honored if it arrives. A range read is the supported way to re-read. |
| Settings symlink | `FileSettingsStorage.withLock` does `lockfile.lockSync(path, { realpath: false })` then `writeFileSync` | Not temp+rename. **Empirical:** after `pi install` of both pinned packages, `~/.pi/agent/settings.json` was still a symlink to `settings/hosts/machina.json`. Custom keys survived. Approach kept. |
| `defaultProjectTrust` | `"ask" \| "always" \| "never"`, default `"ask"` | The sample value `trusted` is rejected. Built value is `always`. Non-interactive `-p`, `--mode json`, and `--mode rpc` with `ask` or `never` ignore project resources. |
| `models.json` | `{ "providers": { "<id>": { "modelOverrides": { ... } } } }` only | Any other top-level key fails TypeBox. Do not redeclare built-in GPT-5.6 models. `promptCache` is `{ "short": 1800, "long": 1800 }` seconds, not `lifetimeSeconds: 3600`. `contextWindow` stays 272000. Above that, long-context rates reprice the whole request. `jq` rejects comments, so the JSON files have none. Jev is not a chat model and is not in this file. |
| Extension discovery | `extensions/*.ts` and one subdirectory level with `index.ts` | `!**/wip-*` is not a filter. It was omitted. `extensions/jev/` has no `index.ts`, so pi does not load it. routing imports it. |
| `pi install` | `pi install <source>` | A bare `pi install` exits 1: `Missing install source` on 0.87.0. install.sh calls the two git refs below. Pi wrote the `packages` array. |
| Packages skipped | — | `kcosr/pi-extensions` v0.2.5 has no installable root and needs a collector daemon. `enhansome/enhansome-pi-coding-agent` is an awesome-list. Telemetry covers argument logging. Pi's footer already shows tokens, cache, cost, and context. Plan mode's `/todos` is the copied example. |
| Web search config | `~/.pi/agent/web-search.json` | Not `settings.webAccess`. The settings block is kept as intent. The file that is read is `settings/web-search.json`, symlinked. `workflow: "none"`, `maxInlineContentChars: 8000`, image and pdf disabled. Tools: `web_search`, `fetch_content`, `source_check`, `get_search_content`. No collision with `note_open`, `note_update`, `queue_append`, `explain_write`, or `subagent`. No rename key in v0.30.0. |
| Web search auth | Codex OAuth can drive OpenAI search | v0.30.0 README: if the active model is `openai-codex`, auto routing tries Codex-backed search. DuckDuckGo is explicit-only (`provider: "duckduckgo"`). v0.1 does **not** force DuckDuckGo for escalate. Tag `v0.30.0` checked out commit `6c5afa1`. |
| Subagent cache | mjakl `runner.ts` `buildPiArgs` | One `pi` process per subagent call. With a `session` it passes `--session-id` (its own transcript). Otherwise `--no-session`. A child does not share the parent's prefix, which is the point of §11.2. Cache across the child's own calls is the same prefix rule as any pi session (GPT-5.6 TTL 1800s) and was **not measured** with a live Codex request. Explain and recap are one-shot processes and do not need that. Delegation is still shipped, because it does not discard the parent prefix. Pin is commit `ce26a686f2571188d2e2b4d586e15a82606a7b72` (per-call `thinking`, including `off`), not tag v3.0.0. The package does not read a `settings.subagent` block. `maxDepth` 2 is `--subagent-max-depth`. The JSON block documents the intent. |
| Context files | global `~/.pi/agent/AGENTS.md` and the project `AGENTS.md` both load | `--no-context-files` disables them. There are no prompt templates in this repo, so Read-first lists were not edited. |
| Prices | built-in catalog in `@earendil-works/pi-ai` 0.87.0, short-context tier | Luna input 0.20, cacheRead 0.02, cacheWrite 0.25, output 1.20. Terra 2.00 / 0.20 / 2.50 / 12.00. openai Sol promo 4 / 0.40 / 5 / 20. openai-codex Sol catalog is still 5 / 0.50 / 6.25 / 30. No dollar override is applied. Cache write is 1.25× uncached input. Context window on all three is 272000, with a higher tier above that. |
| Jev | `POST https://openrouter.ai/api/alpha/decisions` body `{ model, state, questions }` | Model `typesafe/jev-1.13` was accepted on 2026-09-21. HTTP 200, answer shape `{ answers: { single_file_edit: { type: "noul", noul: 0.8 } } }`, echoed model `typesafe/jev-1.13-20260917`. Unauthenticated call is 401. Only `extensions/jev/adapter.ts` knows the URL, the slug, and the error shapes. |
| Credentials on this machine | `pi auth check --json --no-refresh` | `openai` and `openai-codex` are both `credentials_not_configured`. Until that changes, built-in GPT-5.6 models are absent from `pi --list-models`. The pattern `openai/gpt-5.6-luna` then partial-matches OpenRouter's model id, because `OPENROUTER_API_KEY` loads that catalog. `openai-codex/gpt-5.6-sol` matches nothing and warns at every startup. A headless `OK` in that state is not the direct OpenAI tier. |
| mise | not installed | install.sh continues when `node -v` is >= 22.19.0. This machine has v24.18.0. |
| Startup timing | not split per extension | doctor prints one elapsed time per tier smoke. Pi does not emit a per-extension breakdown. |
| `blockRawNotesReads` | `true` in the shipped settings | That is the step-18 value. Set it to `false` for the first live session if you want log-only interception first. The flag is the window. The file is the final value. |

---

## §5 Configuration

### 5.1 `settings/hosts/machina.json`

Symlink: `ln -sfn ~/src/pi-build/settings/hosts/machina.json ~/.pi/agent/settings.json`.

**Why a symlink.** Pi writes `settings.json` itself. A generated file would destroy those writes. Source and the install on 2026-09-21 both say the symlink survives (`writeFileSync` through `realpath: false`). `packages` in the file was written by `pi install`, not by hand.

Built differences from the sample, each with an INDEX row:

- `defaultProjectTrust` is `always`, not `trusted`.
- `extensions` is only `~/src/pi-build/extensions`. The `!**/wip-*` entry is omitted.
- `prompts` and `themes` are omitted.
- `cacheWarming` is `off`.
- `modelThinkingLevels`: luna `minimal`, terra `low`, sol `high`.
- `memoryGate.blockRawNotesReads` is `true`.
- `webAccess` remains as declared intent. The extension reads `web-search.json`.
- `subagent` and `audit` remain as documentation. `audit.approval` is `false`. `audit.logToolArguments` is `true`. The SQLite log that actually records arguments is `~/.pi/agent/telemetry.db`.

`enabled: true` is set on `memoryGate`, `readGuard`, `recap`, `explain`, `postEditTypecheck`, `bounds`, and `routing`. `enabled: false` disables that one extension. An absent block means the extension loads.

### 5.2 `agent/models.json`

Symlink to `~/.pi/agent/models.json`. Shape is `providers.openai.modelOverrides` and `providers.openai-codex.modelOverrides` for `gpt-5.6-luna`, `gpt-5.6-terra`, and `gpt-5.6-sol`. Each sets `contextWindow: 272000` and `promptCache: { short: 1800, long: 1800 }`. Costs stay on the built-in catalog. Sol has no dollar override.

### 5.3 Cache warming

Global `off` in v0.1. The `cache_warming_decision` event exists and is the v0.2 hook. Do not warm the Codex subscription path: there are no dollars to save, and a warm spends quota.

---

## §6 `memory-gate`

Measured: 19 reads across 4 notes files. The protocol permits one note per task.

| Surface | v0.1 access |
|---|---|
| `AGENTS.md` | context file, global and project |
| `.agent/notes/README.md` | skill `notes-protocol`, never a file read |
| `.agent/notes/INDEX.md` | injected at `before_agent_start` |
| other notes | `note_open`, one per task |
| `.agent/explain/` | written only |

Parsers live in `lib/markdown.ts` and are pure. Headings are matched verbatim to `.agent/notes/README.md`. A missing required heading throws `ParseError`. Placeholder rows (`_(empty)_`, `_(none yet)_`, `_(add rows as findings appear)_`) become empty lists. A parse failure is logged, shown, and fails open for that file.

Injection uses section `pi_build_memory` and the markers above. Budget 2000 tokens: Notes and Do-not stay whole; Active next keeps 10 rows and a remainder count.

Tools: `note_open`, `note_update` (rejects `Status: sealed`, patches one field, updates `Last updated`), `queue_append` (next integer `n`), `explain_write` (`.agent/explain/YYYY-MM-DD-<slug>.md`, never INDEX).

Read rejection names the alternative. It blocks only when `blockRawNotesReads` is true. Otherwise it logs `would block`.

---

## §7 `read-guard`

Per user prompt, not per pi `turn_start`, and not reset on an overflow retry of the same prompt. Reset on a new prompt and on the compaction epoch.

| Condition | Response |
|---|---|
| First read this turn | Pass through. Record content. |
| Repeat, no write | Pointer: already read at call N. Outcome `deduped`. No extra bytes in the result content. |
| Repeat, write since | Unified diff of changed hunks (3 lines of context). |
| Changed lines > 50% of the new file | Full file. The comparison is changed-line bytes, not a diff that reprints every unchanged line. |
| `offset` or `limit` set | Always pass through. |
| `force: true` if present | Bypass and log. |

Paths under `.agent/notes/` are left to memory-gate. `readGuard.enabled: false` passes every read.

---

## §8 `recap`

On `session_compact`, rebuild one marked block: the INDEX injection, the open note's current claim and pre-committed criteria, the plan todos if present, and the last recap. Cap the extra text. Then signal read-guard. A second compaction replaces the block; it does not duplicate it.

On session end (quit or abort), spawn scout with thinking off and write `.agent/explain/YYYY-MM-DD-session-<n>.md` plus a session entry. Do not write notes or the queue.

---

## §9 `explain`

After a turn that wrote at least one file, collect the diff and spawn a one-shot scout process with tools `read` only. The parent writes the result via the filesystem, not by asking the model to call `explain_write`. Five sections, in order: What changed, Unfamiliar surface, The alternative, Verify by hand, To modify this yourself. Append new `known:` lines to `.agent/explain/known.md` without duplicating exact lines. No writes means no explanation.

---

## §10 `jev`

### 10.1 Adapter

`decide(state, questions, opts)` posts `{ model: "typesafe/jev-1.13", state, questions }` to `https://openrouter.ai/api/alpha/decisions`. Bool questions go out as `noul`. Enum questions go out as `choice`. Timeout 3s. One retry on transport, 408, 429, or 5xx, after 500ms. No retry on timeout or on 400, 401, 402, 403, 413. On failure, return the caller's defaults and log. Routing's defaults set `needs_repo_reasoning: true`, which `selectTier` maps to `escalate`.

### 10.2 State builder

`buildState(ctx, budgetTokens = 4000)`. Order: user prompt (first 1k tokens, with the label kept inside that 1k), loop index, elapsed ms, tier, tools (name, outcome, path only), files written, index row and current claim, last tool result (500 tokens), files read. Drop from the bottom when over budget. Always log the token count.

### 10.3 Questions

`tier_select`, `escalate_check`, `guard_check`, `criteria_eval` (`c0`… from the open note), `index_resolve` (enum built from the live INDEX topics, or `(none)`).

`selectTier`: `needs_repo_reasoning` or `unfamiliar_stack` → escalate; `single_file_edit` and `spec_exists` and `reversible` → work; otherwise escalate. Scout is not selected here.

### 10.4 Fixtures

Twelve turns from the measured session `updates.jsonl` (175 tool calls, all twelve ended `end_turn`). `fixtures/turn-01.input.json` … `turn-12.input.json` are the `TurnContext` values. `.expected.txt` is `buildState` output locked after the builder's last change. Payloads are not stored. The projection test asserts a byte match and the 4k budget. It passed.

---

## §11 Routing and bounds

Tier selection runs when the user prompt text changes, not on an overflow retry. `pi.setModel` runs then, before the loop. It does not run again mid-loop.

Bounds, in `routing.ts`, independent of `routing.enabled`:

| Bound | Value | Basis |
|---|---|---|
| Max loop depth | 60 | p75 = 54, p90 = 101 |
| Wall clock | 600000 ms | max observed 472s |
| Consecutive tool failures | 3 | `run_terminal_command` fails 5.2% |
| No progress | 6 reads, 0 edits | index-then-read-anyway |
| Per-turn spend | unset | needs a week of cost data |

A memory-gate block is not a tool failure. Hitting a bound aborts and writes the reason. It does not prompt.

---

## §12 Adopted extensions

Installed, by `pi install`, pinned:

| Source | Pin |
|---|---|
| `nicobailon/pi-web-access` | `v0.30.0` (commit `6c5afa1`) |
| `mjakl/pi-subagent` | `ce26a686f2571188d2e2b4d586e15a82606a7b72` |

Copied, not installed:

| Source | Where |
|---|---|
| pi `examples/extensions/plan-mode` | `extensions/plan-mode/` (`index.ts`, `utils.ts`) |
| `Rmnlly/pi-config` `post-edit-typecheck.ts` at `ac0bb8ed` | `extensions/post-edit-typecheck.ts`, import rewritten to `@earendil-works/pi-coding-agent` |

Not installed, on purpose: `kcosr/pi-extensions`, anything from the enhansome list, `@juicesharp/rpiv-todo`. No graph index, no vector store, no embedding memory, no daemon. The measured problems were repeat reads inside a turn and context loss across compaction. Retrieval does not remove either. `fix-spec-pi-v0.1-interop.md` removes `kcosr/pi-extensions` and the enhansome status-bar and todos packages from this manifest: own telemetry covers the tool-call columns, and enhansome was not found as an installable source.

---

## §13 Telemetry

`lib/telemetry.ts`. SQLite at `~/.pi/agent/telemetry.db` or `PI_BUILD_TELEMETRY_DB`. Schema is the two tables and the path index in the original spec, unchanged. `outcome` is `success | error | blocked | deduped`. `blocked_by` is `memory-gate | read-guard | bounds` or null.

`scripts/report.sql` is one query. It emits, per session: cost, cache hit (`cached/prompt`), reasoning share (`reasoning/completion`), wasted re-read rate (`deduped` reads / `read` calls), `note_open` per turn, raw notes blocked, bound-turn rate, escalation share.

---

## §14 Skills and context files

`skills/notes-protocol/SKILL.md` is generated from `.agent/notes/README.md`. Front matter `name: notes-protocol`. `doctor.sh --emit-skill` prints it. `doctor.sh` fails if the file has drifted. Amended by `fix-spec-pi-v0.1-interop.md` §4.4: the skill that both harnesses load lives at `.agent/skills/notes-protocol/SKILL.md` and does not name a pi tool. `doctor.sh --emit-skill` prints that behavioural skill.

`agent/AGENTS.md` is the global context file. It states the same rules and forbids mid-turn model switches and approval prompts.

---

## §15 Build order

The order in the original spec stands. Steps 1–18 are on disk. Step 19 is not: there has been no week of use, and `OPENAI_API_KEY` is unset, so doctor stopped before the tier smokes.

### 15.1 `install.sh`

mise if present, otherwise continue when Node >= 22.19.0. `npm i -g @earendil-works/pi-coding-agent@0.87.0`. Symlink settings (hostname fallback), `AGENTS.md`, `models.json`, and `web-search.json`. Create `~/.config/pi/env` from the example if missing. Then the two `pi install git:…@ref` commands. Then `doctor.sh`. Pi does not auto-load `~/.config/pi/env`.

### 15.2 `doctor.sh`

Fails closed. Checks JSON, `deps.txt`, `pi list` against `packages`, every name in `secrets.example.env`, skill drift, and the unit tests. If a secret is unset it exits before the provider smokes, the tool smoke, and `decide()`. On 2026-09-21 it exited 1 because `OPENAI_API_KEY` was unset. `OPENROUTER_API_KEY` was set; a separate POST to the decisions endpoint returned 200. That does not make doctor pass.

---

## §16 Acceptance

Do not fill this table with invented numbers. `scripts/report.sql` computes it from `telemetry.db` after real use.

| Metric | Baseline | Target | Source |
|---|---|---|---|
| Cost per work session | $13.02 | < $3 | `inference_calls.cost_usd` |
| Cache hit rate | 92.4% | > 90% | `cached_tokens / prompt_tokens` |
| Reasoning share of output | 76% | < 40% | `reasoning_tokens / completion_tokens` |
| Wasted re-reads | 27% of reads | < 10% | `outcome = 'deduped'` |
| Notes files opened per task | 4 | 1 | `note_open` count per turn |
| Raw notes reads blocked | n/a | trends to 0 | `blocked_by = 'memory-gate'` |
| Turns ending on a bound | n/a | < 5% | `blocked_by = 'bounds'` |
| Escalation share of calls | n/a | measure, do not target | `tier = 'escalate'` |

If cost stays at or above $4 with routing disabled and only the provider change plus thinking levels applied, the configuration is wrong. Do not tune routing first.

Direct OpenAI and Codex credentials are not configured on this machine yet. Until `pi auth check --provider openai` and `--provider openai-codex` are ready, the cost comparison is not meaningful: a luna prompt can partial-match OpenRouter.

Pass/fail checks for exact model resolution, legacy notes, scaffold safety, and `doctor.sh --offline` are in `fix-spec-pi-v0.1-interop.md` §8. Do not invent the trend numbers above.

---

## §17 Web search

`nicobailon/pi-web-access@v0.30.0`, `workflow: "none"`, chunked fetch (`maxInlineContentChars: 8000`), image and pdf disabled. Auto routing. Do not force DuckDuckGo. Tool names do not collide with the tools this repo registers.

---

## §18 Do not

- Do not add a vector store, graph index, or embedding memory.
- Do not add approval prompts.
- Do not switch the main session's model mid-turn.
- Do not fail closed on a parse error.
- Do not let a Jev failure block a turn.
- Do not write explanations into `.agent/notes/` or INDEX.
- Do not commit, push, or open a PR.
- Do not create top-level directories beyond §3.
- Do not install anything unpinned.
- Do not build further decision points on top of a failing state-builder fixture test. That test currently passes.
- Do not change the notes format, the front-matter schema, or the INDEX structure.
