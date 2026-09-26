# Session map

Two views. Build these and stop. Inputs are only the fixtures named on each page. Do not read a live ledger, do not add a view, and do not change how turns are recorded.

The ledger is `tools/map/fixtures/telemetry.db`, copied from a few days of work. It has no prompt column. `tool_calls.arguments` is tool input and is not an input to either view. The Python tree is `tools/map/fixtures/keeper/`, a small copy of the companion package layout.

## Call graph

What one turn did, loop by loop, and which later session that turn spawned.

### Inputs

`tools/map/fixtures/telemetry.db`, tables `tool_calls` and `inference_calls`.

Columns: `id`, `session_id`, `turn_id`, `loop_index`, `tool_name`, `path`, `outcome`, `parent_turn_id`, `model`, `tier`, `cost_usd`, `prompt_tokens`, `cached_tokens`, `completion_tokens`.

Leave `arguments` unread.

### Output

```json
{
  "turns": [
    {
      "turn_id": "string",
      "session_id": "string",
      "parent_turn_id": null,
      "loops": [
        {
          "loop_index": 1,
          "inference": {
            "model": "string",
            "tier": "string",
            "cost_usd": 0,
            "prompt_tokens": 0,
            "cached_tokens": 0,
            "completion_tokens": 0
          },
          "tools": [
            { "tool_name": "read", "path": "README.md", "outcome": "success" }
          ]
        }
      ]
    }
  ],
  "edges": [
    { "kind": "next_loop", "turn_id": "string", "from_loop": 1, "to_loop": 2 },
    { "kind": "spawn", "parent_turn_id": "string", "child_turn_id": "string" }
  ]
}
```

- One turn object per distinct `turn_id` in either table.
- `session_id` is the session on that turn's rows. Rows for one turn share a session.
- `parent_turn_id` is the non-null parent on that turn's rows. A turn is a root only when every row for it has a null parent.
- A loop exists for every `loop_index` either table stores for that turn. `loops` is sorted by `loop_index`.
- `inference` is the inference row for that turn and loop. When several share the index, sum `cost_usd` and the three token fields, and keep `model` and `tier` from the row with the greatest `id`. When a loop has tools and no inference row, `inference` is null.
- `tools` follows `tool_calls.id`. `path` is null when the column is null.
- A `next_loop` edge joins each consecutive pair of distinct loop indexes on one turn. Indexes 1 and 3, with no 2, still produce one edge from 1 to 3.
- A `spawn` edge exists for every child turn whose `parent_turn_id` is non-null. The child is not also a root.

### Done

Against `tools/map/fixtures/telemetry.db`, with no network and no write to the database:

- Every `turn_id` appears once.
- For every turn with two or more distinct `loop_index` values in `tool_calls`, `edges` has a `next_loop` edge for each consecutive pair of those indexes.
- For every row whose `parent_turn_id` is non-null, `edges` has one `spawn` from that parent to the row's `turn_id`, and the child turn's `parent_turn_id` equals it.
- The fixture has at least one `spawn` (an explain child joined to the turn that started it) and at least one turn whose tool rows use two loop indexes.
- The process exits 0.

### Fixture

`tools/map/fixtures/telemetry.db`

## Source tree

The package layout a map opens beside the ledger. Tool paths in the ledger are from other projects; this view does not join them. Unmatched paths are a property of the ledger, not a reason to search the machine.

### Inputs

`tools/map/fixtures/keeper/` only. Read the tree. Do not import it and do not install `requirements.txt`.

### Output

```json
{
  "root": "tools/map/fixtures/keeper",
  "packages": ["agent", "config", "core", "environment", "goals", "memory", "scripts", "tg", "tools"],
  "files": ["agent/__init__.py", "agent/runner.py", "main.py"]
}
```

`packages` is that list, sorted. `files` is every `.py` path relative to `root`, sorted, with forward slashes. The closed set is:

`agent/__init__.py`, `agent/runner.py`, `config/__init__.py`, `config/settings.py`, `core/__init__.py`, `core/loop.py`, `environment/__init__.py`, `environment/grounding.py`, `goals/__init__.py`, `goals/system.py`, `main.py`, `memory/__init__.py`, `memory/working.py`, `scripts/__init__.py`, `scripts/diag_common.py`, `tg/__init__.py`, `tg/bot.py`, `tools/__init__.py`, `tools/memory_tools.py`.

### Done

- `packages` equals the nine names above.
- `files` equals the closed set, each path once.
- `data/state/instance.json` and `docs/architecture.md` stay out of `files`.
- Exit 0. No network. No read outside `tools/map/fixtures/keeper/`.

### Fixture

`tools/map/fixtures/keeper/`
