<!-- agent-memory-schema: 1 -->
# Notes index — read this first

Agents: load **this file only**, then the **one** row matching the task. Do not bulk-read notes/.

This file is the **authority for what happens next**. Notes hold conditions; this holds the queue.

## Notes

| Topic | File | Status | One-liner |
|---|---|---|---|
| How to write notes | [README.md](README.md) | meta | layers, front-matter, access rules |
| Routing ladder | [routing-diagnosis.md](routing-diagnosis.md) | sealed | Closed by the translation spec. Sixteen tasks measured; no checker adopted |
| Host | [host-gotchas.md](host-gotchas.md) | sealed | Codex OAuth, tier map, cost divisor, package pins, explore can edit |
| Harness setup | [harness-diagnosis.md](harness-diagnosis.md) | sealed | Stage 4b kept; sections 5, 6, and 9 unrun; section 13 passed |

`Status` must match the `**Status:**` line in the linked file. Mismatch fails the pre-commit check.

## Active next

Ordered. Top row is what the next session picks up. One line each — detail lives in the source note.

| # | Item | Source | Added |
|---|---|---|---|
| 1 | The session map is specified in tools/map/SPEC.md. Build those two views from the fixtures. The tiered-retry plan stays unfinished, and the routing suite stays closed. | human | 2026-09-26 |

`Source` is the note whose pre-committed condition fired, or `human` if you queued it directly.
Close a row by deleting it. Do not leave completed rows with a status marker — the queue is not a log.

## Do not

Standing constraints. These bind every session in this repo until removed here.

- The quota gate is installed. Do not add another extension. Sections 5 and 6 stay unrun. One patch to pi-smart-router already names the pi 0.87 registry seam. A second patch to that package stops the run. The routing suite stays closed.
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

## Verified

Checked 2026-09-26 against `@earendil-works/pi-coding-agent` 0.87.0. No fallback from the spec table was required. Print mode overwrites a returned exit code, so a headless hold uses `process.exit(75)`.

- ExtensionAPI is the imported extension type. `ctx.model.provider` is the provider id. `getApiKeyForProvider` returns `Promise<string | undefined>` and the gate does not refresh. `hasUI` is boolean and false in print mode. `ctx.ui.confirm(title, message)` returns `Promise<boolean>`; an optional dialog-options argument exists. `ctx.ui.notify(message, type?)` accepts `"warning"`. `after_provider_response` is `{ status, headers }`. `message_end` is awaited and the role is `message.role`. `before_agent_start` is awaited before inference. `agent_end` is `{ messages }` with no error object; status is joined from the preceding response onto `errorMessage`. `appendEntry(customType, data)` writes a session entry. The live token's account claim is `https://api.openai.com/auth` → `chatgpt_account_id`.
