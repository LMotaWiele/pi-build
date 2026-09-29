# Stage 1 budget increase

Raised per-turn budget backstops to 50,000,000 prompt tokens and $30 in `lib/telemetry.ts` and both host settings files. Updated local bounds tests to exercise the new limit, while retaining historical measured values in the spec's grounding table.

Validation: Node suite plus Stage 1 pure-library tests: 125 pass, 1 skip, 0 fail. A running session keeps its loaded extensions/settings; the new settings apply on a fresh session.
