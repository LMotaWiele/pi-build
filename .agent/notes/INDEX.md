<!-- agent-memory-schema: 1 -->
# Notes index — read this first

Agents: load **this file only**, then the **one** row matching the task. Do not bulk-read notes/.

This file is the **authority for what happens next**. Notes hold conditions; this holds the queue.

## Notes

| Topic | File | Status | One-liner |
|---|---|---|---|
| How to write notes | [README.md](README.md) | meta | layers, front-matter, access rules |
| _(add rows as findings appear)_ | | | |

`Status` must match the `**Status:**` line in the linked file. Mismatch fails the pre-commit check.

## Active next

Ordered. Top row is what the next session picks up. One line each — detail lives in the source note.

| # | Item | Source | Added |
|---|---|---|---|
| 1 | defaultProjectTrust accepts ask, always, or never. Use always. The sample value trusted is rejected. Non-interactive -p, json, and rpc with ask or never ignore project resources. | human | 2026-09-21 |
| 2 | models.json is providers.openai and providers.openai-codex modelOverrides only. promptCache short and long are 1800 seconds. contextWindow stays 272000. Do not redeclare built-in GPT-5.6 models. Any top-level key besides providers fails validation. | human | 2026-09-21 |
| 3 | Luna short-context prices match the 2026-09-21 page: input 0.20, cached 0.02, output 1.20 per 1M. Terra: 2.00, 0.20, 12.00. Sol promo through at least 2026-11-21 is 4, 0.40, 20. Leave Sol without a dollar override. Cache writes are 1.25x uncached input. Retired baseline grok-4.6-build is input 3.40, cached 0.85, output 10.20. The $1.30 session is costUsdTicks / 1e10. | human | 2026-09-21 |
| 4 | The read tool range is offset (1-indexed line) and limit. force is not in the schema. Honor event.input.force if it arrives. Range reads are the supported re-read. | human | 2026-09-21 |
| 5 | Settings writes use writeFileSync after lockfile.lockSync with realpath false. Empirical: after installing the two pinned packages, the settings file was still a symlink to settings/hosts/machina.json. pi-web-access v0.30.0 checked out 6c5afa1. | human | 2026-09-21 |
| 6 | The package is @earendil-works/pi-coding-agent 0.87.0. Bare pi install exits 1 with Missing install source. Install each git ref explicitly. | human | 2026-09-21 |
| 7 | Extension discovery loads extensions/*.ts and one-level index.ts only. Omit the !**/wip-* entry. jev/ has no index.ts and is not loaded as an extension. | human | 2026-09-21 |
| 8 | cache_warming_decision is overridable with action warm or stop. v0.1 still sets cacheWarming off. GPT-5.6 cache TTL is 1800s, not 3600. | human | 2026-09-21 |
| 9 | pi-web-access reads the agent web-search.json, not settings.webAccess. Codex OAuth can drive OpenAI search. Do not force DuckDuckGo. workflow is none. Image and PDF are disabled. | human | 2026-09-21 |
| 10 | Do not install kcosr/pi-extensions or the enhansome list. Pin pi-web-access at v0.30.0 and pi-subagent at commit ce26a686f2571188d2e2b4d586e15a82606a7b72. The subagent block in settings is not read by that package. maxDepth 2 is a CLI flag. | human | 2026-09-21 |
| 11 | mise is not installed. install.sh continues when node is at least 22.19.0. Hostname george-contis-Machina-Ub falls back to settings/hosts/machina.json. No prompt templates exist, so Read-first lists were not edited. | human | 2026-09-21 |
| 13 | Superseded 2026-09-22: openai-codex login is ready (oauth) and the subscription catalog resolves luna, terra, and sol. The openai API provider remains without a key. The 2026-09-21 credentials_not_configured line is not the live state. | human | 2026-09-21 |
| 14 | install.sh symlinks extensions/, skills/, and lib/ into the agent config directory. Discovery loads extensions and skills from there. The module loader resolves ../lib from the symlink path, so lib is linked too. The host file does not name a machine-specific clone path. skills keeps .agent/skills. A missing skill path warns and continues. | human | 2026-09-21 |
| 15 | Own telemetry records every tool call, including blocked and deduped, with arguments, path, result_bytes, outcome, and blocked_by. kcosr/pi-extensions is not installed. Own telemetry supersedes it. | human | 2026-09-21 |
| 16 | Superseded 2026-09-22: escalate in 26a3137 was openai/gpt-5.6-terra. The committed host file now maps escalate to openai-codex/gpt-5.6-sol. Row 20 is the live mapping. | human | 2026-09-21 |
| 17 | enhansome status-bar and todos packages were not found as installable sources and were not installed. Live cost is the turn-end cost line instead. | human | 2026-09-21 |
| 18 | Model resolution: the CLI list is fuzzy and does not report which provider a pattern resolves to. Session start refuses a tier whose configured id is not an exact provider/id match, including an OpenRouter partial match of an openai slug. Checked in the routing extension, not in the offline doctor. | human | 2026-09-21 |
| 19 | A configured id can be in the registry while setModel still returns false, because that provider has no credentials. Headless modes do not stop the prompt on shutdown, so a refused session exits before the first inference. An authenticated model whose id equals the configured string is a different provider and does not run. Turn cost is one line per turn and the session total accumulates. Extension copies share that counter on the process global. | human | 2026-09-21 |
| 20 | Codex login is ready (oauth). The subscription catalog exposes gpt-5.6-luna, gpt-5.6-terra, and gpt-5.6-sol. Host tiers, the default model, and thinking levels use the openai-codex provider. Escalate is gpt-5.6-sol. The API provider remains without a key. | human | 2026-09-21 |
| 21 | Every cost figure in the 2026-09-21 review is 10x high. costUsdTicks divides by 1e10, so the cited $13.02 session was $1.30 and the seven-turn reference is $32.50. | SPEC-delegation-ab §2.0 | 2026-09-22 |
| 22 | pi 0.87.0 registered tools: bash, edit, find, grep, ls, powershell, read, write. File-mutating tools are bash, edit, powershell, and write. countsAsEdit includes that set. | SPEC-delegation-ab §2.2 | 2026-09-22 |
| 23 | A subagent child writes inference_calls under its own session_id. The 2026-09-22 probe returned two session ids. The child call was 4660 prompt tokens, 0 cached, on gpt-5.6-sol. parent_turn_id correlates that child to the parent turn. One child call does not measure multi-call child cache. | SPEC-delegation-ab §2.3 | 2026-09-22 |
| 24 | The printed cost for openai-codex/gpt-5.6-sol is the catalog card 5 / 0.50 / 30, not the promo card 4 / 0.40 / 20 and not a subscription invoice. openai-codex/gpt-5.6-terra matched input 2 and output 12. Row 3's promo rates are not what the cost line prints. | SPEC-delegation-ab §1.2 | 2026-09-22 |
| 25 | The parent escapes maxLoopDepth, maxTurnWallClockMs, the no-progress check, and the failure counter by starting a nested pi from bash. Those bounds count the parent process only, and bash is in the mutating set, so the escape costs one tool call. Leave the escape unfixed during the delegation measurement; it belongs with child bounds. | SPEC-delegation-ab §4.3b | 2026-09-22 |
| 26 | At 78ce7cb the arm B prompt dispatched explore on all three trials. explore cannot edit or write, the children recorded 0 edits, and rule 0 is VOID. implement is installed and was not named. Do not re-run this prompt until the dispatched child can write. | SPEC-delegation-ab §4.0 | 2026-09-22 |
| 27 | A dispatch call that names a model does not change the recorded model. Trial 4 at 78ce7cb asked for Terra and Luna; every inference row was Sol. Children inherit the parent's session model, so both arms run one model and rules 4 and 5 stay on dollars. | SPEC-delegation-ab §4.0 | 2026-09-22 |
| 28 | A project agent is dispatched only when the trust store records this working directory, or the process is started with --approve. The list helper forced project agents on, so it reported implement while the session saw only the user explore file. Removing that file made discovery recreate the read-only starter. | SPEC-delegation-ab §4.0 | 2026-09-22 |
| 29 | An explain or recap process asks for the explain tier with thinking off. Routing still ran tier selection and replaced that model, so the walkthrough and the session summary ran until their timeouts. Those one-shots keep the model they were given and are not trial rows. | SPEC-delegation-ab §3.6.3 | 2026-09-22 |
| 30 | An explain or recap process still started a session summary on the way out, and that summary started another process. The walkthrough waited on the chain until its timeout. A one-shot does not explain or recap itself. | SPEC-delegation-ab §3.6.3 | 2026-09-22 |
| 31 | A child session is started offline. The walkthrough inherited that flag, opened no model call, and sat until its timeout. A one-shot drops the offline flag and the subagent environment. | SPEC-delegation-ab §3.6.3 | 2026-09-22 |
| 32 | A one-shot with its input left open waits on that pipe and never calls its model. The walkthrough and the session summary close that input. | SPEC-delegation-ab §3.6.3 | 2026-09-22 |
| 33 | A delegated child that edited a fixture file ran several calls on one turn, tied to the parent turn. On a Sol child the first two calls cached nothing (3841 and 3985 prompt tokens) and the third read 3712 cached tokens against 410 prompt tokens. On a Terra child every call read 3584 cached tokens. | SPEC-delegation-ab §2.3 | 2026-09-22 |
| 34 | The six at 4384c58 dispatched implement. Each delegated trial's children edited all six fixture files and the parent wrote none. Parent peaks differed by 13%, so the set is void under the peak rule. Arm A median peak is 5.0% of the 272000 window. Do not re-run this prompt on this fixture to chase a 20% peak gap. Twelve of eighteen child turns were Sol and six were Terra, so a later token comparison replaces dollars when the models differ. | SPEC-delegation-ab §8 | 2026-09-22 |
| 35 | Stage 1 kept the context usage panel. It changes no behaviour. One Sol turn on 2026-09-23 used 9271183 prompt tokens, cache read share 0.9783, peak context 200730 of 272000, 0 compactions, and catalog cost 6.508883 at 5 / 0.50 / 30. Tool results were 67.6% of that peak. Prior-turn reasoning was not observed: one user message. Later stages of the context spec were not started. | SPEC-context-500k §1 | 2026-09-23 |
| 36 | The harness setup spec supersedes the context spec. The stage 1 measurement in row 35 stays. Later stages of the context spec are not executed. | SPEC-harness-setup §0 | 2026-09-23 |
| 37 | Turn budgets are 20000000 prompt tokens and 12 provider dollars. The baseline turn spent 9.27M prompt tokens and 5.08 provider dollars over 60 rounds and stopped mid-spec. Twice that leaves room for the three sections. maxLoopDepth 60 stays the backstop and is checked after the token and cost budgets. | SPEC-harness-setup §2.3 | 2026-09-23 |
| 38 | Stage 1 kept the hook trace and recap's ownership of pi_build_memory. That stage made no model call. The stage 2 replay included both. Its cache read share was 0.971 and its provider cost per round was 0.0864. | SPEC-harness-setup §1 | 2026-09-23 |
| 39 | Stage 2 kept the bounds extension. The replay finished in 49 rounds and no bound fired. Provider cost per round was 0.0864 against stage 0's 0.0846. Cache read share was 0.971 against 0.978. Copy tests were 47 passed, 0 failed, 1 skipped. | SPEC-harness-setup §2.4 | 2026-09-23 |

`Source` is the note whose pre-committed condition fired, or `human` if you queued it directly.
Close a row by deleting it. Do not leave completed rows with a status marker — the queue is not a log.

## Do not

Standing constraints. These bind every session in this repo until removed here.

- _(none yet)_

## Glossary (optional)

Project-specific verdicts, modes, and label names. If a label appears in a note's front-matter or in a routing question, it belongs here.

| Name | Means |
|---|---|
| _(project-specific verdicts / modes)_ | |
