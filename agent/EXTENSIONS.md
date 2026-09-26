# Extension coordination

Pi discovers `extensions/*.ts` and one-level `index.ts` in directory order, then installed packages. This file is the contract for keys, order, and the invalidation budget.

## Section keys

| Key | Owner | Writes it |
|---|---|---|
| `pi_build_memory` | recap | `before_agent_start`, after memory-gate. The value is the claim, the pre-committed criteria, and the last recap. |
| `pi_build_tools` | memory-gate | `before_agent_start`. The tool instructions. |

memory-gate skips `pi_build_memory` while recap is enabled. One key, one owner.

## Shared events

`before_agent_start`, measured on the stage 4b parent turn:

1. bounds clears a fired bound when the prompt changes. It writes no section. That row is stored before the turn id exists.
2. memory-gate writes `pi_build_tools`.
3. plan-mode writes no section while plan mode is off.
4. read-guard resets dedupe for a new prompt. It writes no section.
5. recap writes `pi_build_memory`. It runs after memory-gate so the claim and the criteria stay.
6. Third-party handlers ran after that and did not change the byte count. They are recorded as `unknown:<seq>`.

`context`: plan-mode drops stale plan-mode messages while plan mode is off. It is the only context rewriter.

`tool_result`: bounds checks the turn, explain records edits, post-edit-typecheck schedules `tsc`, and read-guard may replace a repeated read with a pointer or a diff. read-guard is the only tool-result rewriter. A deduped read stays a pointer.

No second context rewriter is stacked on either seam.

## Quota gate

`extensions/quota-gate.ts` writes no section key, so it is outside the invalidation count above. `lib/quota.ts` makes the decisions. The extension's events, in order:

1. `session_start` polls `GET /backend-api/wham/usage` when `ctx.model.provider` is `openai-codex`, then writes a soft hold if a window is already over its threshold.
2. `after_provider_response` reads `status` and `headers` (`x-codex-primary-used-percent`, `x-codex-secondary-used-percent`) and may write a soft hold.
3. `message_end`, for an assistant message, asks when a hold file exists. Print mode has no UI, so the process exits 75.
4. `before_agent_start` does that check before the first inference.
5. `agent_end` writes a hard hold when the last assistant `errorMessage` and the preceding response status are a 429 usage limit. `agent_end` itself has no error object.

The hold file is `~/.pi/agent/quota-hold.json` (override `PI_BUILD_QUOTA_HOLD`). `extensions/bounds.ts` runs its escalate retry only when that file is absent and `PI_BUILD_RETRY` is not `0`. `bin/pi-continue` is the only way to clear a hold. Thresholds come from the `quotaGate` settings block through `readPiSettings()`, the same loader bounds uses. `PI_BUILD_QUOTA_5H` and `PI_BUILD_QUOTA_WEEKLY` override the block.

## Invalidation budget

Maximum prefix invalidation points per turn: 3

A point is a hook row whose byte count changes on `before_agent_start`, `context`, `context_with_system`, `session_before_compact`, or `session_compact`. `doctor.sh --offline` replays one `before_agent_start` and fails when that replay exceeds 3. The kept turns measured 3, 3, and 2.

## Patches

| File | Package | Seam |
|---|---|---|
| `patches/pi-smart-router.patch` | pi-smart-router | pi 0.87 registry bootstrap |

`install.sh` applies each file after `pi install`. One file per package. A second patch to the same package stops the run.
