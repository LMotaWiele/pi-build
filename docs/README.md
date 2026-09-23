# Documentation

Documents for this project live in this repository.

| What | Where |
|---|---|
| Specs | `docs/design/` |
| Measurement spec, also at the repo root | `SPEC-delegation-ab.md` is the same text as `docs/design/SPEC-delegation-ab.md`. §4–§6 are withdrawn. |
| Context spec, at the repo root | `SPEC-context-500k.md` supersedes that measurement. The same text is `docs/design/SPEC-context-500k.md`. |
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
