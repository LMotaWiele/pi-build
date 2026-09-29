"""Map views: methods and nested functions grouped with their owner, a data/code
split of the model, test code flagged, and relative-path telemetry attributed
through project_root. Run: uv run --project tools/map pytest docs/SPEC-map-views.tests -q
"""
import json
import sqlite3
import subprocess
import sys
import time
import tomllib
from html.parser import HTMLParser
from pathlib import Path

import pytest

from map_build.walk import any_match

REPO = Path(__file__).resolve().parents[3]
TOOL = REPO / "tools" / "map"
SNAPSHOT = TOOL / "fixtures" / "telemetry.db"

EXT_TS = """\
export default function demoExtension(pi: any) {
  function helper(x: number): number { return x + 1; }
  const poll = async () => helper(1);
  pi.on("agent_end", async () => { await poll(); });
}

function localOnly(): void {}

export class Store {
  count: number = 0;
  add(n: number): void { this.count += n; }
  get size(): number { return this.count; }
}

export interface Row { id: string; value: number }
export interface Empty {}
"""

MOD_PY = """\
from dataclasses import dataclass


@dataclass
class Point:
    x: int
    y: int

    def norm(self) -> float:
        return (self.x ** 2 + self.y ** 2) ** 0.5


class Service:
    def run(self) -> None:
        def step() -> None:
            pass
        step()


def top() -> None:
    def inner() -> None:
        pass
    inner()
"""


@pytest.fixture(scope="module")
def project(tmp_path_factory) -> Path:
    root = tmp_path_factory.mktemp("proj")
    (root / "ext.ts").write_text(EXT_TS)
    (root / "mod.py").write_text(MOD_PY)
    (root / "tests").mkdir()
    (root / "tests" / "test_mod.py").write_text("def test_top():\n    pass\n")
    (root / "lib").mkdir()
    (root / "lib" / "thing.test.ts").write_text("export function fixtureMaker(): number { return 1; }\n")
    db = root / "app.db"
    with sqlite3.connect(db) as c:
        c.execute("create table items (id integer primary key, name text)")
    (root / ".map").mkdir()
    (root / ".map" / "project.toml").write_text(
        f'[[stores.sqlite]]\nid = "app"\npath = "{db}"\nidentifiers = ["appDb"]\n'
    )
    return root


def build(repo: Path, out: Path, *extra: str) -> dict:
    cmd = [sys.executable, "-m", "map_build", "--repo", str(repo), "--out", str(out), "--no-cache", *extra]
    run = subprocess.run(cmd, cwd=TOOL, capture_output=True, text=True)
    assert run.returncode == 0, run.stderr
    return {name: json.loads((out / "data" / f"{name}.json").read_text()) for name in ("erd", "treemap")}


@pytest.fixture(scope="module")
def built(project, tmp_path_factory) -> tuple[dict, Path]:
    out = tmp_path_factory.mktemp("out")
    return build(project, out)["erd"], out


def ents(erd: dict) -> dict:
    return {e["id"]: e for e in erd["entities"]}


def owned(erd: dict) -> set[tuple[str, str]]:
    return {(r["src"], r.get("dst") or r["dst_ref"]) for r in erd["relations"] if r["kind"] == "member_of"}


def ids_in(erd: dict, prefix: str) -> set[str]:
    return {i for i in ents(erd) if i == prefix or i.startswith(prefix + "::")}


def test_methods_are_entities_owned_by_their_class(built):
    erd, _ = built
    e, m = ents(erd), owned(erd)
    for member, owner in [
        ("ts:ext.ts::Store.add", "ts:ext.ts::Store"),
        ("ts:ext.ts::Store.size", "ts:ext.ts::Store"),
        ("py:mod.py::Point.norm", "py:mod.py::Point"),
        ("py:mod.py::Service.run", "py:mod.py::Service"),
    ]:
        assert e.get(member, {}).get("kind") == "method", member
        assert (member, owner) in m, member


def test_nested_functions_are_owned_by_the_enclosing_function(built):
    erd, _ = built
    e, m = ents(erd), owned(erd)
    for member, owner in [
        ("ts:ext.ts::demoExtension.helper", "ts:ext.ts::demoExtension"),
        ("ts:ext.ts::demoExtension.poll", "ts:ext.ts::demoExtension"),
        ("py:mod.py::top.inner", "py:mod.py::top"),
        ("py:mod.py::Service.run.step", "py:mod.py::Service.run"),
    ]:
        assert e.get(member, {}).get("kind") == "function", member
        assert (member, owner) in m, member


def test_named_declarations_are_captured_and_anonymous_callbacks_are_not(built):
    erd, _ = built
    assert ids_in(erd, "ts:ext.ts") == {
        "ts:ext.ts",
        "ts:ext.ts::demoExtension",
        "ts:ext.ts::demoExtension.helper",
        "ts:ext.ts::demoExtension.poll",
        "ts:ext.ts::localOnly",
        "ts:ext.ts::Store",
        "ts:ext.ts::Store.add",
        "ts:ext.ts::Store.size",
        "ts:ext.ts::Row",
        "ts:ext.ts::Empty",
    }
    assert ids_in(erd, "py:mod.py") == {
        "py:mod.py",
        "py:mod.py::Point",
        "py:mod.py::Point.norm",
        "py:mod.py::Service",
        "py:mod.py::Service.run",
        "py:mod.py::Service.run.step",
        "py:mod.py::top",
        "py:mod.py::top.inner",
    }


def test_every_entity_is_in_the_data_or_the_code_layer(built):
    erd, _ = built
    e = ents(erd)
    assert all(x.get("layer") in ("data", "code") for x in e.values())
    data = {"ts:ext.ts::Row", "ts:ext.ts::Store", "py:mod.py::Point", "db:app"}
    code = {"ts:ext.ts::Empty", "py:mod.py::Service", "ts:ext.ts::demoExtension", "ts:ext.ts::Store.add",
            "py:mod.py::top.inner", "ts:ext.ts", "py:mod.py"}
    for i in data:
        assert e[i]["layer"] == "data", i
    for i in code:
        assert e[i]["layer"] == "code", i
    tables = [x for x in e.values() if x["kind"] == "table" and x["name"] == "items"]
    assert tables and tables[0]["layer"] == "data"


def test_test_code_is_flagged(built):
    erd, _ = built
    e = ents(erd)
    flagged = {i for i, x in e.items() if x.get("test") is True}
    assert "py:tests/test_mod.py::test_top" in flagged
    assert "ts:lib/thing.test.ts::fixtureMaker" in flagged
    assert all(x.get("test") is False for i, x in e.items() if i.startswith(("ts:ext.ts", "py:mod.py", "db:")))


class _Tabs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tabs: list[str] = []
        self.panels: set[str] = set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "button" and a.get("role") == "tab":
            self.tabs.append(a.get("data-tab"))
        if a.get("role") == "tabpanel" and a.get("id"):
            self.panels.add(a["id"])


def test_page_has_separate_data_and_code_tabs(built):
    _, out = built
    p = _Tabs()
    p.feed((out / "index.html").read_text())
    assert p.tabs == ["treemap", "callgraph", "data", "code"]
    assert {"view-treemap", "view-callgraph", "view-data", "view-code"} <= p.panels


def test_this_repository_excludes_reference_trees_and_fixtures():
    config = tomllib.loads((REPO / ".map" / "project.toml").read_text())
    excludes = config.get("exclude", [])
    assert any_match(excludes, "docs/specs/SPEC-0006-translate-specs-with-sol.reference/lib/quota.ts")
    assert any_match(excludes, "tests/fixtures/ab/src/parse.ts")
    assert not any_match(excludes, "lib/quota.ts")
    assert not any_match(excludes, "docs/specs/SPEC-0014-complete-the-codebase-map.md")
    assert not any_match(excludes, "docs/specs/SPEC-0014-complete-the-codebase-map.tests/test_map_views.py")


def test_relative_paths_are_attributed_through_project_root(project, tmp_path):
    """Guard for the adapter half of M0. Expected to pass already: rule 1 reads project_root."""
    db = tmp_path / "telemetry.db"
    db.write_bytes(SNAPSHOT.read_bytes())
    now = int(time.time() * 1000)
    with sqlite3.connect(db) as c:
        for table in ("tool_calls", "inference_calls"):
            cols = {r[1] for r in c.execute(f"pragma table_info({table})")}
            for col in ("project_root", "subagent_role"):
                if col not in cols:
                    c.execute(f"alter table {table} add column {col} text")
        c.execute(
            "insert into tool_calls (ts, session_id, turn_id, loop_index, tool_name, arguments, path, outcome, project_root)"
            " values (?, 's-m0', 't-m0', 0, 'edit', '{}', 'ext.ts', 'success', ?)", (now, str(project)))
        c.execute(
            "insert into inference_calls (ts, session_id, turn_id, loop_index, tier, model, cost_usd, project_root)"
            " values (?, 's-m0', 't-m0', 0, 'work', 'm', 0.25, ?)", (now, str(project)))
    tm = build(project, tmp_path / "out", "--telemetry", str(db))["treemap"]

    def files(n):
        if n.get("type") == "file":
            yield n
        for ch in n.get("children", []):
            yield from files(ch)

    node = next(f for f in files(tm["root"]) if f["path"] == "ext.ts")
    assert node["agent"]["edits"] >= 1
    assert "t-m0" in node["agent"]["turns"]
    assert node["agent"]["cost_usd"] > 0


def test_walkthroughs_link_to_their_turn_by_file_name(tmp_path):
    from map_build.build import _explain_links
    d = tmp_path / ".agent" / "explain"
    d.mkdir(parents=True)
    uid = "4f1c2d3e-aaaa-bbbb-cccc-123456789abc"
    (d / f"2026-09-30-turn-{uid}.md").write_text("## Unfamiliar surface\nx\n")
    (d / "2026-09-22-turn-legacy.md").write_text("<!-- turn: t-old -->\nx\n")
    (d / "known.md").write_text("ui.setFooter\n")
    links = _explain_links(tmp_path, ".agent/explain")
    assert links.get(uid) == [f".agent/explain/2026-09-30-turn-{uid}.md"]
    assert links.get("t-old") == [".agent/explain/2026-09-22-turn-legacy.md"]
    assert not any("known.md" in f for files in links.values() for f in files)
