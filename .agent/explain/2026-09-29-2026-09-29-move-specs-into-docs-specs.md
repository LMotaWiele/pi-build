# Move specs into `docs/specs`

- Started from `86d7019b216c973fcfd87439776e41b20c74888f` with pre-existing changes to `settings/hosts/machina.json` and two untracked session explanations. They were left untouched.
- Moved the seven tracked project specs and all sibling plan/reference/test directories into numbered `docs/specs/SPEC-0001` through `SPEC-0007` locations. The supplied untracked move spec is now `SPEC-0008`.
- Added `docs/specs/index.md`, with contiguous IDs, original titles, statuses, first-added dates, and former paths.
- Updated path consumers in `install.sh`, `scripts/run-plan.mjs`, the moved plan, and its reference. Moved tests now resolve the repository one level higher; fixture strings that intentionally model the legacy paths remain unchanged.
- `docs/SPEC-map-views.md` and `docs/SPEC-extension-coordination.md` were absent locally, so neither was assigned an ID. `docs/design/` remains because it contains two non-spec documents.

## Verification

- Spec-content SHA-256 comparisons confirm the seven moved, pre-existing spec Markdown files are byte-identical.
- All protected-test changes are only relative import or repository-root depth adjustments.
- `uv run --project tools/map pytest -q`: **80 passed**.
- `./doctor.sh --offline`: passed.
- `./doctor.sh --project .`: passed (92 passed, 1 skipped; expected missing optional dependency warnings were emitted).
- Direct moved-spec node suites: **not passed**. Six production-config suite failures are pre-existing readiness gaps: `lib/tiers.ts`, `lib/rework.ts`, `scripts/pi-rework.ts`, and `bin/pi-rework` do not exist. The spec marks that work ready rather than implemented; no protected test changes beyond allowed depth edits were made.
