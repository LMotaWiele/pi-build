# pi-build

Config and extensions for the [pi](https://github.com/earendil-works/pi) coding agent (`@earendil-works/pi-coding-agent` 0.99.1). Pi supplies the session, the tools, and the model providers. This repository supplies the setup that runs on top of that: project memory kept in the cached prompt, a pinned session model, and a local record of what the tools did.

The clone can live anywhere. `install.sh` symlinks it into `~/.pi/agent/`.

## What you get on top of a stock pi install

Stock pi reads whatever the model asks to read, stays on the model you picked, and keeps notes only if you put them in a prompt yourself. This setup changes the loop:

- **Memory stays in the prefix.** On session start, the project's `.agent/notes/INDEX.md` is injected into a prompt section named `pi_build_memory`. The agent opens one note per task with `note_open`, patches one front-matter field with `note_update`, and appends the queue with `queue_append`. With `memoryGate.blockRawNotesReads` true, a raw `read` of `.agent/notes/` is blocked. Explanations are a different thing: the harness writes a walkthrough under `.agent/explain/` only when an edit introduces unfamiliar surface for the configured reader. It has two sections; it is not a note. Session recaps live in `.agent/recaps/`.
- **Repeated reads get cheaper.** Inside one turn, a second read of the same file replaces the previous tool result instead of sending the file again. After a write, a repeat read returns a unified diff of the changed lines. If those lines are more than half of the new file, the full file is returned. A read with `offset` and `limit` always passes through.
- **Compaction does not drop the task.** `recap` writes a short summary the next turn can see. `explain` asks a one-shot process, on the explain tier from your host file and with thinking off, whether an edit turn introduced unfamiliar surface. Only then does it write a two-section walkthrough for you; it is not a note. If that model id is not an exact catalog match, the walkthrough is skipped and the turn still finishes.
- **Fresh sessions start on GPT-6 Sol.** `routing.enabled` is false, so this repo does not run a second router. The installed router still registers `smart-router/auto`, which stays out of `enabledModels` and is manual-only. The `routing.tiers` map supplies the pipeline, retry ladder, and explain model.
- **A turn can stop itself.** Bounds abort the turn, without an approval prompt, when the loop passes 60 steps, the turn passes 10 minutes, three tool calls fail in a row, or six reads in a row make no progress.
- **Quota and context stay visible.** The footer shows context as used tokens over the window (for example `42k/272k`) instead of a percentage. Once the Codex quota gate retrieves usage, `5h` and `weekly` percentages follow that count and refresh after usage polls and response headers.
- **Tool use is logged locally** in `~/.pi/agent/telemetry.db` (override with `PI_BUILD_TELEMETRY_DB`). `scripts/report.sql` summarizes cost, cache hit rate, escalation share, deduped reads, note opens, blocked note reads, and bound turns.
- **Web search and subagents are pinned.** `pi-web-access` v0.30.0 reads `~/.pi/agent/web-search.json`: workflow `none`, inline content capped, image and PDF off. `pi-subagent` is pinned to commit `ce26a686f2571188d2e2b4d586e15a82606a7b72`. The `subagent` object in the host settings is not read by that package. Its own default depth is 3. The depth recorded in the host file is 2, which you set with `pi --subagent-max-depth 2` or `PI_SUBAGENT_MAX_DEPTH=2`. Cycle prevention is already the package default.
- **Plan mode** (`/plan`, or Ctrl+Alt+P) is the pi example: read-only exploration, then execution of the numbered plan. **Post-edit typecheck** runs `tsc --noEmit` after a TypeScript edit or write, debounced, and reports the result in the status line.
- **Cache warming is off.** `models.json` keeps the GPT-5.6 and GPT-6 context windows at 272000 and the prompt-cache TTL at 1800 seconds, so a long-context price does not reprice the whole request. `defaultProjectTrust` is `always`.

Each of `memoryGate`, `readGuard`, `recap`, `explain`, `postEditTypecheck`, `bounds`, and `map` turns off when its `enabled` field is `false`. Leaving the field out leaves the extension on. `routing.enabled` stays false. There is no routing extension. The block is the tier map.

## Requirements

- Node.js >= 22.19.0
- `jq`, `git`, and `npm`
- [uv](https://docs.astral.sh/uv/) is optional. The map needs it; everything else runs without it.
- [mise](https://mise.jdx.dev/) is optional. If it is missing and Node is new enough, install continues.

Pi is installed globally at 0.99.1 by the script (`npm i -g @earendil-works/pi-coding-agent@0.99.1`).

## Install

```bash
git clone <repository-url>
cd pi-build
./install.sh
```

The directory name does not matter. Clone it wherever you keep source.

`install.sh` does five things:

1. Installs pi 0.99.1 globally.
2. Picks `settings/hosts/<hostname>.json`. If that file is missing, it falls back to `settings/hosts/machina.json` and says so. That file is the author's model list. Copy `settings/hosts/example.json` to `settings/hosts/<hostname>.json` and put your own provider ids there before you rely on the fallback. `PI_HOST=machina ./install.sh` forces the author's host file.
3. Symlinks that host file to `~/.pi/agent/settings.json`, and symlinks `agent/AGENTS.md`, `agent/models.json`, `settings/web-search.json`, `extensions/`, `skills/`, and `lib/` into `~/.pi/agent/`. Pi loads `~/.pi/agent/extensions` and `~/.pi/agent/skills` on its own, which is why the host file does not contain a machine path. `lib/` is linked too, because the extensions import `../lib` and Pi resolves that path from the symlink. If one of those destinations already exists as a real file or directory, the script stops and tells you to move it aside.
4. Creates `~/.config/pi/env` (mode 600) from `secrets.example.env` when the file is missing. Pi does not load this file. Export it yourself (see below).
5. Runs `pi install` for the two pinned git packages, `npm:pi-context-usage`, and `npm:pi-smart-router@0.8.0`, applies `patches/*.patch`, then `./doctor.sh`.

`secrets.example.env` lists no required names. Chat models on the author's host use `/login`. `./doctor.sh --offline` validates the checkout without a provider call.

Copy `settings/hosts/example.json` to `settings/hosts/<hostname>.json` before installing if this machine is not the author's. Put no secrets in that file. The `packages` array lists the two git refs, `npm:pi-context-usage`, and `npm:pi-smart-router@0.8.0`. Replace `provider/model-id` with any id pi can resolve as `provider/id`. Keep `defaultProvider` as the provider and `defaultModel` as a bare id. Pi uses that default when its composed `provider/id` is in `enabledModels`; otherwise it uses `enabledModels[0]`. The same id in every tier is valid. Codex models map `minimal` thinking to `low`.

## Credentials

`doctor.sh` reads the process environment. It does not read `auth.json`, and it does not source `~/.config/pi/env`.

```bash
set -a
source ~/.config/pi/env
set +a
```

Put that in the shell profile you use to launch pi, or export the variables another way. Doctor requires every name listed in `secrets.example.env`. The committed file lists none.

Any pi-compatible provider works. Put that provider's id in the host file (`provider/model-id`, or `openrouter/openai/gpt-5.6-luna` when the model id itself contains a slash) and put the key's variable name in `secrets.example.env`.

On the author's host, fresh sessions and work use `openai-codex/gpt-6-sol`; scout and explain use `openai-codex/gpt-6-luna`; GPT-6 Astra is manual-only. These use the ChatGPT Plus or Pro subscription, signed in with `/login`, not an OpenAI API key. A written-file bound retries once along Luna → Sol at medium → Sol at high → stop. If GPT-6 Sol is unavailable, the retry fallback is GPT-5.6 Sol at high. Retries never target a per-token provider.

You can also store a provider key with `/login`. `doctor.sh` still requires the names in `secrets.example.env` for the live checks.

Check the provider you configured before trusting a tier. Do not pass `--credentials`; that prints the secret.

```bash
pi auth check --provider openai --json --no-refresh
pi auth check --provider openai-codex --json --no-refresh
```

A tier id has to equal a registry `provider/id` exactly. A partial match does not count. `./doctor.sh --offline` does not ask the live registry, so a fresh checkout can still be validated. Pass `--model smart-router/auto` to start a session on the router. Leave that id out of `enabledModels`.

`~/.config/pi/env`, `auth.json`, and `trust.json` are gitignored.

## Use

Start pi in the project you want to work on:

```bash
pi
```

Global instructions from this repo's `agent/AGENTS.md` apply in every project. A project's own `AGENTS.md` stacks under that file.

**Notes.** On session start the harness checks the active project, which is the nearest directory at or above the working directory that contains `AGENTS.md` (or `.agent/` if there is no `AGENTS.md`). Missing memory files are created from `templates/agent-memory/`. An existing file is left untouched. `memory_bootstrap` does the same thing when you call it. `memoryGate.autoScaffold: false` turns the automatic copy off. `.agent/` describes the behaviour (read the index, then one note) and does not name a pi tool. Pi hears the tool names from a prompt section injected at session start. The per-project skill is `.agent/skills/notes-protocol/SKILL.md`. A legacy index, with a bullet queue and `## Pre-committed next`, keeps working. `node scripts/migrate-notes.js <project>` writes `INDEX.v1.md` and note siblings for you to review; a session never renames them. You read `.agent/explain/` when you want the walkthrough of an edit. `.grok/` beside `.pi/` is expected and left alone.

**Plan mode.** `/plan` or Ctrl+Alt+P toggles read-only exploration. Write tools come back when you leave the plan or execute it.

**Models.** Fresh sessions use GPT-6 Sol at medium. A bound that trips after a file was written retries once along the GPT-6 ladder. Each turn appends one cost line to the session log: tier, inference calls, prompt tokens, cache hit, completion tokens, reasoning share, turn cost, and cumulative session cost. Telemetry copies the router's tier when `SMART_ROUTER_DATASET` is `1`, which the harness sets when it attaches.

**Web search.** After `pi-web-access` is installed, the agent gets `web_search`, `fetch_content`, `source_check`, and `get_search_content`. Provider choice is left to the package. Image and PDF tools are disabled in `settings/web-search.json`.

**Subagents.** Pass the depth when you want the value from the host file:

```bash
pi --subagent-max-depth 2
```

**Disable one piece.** In the host settings file:

```json
"readGuard": { "enabled": false }
```

The same `enabled: false` pattern works for `memoryGate`, `recap`, `explain`, `postEditTypecheck`, and `bounds`. Plan mode has no settings flag; leave it with `/plan`.

## Developing with pi

Write a spec in the current template with its sibling `.tests/` directory. Ask pi to implement it with `implement_spec`: the pipeline runs as a tool call in the chat, streaming progress while the session waits. The terminal route remains available: from this repository, preview the run with `bin/pi-implement <spec> --dry-run`, then start it with `bin/pi-implement <spec>`. Review the resulting branch, run record and report before merging. If something later proves wrong, use `bin/pi-rework`.

Stuck loops receive a nudge, then escalate through the retry ladder; token and cost budgets stop the turn instead of retrying. The 5-hour quota window pauses and resumes automatically. The weekly window holds for you; release it with `bin/pi-continue`. Use `bin/pi-implement <spec> --resume` to continue a held pipeline run.

## Map

`extensions/map.ts` rebuilds a map of the project after every turn that read or wrote a file inside it. The build is `tools/map`, a Python tool run with [uv](https://docs.astral.sh/uv/); the extension never waits for it, and a second request during a build runs once more when the first exits. Without `uv` on `PATH` the extension logs one warning and stays off.

The page is `.agent/map/index.html`: one self-contained file that opens from disk.

- **Treemap**: files and functions sized by lines of code, colored by complexity, agent edits, reads, cost, or git commits. Files edited in the highlighted turn get a thick outline.
- **Call graph**: turns, loops, model calls, tool calls, guards, and explain or recap subagents from `telemetry.db`, over the window or one turn at a time.
- **Data model**: types, SQLite tables, and file stores, their relations, and which code reads or writes them.

```bash
/map          # build now and print the page path
/map open     # build and open it
uv run --project tools/map python -m map_build --repo . --telemetry ~/.pi/agent/telemetry.db
```

`.agent/map/` holds a `.gitignore` of `*`, so the map is never committed. A project can declare its stores and query rules in `.map/project.toml` and `.map/rules/`; this repository's are the example. Settings block `map`: `enabled`, `outDir` (default `.agent/map`), `windowDays` (7), `uv` (`"uv"`), `toolDir` (default `tools/map` beside the extension). `tools/map/SPEC.md` is the contract.

## Check the install

```bash
./doctor.sh --offline
./doctor.sh --project .
./doctor.sh
```

`--offline` checks JSON, the versions in `deps.txt`, that `pi list` contains the pinned packages, the project's memory files, and the unit tests, runs the map tests when `uv` is installed (else prints `skipped: uv not installed`), then times `pi --version`. It prints `skipped: no credentials` for the live calls and exits 0 when that subset passes. `--project <path>` checks one project's memory files and exits. It does not start a session. A status in the index that disagrees with the note's `**Status:**` line fails the check.

Full `./doctor.sh` exits 1 when a name in `secrets.example.env` is unset. When every listed name is set, it smokes each distinct tier id from `settings/hosts/machina.json` and calls `note_open` and `queue_append`.

Regenerate the per-project skill after editing the notes README:

```bash
./doctor.sh --emit-skill > .agent/skills/notes-protocol/SKILL.md
```

Unit tests, with no install and no network:

```bash
node --experimental-strip-types --test tests/*.test.ts
```

There is no `package.json` and no build step. Pi runs the extension entry points directly.

Acceptance numbers over a week of use are not in this repository. Query a real session log with:

```bash
sqlite3 ~/.pi/agent/telemetry.db < scripts/report.sql
```

## Layout

```
AGENTS.md                  this repo's contract
agent/AGENTS.md            global instructions, symlinked into ~/.pi/agent/
agent/models.json          the author's context window and prompt-cache TTL
extensions/                memory, read guard, bounds, recap, explain, plan mode, map
lib/                       markdown, scaffold, skill, telemetry
tools/map/                 the map build (Python, uv); SPEC.md is its contract
.map/                      this repo's map stores and query rules
settings/hosts/machina.json    the author's models
settings/hosts/example.json    portable host: one id, or several tier ids
settings/web-search.json   pi-web-access config
templates/agent-memory/    files copied into a project that lacks them
.agent/                    this repo's own notes, skill, and explain directory
scripts/report.sql         one sqlite query over telemetry.db
scripts/migrate-notes.js   write v1 siblings for a legacy notes tree
install.sh  doctor.sh  deps.txt  secrets.example.env
```

## License

MIT, copyright (c) 2026 LMotaWiele. See [LICENSE](LICENSE).

[NOTICE](NOTICE) names the third-party pieces:

- `extensions/plan-mode/` is the pi 0.87.0 example. Copyright (c) 2025 Mario Zechner, MIT.
- `extensions/post-edit-typecheck.ts` is a modified copy from [Rmnlly/pi-config](https://github.com/Rmnlly/pi-config) at `ac0bb8ed`, and that repository publishes no license. The MIT license here does not grant rights to that file. Delete it if you need a uniformly MIT tree. The other extensions load without it.
- `tools/map/map_build/render/vendor/` holds d3 7.9.0 (ISC, copyright Mike Bostock) and @dagrejs/dagre 3.1.1 (MIT, copyright Chris Pettitt), inlined into the map page.
- `pi-web-access` and `pi-subagent` are not vendored. `install.sh` clones the pinned refs. Both upstream projects are MIT.
- Pi itself is MIT, copyright (c) 2025 Mario Zechner.

## Keep these out of git

`.gitignore` already excludes `auth.json`, `trust.json`, `npm/`, `*.db`, `sessions/`, and `*.env` except `secrets.example.env`. Do not commit API keys, OAuth tokens, telemetry databases, or session transcripts.
