"""§10 Python fixture: a synthetic agent project built end to end."""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from map_build.build import BuildOptions, build

from conftest import TOOL, make_db


@pytest.fixture(scope="module")
def erd(tmp_path_factory):
    repo = tmp_path_factory.mktemp("py") / "py-sample"
    shutil.copytree(TOOL / "fixtures" / "py-sample", repo)
    make_db(repo / "memory.db", (repo / "build_db.sql").read_text())
    result = build(BuildOptions(repo=repo, out=repo / ".agent" / "map", no_cache=True))
    return result.views["erd"], result


def _entities(view):
    return {e["id"]: e for e in view["entities"]}


def test_entities_and_kinds(erd):
    view, _ = erd
    kinds = {i: e["kind"] for i, e in _entities(view).items()}
    assert kinds["py:agent/models.py::Message"] == "dataclass"
    assert kinds["py:agent/models.py::Turn"] == "dataclass"
    assert kinds["py:agent/models.py::Role"] == "enum"
    assert kinds["py:agent/config.py::Settings"] == "pydantic"
    assert kinds["py:agent/memory/store.py::MemoryRow"] == "typeddict"
    assert kinds["db:memory::turns"] == kinds["db:memory::messages"] == "table"
    assert kinds["file:notes"] == "file_store"
    fields = {f["name"]: f for f in _entities(view)["py:agent/models.py::Message"]["fields"]}
    assert fields["tool_call"]["type_id"] == "py:agent/models.py::ToolCall"


def test_relations(erd):
    view, _ = erd
    rels = {(r["src"], r["kind"], r["dst"]): r["provenance"] for r in view["relations"]}
    assert rels[("db:memory::messages", "fk", "db:memory::turns")] == "extracted"
    assert rels[("py:agent/models.py::Turn", "has_field_of", "py:agent/models.py::Message")] == "extracted"
    assert rels[("py:agent/runner.py::Runner", "has_field_of", "py:agent/config.py::Settings")] == "extracted"
    assert rels[("py:agent/tools/files.py::FileTool", "inherits", "py:agent/tools/base.py::Tool")] == "extracted"
    assert rels[("py:agent/runner.py", "imports", "py:agent/memory/__init__.py")] == "extracted"
    assert ("py:agent/memory/store.py", "imports", "py:agent/models.py") in rels  # relative import
    assert not any(k == "same_key" for _, k, _ in rels)  # the store declares a foreign key


def test_accesses(erd):
    view, _ = erd
    acc = {(a["actor_file"], a["mode"], a["target"]) for a in view["accesses"]}
    assert ("agent/memory/store.py", "write", "db:memory::messages") in acc
    assert ("agent/memory/store.py", "write", "db:memory::turns") in acc  # executescript CREATE TABLE
    assert ("agent/memory/store.py", "read", "db:memory::messages") in acc
    assert ("agent/tools/files.py", "write", "file:notes") in acc  # open(self.notes_path, "a")
    assert ("agent/tools/files.py", "write", "file:snapshot") in acc  # Path(...).write_text
    functions = [f["actor"] for a in view["accesses"] if a["target"] == "db:memory::turns" for f in a["functions"]]
    assert "py:agent/memory/store.py::MemoryStore.save" in functions


def test_no_diagnostics(erd):
    _, result = erd
    assert [d for d in result.diagnostics if d.severity == "error"] == []
