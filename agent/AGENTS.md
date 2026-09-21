# Global agent instructions

These rules apply in every project. The project's own `AGENTS.md` stacks under this file.

## Memory

INDEX and the notes protocol are already in the cached prefix. Do not read `.agent/notes/INDEX.md` or `.agent/notes/README.md`.

Open one note per task with `note_open`. Update one front-matter field with `note_update`. Append the queue only with `queue_append`.

Explanations are not notes. They land under `.agent/explain/` and are never indexed.

## Models

Do not switch this session's model in the middle of a turn. Escalation is a subagent with its own context.

Scout and explain summaries use `openai-codex/gpt-5.6-luna` with thinking off. Work uses `openai-codex/gpt-5.6-terra` at low. Escalate uses `openai-codex/gpt-5.6-sol` at high, as a subagent.

## Approvals

Do not ask for approval. Telemetry is the record. The explanation written after an edit turn is the review.
