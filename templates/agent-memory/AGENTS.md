<!-- agent-memory-schema: 1 -->
# Project rules

Agent-agnostic layout and conventions. Stacks on `~/.pi/agent/AGENTS.md` (global routing + spawn policy). Prefer **AGENTS.md** — no `CLAUDE.md` / `.claude/`.

## Overview (fill in)

- **Purpose**: _TODO_
- **Stack**: Python >= 3.12 (`pyproject.toml`, hatchling, `.venv`)
- **Package**: _TODO_ (`src/<package>/` — set by init from project dirname)
- **Build / test**: `source .venv/bin/activate` · `pip install -e '.[dev]'` · `pytest`

## Layout

```
project/
├── AGENTS.md              # this file
├── README.md              # human: what + how to run
├── pyproject.toml         # Python project (init: >=3.12, hatchling)
├── .venv/                 # local venv (init: Python 3.12; gitignored)
├── CHANGELOG.md           # optional
├── src/<package>/         # production code only
├── tests/                 # mirrors src/ one-to-one
├── scripts/               # runnable one-offs — never imported by src/
├── notebooks/             # demos/experiments — not production logic
├── docs/design/           # ADRs / design ("why") — sealed authority
├── docs/                  # other topics
├── bench/                 # optional evals (runs|analysis|ref)
├── .agent/skills/         # shared SKILL.md (harness-agnostic)
├── .agent/notes/          # durable findings — INDEX.md first (see rule 7)
├── .agent/explain/        # walkthroughs for the human — NOT indexed (rule 11)
├── .pi/settings.json      # harness wiring: project overrides only
├── .pi/agents/            # subagent definitions (tier → pinned model)
├── .pi/extensions/        # project-local extensions, if any
└── .mcp.json              # optional extra MCP only (not CRG)
```

Rationale for buckets: `docs/design/layout.md` (read on demand).
Harness design: `docs/design/pi-setup.md`.

## Hard rules

1. New modules under `src/<package>/…` only — never free-floating at repo root.
2. Tests mirror source: `src/<package>/<path>/mod.py` ↔ `tests/<path>/test_mod.py` (one style per repo; mechanical).
3. `scripts/` = agent-runnable one-offs; `notebooks/` = demos. Neither imported by `src/`. Promote shared code into `src/`.
4. Design/ADRs → `docs/design/`. README stays short.
5. Before a **new top-level directory**, stop and ask. Prefer the tree above.
6. `.agent/` = shared knowledge/skills, portable across harnesses. `.pi/` / `.mcp.json` = harness wiring — do not merge, do not move knowledge into wiring.
7. **Notes (cheap path):** before re-deriving a diagnosis, opening a design debate, or continuing prior investigation → read `.agent/notes/INDEX.md` only, then the **one** linked file. After a finding → update that note’s front-matter, and if a pre-committed condition fired, append the resulting item to INDEX `## Active next`. Do not bulk-read notes/ or dump chat. Shape: `.agent/notes/README.md` (on demand). Prefer `docs/design/` for sealed/spec authority over notes.
8. **INDEX is the queue.** `.agent/notes/INDEX.md § Active next` is the single authority for what happens next and for standing constraints. Notes hold *conditions* (`If → Then`), never a queue. When a condition fires, the Then writes a row into INDEX. Never read a note to find out what to work on.
9. Small focused edits; match neighbors; no unsolicited docs; verify against source not README alone.
10. Commit your own work, with messages naming the task. Never push, force-push, or rewrite commits you didn't make. No production logic in scripts/notebooks/notes.
11. **Explanations are not notes.** Walkthroughs written for the human land in `.agent/explain/YYYY-MM-DD-slug.md` and are never referenced from INDEX. Promote to `.agent/notes/*-gotchas.md` only when the trap will recur across tasks in this repo.
12. CRG MCP is **global** (`~/.pi/agent/settings.json`) — no project `.mcp.json` for the graph. Build once: `code-review-graph build --repo .`

## New module

Create `src/…` + mirrored `tests/…`. Architecture change → `docs/design/`. Durable finding → `.agent/notes/` (via INDEX + front-matter). Next action → INDEX `## Active next`.
