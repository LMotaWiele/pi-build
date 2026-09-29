"""Turn-level facts derived from CallEvents. Shared by the treemap and the call graph; knows no trace format."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from ..ir import CallEvent

EDIT_TOOLS = frozenset({"edit", "write"})


@dataclass
class TurnIndex:
    events: list[CallEvent]
    by_span: dict[str, CallEvent] = field(default_factory=dict)
    turn_of_span: dict[str, str] = field(default_factory=dict)
    turns: dict[str, CallEvent] = field(default_factory=dict)  # turn id → turn event
    parent_turn: dict[str, str] = field(default_factory=dict)
    own_cost: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    edited: dict[str, list[str]] = field(default_factory=lambda: defaultdict(list))

    @staticmethod
    def build(events: list[CallEvent]) -> "TurnIndex":
        index = TurnIndex(events)
        for event in events:
            index.by_span[event.span] = event
        for event in events:
            if event.kind == "turn":
                tid = str(event.attrs.get("turn_id") or event.span)
                index.turns[tid] = event
        for event in events:
            index.turn_of_span[event.span] = index._turn_for(event)
        for tid, event in index.turns.items():
            parent = event.parent and index.by_span.get(event.parent)
            if parent is not None:
                outer = index.turn_of_span.get(parent.span)
                if outer and outer != tid:
                    index.parent_turn[tid] = outer
        for event in events:
            tid = index.turn_of_span.get(event.span)
            if not tid:
                continue
            if event.kind == "model" and isinstance(event.attrs.get("cost_usd"), (int, float)):
                index.own_cost[tid] += float(event.attrs["cost_usd"])
            if (event.kind == "tool" and event.name in EDIT_TOOLS and event.attrs.get("outcome") == "success"
                    and event.attrs.get("path")):
                if event.attrs["path"] not in index.edited[tid]:
                    index.edited[tid].append(event.attrs["path"])
        return index

    def _turn_for(self, event: CallEvent) -> str | None:
        seen = set()
        current: CallEvent | None = event
        while current is not None and current.span not in seen:
            seen.add(current.span)
            if current.kind == "turn":
                return str(current.attrs.get("turn_id") or current.span)
            current = self.by_span.get(current.parent) if current.parent else None
        return None

    def cost(self, turn_id: str) -> float:
        """Own model cost plus the cost of turns whose parent is this turn."""
        total = self.own_cost.get(turn_id, 0.0)
        for child, parent in self.parent_turn.items():
            if parent == turn_id:
                total += self.own_cost.get(child, 0.0)
        return total

    def root_turns(self) -> list[str]:
        return [t for t in self.turns if t not in self.parent_turn]

    def latest_root(self) -> str | None:
        roots = self.root_turns()
        if not roots:
            return None
        return max(roots, key=lambda t: (self.turns[t].start_ms, t))
