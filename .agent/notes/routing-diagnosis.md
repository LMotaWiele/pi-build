# Routing ladder

**Status:** sealed
**Topic:** routing ladder
**Last updated:** 2026-09-26

## Current claim

`docs/SPEC-spec-translation.md` closed this ladder on 2026-09-26. The measurements stand. The hold check in bounds belongs to that spec. The task file has seventeen tasks. `9e26310` cannot be split and is out of the repaired runs, so sixteen tasks were measured. The pinned Luna result is 5 pass, 6 silent fail, 3 loud fail, 2 censored, provider cost 0.337316. Phase C spent 6.504868 of its 10 dollar cap and produced no pass, so the repaired handoff rerun was skipped. §7 has not named a policy. §5.4, §5.5, and §6 through §9 have not run.

The hook-trace hidden check on `59c9121` asks for a naming channel the prompt does not state. The prompt records a handler that does not name itself as unknown plus its sequence number, and the declared interface does not give `attachTelemetry` a second argument. Luna, Terra, and Sol each kept the one-argument form and recorded `unknown:1`.

`78ce7cb` is three different failures. The wall-clock value check passed on all three tiers. Terra rewrote the inherited environment id inside `beginUserTurn`, which the prompt says to keep. Luna kept that id and failed the later assert that the environment equals the new snapshot turn id after dispatch; the prompt also says a later rewrite must not retarget the process. Sol threw in the test helper before any assertion.

No checker separates silent fails from passes on the fourteen finished Luna runs. C1 flagged 0 of 6 silent fails and 0 of 5 passes. C2 flagged 4 of 6 and 4 of 5. Names-only blind tests flagged 4 of 6 and 3 of 5. The signature rescore flagged 0 of 6 and 2 of 5, and that rescore is the C3 result. Sol review flagged 1 of 2 and 1 of 2. No adoption row fired. C2 said no on `4704b4f` and `a0043ca` with the requirement present and the held-out check passing. The hook-trace miss is the case where the prompt and the checker both lack the hidden naming channel.

## Ruled out / confounds

- The first Luna table in the outcome matrix is an invalid launch: the pin flags arrived as user messages. The pinned measurement is the Phase B Luna table.
- The first Sol table counts five cost-cap stops as fails. A stop is censored. That table is the unrepaired split.
- The nesting claim on `690b685` uses the unrepaired visible and held-out counts. It was not re-run after the repair. A cascade built from it would be escalate-only, and that cascade was not built.
- Luna omitted 0 of 42 checklist requirements. That checklist result stands. The section 4 handoff rerun is the unrepaired split. The repaired handoff was skipped because Phase C had no Sol pass.
- S2 matched 16 of 16 after one reword, at provider cost 0.000654. The other twelve answers stand, and 64 of 77 was not rescored. Under the amended per-question rule the classifier stands.
- The Terra probe passed `aoh-fb5d493` and silent-failed `aoh-5cbfb21`, provider cost 0.762764. The low-thinking arm was not run. Later Terra runs pin `openai-codex/gpt-5.6-terra` at medium thinking.
- Phase C Terra silent-failed `bd51f93`, `78ce7cb`, and `59c9121`, and censored `aoh-c40f118` when bounds retried at Sol after three consecutive tool failures. Sol then loud-failed `78ce7cb` and silent-failed `bd51f93` and `59c9121`. `bd51f93` was loud on Luna and silent on Terra and Sol. `78ce7cb` was silent on Luna and Terra, and loud on Sol.
- C4 marked `78ce7cb`'s only sentence present, and marked the hook-trace requirement on `59c9121` missing with no explanation.

## Evidence (pointers only)

- Matrix: `.agent/explain/2026-09-24-outcome-matrix.md` (Phase B Luna, Terra probe, C1–C4, Phase C Terra, Phase C Sol).
- Contract: `docs/SPEC-routing-orchestration.md`.
- Record of Phase C: commit `ba46844`.
- Run trees: `/home/george-contis/var/routing-runs/luna`, `/home/george-contis/var/routing-runs/terra`, `/home/george-contis/var/routing-runs/sol`, `/home/george-contis/var/routing-runs/c2`, `/home/george-contis/var/routing-runs/c3`, `/home/george-contis/var/routing-runs/c4`, `/home/george-contis/var/routing-runs/s2`.

## Pre-committed criteria

| If | Then |
|---|---|
| The hook-trace hidden check on `59c9121` is edited, or the parent-turn hidden check on `78ce7cb` is edited | Append a queue row to re-grade the existing Luna, Terra, and Sol runs of that task before any new model rung |
| A checker adoption row fires on a new scoring of the same fourteen runs | Supersede this note, and append a queue row to take the adopted checker into §7 |

## Do not

- Do not retune C1–C4 or rewrite their prompts. The C3 result is the signature rescore.
- Do not rescore 64 of 77, and do not reword S2 again.
- Do not edit the bounds extension as part of this claim.
- Do not run the low-thinking Terra arm.
- Do not treat the names-only blind tests as the C3 result.
- Do not start §5.4, §5.5, or §6 through §9 while this note is open. The queue row is this diagnosis.

## Chronology

The first pass through §2–§5 is the top of the outcome matrix. The repaired measurement starts at Phase B. Phase C and the checker verdicts were recorded on 2026-09-26.
