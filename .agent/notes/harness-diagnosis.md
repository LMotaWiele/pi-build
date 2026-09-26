# Harness setup

**Status:** sealed
**Topic:** harness setup
**Last updated:** 2026-09-26

## Current claim

Harness setup is recorded through stage 4b and section 13. Stage 4b kept `pi-smart-router` 0.8.0, with routing left off. Provider cost per round on that replay is under half of stage 0, and the requested sections' tests passed. Sections 5 and 6 were not run. Section 9 was not run. The section 13 Luna and Sol replays both passed the held-out suite; Luna's mean provider cost per round was 0.001383 and Sol's was 0.060005. A prompt that adds a file under `extensions/`, or that names two or more harness stages, is pinned to `openai-codex/gpt-5.6-sol`. The section 6 benchmark stays on `pi-smart-router`. One patch, `patches/pi-smart-router.patch`, names the pi 0.87 registry seam.

The context spec's stage 1 measurement stands. Its later stages were not executed. A parent can start a nested process from bash and leave the turn bounds counting the parent process only. That escape is unfixed.

## Ruled out / confounds

- Stage 4b's removal of `extensions/jev/` as a description of the current tree. The directory is restored and is not loaded, because it has no `index.ts`.
- A second patch to `pi-smart-router`. The one allowed patch is already spent.

## Evidence (pointers only)

- Walkthrough: `.agent/explain/2026-09-23-harness-setup.md`.
- Context stage 1: `.agent/explain/2026-09-22-context-baseline.md`.
- Delegation measurements and the bash escape: `.agent/explain/2026-09-22-ab-results.md`.
- Contract: `docs/SPEC-harness-setup.md`.

## Pre-committed criteria

| If | Then |
|---|---|
| Section 5, section 6, or section 9 of the harness setup contract is run | Supersede this note |
| The bash escape is closed | Supersede this note |

## Do not

- Do not add an extension. The same rule is in the index for every session.
- Do not run harness sections 5 or 6.
- Do not apply a second patch to `pi-smart-router`.

## Chronology

Stages were recorded on 2026-09-23 and the section 13 comparison on 2026-09-24. The numbers stay in the walkthrough.
