"""pi.telemetry: turns, loops, model calls, tool calls, guards, and subagents from pi-build's telemetry.db.

The `arguments` column is never selected.
"""

from __future__ import annotations

import os
import sqlite3
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

from map_build.ir import CallEvent, Diagnostic, Origin

TOOL_COLUMNS = ("id", "ts", "session_id", "turn_id", "loop_index", "tool_name", "path", "result_bytes", "elapsed_ms", "outcome", "blocked_by")
INFERENCE_COLUMNS = (
    "id", "ts", "session_id", "turn_id", "loop_index", "tier", "model", "prompt_tokens", "cached_tokens",
    "completion_tokens", "reasoning_tokens", "ttft_ms", "elapsed_ms", "cost_usd",
)
M0_COLUMNS = ("project_root", "parent_turn_id", "subagent_role")
TOOL_M0_COLUMNS = ("tool_call_id",)
DAY_MS = 86_400_000


def _connect(source: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"file:{source.resolve().as_posix()}?mode=ro", uri=True)


def _columns(con: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in con.execute(f"PRAGMA table_info({table})")}


def _norm_root(path: str) -> str:
    return os.path.normpath(path).rstrip("/") or "/"


def _under(path: str, roots: list[str]) -> str | None:
    """Repo-relative form of an absolute path under one of the roots."""
    normal = os.path.normpath(path)
    for root in roots:
        if normal == root:
            return ""
        if normal.startswith(root + "/"):
            return normal[len(root) + 1:]
    return None


def _relative(path: str) -> str:
    rel = os.path.normpath(path)
    return "" if rel == "." else rel


class PiTelemetry:
    id = "pi.telemetry"
    version = 1

    def __init__(self) -> None:
        self.stats: dict[str, Any] = {}
        self.rows: dict[str, list[int]] = {}

    def detect(self, source: Path) -> bool:
        try:
            with open(source, "rb") as handle:
                if handle.read(16) != b"SQLite format 3\x00":
                    return False
            con = _connect(source)
            try:
                names = {row[0] for row in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
            finally:
                con.close()
            return {"inference_calls", "tool_calls"} <= names
        except (OSError, sqlite3.DatabaseError):
            return False

    def events(self, source: Path, repo: Path, **opts: Any):
        tag = f"{self.id}@{self.version}"
        try:
            yield from self._events(source, repo, tag, **opts)
        except sqlite3.DatabaseError as err:
            yield Diagnostic(tag, None, "error", f"{source.name}: {err}")

    def _events(self, source: Path, repo: Path, tag: str, window_days: float | None = None,
                aliases: tuple[str, ...] = (), now_ms: float | None = None, **_: Any):
        con = _connect(source)
        try:
            tool_cols = _columns(con, "tool_calls")
            inf_cols = _columns(con, "inference_calls")
            missing = [c for c in M0_COLUMNS if c not in tool_cols or c not in inf_cols]
            missing += [c for c in TOOL_M0_COLUMNS if c not in tool_cols]
            tool_select = TOOL_COLUMNS + tuple(c for c in (*M0_COLUMNS, *TOOL_M0_COLUMNS) if c in tool_cols)
            inf_select = INFERENCE_COLUMNS + tuple(c for c in M0_COLUMNS if c in inf_cols)
            since = None
            if window_days is not None:
                since = (now_ms if now_ms is not None else time.time() * 1000) - window_days * DAY_MS
            where = " WHERE ts >= ?" if since is not None else ""
            params = (since,) if since is not None else ()
            con.row_factory = sqlite3.Row
            tools = [dict(r) for r in con.execute(f"SELECT {', '.join(tool_select)} FROM tool_calls{where} ORDER BY id", params)]
            infs = [dict(r) for r in con.execute(f"SELECT {', '.join(inf_select)} FROM inference_calls{where} ORDER BY id", params)]
        finally:
            con.close()
        if missing:
            has_parent = "parent_turn_id" in tool_cols and "parent_turn_id" in inf_cols
            yield Diagnostic(tag, None, "warning",
                             f"telemetry predates columns {', '.join(sorted(set(missing)))}"
                             + ("" if has_parent else "; subagent links skipped"))

        repo_root = _norm_root(str(repo.resolve()))
        roots = [repo_root] + [_norm_root(a) for a in aliases]
        rule: dict[tuple[str, int], str] = {}
        rel_path: dict[int, str] = {}

        for row in infs:
            if row.get("project_root") and _norm_root(row["project_root"]) in roots:
                rule[("inference", row["id"])] = "rule1"
        rule2_sessions: set[str] = set()
        for row in tools:
            path = row.get("path")
            if row.get("project_root") and _norm_root(row["project_root"]) in roots:
                rule[("tool", row["id"])] = "rule1"
                if path:
                    rel = _under(path, roots) if os.path.isabs(path) else _relative(path)
                    if rel and (repo / rel).exists():
                        rel_path[row["id"]] = rel
                continue
            if path and os.path.isabs(path):
                rel = _under(path, roots)
                if rel is not None:
                    rule[("tool", row["id"])] = "rule2"
                    rule2_sessions.add(row["session_id"])
                    if rel:
                        rel_path[row["id"]] = rel
        for row in tools:
            path = row.get("path")
            if ("tool", row["id"]) in rule or not path or os.path.isabs(path):
                continue
            rel = _relative(path)
            if row["session_id"] in rule2_sessions and rel and not rel.startswith("..") and (repo / rel).exists():
                rule[("tool", row["id"])] = "rule3"
                rel_path[row["id"]] = rel

        turns: set[str] = {row["turn_id"] for kind, rows in (("tool", tools), ("inference", infs))
                           for row in rows if (kind, row["id"]) in rule}
        parent_of: dict[str, str] = {}
        role_of: dict[str, str] = {}
        for row in (*tools, *infs):
            parent = row.get("parent_turn_id")
            if parent and parent != row["turn_id"]:
                parent_of.setdefault(row["turn_id"], parent)
            if row.get("subagent_role"):
                role_of.setdefault(row["turn_id"], row["subagent_role"])
        changed = True
        via_parent: set[str] = set()
        while changed:
            changed = False
            for child, parent in parent_of.items():
                if parent in turns and child not in turns:
                    turns.add(child)
                    via_parent.add(child)
                    changed = True

        counts = {"rule1": 0, "rule2": 0, "rule3": 0, "turn": 0, "parent": 0, "ignored": 0}
        kept_tools, kept_infs = [], []
        for kind, rows, kept in (("tool", tools, kept_tools), ("inference", infs, kept_infs)):
            for row in rows:
                how = rule.get((kind, row["id"]))
                if how:
                    counts[how] += 1
                elif row["turn_id"] in via_parent:
                    counts["parent"] += 1
                elif row["turn_id"] in turns:
                    counts["turn"] += 1
                else:
                    counts["ignored"] += 1
                    continue
                kept.append(row)
        # A row that joined through its turn keeps a path the repo has; the turn is already this repo's.
        for row in kept_tools:
            path = row.get("path")
            if row["id"] in rel_path or not path:
                continue
            rel = _under(path, roots) if os.path.isabs(path) else _relative(path)
            if rel and not rel.startswith("..") and (repo / rel).exists():
                rel_path[row["id"]] = rel
        self.stats = {"rows": counts, "turns": len(turns)}
        self.rows = {"tool_calls": [r["id"] for r in kept_tools], "inference_calls": [r["id"] for r in kept_infs]}
        yield from self._build(kept_tools, kept_infs, parent_of, role_of, turns, rel_path, rule, tag)

    @staticmethod
    def _build(tools, infs, parent_of, role_of, turns, rel_path, rule, tag):
        by_turn: dict[str, list[tuple[str, dict]]] = defaultdict(list)
        for row in tools:
            by_turn[row["turn_id"]].append(("tool", row))
        for row in infs:
            by_turn[row["turn_id"]].append(("inference", row))

        def span_of(row: dict) -> tuple[float, float | None]:
            elapsed = row.get("elapsed_ms")
            if elapsed is None:
                return float(row["ts"]), None
            return float(row["ts"] - elapsed), float(elapsed)

        def root_of(turn: str) -> str:
            seen = set()
            while turn in parent_of and parent_of[turn] in by_turn and turn not in seen:
                seen.add(turn)
                turn = parent_of[turn]
            return turn

        extracted = Origin(tag, "extracted", None)
        inferred = Origin(tag, "inferred", None)
        for turn_id in sorted(by_turn, key=lambda t: (min(r["ts"] for _, r in by_turn[t]), t)):
            rows = by_turn[turn_id]
            trace = root_of(turn_id)
            starts = [span_of(r)[0] for _, r in rows]
            end = max(r["ts"] for _, r in rows)
            start = min(starts)
            session = rows[0][1]["session_id"]
            parent_turn = parent_of.get(turn_id)
            turn_parent_span = None
            role = role_of.get(turn_id)
            if parent_turn and parent_turn in by_turn:
                sub_span = f"subagent:{turn_id}"
                yield CallEvent(trace, sub_span, f"turn:{parent_turn}", role or "subagent", "subagent", start, float(end - start),
                                {"role": role, "turn_id": parent_turn, "child_turn_id": turn_id, "session_id": session}, extracted)
                turn_parent_span = sub_span
            direct = any(rule.get((k, r["id"])) for k, r in rows)
            yield CallEvent(trace, f"turn:{turn_id}", turn_parent_span, "turn", "turn", start, float(end - start),
                            {"turn_id": turn_id, "session_id": session, "parent_turn_id": parent_turn, "role": role},
                            extracted if direct else inferred)
            loops: dict[int, list[tuple[str, dict]]] = defaultdict(list)
            for kind, row in rows:
                loops[row["loop_index"] if row["loop_index"] is not None else 0].append((kind, row))
            for index in sorted(loops):
                members = loops[index]
                loop_span = f"loop:{turn_id}:{index}"
                l_start = min(span_of(r)[0] for _, r in members)
                l_end = max(r["ts"] for _, r in members)
                yield CallEvent(trace, loop_span, f"turn:{turn_id}", "loop", "loop", l_start, float(l_end - l_start),
                                {"turn_id": turn_id, "loop_index": index, "session_id": session}, extracted)
                for kind, row in sorted(members, key=lambda kr: (span_of(kr[1])[0], kr[0], kr[1]["id"])):
                    s, d = span_of(row)
                    base = {"turn_id": turn_id, "session_id": session, "loop_index": index}
                    if kind == "inference":
                        attrs = {**base, "tier": row["tier"], "model": row["model"], "cost_usd": row["cost_usd"],
                                 "prompt_tokens": row["prompt_tokens"], "cached_tokens": row["cached_tokens"],
                                 "completion_tokens": row["completion_tokens"], "reasoning_tokens": row["reasoning_tokens"],
                                 "ttft_ms": row["ttft_ms"]}
                        yield CallEvent(trace, f"model:{row['id']}", loop_span, f"{row['tier']}/{row['model']}", "model", s, d, attrs, extracted)
                        continue
                    attrs = {**base, "tool_name": row["tool_name"], "outcome": row["outcome"], "blocked_by": row["blocked_by"],
                             "result_bytes": row["result_bytes"]}
                    if row.get("tool_call_id"):
                        attrs["tool_call_id"] = row["tool_call_id"]
                    if row["id"] in rel_path:
                        attrs["path"] = rel_path[row["id"]]
                    how = rule.get(("tool", row["id"]))
                    origin = extracted if how in ("rule1", "rule2") else inferred
                    yield CallEvent(trace, f"tool:{row['id']}", loop_span, row["tool_name"], "tool", s, d, attrs, origin)
                    if row["outcome"] in ("blocked", "deduped"):
                        name = row["blocked_by"] or ("dedupe" if row["outcome"] == "deduped" else "blocked")
                        yield CallEvent(trace, f"guard:{row['id']}", f"tool:{row['id']}", name, "guard", s, d,
                                        {"turn_id": turn_id, "outcome": row["outcome"], "blocked_by": row["blocked_by"],
                                         "tool_name": row["tool_name"], "loop_index": index}, extracted)


PLUGINS = [PiTelemetry()]
