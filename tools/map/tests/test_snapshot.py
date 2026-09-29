"""§10 smoke test: the full build of this repository against the telemetry snapshot."""

from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import sys
import time
from html.parser import HTMLParser
from pathlib import Path

import pytest

from map_build.build import BuildOptions, build

from conftest import REPO, TOOL

# The snapshot was recorded in other checkouts of this repository; these are their roots.
ALIASES = ("/home/george-contis/src/pi-build", "/tmp/pi-build-harness-s4/work", "/tmp/pi-build-context-s1/work")
WINDOW = 36500


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    from conftest import snapshot_source
    import shutil

    tmp = tmp_path_factory.mktemp("snap")
    db = tmp / "telemetry.db"
    shutil.copyfile(snapshot_source(), db)
    out = tmp / "map"
    old = os.environ.get("PI_BUILD_TELEMETRY_DB")
    os.environ["PI_BUILD_TELEMETRY_DB"] = str(db)  # the telemetry store in .map/project.toml
    try:
        result = build(BuildOptions(repo=REPO, out=out, telemetry=[db], window_days=WINDOW, aliases=ALIASES))
    finally:
        if old is None:
            os.environ.pop("PI_BUILD_TELEMETRY_DB", None)
        else:
            os.environ["PI_BUILD_TELEMETRY_DB"] = old
    return result, db, out


def _files(node, out=None):
    out = {} if out is None else out
    if node["type"] == "file":
        out[node["path"]] = node
    for child in node.get("children", []):
        if child.get("type") in ("dir", "file"):
            _files(child, out)
    return out


def test_attributes_at_least_one_row(built):
    result, _, _ = built
    rows = result.meta["attribution"]["rows"]
    assert rows["rule1"] + rows["rule2"] + rows["rule3"] >= 1


def test_treemap_covers_extensions_and_lib(built):
    result, _, _ = built
    files = _files(result.views["treemap"]["root"])
    expected = [p.relative_to(REPO).as_posix() for d in ("extensions", "lib") for p in (REPO / d).rglob("*.ts")]
    assert expected
    missing = [p for p in expected if p not in files]
    assert missing == []
    assert files["lib/telemetry.ts"]["metrics"]["functions"] > 10


def test_totals_match_report_sql(built):
    result, db, _ = built
    tool_ids = [int(e.span.split(":")[1]) for e in result.events if e.kind == "tool"]
    inf_ids = [int(e.span.split(":")[1]) for e in result.events if e.kind == "model"]
    con = sqlite3.connect(db)
    con.execute("CREATE TEMP TABLE keep_tool (id INTEGER PRIMARY KEY)")
    con.execute("CREATE TEMP TABLE keep_inf (id INTEGER PRIMARY KEY)")
    con.executemany("INSERT INTO keep_tool VALUES (?)", [(i,) for i in tool_ids])
    con.executemany("INSERT INTO keep_inf VALUES (?)", [(i,) for i in inf_ids])
    # scripts/report.sql's aggregates over the attributed rows, without its per-session grouping.
    row = con.execute("""
      WITH inf AS (
        SELECT
          ROUND(SUM(cost_usd), 4) AS cost_usd,
          ROUND(SUM(cached_tokens) * 1.0 / NULLIF(SUM(prompt_tokens), 0), 4) AS cache_hit_rate,
          ROUND(SUM(reasoning_tokens) * 1.0 / NULLIF(SUM(completion_tokens), 0), 4) AS reasoning_share,
          ROUND(SUM(CASE WHEN tier = 'escalate' THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(*), 0), 4) AS escalation_share
        FROM inference_calls WHERE id IN (SELECT id FROM keep_inf)
      ),
      tools AS (
        SELECT
          ROUND(SUM(CASE WHEN outcome = 'deduped' THEN 1 ELSE 0 END) * 1.0
                / NULLIF(SUM(CASE WHEN tool_name = 'read' THEN 1 ELSE 0 END), 0), 4) AS wasted_reread_rate,
          ROUND(SUM(CASE WHEN tool_name = 'note_open' THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(DISTINCT turn_id), 0), 4) AS note_opens_per_turn,
          SUM(CASE WHEN blocked_by = 'memory-gate' THEN 1 ELSE 0 END) AS raw_notes_blocked,
          ROUND(COUNT(DISTINCT CASE WHEN blocked_by = 'bounds' THEN turn_id END) * 1.0 / NULLIF(COUNT(DISTINCT turn_id), 0), 4) AS bound_turn_rate,
          SUM(CASE WHEN outcome = 'blocked' THEN 1 ELSE 0 END) AS blocked,
          SUM(CASE WHEN outcome = 'deduped' THEN 1 ELSE 0 END) AS deduped
        FROM tool_calls WHERE id IN (SELECT id FROM keep_tool)
      ),
      turns AS (
        SELECT COUNT(DISTINCT turn_id) AS turns FROM (
          SELECT turn_id FROM tool_calls WHERE id IN (SELECT id FROM keep_tool)
          UNION SELECT turn_id FROM inference_calls WHERE id IN (SELECT id FROM keep_inf))
      )
      SELECT inf.*, tools.*, turns.turns FROM inf, tools, turns
    """).fetchone()
    names = [d[0] for d in con.execute("SELECT * FROM (SELECT 1 AS cost_usd, 1 AS cache_hit_rate, 1 AS reasoning_share, 1 AS escalation_share, 1 AS wasted_reread_rate, 1 AS note_opens_per_turn, 1 AS raw_notes_blocked, 1 AS bound_turn_rate, 1 AS blocked, 1 AS deduped, 1 AS turns)").description]
    expected = dict(zip(names, row))
    totals = result.views["callgraph"]["totals"]
    assert {k: totals[k] for k in names} == expected
    assert expected["turns"] >= 1


def test_erd_has_telemetry_table_written_by_telemetry_ts(built):
    result, _, _ = built
    erd = result.views["erd"]
    assert any(e["id"] == "db:telemetry::tool_calls" for e in erd["entities"])
    assert any(a["target"] == "db:telemetry::tool_calls" and a["mode"] == "write" and a["actor_file"] == "lib/telemetry.ts"
               for a in erd["accesses"])


def test_agent_end_subscribers(built):
    result, _, _ = built
    subscribers = {a["actor_file"] for a in result.views["erd"]["accesses"]
                   if a["target"] == "event:pi:agent_end" and a["mode"] == "subscribe"}
    assert {"extensions/explain.ts", "extensions/recap.ts"} <= subscribers


def test_no_arguments_value_leaks(built):
    _, db, out = built
    con = sqlite3.connect(db)
    values = [r[0] for r in con.execute(
        "SELECT arguments FROM tool_calls WHERE length(arguments) >= 12 ORDER BY id LIMIT 200")]
    assert values
    blobs = [p.read_text(encoding="utf-8", errors="replace") for p in out.rglob("*") if p.is_file()]
    leaked = [v for v in values if any(v in blob for blob in blobs)]
    assert leaked == []


class _Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.data: dict[str, str] = {}
        self.current: str | None = None
        self.external: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for key in ("src", "href"):
            if a.get(key) and "//" in a[key] and tag in ("script", "link", "img", "iframe"):
                self.external.append(a[key])
        if tag == "script" and (a.get("id") or "").startswith("data-"):
            self.current = a["id"][5:]
            self.data[self.current] = ""

    def handle_data(self, data):
        if self.current:
            self.data[self.current] += data

    def handle_endtag(self, tag):
        if tag == "script":
            self.current = None


def test_page_is_self_contained(built):
    _, _, out = built
    html = (out / "index.html").read_text(encoding="utf-8")
    assert len(html.encode()) < 5_000_000
    parser = _Scripts()
    parser.feed(html)
    assert parser.external == []
    data = {k: json.loads(v) for k, v in parser.data.items()}
    assert set(data) >= {"treemap", "callgraph", "erd", "diagnostics", "meta"}
    assert data["treemap"]["root"]["children"]
    assert data["callgraph"]["aggregate"]["nodes"]
    assert data["erd"]["entities"]
    assert "d3" in html and "dagre" in html and "sourceMappingURL" not in html


def test_performance(tmp_path):
    env = {**os.environ, "PI_BUILD_TELEMETRY_DB": str(TOOL / "fixtures" / "does-not-exist.db")}
    cmd = [sys.executable, "-m", "map_build", "--repo", str(REPO), "--out", str(tmp_path / "map")]
    # Warm the interpreter and external environment without populating the measured cache.
    warmup = [sys.executable, "-m", "map_build", "--repo", str(REPO), "--out", str(tmp_path / "warmup")]
    subprocess.run(warmup, check=True, capture_output=True, env=env, cwd=TOOL)
    started = time.perf_counter()
    subprocess.run(cmd, check=True, capture_output=True, env=env, cwd=TOOL)
    cold = time.perf_counter() - started
    started = time.perf_counter()
    subprocess.run(cmd, check=True, capture_output=True, env=env, cwd=TOOL)
    warm = time.perf_counter() - started
    meta = json.loads((tmp_path / "map" / "data" / "meta.json").read_text())
    assert meta["cache"]["extractions"] == 0
    assert cold < 3.0, cold
    assert warm < 1.0, (warm, meta["timings_ms"])


def test_no_error_diagnostics(built):
    result, _, _ = built
    assert [d for d in result.diagnostics if d.severity == "error"] == []
