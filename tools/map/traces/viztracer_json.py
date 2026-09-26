"""viztracer.json: Chrome trace JSON (`traceEvents`) complete events → function CallEvents nested per thread."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from map_build.ir import CallEvent, Diagnostic, Origin


class VizTracerJson:
    id = "viztracer.json"
    version = 1

    def detect(self, source: Path) -> bool:
        if source.suffix.lower() != ".json":
            return False
        try:
            head = source.read_text(encoding="utf-8")[:65536]
        except (OSError, UnicodeDecodeError):
            return False
        return '"traceEvents"' in head

    def events(self, source: Path, repo: Path, **opts: Any):
        tag = f"{self.id}@{self.version}"
        try:
            doc = json.loads(source.read_text(encoding="utf-8"))
            raw = doc["traceEvents"] if isinstance(doc, dict) else doc
            if not isinstance(raw, list):
                raise ValueError("traceEvents is not a list")
        except (OSError, UnicodeDecodeError, ValueError, KeyError, TypeError) as err:
            yield Diagnostic(tag, None, "error", f"{source.name}: not a Chrome trace: {err}")
            return
        origin = Origin(tag, "extracted", None)
        threads: dict[tuple[Any, Any], list[tuple[int, dict]]] = defaultdict(list)
        for index, event in enumerate(raw):
            if isinstance(event, dict) and event.get("ph") == "X" and "ts" in event:
                threads[(event.get("pid", 0), event.get("tid", 0))].append((index, event))
        for (pid, tid), items in sorted(threads.items(), key=lambda kv: (str(kv[0][0]), str(kv[0][1]))):
            items.sort(key=lambda ie: (float(ie[1]["ts"]), -float(ie[1].get("dur", 0)), ie[0]))
            stack: list[tuple[float, str]] = []
            trace = f"{source.stem}:{pid}"
            for index, event in items:
                start = float(event["ts"]) / 1000.0
                dur = float(event.get("dur", 0)) / 1000.0
                end = start + dur
                while stack and stack[-1][0] < end - 1e-9:
                    stack.pop()
                span = f"{pid}:{tid}:{index}"
                parent = stack[-1][1] if stack else None
                attrs = {"pid": pid, "tid": tid, "cat": event.get("cat")}
                yield CallEvent(trace, span, parent, str(event.get("name", "")), "function", start, dur, attrs, origin)
                stack.append((end, span))


PLUGINS = [VizTracerJson()]
