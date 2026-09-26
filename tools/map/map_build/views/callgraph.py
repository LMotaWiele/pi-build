"""callgraph.json: aggregate graph over the window, the last 50 turns as timelines, and report.sql totals."""

from __future__ import annotations

import sqlite3
import statistics
from collections import defaultdict
from typing import Any

from ..ir import CallEvent
from .agent import TurnIndex

MAX_TURNS = 50
_ROUND = sqlite3.connect(":memory:")


def sql_round(value: float | None, digits: int = 4) -> float | None:
    """SQLite's ROUND, so totals match scripts/report.sql digit for digit."""
    if value is None:
        return None
    return _ROUND.execute("SELECT ROUND(?, ?)", (value, digits)).fetchone()[0]


def _ratio(num: float | None, den: float | None) -> float | None:
    if num is None or not den:
        return None
    return sql_round(num * 1.0 / den)


def _sum(values: list[Any]) -> float | None:
    present = [v for v in values if v is not None]
    return sum(present) if present else None


def totals(events: list[CallEvent], index: TurnIndex) -> dict:
    models = [e for e in events if e.kind == "model"]
    tools = [e for e in events if e.kind == "tool"]
    tool_turns = {index.turn_of_span.get(e.span) for e in tools}
    bound_turns = {index.turn_of_span.get(e.span) for e in tools if e.attrs.get("blocked_by") == "bounds"}
    cost = _sum([m.attrs.get("cost_usd") for m in models])
    prompt = _sum([m.attrs.get("prompt_tokens") for m in models])
    cached = _sum([m.attrs.get("cached_tokens") for m in models])
    completion = _sum([m.attrs.get("completion_tokens") for m in models])
    reasoning = _sum([m.attrs.get("reasoning_tokens") for m in models])
    reads = sum(1 for t in tools if t.name == "read")
    return {
        "turns": len(index.turns),
        "cost_usd": sql_round(cost),
        "cache_hit_rate": _ratio(cached, prompt),
        "reasoning_share": _ratio(reasoning, completion),
        "escalation_share": _ratio(sum(1 for m in models if m.attrs.get("tier") == "escalate"), len(models)),
        "wasted_reread_rate": _ratio(sum(1 for t in tools if t.attrs.get("outcome") == "deduped"), reads),
        "note_opens_per_turn": _ratio(sum(1 for t in tools if t.name == "note_open"), len(tool_turns)),
        "raw_notes_blocked": sum(1 for t in tools if t.attrs.get("blocked_by") == "memory-gate") if tools else None,
        "bound_turn_rate": _ratio(len(bound_turns), len(tool_turns)),
        "blocked": sum(1 for t in tools if t.attrs.get("outcome") == "blocked"),
        "deduped": sum(1 for t in tools if t.attrs.get("outcome") == "deduped"),
        "model_calls": len(models),
        "tool_calls": len(tools),
    }


def _node_key(event: CallEvent, by_span: dict[str, CallEvent]) -> tuple[str, str] | None:
    if event.kind == "turn" and event.parent and event.parent in by_span:
        return None  # a subagent's own turn folds into its subagent node
    return (event.kind, event.name)


def aggregate(events: list[CallEvent], index: TurnIndex) -> dict:
    by_span = index.by_span
    nodes: dict[tuple[str, str], dict] = {}
    durations: dict[tuple[str, str], list[float]] = defaultdict(list)
    edges: dict[tuple[tuple[str, str], tuple[str, str]], int] = defaultdict(int)

    def key_for(span: str | None) -> tuple[str, str] | None:
        seen = set()
        while span and span in by_span and span not in seen:
            seen.add(span)
            event = by_span[span]
            key = _node_key(event, by_span)
            if key is not None:
                return key
            span = event.parent
        return None

    for event in events:
        key = _node_key(event, by_span)
        if key is None:
            continue
        node = nodes.get(key)
        if node is None:
            node = nodes[key] = {
                "id": f"{key[0]}:{key[1]}", "kind": key[0], "name": key[1], "count": 0, "dur_ms_sum": 0.0,
                "dur_ms_p50": None, "cost_usd": 0.0,
                "tokens": {"prompt": 0, "cached": 0, "completion": 0, "reasoning": 0},
            }
            if key[0] in ("tool", "guard"):
                node["outcomes"] = {}
        node["count"] += 1
        if event.dur_ms is not None:
            node["dur_ms_sum"] += event.dur_ms
            durations[key].append(event.dur_ms)
        if event.kind == "model":
            node["cost_usd"] += float(event.attrs.get("cost_usd") or 0)
            for short, attr in (("prompt", "prompt_tokens"), ("cached", "cached_tokens"),
                                ("completion", "completion_tokens"), ("reasoning", "reasoning_tokens")):
                node["tokens"][short] += int(event.attrs.get(attr) or 0)
        if "outcomes" in node:
            outcome = str(event.attrs.get("outcome") or "unknown")
            node["outcomes"][outcome] = node["outcomes"].get(outcome, 0) + 1
        parent = key_for(event.parent)
        if parent is not None:
            edges[(parent, key)] += 1
    for key, node in nodes.items():
        node["dur_ms_sum"] = round(node["dur_ms_sum"], 3)
        node["cost_usd"] = round(node["cost_usd"], 6)
        if durations[key]:
            node["dur_ms_p50"] = statistics.median(durations[key])
    ordered = sorted(nodes.values(), key=lambda n: (["turn", "subagent", "loop", "model", "tool", "guard", "hook", "function"].index(n["kind"]), n["name"]))
    return {
        "root": "turn:turn" if ("turn", "turn") in nodes else None,
        "nodes": ordered,
        "edges": sorted(
            ({"src": f"{a[0]}:{a[1]}", "dst": f"{b[0]}:{b[1]}", "count": n} for (a, b), n in edges.items()),
            key=lambda e: (e["src"], e["dst"]),
        ),
    }


def _slim(event: CallEvent) -> dict:
    return {
        "span": event.span, "parent": event.parent, "kind": event.kind, "name": event.name,
        "start_ms": event.start_ms, "dur_ms": event.dur_ms, "attrs": event.attrs,
    }


def timelines(events: list[CallEvent], index: TurnIndex) -> list[dict]:
    children: dict[str, list[CallEvent]] = defaultdict(list)
    for event in events:
        if event.parent:
            children[event.parent].append(event)
    out = []
    roots = sorted(index.root_turns(), key=lambda t: (-index.turns[t].start_ms, t))[:MAX_TURNS]
    for tid in roots:
        turn = index.turns[tid]
        collected: list[tuple[tuple, CallEvent]] = []
        last_loop = 0

        def walk(span: str, depth: int, loop_hint: float) -> None:
            nonlocal last_loop
            for child in children.get(span, []):
                loop = child.attrs.get("loop_index")
                is_own = index.turn_of_span.get(child.span) == tid
                if child.kind == "subagent":
                    loop_key = float("inf")
                elif is_own and isinstance(loop, (int, float)):
                    loop_key = float(loop)
                    last_loop = max(last_loop, int(loop))
                else:
                    loop_key = loop_hint
                collected.append(((loop_key, child.start_ms, depth, child.span), child))
                walk(child.span, depth + 1, loop_key)

        walk(turn.span, 1, 0.0)
        collected.sort(key=lambda kv: kv[0])
        out.append({
            "turn_id": tid,
            "trace": turn.trace,
            "session_id": turn.attrs.get("session_id"),
            "start_ms": turn.start_ms,
            "dur_ms": turn.dur_ms,
            "cost_usd": round(index.cost(tid), 6),
            "edited": index.edited.get(tid, []),
            "events": [_slim(turn)] + [_slim(e) for _, e in collected],
        })
    return out


def build_callgraph(header: dict, events: list[CallEvent], index: TurnIndex) -> dict:
    return {
        **header,
        "aggregate": aggregate(events, index),
        "turns": timelines(events, index),
        "totals": totals(events, index),
    }
