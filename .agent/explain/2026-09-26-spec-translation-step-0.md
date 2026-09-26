# Spec translation — step 0

Date: 2026-09-26. Step 0 of `docs/SPEC-spec-translation.md` is installed. Steps 1–3 have not started.

## Usage

One usage GET, during the held Luna prompt. That run made no model call.

| Window | Slot | Duration (seconds) | Used | Resets (local) |
|---|---|---|---|---|
| 5h | primary | 18000 | 66% | 2026-09-26 17:10:52 |
| weekly | secondary | 604800 | 66% | 2026-09-28 23:20:35 |

The weekly threshold stays 95 in both host settings. Measured weekly use is 66%, twenty-nine points under that line. The threshold leaves five points before a window is exhausted.

The 5-hour setting stays 95. The live check set `PI_BUILD_QUOTA_5H=1` only in an isolated environment. The per-user hold file and override file were absent and were left untouched.

## Live check

Headless Luna (`openai-codex/gpt-5.6-luna`, thinking `minimal`), flags before the prompt, one-word prompt `ping`.

- Exit 75.
- Hold reason `5h`, soft, set at 2026-09-26T13:50:45.756Z.
- Windows as in the table above.
- Inference rows: 0.

`bin/pi-continue --yes` cleared that hold and suspended the 5-hour threshold until 2026-09-26 17:10:52 local. The next one-word prompt, `pong`, exited 0. Its inference model was `gpt-5.6-luna`. Catalog cost of that call was $0.0015. The isolated override is what let it proceed while the environment threshold stayed at 1.

The live token carried `https://api.openai.com/auth` → `chatgpt_account_id`. That matches the claim path in the installed coding agent 0.87.0.

## Verified shapes

The notes index holds the row. Package: `@earendil-works/pi-coding-agent` 0.87.0.

No row in the spec's fallback table was used. `after_provider_response` includes `status` and `headers`. `hasUI` is false in print mode, and the held run took the headless path. `message_end` and `before_agent_start` are awaited. `getApiKeyForProvider` returned a token, and the usage GET succeeded.

`agent_end` carries messages and no error object. The gate joins the preceding response status to the assistant `errorMessage`.

Print mode assigns its own exit code on the way out and would replace a stored code of 75. A headless hold calls `process.exit(75)` from `before_agent_start` (after `session_start` has polled), and from `message_end` and `agent_end`. The held run exited 75.

## Tooling

In place, and covered by the uneditable tests: `lib/quota.ts`, `lib/plan.ts`, `lib/conformance.ts`, the difficulty and quality batteries, `scripts/pi-continue.ts`, and `bin/pi-continue`. The gate wiring, the bounds hold check, both host `quotaGate` blocks, and `scripts/run-plan.mjs` are in the tree. The runner parses and refuses to start without a plan. It has not executed a plan.

`quota.test.ts`, `plan.test.ts`, `conformance.test.ts`, and `batteries.test.ts` passed. The bounds hold test and the retry-disabled test passed. `./doctor.sh --offline` and `./doctor.sh --project .` both exited 0 after the notes update.

## Not started

`docs/SPEC-production-config.md` is not in the repository, and it has no tests directory. Step 1 waits on those author-supplied tests. No Sol session and no Luna plan ran.

## Grok cost

This session has no `usage.json`, so `costUsdTicks / 1e10` cannot be computed. The Codex side of the check is the usage GET above plus one Luna call at $0.0015 catalog.
