"""The pipeline: walk → parse → extract → metrics → traces → resolve → views → render."""

from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
import time
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import ir
from .cache import ExtractionCache
from .churn import churn
from .context import FileContext, ProjectConfig, load_project
from .ir import CallEvent, Diagnostic, Entity, FileMetric, FunctionMetric
from .plugins import Registry, discover, origin_tag
from .queries import run_queries
from .resolve import resolve
from .views.agent import TurnIndex
from .views.callgraph import build_callgraph
from .views.erd import build_erd
from .views.treemap import build_treemap
from .walk import WalkedFile, any_match, walk

_EXPLAIN_MARKER = re.compile(r"^<!--\s*turn:\s*(\S+)\s*-->")
_EXPLAIN_FILENAME = re.compile(r"^\d{4}-\d{2}-\d{2}-turn-(.+)\.md$")


@dataclass
class BuildOptions:
    repo: Path
    out: Path | None = None
    telemetry: list[Path] = field(default_factory=list)
    traces: list[Path] = field(default_factory=list)
    turn: str | None = None
    window_days: float = 7
    no_cache: bool = False
    check: bool = False
    aliases: tuple[str, ...] = ()
    now_ms: float | None = None
    render: bool = True


@dataclass
class BuildResult:
    out: Path
    meta: dict
    diagnostics: list[Diagnostic]
    records: list[Any]
    events: list[CallEvent]
    extractions: int
    views: dict = field(default_factory=dict)


class Timer:
    def __init__(self) -> None:
        self.started = time.perf_counter()
        self.last = self.started
        self.marks: dict[str, float] = {}

    def mark(self, name: str) -> None:
        now = time.perf_counter()
        self.marks[name] = round((now - self.last) * 1000, 1)
        self.last = now

    def total(self) -> float:
        return round((time.perf_counter() - self.started) * 1000, 1)


def _safe(plugin_tag: str, path: str | None, call) -> list[Any]:
    try:
        return list(call())
    except Exception as err:  # one file never fails the build
        return [Diagnostic(plugin_tag, path, "error", f"{type(err).__name__}: {err}")]


class Extractor:
    """Runs structure extractors and rules over the walked files with one parse per file per grammar."""

    def __init__(self, repo: Path, config: ProjectConfig, registry: Registry, cache: ExtractionCache):
        self.repo = repo
        self.config = config
        self.registry = registry
        self.cache = cache
        self.trees: dict[tuple[str, str], Any] = {}
        self.texts: dict[str, str] = {}
        self.extractions = 0

    def text(self, path: str) -> str:
        if path not in self.texts:
            self.texts[path] = (self.repo / path).read_bytes().decode("utf-8", "replace")
        return self.texts[path]

    def tree(self, grammar: str, path: str) -> Any:
        key = (grammar, path)
        if key not in self.trees:
            import tree_sitter

            language = self.registry.grammars[grammar](path)
            self.trees[key] = tree_sitter.Parser(language).parse(self.text(path).encode("utf-8"))
        return self.trees[key]

    def run_file_plugin(self, table: str, tag: str, files: list[WalkedFile], globs: tuple[str, ...], grammar: str | None,
                        extract) -> list[Any]:
        out: list[Any] = []
        live: set[str] = set()
        for walked in files:
            if not any_match(globs, walked.path):
                continue
            live.add(ExtractionCache.key(walked.path, walked.sha256))
            cached = self.cache.get(table, walked.path, walked.sha256)
            if cached is not None:
                out.extend(cached)
                continue
            self.extractions += 1

            def call(walked: WalkedFile = walked) -> list[Any]:
                tree = self.tree(grammar, walked.path) if grammar else None
                ctx = FileContext(walked.path, self.text(walked.path), tree, self.config)
                records = list(extract(ctx))
                if tree is not None and tree.root_node.has_error:
                    records.append(Diagnostic(tag, walked.path, "warning", "syntax errors; extraction is partial"))
                return records

            records = _safe(tag, walked.path, call)
            self.cache.put(table, walked.path, walked.sha256, records)
            out.extend(records)
        self.cache.prune(table, live)
        return out

    def structure(self, files: list[WalkedFile]) -> list[Any]:
        out: list[Any] = []
        for plugin in self.registry.structure:
            tag = origin_tag(plugin)
            if not plugin.globs:
                ctx = FileContext("", "", None, self.config)
                out.extend(_safe(tag, None, lambda: plugin.extract(ctx)))
                continue
            table = ExtractionCache.table_name(plugin.id, plugin.version)
            out.extend(self.run_file_plugin(table, tag, files, plugin.globs, plugin.grammar, plugin.extract))
        return out

    def rules(self, files: list[WalkedFile]) -> list[Any]:
        out: list[Any] = []
        for rule in self.config.rules:
            stem = Path(rule.file).stem
            tag = f"rules.{stem}@1"
            source_path = self.config.rules_dir / rule.file
            host = next((p for p in self.registry.structure
                         if rule.language in p.languages and getattr(p, "spec", None) and p.grammar), None)
            if host is None or not source_path.is_file():
                why = "no extractor for that language" if host is None else "file missing"
                out.append(Diagnostic(tag, f".map/rules/{rule.file}", "warning", f"rule skipped: {why}"))
                continue
            source = source_path.read_text(encoding="utf-8")
            import hashlib

            table = f"rules.{stem}@{hashlib.sha256(source.encode()).hexdigest()[:16]}"
            spec = replace(host.spec, filter=None)
            try:
                from .queries import compile_query

                compile_query(self.registry.grammars[host.grammar]("x"), source)
            except Exception as err:
                out.append(Diagnostic(tag, f".map/rules/{rule.file}", "error", f"rule does not compile: {err}"))
                continue
            out.extend(self.run_file_plugin(
                table, tag, files, host.globs, host.grammar,
                lambda ctx, source=source, spec=spec, tag=tag: run_queries(ctx, [source], spec, tag, emit_module=False),
            ))
        return out

    def metrics(self, files: list[WalkedFile]) -> list[Any]:
        out: list[Any] = []
        for plugin in self.registry.metrics:
            tag = origin_tag(plugin)
            table = ExtractionCache.table_name(plugin.id, plugin.version)
            handles = getattr(plugin, "handles", lambda _p: True)
            pending: list[WalkedFile] = []
            live: set[str] = set()
            for walked in files:
                if not handles(walked.path):
                    continue
                live.add(ExtractionCache.key(walked.path, walked.sha256))
                cached = self.cache.get(table, walked.path, walked.sha256)
                if cached is None:
                    pending.append(walked)
                else:
                    out.extend(cached)
            for walked in pending:
                self.extractions += 1
                records = _safe(tag, walked.path, lambda walked=walked: plugin.measure([walked.path], self.repo))
                self.cache.put(table, walked.path, walked.sha256, records)
                out.extend(records)
            self.cache.prune(table, live)
        return out


def _validate(records: list[Any]) -> tuple[list[Any], list[Diagnostic]]:
    schema = ir.json_schema()
    kept: list[Any] = []
    bad: list[Diagnostic] = []
    for record in records:
        errors = ir.validate(ir.to_dict(record), schema)
        ids = []
        if isinstance(record, (Entity, FunctionMetric)):
            ids.append(record.id)
        if isinstance(record, ir.Relation):
            ids.append(record.src)
        if isinstance(record, ir.Access):
            ids.append(record.actor)
        if isinstance(record, ir.Field):
            ids.append(record.entity)
        errors += [f"id {i!r} matches no §4.1 form" for i in ids if ir.id_form(i) is None]
        if errors:
            tag = getattr(getattr(record, "origin", None), "extractor", None) or getattr(record, "extractor", "core@1")
            bad.append(Diagnostic(tag, getattr(record, "path", None), "error", f"invalid record dropped: {errors[0]}"))
            continue
        kept.append(record)
    return kept, bad


def _explain_links(repo: Path, explain_dir: str) -> dict[str, list[str]]:
    links: dict[str, list[str]] = {}
    base = repo / explain_dir
    if not base.is_dir():
        return links
    for path in sorted(base.glob("*.md")):
        try:
            with path.open(encoding="utf-8", errors="replace") as handle:
                first = handle.readline()
        except OSError:
            continue
        match = _EXPLAIN_MARKER.match(first.strip())
        turn_id = match.group(1) if match else None
        if turn_id is None:
            filename_match = _EXPLAIN_FILENAME.fullmatch(path.name)
            if filename_match:
                turn_id = filename_match.group(1)
        if turn_id:
            links.setdefault(turn_id, []).append(path.relative_to(repo).as_posix())
    return links


def _write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, sort_keys=True, separators=(",", ":")))
            handle.write("\n")


def _write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=1, sort_keys=False, default=str) + "\n", encoding="utf-8")


def trace_sources(registry: Registry, sources: list[Path], repo: Path, opts: dict) -> tuple[list[CallEvent], list[Diagnostic], list[dict]]:
    events: list[CallEvent] = []
    diagnostics: list[Diagnostic] = []
    info: list[dict] = []
    for source in sources:
        if not source.exists():
            diagnostics.append(Diagnostic("core@1", None, "warning", f"trace source missing: {source}"))
            continue
        adapter = next((a for a in registry.traces if _detects(a, source)), None)
        if adapter is None:
            diagnostics.append(Diagnostic("core@1", None, "warning", f"no trace adapter recognises {source.name}"))
            continue
        tag = origin_tag(adapter)
        records = _safe(tag, None, lambda: adapter.events(source, repo, **opts))
        events.extend(r for r in records if isinstance(r, CallEvent))
        diagnostics.extend(r for r in records if isinstance(r, Diagnostic))
        info.append({"source": source.name, "adapter": adapter.id, "events": sum(isinstance(r, CallEvent) for r in records),
                     "stats": getattr(adapter, "stats", None)})
    return events, diagnostics, info


def _detects(adapter: Any, source: Path) -> bool:
    try:
        return bool(adapter.detect(source))
    except Exception:
        return False


def build(options: BuildOptions) -> BuildResult:
    timer = Timer()
    repo = options.repo.resolve()
    temp_dir = None
    if options.check:
        temp_dir = Path(tempfile.mkdtemp(prefix="map-check-"))
        out = temp_dir
    else:
        out = (options.out or repo / ".agent" / "map").resolve()
    try:
        return _build(options, repo, out, timer)
    finally:
        if temp_dir is not None:
            shutil.rmtree(temp_dir, ignore_errors=True)


def _build(options: BuildOptions, repo: Path, out: Path, timer: Timer) -> BuildResult:
    config = load_project(repo)
    registry = discover()
    timer.mark("discover")
    files = walk(repo, config.exclude, out)
    timer.mark("walk")
    cache = ExtractionCache(None if options.no_cache else out / "cache")
    extractor = Extractor(repo, config, registry, cache)
    records = extractor.structure(files) + extractor.rules(files)
    timer.mark("extract")
    records += extractor.metrics(files)
    timer.mark("metrics")
    opts = {"window_days": options.window_days, "aliases": options.aliases, "now_ms": options.now_ms}
    events, trace_diags, sources = trace_sources(registry, [*options.telemetry, *options.traces], repo, opts)
    timer.mark("traces")

    diagnostics = [r for r in records if isinstance(r, Diagnostic)] + trace_diags
    records = [r for r in records if not isinstance(r, Diagnostic)]
    records, invalid = _validate(records)
    events, invalid_events = _validate(events)
    diagnostics += invalid + invalid_events
    timer.mark("validate")

    resolved = resolve(records, config)
    diagnostics += resolved.diagnostics
    timer.mark("resolve")

    history = churn(repo, int(options.window_days) if options.window_days else 36500)
    diagnostics += history.diagnostics
    timer.mark("churn")

    index = TurnIndex.build(events)
    highlight = options.turn if options.turn else index.latest_root()
    header = {
        "schema_version": ir.SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "repo": str(repo),
        "repo_name": repo.name,
        "highlight_turn": highlight,
        "window_days": options.window_days,
    }
    try:
        out_rel = out.relative_to(repo).as_posix()
    except ValueError:
        out_rel = None
    file_metrics = [r for r in records if isinstance(r, FileMetric)]
    function_metrics = [r for r in records if isinstance(r, FunctionMetric)]
    treemap = build_treemap(header, file_metrics, function_metrics, index, history, resolved.entities,
                            _explain_links(repo, config.explain_dir), highlight)
    callgraph = build_callgraph(header, events, index)
    erd, erd_stats = build_erd(header, resolved)
    timer.mark("views")

    diagnostics_rows = sorted(({k: v for k, v in ir.to_dict(d).items() if k != "type"} for d in diagnostics),
                              key=lambda d: (d["severity"], d["extractor"], d["path"] or "", d["message"]))
    attribution = next((s["stats"] for s in sources if s.get("adapter") == "pi.telemetry" and s.get("stats")), None)
    meta = {
        **header,
        "out_rel_to_repo": out_rel,
        "timings_ms": {},
        "cache": {"enabled": not options.no_cache, "hits": cache.hits, "misses": cache.misses, "extractions": extractor.extractions},
        "files": {"walked": len(files), "measured": len(file_metrics), "functions": len(function_metrics)},
        "plugins": sorted(origin_tag(p) for p in registry.all()),
        "rules": [r.file for r in config.rules],
        "sources": [{k: v for k, v in s.items() if k != "stats"} for s in sources],
        "attribution": attribution,
        "resolution": resolved.stats,
        "erd": erd_stats,
        "events": len(events),
        "diagnostics": {"warning": sum(d.severity == "warning" for d in diagnostics),
                        "error": sum(d.severity == "error" for d in diagnostics)},
    }

    out.mkdir(parents=True, exist_ok=True)
    (out / ".gitignore").write_text("*\n", encoding="utf-8")
    data = out / "data"
    data.mkdir(exist_ok=True)
    ir_dir = out / "ir"
    ir_dir.mkdir(exist_ok=True)
    _write_json(data / "treemap.json", treemap)
    _write_json(data / "callgraph.json", callgraph)
    _write_json(data / "erd.json", erd)
    _write_json(data / "diagnostics.json", diagnostics_rows)
    sort = lambda rows: sorted(rows, key=lambda r: json.dumps(r, sort_keys=True))  # noqa: E731
    _write_jsonl(ir_dir / "entities.jsonl", resolved.entities)
    _write_jsonl(ir_dir / "fields.jsonl", sort(resolved.fields))
    _write_jsonl(ir_dir / "relations.jsonl", sort(resolved.relations))
    _write_jsonl(ir_dir / "accesses.jsonl", sort(resolved.accesses))
    _write_jsonl(ir_dir / "file_metrics.jsonl", sort([ir.to_dict(r) for r in file_metrics]))
    _write_jsonl(ir_dir / "function_metrics.jsonl", sort([ir.to_dict(r) for r in function_metrics]))
    _write_jsonl(ir_dir / "call_events.jsonl", [ir.to_dict(e) for e in events])
    cache.save()
    timer.mark("write")
    views = {"treemap": treemap, "callgraph": callgraph, "erd": erd, "diagnostics": diagnostics_rows}
    meta["timings_ms"] = {**timer.marks, "total": timer.total()}
    if options.render:
        from .render.page import render_page

        render_page(out / "index.html", {**views, "meta": meta})
        timer.mark("render")
        meta["timings_ms"] = {**timer.marks, "total": timer.total()}
    _write_json(data / "meta.json", meta)
    return BuildResult(out, meta, diagnostics, records, events, extractor.extractions, views)


def env_aliases() -> tuple[str, ...]:
    raw = os.environ.get("MAP_REPO_ALIASES", "")
    return tuple(p for p in raw.split(os.pathsep) if p)
