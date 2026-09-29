"""pi.telemetry through the views: subagent linking, turn cost, attribution counts, treemap agent fields."""

from __future__ import annotations

import shutil

import pytest

from map_build.build import BuildOptions, build

from conftest import TOOL


@pytest.fixture(scope="module")
def result(tmp_path_factory):
    fixture = TOOL / "traces" / "fixtures" / "pi.telemetry"
    repo = tmp_path_factory.mktemp("tele") / "repo"
    shutil.copytree(fixture, repo)
    return build(BuildOptions(repo=repo, telemetry=[repo / "telemetry.db"], window_days=36500,
                              aliases=("/fixture/repo",), now_ms=10_000, no_cache=True))


def test_attribution_counts(result):
    rows = result.meta["attribution"]["rows"]
    # rule1: C's two rows and B's inference; rule2: two absolute paths; rule3: two relative in s1;
    # turn: A's two inference rows; ignored: Z's two rows.
    assert rows == {"rule1": 3, "rule2": 2, "rule3": 2, "turn": 2, "parent": 0, "ignored": 2}


def test_subagent_links_under_parent_turn(result):
    by_span = {e.span: e for e in result.events}
    sub = by_span["subagent:C"]
    assert (sub.kind, sub.name, sub.parent) == ("subagent", "explain", "turn:A")
    assert by_span["turn:C"].parent == "subagent:C"
    assert by_span["model:3"].trace == "A"


def test_turn_cost_includes_child_and_splits_over_edited_files(result):
    turns = {t["turn_id"]: t for t in result.views["callgraph"]["turns"]}
    assert set(turns) == {"A", "B"}  # C is nested, not a root
    assert turns["A"]["cost_usd"] == pytest.approx(0.08)
    assert turns["A"]["edited"] == ["src/app.py"]
    kinds = [e["kind"] for e in turns["A"]["events"]]
    assert kinds[0] == "turn" and "subagent" in kinds
    assert kinds.index("subagent") > max(i for i, k in enumerate(kinds) if k == "loop" and turns["A"]["events"][i]["attrs"]["turn_id"] == "A")


def test_aggregate(result):
    agg = result.views["callgraph"]["aggregate"]
    nodes = {n["id"]: n for n in agg["nodes"]}
    assert agg["root"] == "turn:turn" and nodes["turn:turn"]["count"] == 2
    assert nodes["guard:read-guard"]["outcomes"] == {"deduped": 1}
    assert nodes["tool:read"]["outcomes"] == {"success": 2, "deduped": 1, "blocked": 1}
    edges = {(e["src"], e["dst"]): e["count"] for e in agg["edges"]}
    assert edges[("turn:turn", "subagent:explain")] == 1
    assert edges[("subagent:explain", "loop:loop")] == 1
    assert ("turn:turn", "turn:turn") not in edges


def test_totals(result):
    totals = result.views["callgraph"]["totals"]
    assert totals["turns"] == 3
    assert totals["cost_usd"] == 0.081
    assert totals["blocked"] == 1 and totals["deduped"] == 1
    assert totals["cache_hit_rate"] == round(240 / 950, 4)


def test_treemap_agent_fields(result):
    files = {}

    def walk(node):
        if node["type"] == "file":
            files[node["path"]] = node
        for child in node.get("children", []):
            if child.get("type") in ("dir", "file"):
                walk(child)

    walk(result.views["treemap"]["root"])
    app = files["src/app.py"]["agent"]
    assert (app["edits"], app["reads"], app["deduped"]) == (1, 1, 1)
    assert app["cost_usd"] == pytest.approx(0.08)
    assert app["turns"][0] == "C" and set(app["turns"]) == {"A", "C"}
    assert files["src/app.py"]["highlight"] is False  # highlight defaults to the latest root turn (B)
    assert result.meta["highlight_turn"] == "B"
