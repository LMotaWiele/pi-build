# Documentation

Documents for this project live in this repository.

| What | Where |
|---|---|
| Specs | `docs/design/`, plus the live harness spec at `docs/SPEC-harness-setup.md` |
| Harness setup spec | `docs/SPEC-harness-setup.md`. Supersedes the context spec. |
| Measurement spec | `docs/design/SPEC-delegation-ab.md`. §1–§3 are committed. §4–§6 are withdrawn. |
| Context spec | `docs/design/SPEC-context-500k.md`. Superseded by the harness setup spec. Kept for history. Not executed. |
| Trial writeup | `.agent/explain/` |
| Notes and the queue | `.agent/notes/INDEX.md` |

Pi loads this repository. `~/.pi/agent/settings.json`, `AGENTS.md`, `extensions`, and `skills` are symlinks into it. The host file pi reads is `settings/hosts/machina.json`.

`docs/reference/` is a snapshot copied from the old `Documents/pi_build` tree. It is not what the live process loads. `docs/reference/machina.json` is not `settings/hosts/machina.json`.

`implement` is `.pi/agents/implement.md` in this repo. `explore` is `~/.pi/agent/agents/explore.md`, outside this repo.

Trial databases and runner logs under `/tmp` are local measurement output. They are not the documents. The writeup that interprets them is `.agent/explain/`.

| Run | Database |
|---|---|
| Void pair at `bd51f93` | `/tmp/pi-build-ab/telemetry.db` |
| Six at `9d81e6b` | `/tmp/pi-build-ab-set/telemetry.db` |
| Stopped re-run at `f8edcd2` | `/tmp/pi-build-ab-set2/telemetry.db` |
| Six at `78ce7cb` | `/tmp/pi-build-ab-set3/telemetry.db` |
| Six at `4384c58` | `/tmp/pi-build-ab-set4/telemetry.db` |
| Stage 1 context baseline, 2026-09-23 | `/tmp/pi-build-context-s1/telemetry.db` |
| Stage 2 harness bounds, 2026-09-23 | `/tmp/pi-build-harness-s2/telemetry.db` |
| Stage 4 loosened selectTier, 2026-09-23 | `/tmp/pi-build-harness-s4/telemetry.db` |
| Stage 4b pi-smart-router, 2026-09-23 | `/tmp/pi-build-harness-s4b/telemetry.db` |
| Section 13 Luna run 1, 2026-09-24 | `/tmp/pi-build-s13/luna-1/telemetry.db` |
| Section 13 Luna run 2, 2026-09-24 | `/tmp/pi-build-s13/luna-2/telemetry.db` |
| Section 13 Luna run 3, 2026-09-24 | `/tmp/pi-build-s13/luna-3/telemetry.db` |
| Section 13 Sol run 1, 2026-09-24 | `/tmp/pi-build-s13/sol-1/telemetry.db` |
| Section 13 Sol run 2, 2026-09-24 | `/tmp/pi-build-s13/sol-2/telemetry.db` |
| Section 13 Sol run 3, 2026-09-24 | `/tmp/pi-build-s13/sol-3/telemetry.db` |
| Section 13 hard spec, 2026-09-24 | `/tmp/pi-build-s13/hard-1/telemetry.db` |
