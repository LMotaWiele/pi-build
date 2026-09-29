"""Core: IR schema and ids, SQL helper, globs and walk, resolver, churn, CLI."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from map_build import ir
from map_build.__main__ import main
from map_build.churn import churn
from map_build.context import ProjectConfig, SqliteStore, parse_config
from map_build.ir import Access, Entity, Field, Origin, Relation
from map_build.plugins import PluginError, discover
from map_build.resolve import resolve
from map_build.sql import sql_accesses
from map_build.walk import glob_match, walk

from conftest import TOOL, git

O = Origin("t@1", "extracted", None)


def test_schema_export_and_validation():
    schema = ir.json_schema()
    assert schema["schema_version"] == ir.SCHEMA_VERSION == 1
    good = Entity("py:a.py::A", "class", "A", O)
    assert ir.validate_record(good) == []
    assert ir.validate_record(Entity("py:a.py::A", "widget", "A", O))  # kind outside §4.2
    assert ir.validate_record(Access("py:a.py", "x", "delete", O))  # type: ignore[arg-type]
    assert ir.from_dict(ir.to_dict(good)) == good


def test_print_schema(capsys):
    assert main(["--print-schema"]) == 0
    assert json.loads(capsys.readouterr().out)["$defs"]["Entity"]["properties"]["kind"]["enum"][0] == "module"


@pytest.mark.parametrize("identifier,form", [
    ("py:keeper/memory/store.py", "module"),
    ("ts:lib/telemetry.ts::InferenceRow", "symbol"),
    ("db:telemetry::inference_calls", "table"),
    ("db:telemetry::inference_calls.cost_usd", "column"),
    ("file:known.md", "file_store"),
    ("event:pi:agent_end", "event"),
    ("global:pi-build.telemetry", "global"),
    ("not an id", None),
])
def test_identifier_grammar(identifier, form):
    assert ir.id_form(identifier) == form


def test_sql_accesses():
    assert sql_accesses("INSERT INTO tool_calls (a) VALUES (1)") == [("tool_calls", "write")]
    assert sql_accesses("CREATE TABLE IF NOT EXISTS t (x)") == [("t", "write")]
    assert sql_accesses("DELETE FROM t WHERE id = 1") == [("t", "write")]
    assert sql_accesses("UPDATE OR IGNORE t SET x = 1") == [("t", "write")]
    assert sql_accesses("SELECT * FROM a JOIN b ON a.id = b.a_id") == [("a", "read"), ("b", "read")]
    got = sql_accesses("WITH recent AS (SELECT * FROM calls), x AS (SELECT 1) SELECT * FROM recent JOIN x")
    assert got == [("calls", "read")]
    assert sql_accesses("SELECT name FROM sqlite_master; PRAGMA table_info(t)") == []
    assert sql_accesses("SELECT * FROM ${table}") == []


def test_globs():
    assert glob_match("**/*.py", "a.py") and glob_match("**/*.py", "x/y/a.py")
    assert glob_match(".agent/map/**", ".agent/map/data/x.json")
    assert not glob_match("*.py", "x/a.ts")
    assert glob_match("*.lock", "deep/uv.lock")  # no slash: any depth
    assert not glob_match("results/*", "results/a/b")


def test_walk_excludes(tmp_path):
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "x.js").write_text("x")
    (tmp_path / "out").mkdir()
    (tmp_path / "out" / "a.py").write_text("x")
    (tmp_path / "big.py").write_text("x" * 1_000_001)
    (tmp_path / "bin.dat").write_bytes(b"\0\1\2")
    (tmp_path / "keep.py").write_text("x = 1\n")
    (tmp_path / "skip.lock").write_text("x")
    got = [f.path for f in walk(tmp_path, ("**/*.lock",), tmp_path / "out")]
    assert got == ["keep.py"]


def test_duplicate_plugin_ids_are_a_core_error(tmp_path, monkeypatch):
    for name in [m for m in sys.modules if m.split(".")[0] in ("extractors", "metrics", "traces")]:
        monkeypatch.delitem(sys.modules, name)
    monkeypatch.setattr(sys, "path", list(sys.path))
    pkg = tmp_path / "extractors" / "twice"
    pkg.mkdir(parents=True)
    (pkg.parent / "__init__.py").write_text("")
    (pkg / "__init__.py").write_text(
        "class P:\n id='same'; version=1; languages=frozenset(); globs=(); grammar=None\n def extract(self, ctx): return []\n"
        "PLUGINS=[P(), P()]\n"
    )
    with pytest.raises(PluginError):
        discover(tmp_path)


def test_resolver_rules():
    config = ProjectConfig(repo=Path("."), sqlite=(SqliteStore("s", ("x",), ("dbPath",)),))
    records = [
        Entity("py:a/models.py", "module", "a.models", O),
        Entity("py:a/models.py::User", "class", "User", O),
        Entity("py:b/models.py", "module", "b.models", O),
        Entity("py:b/models.py::User", "class", "User", O),
        Entity("py:a/service.py", "module", "a.service", O),
        Entity("py:a/service.py::Svc", "class", "Svc", O),
        Entity("py:c/lone.py::Lonely", "class", "Lonely", O),
        Entity("db:s", "file_store", "s", O),
        Entity("db:s::users", "table", "users", O),
        Entity("db:s::orders", "table", "orders", O),
        Field("db:s::users", "account_id", "TEXT", O),
        Field("db:s::orders", "account_id", "TEXT", O),
        Relation("py:a/service.py", "a.models", "imports", O),
        Relation("py:a/service.py::Svc", "User", "has_field_of", O),  # import-visible → a/models
        Relation("py:a/service.py::Svc", "vendor.Lonely", "inherits", O),  # last segment unique → inferred
        Relation("py:c/lone.py::Lonely", "User", "has_field_of", O),  # ambiguous → nearest, warning
        Relation("py:c/lone.py::Lonely", "Missing", "inherits", O),
        Access("py:a/service.py::Svc", "db:?::users", "read", O),
        Access("py:a/service.py::Svc", "db:?::nowhere", "write", O),
        Access("py:a/service.py::Svc", "self.dbPath", "write", O),
        Access("py:a/service.py::Svc", "event:pi:agent_end", "subscribe", O),
    ]
    out = resolve(records, config)
    rel = {(r["src"], r["dst_ref"]): r for r in out.relations}
    assert rel[("py:a/service.py", "a.models")]["dst"] == "py:a/models.py"
    visible = rel[("py:a/service.py::Svc", "User")]
    assert (visible["dst"], visible["provenance"]) == ("py:a/models.py::User", "extracted")
    lonely = rel[("py:a/service.py::Svc", "vendor.Lonely")]
    assert (lonely["dst"], lonely["provenance"]) == ("py:c/lone.py::Lonely", "inferred")
    assert rel[("py:c/lone.py::Lonely", "User")]["provenance"] == "inferred"
    assert rel[("py:c/lone.py::Lonely", "Missing")]["dst"] is None
    assert any("candidates" in d.message for d in out.diagnostics)
    acc = {a["target_ref"]: a for a in out.accesses}
    assert acc["db:?::users"]["target"] == "db:s::users"
    assert acc["db:?::nowhere"]["target"] is None
    assert acc["self.dbPath"]["target"] == "db:s"
    assert acc["event:pi:agent_end"]["target"] == "event:pi:agent_end"
    assert any(e["id"] == "event:pi:agent_end" and e["kind"] == "event" for e in out.entities)
    same = [r for r in out.relations if r["kind"] == "same_key"]
    assert [(r["src"], r["dst"], r["provenance"]) for r in same] == [("db:s::orders", "db:s::users", "inferred")]
    assert out.stats["relations_unresolved"] == 1


def test_config_parsing_reports_bad_entries(tmp_path):
    config = parse_config(tmp_path, {"stores": {"sqlite": [{"id": "x"}], "file": [{"globs": ["a"]}]}}, {"rule": [{"file": 1}]})
    assert len(config.errors) == 3


def test_store_path_candidates(tmp_path, monkeypatch):
    (tmp_path / "b.db").write_text("")
    monkeypatch.delenv("MAP_TEST_UNSET", raising=False)
    store = SqliteStore("s", ("$MAP_TEST_UNSET/a.db", "b.db"))
    assert store.resolve(tmp_path) == tmp_path / "b.db"


def test_churn_follows_renames(tmp_path):
    repo = tmp_path / "r"
    repo.mkdir()
    git(repo, "init", "-q")
    (repo / "old.py").write_text("a\nb\n")
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "one")
    git(repo, "mv", "old.py", "new.py")
    git(repo, "commit", "-qm", "rename")
    (repo / "new.py").write_text("a\nb\nc\n")
    git(repo, "commit", "-qam", "edit")
    result = churn(repo, 7)
    assert result.available
    assert result.commits == {"new.py": 3}
    assert result.lines_changed["new.py"] == 3  # 2 added, rename 0, 1 added


def test_churn_outside_git(tmp_path):
    result = churn(tmp_path, 7)
    assert not result.available
    assert result.for_path("x") == {"commits": None, "lines_changed": None}
    assert len(result.diagnostics) == 1


def test_cli_exit_codes(tmp_path):
    run = lambda *a: subprocess.run([sys.executable, "-m", "map_build", *a], cwd=TOOL, capture_output=True, text=True)  # noqa: E731
    assert run("--repo", str(tmp_path / "nope")).returncode == 2
    assert run("--bogus").returncode == 2
    (tmp_path / "a.py").write_text("def f():\n    return 1\n")
    ok = run("--repo", str(tmp_path), "--check")
    assert ok.returncode == 0, ok.stderr
    assert not (tmp_path / ".agent").exists()  # --check builds in a temp dir
    built = run("--repo", str(tmp_path))
    assert built.returncode == 0, built.stderr
    out = tmp_path / ".agent" / "map"
    assert (out / ".gitignore").read_text() == "*\n"
    for name in ("treemap", "callgraph", "erd", "diagnostics", "meta"):
        assert (out / "data" / f"{name}.json").is_file()
    assert (out / "index.html").is_file()
    assert (out / "ir" / "entities.jsonl").is_file()
