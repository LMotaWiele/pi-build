# Notes index — read this first

Agents: load **this file only**, then the **one** row matching the task. Do not bulk-read notes/.

| Topic | File | Status | One-liner |
|---|---|---|---|
| How to write notes | [README.md](README.md) | meta | layers, front-matter, access rules |
| Trajectory step check vs `run_start`/`run_end` | [trajectory-step-boundary-gotchas.md](trajectory-step-boundary-gotchas.md) | sealed | Boundary events use `step=0` + `check_step=False`; otherwise full runs break |
| Stale spec → retired class-based Agent | [spec-stale-authoring-gotchas.md](spec-stale-authoring-gotchas.md) | sealed | On-disk `docs/design/` wins; plain Agent + memory is v1 lock (ADR 0003) |
| `CancelledError` is a BaseException | [cancellederror-baseexception-gotchas.md](cancellederror-baseexception-gotchas.md) | sealed | `except Exception` misses it; write `run_end(cancelled)` then re-raise |
| Sync tools atomic only inline | [parallel-safe-sync-tools-gotchas.md](parallel-safe-sync-tools-gotchas.md) | sealed | `to_thread` is the race; reached only via `parallel_safe` in a group of ≥2 |
| OpenRouter campaign (typed/untyped, L3) | [openrouter-campaign-diagnosis.md](openrouter-campaign-diagnosis.md) | open | post16: ADR 0016 on every turn (served_by matches sidecar; native=length @64); L1/L2 still 0/0; L4 mistral phantom mark_done then recovered; L3 factor 2.98 |

## Glossary (optional)

| Name | Means |
|---|---|
| plain Agent | Non-subclassed `Agent` dataclass + `make_tool()` + closures; final for v1 (§2.1) |
| `check_step=False` | Writer exemption for run-boundary events so `step=0` does not violate monotonicity |
| MemoryStore | Optional two-method protocol (`fetch`/`write`); additive; loop never calls `write` |
| primitive | One of three: branch, loop, fork/join (ADR 0009, retiered ADR 0012). Fourth needs a non-derivability proof *and* a tier |
| `router` | Branch carrier (ADR 0010). `Callable[[LoopState], Optional[tuple[str, str]]]`. Who next, never whether next |
| `cancel_on` / `reduce` | Fork parameters (ADR 0011), not primitives. Cancellation is not failure; `reduce` must emit a `reduction` event |
| `decided_by` | `"model"` \| `"router"` on every `handoff`. `overrode` only when the router redirected a model `transfer_to` |
| `pattern` (cycle_detected) | Observed A→B→A→B handoff sequence — not the `fan_out` field (now `primitive`) |
| recipes/ | Open, unstable compositions. Not the basis, not a stable API, not re-exported from the package root. Do not add them to `primitives/` |
| recipe | One function per *composition* (ADR 0013 §1). Allowed to fix a combination; that is why it is not a façade. `critique_revise` is the first |
| preset | Parameter factory for one existing seam (`router` / `stop_condition` / `reduce`). Stable, root-exported. Not a primitive and not a recipe (ADR 0017). |
| templates/ | Top-level copy-and-own examples. Not a library. Comment standard is decision-first, for non-programmers (ADR 0017 §2). Human review is the readability gate. |
| substrate | The sequential turn loop — always present, not selectable, not a member. Turn N+1's context is built from history containing turn N's output (ADR 0012 §1) |
| tier 1 / tier 2 | In-run control flow (branch, loop — `Harness` seams) vs run composition (fork/join — `fan_out_fan_in`). The surface asymmetry *is* the tier boundary (ADR 0012 §2) |
| `parallel_safe` | Per-tool opt-in (ADR 0014). Consecutive marked calls in one turn dispatch together. Unmarked tools have zero new race surface. Not a `Config` switch |

## Active next

- **v1 complete** — three members across two tiers over a substrate; `recipes/` open (`critique_revise`); `presets/` + `templates/` added (ADR 0017; §8 human-review gate still open); every tool call records `dispatch`.
- Next when asked: the **v2 graph view** (spec §12).
- **Do not:** add a fourth primitive without a non-derivability proof *and* a tier; put convenience helpers in `primitives/`; wrap `router`/`stop_condition` in façades; re-export recipes from the package root; add a `Config` switch over `parallel_safe`; thread every sync tool by default; rename `cycle_detected`'s `pattern`; let a router decide termination; swallow `CancelledError`; add `sink_factory` to `ChildSpec` without a recovery guard; reintroduce class-based agents; invent semantics only in a visual layer; bulk-read notes/.
