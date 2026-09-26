<!-- agent-memory-schema: 1 -->
# Notes index — read this first

Agents: load **this file only**, then the **one** row matching the task. Do not bulk-read notes/.

This file is the **authority for what happens next**. Notes hold conditions; this holds the queue.

## Notes

| Topic | File | Status | One-liner |
|---|---|---|---|
| How to write notes | [README.md](README.md) | meta | layers, front-matter, access rules |
| Routing ladder | [routing-diagnosis.md](routing-diagnosis.md) | open | Sixteen tasks measured, no policy, hook-trace and parent-turn checks block the later sections |
| Host | [host-gotchas.md](host-gotchas.md) | sealed | Codex OAuth, tier map, cost divisor, package pins, explore can edit |
| Harness setup | [harness-diagnosis.md](harness-diagnosis.md) | sealed | Stage 4b kept; sections 5, 6, and 9 unrun; section 13 passed |

`Status` must match the `**Status:**` line in the linked file. Mismatch fails the pre-commit check.

## Active next

Ordered. Top row is what the next session picks up. One line each — detail lives in the source note.

| # | Item | Source | Added |
|---|---|---|---|
| 1 | The routing contract is open and §7 has not run. Read the routing diagnosis before any later section: the hook-trace check is outside the prompt, the parent-turn task fails three ways, and no checker separates silent fails from passes. | routing-diagnosis.md | 2026-09-26 |

`Source` is the note whose pre-committed condition fired, or `human` if you queued it directly.
Close a row by deleting it. Do not leave completed rows with a status marker — the queue is not a log.

## Do not

Standing constraints. These bind every session in this repo until removed here.

- Provider cost per round on the stage 4 router replay is under half of stage 0, and the requested sections' tests passed. Do not add another extension. Sections 5 and 6 stay unrun. One patch to pi-smart-router already names the pi 0.87 registry seam. A second patch to that package stops the run.
- A prompt that adds a file under extensions/, or that names two or more harness stages, is pinned to openai-codex/gpt-5.6-sol. The section 6 benchmark stays on pi-smart-router. The router package is left as it is.

## Glossary (optional)

Project-specific verdicts, modes, and label names. If a label appears in a note's front-matter or in a routing question, it belongs here.

| Name | Means |
|---|---|
| Pass | Visible and held-out both exit 0 with at least one passing test, and the run was not stopped |
| Loud fail | Visible and held-out both fail to pass, and the run was not stopped |
| Silent fail | Visible passes and held-out does not, and the run was not stopped |
| Odd | Held-out passes and visible does not, and the run was not stopped |
| censored | The run stopped on a bound, pin, wall, or spawn |
