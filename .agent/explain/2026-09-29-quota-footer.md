# Quota and numerical context footer

Updated the existing `quota-gate` extension rather than adding another extension.

The interactive footer now preserves Pi's location, usage totals, cache hit rate, cost, model, thinking level, and extension statuses while changing the context display from a percentage to used tokens over the context window, for example `42k/272k`.

After that context count it shows the latest known Codex subscription windows, in stable order:

```text
42k/272k (auto) 5h 88% weekly 26%
```

Quota values trigger a footer render after both existing update paths:

- the `/backend-api/wham/usage` poll at session start;
- `x-codex-primary-used-percent` and `x-codex-secondary-used-percent` response headers.

The custom footer is installed only in TUI mode. RPC, JSON, and print behavior remains unchanged.

Validation:

- Footer and quota unit tests: 22/22 passed.
- Full Node suite: 100 passed, 1 skipped.
- Map suite: 80 passed.
- A live pseudo-terminal smoke showed `0/272k (auto) 5h 88% weekly 26%`.
- `doctor.sh --offline` reached project-memory validation but was blocked by pre-existing generated INDEX/explanation neutrality drift; the code and map suites it normally runs passed directly.
