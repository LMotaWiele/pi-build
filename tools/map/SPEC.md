# SPEC: codebase map for pi-build

Place this file at `tools/map/SPEC.md`. It is the contract for the cloud sessions that build the map. Read it in full before writing code. When the spec and the code disagree, the spec wins; when the spec is ambiguous, pick the smaller interpretation and say so in the PR description.

## 0. What is being built

A per-project representation layer that regenerates after every agent turn and renders three views in one static HTML page:

1. **Treemap** — file and function size and complexity, colored by agent activity or cost.
2. **Call graph** — runtime structure of agent turns from telemetry: model calls, tool calls, guards, subagents.
3. **Data model (ERD)** — entities (tables, types, config schemas, file stores), their relations, and which code reads or writes them.

Language support is Python and TypeScript. Adding a language must not touch the core, the views, or the page.

The map is built by a standalone Python tool (`tools/map/`). A small pi extension (`extensions/map.ts`) calls it on `agent_end`. The tool never imports pi.

## 1. Repository facts you must rely on

Verify each of these against the code before depending on it. If one is false, stop and report it in the PR.

- There is no `package.json` and no build step. Pi loads `extensions/*.ts` directly. Unit tests: `node --experimental-strip-types --test tests/*.test.ts`.
- `lib/telemetry.ts` owns `telemetry.db` (path from `telemetryPath()`: `PI_BUILD_TELEMETRY_DB`, else `$PI_CODING_AGENT_DIR/telemetry.db`, else `~/.pi/agent/telemetry.db`). Schema is created with `CREATE TABLE IF NOT EXISTS` from the `SCHEMA` string.
- Tables `tool_calls(id, ts, session_id, turn_id, loop_index, tool_name, arguments, path, result_bytes, elapsed_ms, outcome, blocked_by)` and `inference_calls(id, ts, session_id, turn_id, loop_index, tier, model, prompt_tokens, cached_tokens, completion_tokens, reasoning_tokens, ttft_ms, elapsed_ms, cost_usd)`. `ts` is written at insert time, which is the end of the call.
- `tool_calls.outcome` ∈ `success | error | blocked | deduped`; `blocked_by` names the guard (`memory-gate`, `read-guard`, `bounds`, …).
- `tool_calls.arguments` holds full tool input, including whole file contents for `write`. **Never copy this column into any output, log, fixture, or PR text.** Read only `path`, `tool_name`, `outcome`, `blocked_by`, timing and ids.
- `tool_calls.path` is sometimes absolute, sometimes relative to the session cwd. There is no project or cwd column today. One global database serves every project.
- Telemetry state is a process-global bag (`Symbol.for("pi-build.telemetry")`) because each extension loads its own copy of `lib/telemetry.ts`. `attachTelemetry` is idempotent per process.
- `extensions/explain.ts` and `extensions/recap.ts` spawn a child `pi` with `execFile` using `explainCommand()` (`--mode json --no-session --thinking off --tools read -p …`). The child loads extensions and writes its own telemetry rows under its own session and turn ids. Nothing links them to the parent turn today.
- `validateProject()` in `lib/scaffold.ts` fails when any file under `.agent/` matches `/note_open|memoryGate|\.pi\/|pi-build/`. Generated map output will contain such strings.
- `extensions/post-edit-typecheck.ts` has no license grant. Do not copy from it.

## 2. Inputs available in the cloud session

- This repository at its current state.
- A telemetry snapshot committed at `tools/map/fixtures/telemetry.snapshot.db` (pre-M0 schema, real usage). If it is not at that path, locate it with `git ls-files '*.db'` and use that path. Treat it as read-only: tests copy it to a temp dir first.
- No other repositories. Build the Python fixture yourself (M2).

Cloud environment setup script:

```bash
#!/bin/bash
set -e
apt-get update && apt-get install -y sqlite3
pip install --break-system-packages uv
node --version   # must be >= 22.5 for node:sqlite; install a newer Node if not
```

## 3. Architecture

```
tools/map/
  SPEC.md
  pyproject.toml            # uv project; Python >= 3.12
  uv.lock
  map_build/                # package
    __main__.py             # CLI entry: python -m map_build
    ir.py                   # IR dataclasses + JSON Schema export
    plugins.py              # plugin protocols + discovery
    context.py              # FileContext, ProjectConfig loading
    walk.py                 # file discovery, exclusions, hashing
    cache.py                # per-file extraction cache
    resolve.py              # reference resolution
    churn.py                # git history
    views/
      treemap.py  callgraph.py  erd.py
    render/
      page.py               # writes index.html
      template.html         # page shell
      app.js                # page logic, no build step
      vendor/               # d3, dagre (see §9)
  extractors/
    python/   __init__.py  module.py  *.scm  fixtures/
    typescript/  __init__.py  module.py  *.scm  fixtures/
    sqlite/   __init__.py  fixtures/
    manifest/ __init__.py  fixtures/
  metrics/
    lizard_provider.py      fixtures/
  traces/
    pi_telemetry.py  otel_json.py  viztracer_json.py  fixtures/
  conformance/
    test_conformance.py
  tests/                    # core tests
  fixtures/
    telemetry.snapshot.db
    py-sample/              # synthetic Python project (M2)
extensions/
  map.ts                    # pi shim (M5)
```

`tools/map/pyproject.toml` is allowed. The no-`package.json` rule is about the TypeScript side and stays in force.

Dependencies (pin exact versions in `uv.lock`): `tree-sitter`, `tree-sitter-python`, `tree-sitter-typescript`, `lizard`. Tests add `pytest`. Nothing else without a line in the PR explaining why the standard library does not cover it.

### 3.1 Pipeline

```
walk → parse (once per file per grammar) → extractors → IR (per file, cached)
                                          → metric providers → IR
                    telemetry / trace files → trace adapters → IR
                                          git → churn
IR → resolve → views/{treemap,callgraph,erd}.json → render → index.html
```

Views read only resolved IR and churn. Nothing downstream of IR knows a language.

### 3.2 CLI

```
uv run --project tools/map python -m map_build \
  --repo <project root> \
  --out <dir>                      # default <repo>/.agent/map
  [--telemetry <sqlite path>]      # repeatable trace sources; format auto-detected
  [--trace <file>]                 # OTel JSON / VizTracer JSON; repeatable
  [--turn <turn id>]               # highlight this turn; default: latest turn for this repo
  [--window-days 7]
  [--no-cache]
  [--check]                        # build to a temp dir, exit non-zero on any core error
```

Exit codes: 0 success (diagnostics allowed), 1 core failure, 2 bad arguments. Per-file extractor failures are diagnostics, never exit 1.

Output directory contents:

```
<out>/
  .gitignore           # contains "*" so the map never gets committed in any project
  index.html           # self-contained page
  data/
    treemap.json  callgraph.json  erd.json  diagnostics.json  meta.json
  ir/                  # resolved IR, JSON Lines, one file per record type
  cache/               # extraction cache
```

### 3.3 Project configuration

Optional `<repo>/.map/project.toml`:

```toml
exclude = [".agent/map/**", "results/**", "**/*.lock"]   # added to built-in excludes

[[stores.sqlite]]
id = "telemetry"
path = "~/.pi/agent/telemetry.db"      # expanded; absent file → diagnostic, not error
identifiers = ["telemetryPath"]        # code identifiers that refer to this store

[[stores.file]]
id = "known.md"
globs = [".agent/explain/known.md"]
identifiers = ["knownPath"]

[[stores.file]]
id = "notes-index"
globs = [".agent/notes/INDEX.md"]
identifiers = ["indexPath", "indexFile"]
```

Optional `<repo>/.map/rules/*.scm` plus `<repo>/.map/rules.toml` for project domain rules (§5.4).

Built-in excludes: `.git/`, `node_modules/`, `.venv/`, `venv/`, `__pycache__/`, `dist/`, `build/`, the output directory, binary files, files over 1 MB.

This repository gets its own `.map/project.toml` and `.map/rules/` in M2 declaring the telemetry store, the notes and explain file stores, and the pi event rule.

## 4. IR

`map_build/ir.py`. Frozen dataclasses, serialized as JSON Lines. `SCHEMA_VERSION = 1`. Export a JSON Schema (`python -m map_build --print-schema`) and validate every record against it in tests.

```python
Provenance = Literal["extracted", "inferred"]

@dataclass(frozen=True)
class Source:      path: str; line: int; end_line: int          # repo-relative, 1-based
@dataclass(frozen=True)
class Origin:      extractor: str; provenance: Provenance; source: Source | None
                   # extractor = "<plugin id>@<version>"

@dataclass(frozen=True)
class FileMetric:     path: str; lang: str; nloc: int; functions: int
                      ccn_max: int; ccn_sum: int; origin: Origin
@dataclass(frozen=True)
class FunctionMetric: id: str; path: str; name: str; start_line: int; end_line: int
                      nloc: int; ccn: int; params: int; origin: Origin

@dataclass(frozen=True)
class Entity:   id: str; kind: str; name: str; origin: Origin
@dataclass(frozen=True)
class Field:    entity: str; name: str; type_ref: str | None; origin: Origin
@dataclass(frozen=True)
class Relation: src: str; dst_ref: str; kind: str; origin: Origin
@dataclass(frozen=True)
class Access:   actor: str; target_ref: str; mode: Literal["read", "write", "subscribe", "emit"]; origin: Origin

@dataclass(frozen=True)
class CallEvent:
    trace: str; span: str; parent: str | None
    name: str
    kind: Literal["turn", "loop", "model", "tool", "guard", "subagent", "hook", "function"]
    start_ms: float; dur_ms: float | None
    attrs: dict          # tokens, cost_usd, tier, model, outcome, blocked_by, path (repo-relative), role
    origin: Origin

@dataclass(frozen=True)
class Diagnostic: extractor: str; path: str | None; severity: Literal["warning", "error"]; message: str
```

### 4.1 Identifier grammar

```
<lang>:<repo-relative path>                     module       py:keeper/memory/store.py
<lang>:<path>::<qualified name>                 symbol       ts:lib/telemetry.ts::InferenceRow
db:<store id>::<table>                          table        db:telemetry::inference_calls
db:<store id>::<table>.<column>                 column
file:<store id>                                 file store   file:known.md
event:<namespace>:<name>                        event        event:pi:agent_end
global:<key>                                    global state global:pi-build.telemetry
```

`<lang>` is the extractor's language key (`py`, `ts`). Paths use `/`. Qualified names use `.` for nesting.

### 4.2 Entity kinds

`module`, `class`, `interface`, `type`, `dataclass`, `pydantic`, `typeddict`, `enum`, `function`, `table`, `file_store`, `config`, `event`, `global`. New kinds require a schema version bump.

### 4.3 Relation kinds

`has_field_of` (field type refers to entity), `inherits`, `implements`, `fk`, `imports`, `defines` (module → symbol), `same_key` (inferred join by column name).

### 4.4 References and resolution

Extractors emit **references** in `dst_ref`, `type_ref`, `target_ref`: a bare or dotted name as written in source, or a full identifier when the extractor knows it (SQL table names, event names, store ids from config).

`resolve.py`, language-agnostic:

1. Build a symbol table from all `Entity` records: by full id, by qualified name, by last name segment.
2. For each reference: exact id → match (`extracted`); qualified name unique → match (`extracted`); import-visible name (use `imports` relations of the referencing module) unique → match (`extracted`); last segment unique repo-wide → match (`inferred`); several candidates → pick the one in the nearest directory, mark `inferred`, add a diagnostic warning; none → keep as unresolved with `dst` = `null` and count it in `meta.json`.
3. Store ids from `project.toml` `identifiers` resolve identifier references to stores (`inferred`).
4. `same_key` relations: for SQLite stores without declared foreign keys, columns named `<x>_id` in two or more tables produce `same_key` relations between those tables (`inferred`).

Language-specific resolution hooks are out of scope for v1.

## 5. Plugins

`map_build/plugins.py`. Discovery: import every package under `tools/map/extractors/`, `metrics/`, `traces/`, and collect the module attribute `PLUGINS: list`. A plugin id is unique; duplicate ids are a core error.

```python
class StructureExtractor(Protocol):
    id: str; version: int
    languages: frozenset[str]
    globs: tuple[str, ...]
    grammar: str | None                   # tree-sitter grammar key, or None for non-code sources
    def extract(self, ctx: FileContext) -> Iterable[Entity | Field | Relation | Access | Diagnostic]: ...

class MetricProvider(Protocol):
    id: str; version: int; languages: frozenset[str]
    def measure(self, paths: Sequence[str], repo: Path) -> Iterable[FileMetric | FunctionMetric | Diagnostic]: ...

class TraceAdapter(Protocol):
    id: str; version: int
    def detect(self, source: Path) -> bool: ...
    def events(self, source: Path, repo: Path) -> Iterable[CallEvent | Diagnostic]: ...

@dataclass(frozen=True)
class FileContext:
    path: str                 # repo-relative
    text: str
    tree: "tree_sitter.Tree | None"
    project: ProjectConfig
```

Core responsibilities (plugins do none of this): discovery, file walking, one parse per file per grammar, cache keyed by `(plugin id, plugin version, sha256(file))`, per-file try/except turning exceptions into `Diagnostic(severity="error")`, IR validation, resolution.

### 5.1 Tree-sitter query convention

Structure extractors run `.scm` query files through one generic runner (`map_build/queries.py`). Capture names are a closed, versioned vocabulary:

| Capture | Produces |
|---|---|
| `@entity.<kind>` on the whole node, with `@entity.name` | `Entity` |
| `@field.name`, optional `@field.type` inside an entity match | `Field` |
| `@relation.inherits`, `@relation.implements` | `Relation` |
| `@import.source`, optional `@import.name` | `Relation(kind="imports")` |
| `@access.read` / `@access.write` / `@access.subscribe` / `@access.emit` with `@access.target` | `Access` |
| `@literal.sql` | fed to the shared SQL helper (§5.3) |

The actor of an `Access` is the innermost enclosing function, method, or class, else the module. The runner computes it from the tree.

A language `module.py` may post-filter matches (for example deciding dataclass vs plain class from decorators). It must not walk files, parse, cache, or resolve.

### 5.2 Built-in extractors

**python.structure** (`**/*.py`):
- Entities: classes; `@dataclass` → `dataclass`; bases containing `BaseModel` → `pydantic`; `TypedDict` → `typeddict`; `Enum` → `enum`; top-level functions → `function`.
- Fields: annotated class-body assignments; `self.<x> = …` in `__init__` (`inferred`).
- Relations: bases → `inherits`; field annotations → `has_field_of` via `type_ref` (unwrap `Optional[...]`, `list[...]`, `X | None`, `dict[str, X]` → innermost user type names).
- Imports: `import x`, `from x import y`.
- Accesses: `open(<target>, <mode>)` where mode contains `w`, `a`, `x`, `+` → write, else read (`inferred`); `Path(...).write_text/read_text/…` (`inferred`); SQL in string arguments to `.execute`, `.executemany`, `.executescript` (§5.3).

**typescript.structure** (`**/*.ts`, `**/*.tsx`, `**/*.mts`):
- Entities: `interface`, `type` aliases with object types, `class`, `enum`, exported functions.
- Fields: interface and object-type members; class properties.
- Relations: `extends`, `implements`, member types → `has_field_of` (unwrap `T | null`, `T[]`, `Array<T>`, `Partial<T>`, `Record<string, T>`).
- Imports: `import … from "…"` including `.ts` extensions.
- Accesses: `fs.writeFileSync|appendFileSync|mkdirSync|renameSync|rmSync` → write; `fs.readFileSync|existsSync|readdirSync` → read; target is the first argument (identifier or string); SQL in string and template-literal arguments to `.prepare` and `.exec` (§5.3).

**sqlite.schema** (non-code, reads stores from `project.toml`): opens each database read-only (`file:…?mode=ro` URI), emits `table` entities, column `Field`s with declared type, `fk` relations from `PRAGMA foreign_key_list` (`extracted`). Missing file → warning diagnostic.

**manifest.stores**: emits `file_store` entities for `[[stores.file]]` entries.

### 5.3 Shared SQL helper

`map_build/sql.py`: `sql_accesses(text) -> list[(table, mode)]`. `INSERT INTO t`, `UPDATE t`, `DELETE FROM t`, `REPLACE INTO t` → write; `CREATE TABLE [IF NOT EXISTS] t` → write (schema owner); `FROM t`, `JOIN t` → read. Target ref is `db:?::<table>`; the resolver binds `?` to the single configured SQLite store that has the table, or leaves it unresolved with a warning. Regex-based is acceptable; ignore CTE names declared in `WITH`.

### 5.4 Project domain rules

`<repo>/.map/rules/*.scm` are run by the same runner for the language given in `rules.toml`:

```toml
[[rule]]
file = "pi-events.scm"
language = "typescript"
```

This repository ships one rule that turns `pi.on("<event>", …)` (and `.on` on any identifier named `pi` or `host`) into `Access(mode="subscribe", target_ref="event:pi:<event>")`, and one that turns `Symbol.for("<key>")` inside `globalThis` access into `Access(mode="write", target_ref="global:<key>")` for the function that owns the access. The event and global entities are created implicitly by the resolver for `event:` and `global:` references.

### 5.5 Metric provider

**lizard** (`python`, `typescript`): run lizard on the discovered files in-process (`lizard.analyze_file`). File metrics: `nloc`, function count, `ccn_max`, `ccn_sum`. Function metrics per function. Files lizard cannot parse → warning diagnostic and a `FileMetric` with `nloc` from a plain non-blank-line count, `functions=0`, provenance `inferred`.

### 5.6 Trace adapters

**pi.telemetry** (`detect`: SQLite file containing `inference_calls` and `tool_calls`):

- Selects rows for this repo (§6.2 attribution) within the window.
- Emits per turn: a `turn` event (span `turn:<turn_id>`); per distinct `loop_index` a `loop` event; per inference row a `model` event (`name = "<tier>/<model>"`, attrs tokens, cost, ttft); per tool row a `tool` event (`name = tool_name`) and, when `outcome` is `blocked` or `deduped`, a `guard` event child (`name = blocked_by`).
- `start_ms = ts - elapsed_ms`; `dur_ms = elapsed_ms`; null elapsed → `dur_ms = null`, `start_ms = ts`.
- With M0 columns present: rows with `parent_turn_id` become a `subagent` event (`name = subagent_role or "subagent"`) under the parent turn, with the child's events beneath it. Without M0 columns: no subagent links, plus one info-level warning in diagnostics.
- `attrs.path` is the repo-relative path when attributable, else omitted. Never read `arguments`.

**otel.json** (`detect`: JSON or JSON Lines with `resourceSpans` or OTLP span objects): one `CallEvent` per span; kind from `gen_ai.*` attributes → `model`, `http.*`/`db.*` → `tool`, else `function`.

**viztracer.json** (`detect`: Chrome trace JSON with `traceEvents`): complete events (`ph: "X"`) → `function` events; parents from nesting per thread.

## 6. Views

All view files carry `schema_version`, `generated_at`, `repo`, `highlight_turn`.

### 6.1 treemap.json

Hierarchy: directory → file → function. Leaf size is `nloc`. Every file node carries:

- `metrics`: `nloc`, `ccn_max`, `ccn_sum`, `functions`
- `agent`: `edits`, `reads`, `blocked`, `deduped`, `cost_usd`, `turns` (list of turn ids, newest first, max 20), `last_touched_ts`
- `git`: `commits`, `lines_changed` in the window
- `highlight`: true if edited in `highlight_turn`
- `entities`: ids defined in the file; `explain`: explain file paths linked to its turns (§6.4)

Ordering: children sorted by path. The page must not re-sort by value (stable layout across regenerations).

### 6.2 Agent attribution

A telemetry row belongs to this repo when:
1. M0 `project_root` equals the repo root → `extracted`; else
2. `path` is absolute and under the repo root → `extracted`; else
3. `path` is relative, the same `session_id` has at least one row attributed by rule 2, and `<repo>/<path>` exists → `inferred`.

Rows not attributed are ignored. `meta.json` reports attributed and ignored counts by rule.

`edits` = `tool_name ∈ {edit, write}` with `outcome = success`. `reads` = `tool_name = read` with `outcome = success`. Cost of a turn = sum of `cost_usd` over inference rows of that turn plus rows whose `parent_turn_id` is that turn. A turn's cost is split equally across the distinct files it edited; turns that edited nothing contribute nothing to file cost (they still appear in the call graph).

### 6.3 Churn

`git log -M --name-status --format=%H%x09%ct --since=<window>`: follow renames by folding old paths into new ones; `commits` and `lines_changed` (from `--numstat` in a second pass) per current path. Not a git repo → git fields null, one warning.

### 6.4 Explain links

After M0, explain files begin with `<!-- turn: <turn_id> -->`. The treemap maps turn ids to explain file paths by that marker. Files without the marker are ignored. Because explain finishes after `agent_end`, the current turn's link appears on the next build; this is expected.

### 6.5 callgraph.json

Two sections:

- `aggregate`: nodes keyed by `(kind, name)` over the window; `count`, `dur_ms_sum`, `dur_ms_p50`, `cost_usd`, `tokens` (prompt, cached, completion, reasoning), `outcomes` for tools. Edges parent→child with `count`. Root is a single `turn` node.
- `turns`: the last 50 turns, each an ordered list of events by `loop_index` then `start_ms`, for the single-turn timeline.

Include a `totals` block: turns, cost, cache hit rate, blocked and deduped counts. These must reproduce `scripts/report.sql` for the same rows (tested).

### 6.6 erd.json

- `entities`: id, kind, name, fields (name, type_ref, resolved type id), source location, provenance.
- `relations`: src, dst, kind, provenance.
- `accesses`: aggregated to file level by default (`actor_file`, `target`, `mode`, `count`), with the function-level list attached for drill-down.
- Entities with no fields, no relations, and no accesses are omitted (keeps the view readable). `meta.json` counts them.

## 7. Page

One self-contained `index.html` (inline CSS, JS, data, vendored libraries). Opens from `file://` with no network. Under 5 MB for this repository.

Header: repo name, build time, highlighted turn, diagnostics count (click to list).

**Treemap tab.** Squarified layout, input order preserved. Color mode switch: complexity (`ccn_max`), edits, reads, cost, git commits. Sequential scale per mode with a legend stating the metric and window. Highlighted files get a thick outline, not a color change. Click a file: side panel with metrics, function table (drill-down re-renders the file's rectangle as function tiles), recent turns with cost, explain links, entities defined here, accesses from here.

**Call graph tab.** Layered left-to-right layout (dagre). Aggregate mode: node size by count, fill by cost, edge width by count, label with count. Guard nodes styled distinctly (dashed border) and labeled with blocked and deduped counts. Turn picker switches to the single-turn timeline: loops as columns, model and tool events in order, subagents as nested blocks.

**Data model tab.** Entity boxes with field lists (dagre layout). Relations: solid for `extracted`, dashed for `inferred`, labeled with kind. Accesses toggle: file nodes on the left, entities on the right, arrows labeled `read` / `write` / `subscribe`, styled by mode with a text label (never color alone). Filter box by entity or file name.

Theme follows `prefers-color-scheme`. Keyboard: `1`/`2`/`3` switch tabs, `/` focuses filter.

## 8. Harness changes (M0 and M5)

### 8.1 Telemetry (M0)

In `lib/telemetry.ts`:

1. **Additive migration.** After `opened.exec(SCHEMA)`, read `PRAGMA table_info` for both tables and `ALTER TABLE … ADD COLUMN` any missing of: `tool_calls.tool_call_id TEXT`, and on both tables `project_root TEXT`, `parent_turn_id TEXT`, `subagent_role TEXT`. Add them to `SCHEMA` too so new databases get them directly. Existing rows keep nulls. No data rewrites.
2. **Project root.** On `agent_start`, store the project root for the turn in the bag (use `findProjectRoot(ctx.cwd)`; if importing it creates a cycle with `lib/scaffold.ts`, store `ctx.cwd` and let the map tool resolve it). Write it on every insert.
3. **Parent link.** When the bag is created, capture `process.env.PI_BUILD_PARENT_TURN` and `process.env.PI_BUILD_SUBAGENT_ROLE` into it. In `beginUserTurn`, set `process.env.PI_BUILD_PARENT_TURN = <new turn id>` so any child process inherits it. Write the captured parent and role on every insert. A child sets its own turn id for its own children; the captured value is not overwritten.
4. **Tool call id.** Persist `row.toolCallId` into `tool_call_id`.
5. **Roles.** In `explain.ts` and `recap.ts`, pass `env: { ...process.env, PI_BUILD_SUBAGENT_ROLE: "explain" | "recap" }` to `execFile`. Children spawned by other packages inherit the parent turn but no role; the adapter labels them `subagent`.
6. **Explain marker.** `explain.ts` writes `<!-- turn: <turn_id> -->` as the first line of each explain file. Use the current turn id from `turnSnapshot()` captured at the start of the `agent_end` handler.

Tests (node): migration on a copy of `tools/map/fixtures/telemetry.snapshot.db` adds columns and preserves row counts; parent capture from env with `resetTelemetryForTests()`; project root and role written; explain marker present; `explainCommand` args unchanged.

Do not change `scripts/report.sql` semantics.

### 8.2 Validator (M0)

`validateProject()` skips `.agent/map/` in the neutrality walk. Test: a file under `.agent/map/` containing `pi-build` does not fail validation; the same file elsewhere under `.agent/` still does.

### 8.3 Extension shim (M5)

`extensions/map.ts`, following the pattern of the other extensions (settings via `readPiSettings`, `extensionEnabled(settings, "map")`, errors logged with `[map]` prefix, load failure never breaks other extensions):

- On `agent_end`: if the turn had any tool call attributed to the project or edited a file, spawn the CLI with `--repo <project root> --telemetry <telemetryPath()> --turn <turn id>`, **without awaiting it** (do not delay other `agent_end` handlers). One build at a time per process: if a build is running, mark dirty and run once more when it exits.
- Timeout 60 s; kill on timeout; log one line.
- Command `/map`: build synchronously and print the `index.html` path; `/map open` also opens it (`xdg-open` / `open`).
- Settings block `map`: `enabled`, `outDir` (default `.agent/map`), `windowDays` (default 7), `uv` (default `"uv"`), `toolDir` (default: `tools/map` resolved relative to this extension file).
- Missing `uv` → one warning per session, then inert.

Also in M5: `deps.txt` gains `uv`; `doctor.sh --offline` runs `uv run --project tools/map pytest -q` when `uv` is present, else prints `skipped: uv not installed`; README gets a short "Map" section; `.map/project.toml` and `.map/rules/` for this repo; NOTICE lists vendored libraries.

## 9. Vendored front-end libraries

Download once from npm in the session, commit under `tools/map/map_build/render/vendor/` with their license files: `d3` (ISC), `dagre` (MIT) or `@dagrejs/dagre` (MIT). Record exact versions in `vendor/VERSIONS`. No CDN references in the page. No other front-end dependencies.

## 10. Tests and conformance

`uv run --project tools/map pytest -q` must pass at the end of every milestone, together with the existing node tests.

**Conformance** (`conformance/test_conformance.py`), parametrized over every discovered plugin:
- plugin has `fixtures/` with inputs and `golden.jsonl`;
- output validates against the IR JSON Schema;
- ids match §4.1; every record has an origin whose extractor string matches the plugin;
- output equals `golden.jsonl` (sorted, stable); regenerate with `UPDATE_GOLDEN=1`;
- a fixture named `broken.*` yields at least one `Diagnostic` and no exception;
- running twice with cache yields identical output and zero re-extractions the second time.

**Snapshot smoke test**: run the full build against this repository with the telemetry snapshot. Assert: at least one attributed row; treemap covers every `.ts` file under `extensions/` and `lib/`; `callgraph.totals` equals `scripts/report.sql` aggregates computed over the same attributed rows (write the comparison query in the test); ERD contains `db:telemetry::tool_calls` with a write access from `lib/telemetry.ts`; `event:pi:agent_end` has subscribe accesses from at least `explain.ts` and `recap.ts`; no string from the `arguments` column appears anywhere in the output directory (check by sampling 200 argument values and grepping).

**Python fixture** (`fixtures/py-sample/`): a small synthetic agent-style project (about 10 files) with dataclasses, a Pydantic-style model (no pydantic install needed; the extractor matches by base name), a SQLite store with `executescript` schema and a declared FK, file writes via `open` and `Path.write_text`, and a config module mapping names to classes. Build it, then assert the ERD contains the expected entities, relations (including the FK as `extracted`), and accesses.

**Performance**: full build of this repository under 3 s cold, under 1 s warm, on the cloud machine. Record timings in `meta.json`.

## 11. Milestones

One session and one PR per milestone. Each PR description lists: what was built, spec deviations and why, test output summary, timings.

| # | Scope | Done when |
|---|---|---|
| M0 | §8.1, §8.2 harness changes | node tests pass including new ones; migration test on snapshot copy passes |
| M1 | Core: IR, schema export, plugin discovery, walk, cache, CLI skeleton, lizard provider, churn, `treemap.json` with metrics, git and agent fields, attribution rules | conformance passes for lizard; snapshot smoke test passes for treemap assertions |
| M2 | Query runner, python and typescript extractors, SQL helper, sqlite and manifest extractors, resolver, domain rules for this repo, `erd.json`, Python fixture | conformance passes for all structure extractors; ERD assertions in smoke test and Python fixture pass |
| M3 | Trace adapters (pi.telemetry, otel.json, viztracer.json), `callgraph.json` | totals match `report.sql`; subagent linking tested with synthetic M0 rows; adapter conformance passes |
| M4 | Page, vendored libraries | `index.html` opens offline; a headless check (Python `html.parser` plus a data sanity pass) confirms all three datasets embedded; size limit met; commit a generated page from the snapshot as `tools/map/fixtures/sample-index.html` for human review |
| M5 | §8.3 shim, settings, doctor, README, NOTICE | node test for the shim's command construction and single-flight logic; doctor offline passes with and without `uv` |

If a milestone cannot meet its done-when without expanding scope, stop, commit what passes, and describe the gap in the PR.

## 12. Out of scope for v1

Cross-language references in one repo; type-resolved static call graphs; LSP or SCIP backends; hook-level timing inside extensions; a live server or websocket; any LLM call in the build path; editing the page from the browser; languages other than Python and TypeScript.

## 13. Adding a language later (must remain true)

A new language is a new package under `tools/map/extractors/<lang>/` with a grammar dependency, `.scm` files using §5.1 captures, an optional `module.py` post-filter, fixtures, and a golden file. Optionally the lizard provider's `languages` set grows. No edits to `map_build/` or the page. If an implementation choice would break this, it is wrong.

## 14. Status in this repository

Built in one session as a standalone add-on: `tools/map/` plus `extensions/map.ts`, with harness changes limited to what the integration needs. Deviations, each the smaller reading:

- **§1 facts that were already false.** `parent_turn_id` exists on both telemetry tables and explain/recap children already inherit `PI_BUILD_PARENT_TURN` (`explainSpawnEnv`). The snapshot is `tools/map/fixtures/telemetry.db`, found through `git ls-files '*.db'` as §2 allows.
- **M0 (§8.1) is not applied.** `lib/telemetry.ts` is unchanged: no `project_root`, `subagent_role`, or `tool_call_id` columns and no explain marker. The adapter reads those columns when present (attribution rule 1, role names, tool call ids) and otherwise attributes by path (rules 2 and 3), names children `subagent`, and emits one warning. §8.2 (the validator skip) is applied.
- **Attribution is per turn.** Inference rows carry no path, so a turn with any attributed tool row brings its other rows (`turn`), and child turns of an attributed turn come with it (`parent`). `meta.json` counts rows by rule 1, 2, 3, turn, parent, and ignored.
- **`--repo-alias <path>`** (repeatable; also `MAP_REPO_ALIASES`) treats another absolute root as this repo. The snapshot was recorded in other checkouts, so the smoke test passes their roots.
- **Store paths may be a list** tried in order with environment variables expanded; unset variables are skipped. This repo mirrors `telemetryPath()`.
- **Grammars** are registered by language packages as `GRAMMARS = {key: path -> Language}` so the core never names a language; TSX is the same extractor with a per-path grammar.
- **Query runner additions:** captures starting with `_` are private to a pattern and go only to the post-filter; `(#set! access.prefix "…")` prefixes access targets, which is how `.map/rules/` emit `event:pi:` and `global:` references without code.
- **The `global:` rule** matches `globalThis[Symbol.for("k")]` inside a function and `const K = Symbol.for("k")`; the second form is attributed to the module because a query cannot follow the constant to the function that indexes `globalThis` with it.
- **Implicit store entity:** `db:<store id>` (kind `file_store`) is emitted per SQLite store so identifier references such as `telemetryPath` have a target.
- **Cache key** includes the path as well as the file hash, since identical files (empty `__init__.py`) produce records that name different paths.
- **Rules** are cached under the hash of the rule file.
