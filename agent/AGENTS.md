# Global agent instructions

These rules apply in every project. The project's own `AGENTS.md` stacks under this file.

## Memory

INDEX and the notes protocol are already in the cached prefix. Do not read `.agent/notes/INDEX.md` or `.agent/notes/README.md`.

Open one note per task with `note_open`. Update one front-matter field with `note_update`. Append the queue only with `queue_append`.

Explanations are not notes. The harness writes walkthroughs under `.agent/explain/`; do not write there by hand. They are never indexed. Record progress on a spec in its run record; for other work, in the commit message.

Commit your own work, with messages naming the task. Never push, force-push, or rewrite commits you didn't make.

When a spec's final acceptance passes in an interactive session, set its status to `implemented` in its header and in `/docs/specs/index.md`, with Implemented by.

## Models

This session sets its model with setModel before the first inference of a turn. Do not switch models in the middle of a turn. The resolved tier map is injected from the host file. Do not copy model ids into this file.

## Approvals

Do not ask for approval. Telemetry is the record. The explanation written after an edit turn is the review.
