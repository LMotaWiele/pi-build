"""treemap.json: directory → file → function, sized by nloc, with agent, git, and entity facts per file."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from ..churn import Churn
from ..ir import FileMetric, FunctionMetric, path_of
from .agent import TurnIndex

MAX_TURNS = 20


def _agent(index: TurnIndex) -> dict[str, dict]:
    per: dict[str, dict] = defaultdict(lambda: {
        "edits": 0, "reads": 0, "blocked": 0, "deduped": 0, "cost_usd": 0.0, "turns": [], "last_touched_ts": None,
    })
    touched: dict[str, dict[str, float]] = defaultdict(dict)
    for event in index.events:
        path = event.attrs.get("path") if event.kind == "tool" else None
        if not path:
            continue
        row = per[path]
        outcome = event.attrs.get("outcome")
        if outcome == "success" and event.name in ("edit", "write"):
            row["edits"] += 1
        elif outcome == "success" and event.name == "read":
            row["reads"] += 1
        elif outcome == "blocked":
            row["blocked"] += 1
        elif outcome == "deduped":
            row["deduped"] += 1
        end = event.start_ms + (event.dur_ms or 0)
        row["last_touched_ts"] = end if row["last_touched_ts"] is None else max(row["last_touched_ts"], end)
        tid = index.turn_of_span.get(event.span)
        if tid:
            turn_event = index.turns[tid]
            touched[path][tid] = turn_event.start_ms
    for tid, files in index.edited.items():
        if not files:
            continue
        share = index.cost(tid) / len(files)
        for path in files:
            per[path]["cost_usd"] += share
    for path, turns in touched.items():
        per[path]["turns"] = [t for t, _ in sorted(turns.items(), key=lambda kv: (-kv[1], kv[0]))][:MAX_TURNS]
    for row in per.values():
        row["cost_usd"] = round(row["cost_usd"], 6)
    return per


def build_treemap(header: dict, files: list[FileMetric], functions: list[FunctionMetric], index: TurnIndex,
                  churn: Churn, entities: list[dict], explain: dict[str, list[str]], highlight: str | None) -> dict:
    agent = _agent(index)
    highlighted = set(index.edited.get(highlight, [])) if highlight else set()
    fn_by_path: dict[str, list[FunctionMetric]] = defaultdict(list)
    for fn in functions:
        fn_by_path[fn.path].append(fn)
    defined: dict[str, list[str]] = defaultdict(list)
    for entity in entities:
        path = path_of(entity["id"])
        if path and entity["kind"] != "module":
            defined[path].append(entity["id"])

    root: dict[str, Any] = {"name": header.get("repo_name", ""), "path": "", "type": "dir", "children": []}
    dirs: dict[str, dict] = {"": root}

    def dir_node(path: str) -> dict:
        if path in dirs:
            return dirs[path]
        parent_path, _, name = path.rpartition("/")
        node = {"name": name, "path": path, "type": "dir", "children": []}
        dir_node(parent_path)["children"].append(node)
        dirs[path] = node
        return node

    empty_agent = {"edits": 0, "reads": 0, "blocked": 0, "deduped": 0, "cost_usd": 0.0, "turns": [], "last_touched_ts": None}
    for metric in sorted(files, key=lambda m: m.path):
        parent_path, _, name = metric.path.rpartition("/")
        facts = agent.get(metric.path, empty_agent)
        explain_links: list[str] = []
        for tid in facts["turns"]:
            for link in explain.get(tid, []):
                if link not in explain_links:
                    explain_links.append(link)
        node = {
            "name": name,
            "path": metric.path,
            "type": "file",
            "lang": metric.lang,
            "size": metric.nloc,
            "metrics": {"nloc": metric.nloc, "ccn_max": metric.ccn_max, "ccn_sum": metric.ccn_sum, "functions": metric.functions},
            "agent": facts,
            "git": churn.for_path(metric.path),
            "highlight": metric.path in highlighted,
            "entities": sorted(defined.get(metric.path, [])),
            "explain": explain_links,
            "provenance": metric.origin.provenance,
            "children": [
                {"name": fn.name, "id": fn.id, "type": "function", "size": fn.nloc, "nloc": fn.nloc, "ccn": fn.ccn,
                 "params": fn.params, "start_line": fn.start_line, "end_line": fn.end_line}
                for fn in sorted(fn_by_path.get(metric.path, []), key=lambda f: (f.start_line, f.id))
            ],
        }
        dir_node(parent_path)["children"].append(node)

    def order(node: dict) -> None:
        if node["type"] == "dir":
            node["children"].sort(key=lambda c: c["path"])
            for child in node["children"]:
                order(child)

    order(root)
    return {**header, "window_days": header.get("window_days"), "root": root}
