# GPT-6 migration

Implemented `SPEC-0009` in three bounded stages.

- Upgraded the harness pin to pi 0.87.1 and kept the existing router patch unchanged.
- Made bare `gpt-6-sol` the host default, first in scope, with Sol/Luna at medium and Astra at high.
- Moved routing, agent pins, pipeline thinking, validation, documentation and model metadata to GPT-6.
- Added the bounded retry ladder in `lib/tiers.ts`: Luna → Sol medium, Sol below high → Sol high, and GPT-5.6 Terra resume → Sol high, with GPT-5.6 Sol only as the documented fallback.
- Integrated that ladder into `extensions/bounds.ts`, retaining quota, environment-switch and one-retry guards.
- Restored and adapted `pi-rework` for numbered specs. It accepts an ID, slug or full spec path and reports candidates on refusal.
- Deleted the superseded GPT-5.6 tiers test and marked SPEC-0005's retry ladder as superseded.

Validation:

- Integrated migration and runner suites: 37/37 passed.
- Final focused ladder/bounds/rework suites: 15/15 passed.
- `./doctor.sh --offline`: 96 passed, 1 skipped; map suite 80 passed.
- `./doctor.sh --project .`: passed.
- Fresh RPC state: GPT-6 Sol, medium thinking.
- Quota observation around one ordinary GPT-6 Sol task: 5h 67% and weekly 23% before and after.

The complete staged evidence and the one source-layout deviation are recorded in `docs/specs/SPEC-0009-run.md`.
