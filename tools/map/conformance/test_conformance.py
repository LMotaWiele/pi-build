"""Conformance for every discovered plugin (§10). Regenerate goldens with UPDATE_GOLDEN=1."""

from __future__ import annotations

import os
import tomllib
from pathlib import Path
from typing import Any

import pytest

from map_build import ir
from map_build.build import Extractor
from map_build.cache import ExtractionCache
from map_build.context import FileContext, ProjectConfig, load_project
from map_build.plugins import Registry, discover, kind_of, origin_tag
from map_build.walk import walk

REGISTRY = discover()
PLUGINS = REGISTRY.all()
SKIP_NAMES = {"golden.jsonl", "conformance.toml", "make.sql", "schema.sql"}


def _inputs(fixtures: Path, broken: bool) -> list:
    files = walk(fixtures)
    return [f for f in files if (Path(f.path).name.startswith("broken.") == broken) and Path(f.path).name not in SKIP_NAMES]


def _only(plugin: Any) -> Registry:
    single = Registry(grammars=REGISTRY.grammars)
    getattr(single, kind_of(plugin)).append(plugin)
    return single


def run_plugin(plugin: Any, fixtures: Path, broken: bool = False, cache_dir: Path | None = None) -> tuple[list[Any], int]:
    """Records the plugin produces over its fixtures, through the same core paths a build uses."""
    kind = kind_of(plugin)
    if kind == "traces":
        opts = {}
        if (fixtures / "conformance.toml").is_file():
            opts = tomllib.loads((fixtures / "conformance.toml").read_text())
            opts["aliases"] = tuple(opts.get("aliases", ()))
        out: list[Any] = []
        for walked in _inputs(fixtures, broken):
            source = fixtures / walked.path
            if broken or plugin.detect(source):
                out.extend(plugin.events(source, fixtures, **opts))
        if not broken:
            for binary in sorted(fixtures.glob("*.db")):
                if not binary.name.startswith("broken.") and plugin.detect(binary):
                    out.extend(plugin.events(binary, fixtures, **opts))
        else:
            for binary in sorted(fixtures.glob("broken.db")):
                out.extend(plugin.events(binary, fixtures, **opts))
        return out, 0
    if kind == "structure" and not plugin.globs:
        config = load_project(fixtures, fixtures / ("broken.toml" if broken else "project.toml"))
        return list(plugin.extract(FileContext("", "", None, config))), 0
    config = ProjectConfig(repo=fixtures)
    extractor = Extractor(fixtures, config, _only(plugin), ExtractionCache(cache_dir))
    files = _inputs(fixtures, broken)
    if kind == "structure":
        table = ExtractionCache.table_name(plugin.id, plugin.version)
        records = extractor.run_file_plugin(table, origin_tag(plugin), files, plugin.globs, plugin.grammar, plugin.extract)
    else:
        records = extractor.metrics(files)
    extractor.cache.save()
    return records, extractor.extractions


def lines(records: list[Any]) -> list[str]:
    return sorted(ir.dumps(r) for r in records)


def ids_of(record: Any) -> list[str]:
    if isinstance(record, (ir.Entity, ir.FunctionMetric)):
        return [record.id]
    if isinstance(record, ir.Relation):
        return [record.src]
    if isinstance(record, ir.Access):
        return [record.actor]
    if isinstance(record, ir.Field):
        return [record.entity]
    return []


@pytest.fixture(params=PLUGINS, ids=[p.id for p in PLUGINS])
def plugin(request):
    return request.param


def test_has_fixtures_and_golden(plugin):
    fixtures = REGISTRY.fixtures[plugin.id]
    assert fixtures.is_dir(), f"{plugin.id} has no fixtures dir"
    assert (fixtures / "golden.jsonl").is_file() or os.environ.get("UPDATE_GOLDEN"), f"{plugin.id} has no golden.jsonl"


def test_records_validate_and_carry_origin(plugin):
    records, _ = run_plugin(plugin, REGISTRY.fixtures[plugin.id])
    assert records, f"{plugin.id} produced nothing from its fixtures"
    schema = ir.json_schema()
    tag = origin_tag(plugin)
    for record in records:
        assert ir.validate(ir.to_dict(record), schema) == [], record
        for identifier in ids_of(record):
            assert ir.id_form(identifier) is not None, identifier
        if isinstance(record, ir.Diagnostic):
            assert record.extractor == tag
        else:
            assert record.origin is not None and record.origin.extractor == tag, record


def test_matches_golden(plugin):
    fixtures = REGISTRY.fixtures[plugin.id]
    records, _ = run_plugin(plugin, fixtures)
    got = lines(records)
    golden = fixtures / "golden.jsonl"
    if os.environ.get("UPDATE_GOLDEN"):
        golden.write_text("".join(line + "\n" for line in got), encoding="utf-8")
    assert golden.read_text(encoding="utf-8").splitlines() == got


def test_broken_fixture_yields_diagnostic(plugin):
    fixtures = REGISTRY.fixtures[plugin.id]
    broken = [p for p in fixtures.iterdir() if p.name.startswith("broken.")]
    assert broken, f"{plugin.id} has no broken.* fixture"
    records, _ = run_plugin(plugin, fixtures, broken=True)
    assert any(isinstance(r, ir.Diagnostic) for r in records), records


def test_cache_second_run_is_identical_and_extracts_nothing(plugin, tmp_path):
    fixtures = REGISTRY.fixtures[plugin.id]
    first, n1 = run_plugin(plugin, fixtures, cache_dir=tmp_path)
    second, n2 = run_plugin(plugin, fixtures, cache_dir=tmp_path)
    assert lines(first) == lines(second)
    cacheable = kind_of(plugin) == "metrics" or (kind_of(plugin) == "structure" and plugin.globs)
    if cacheable:
        assert n1 > 0
        assert n2 == 0


def test_ids_are_unique_per_plugin():
    assert len({p.id for p in PLUGINS}) == len(PLUGINS)
