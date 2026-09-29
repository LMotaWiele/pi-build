"""otel.json: OTLP JSON (`resourceSpans`) or JSON Lines of span objects → one CallEvent per span."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterator

from map_build.ir import CallEvent, Diagnostic, Origin


def _load(source: Path) -> list[Any]:
    text = source.read_text(encoding="utf-8")
    stripped = text.strip()
    if not stripped:
        return []
    try:
        return [json.loads(stripped)]
    except json.JSONDecodeError:
        return [json.loads(line) for line in stripped.splitlines() if line.strip()]


def _value(value: Any) -> Any:
    if not isinstance(value, dict):
        return value
    for key in ("stringValue", "boolValue", "doubleValue"):
        if key in value:
            return value[key]
    if "intValue" in value:
        return int(value["intValue"])
    if "arrayValue" in value:
        return [_value(v) for v in value["arrayValue"].get("values", [])]
    return None


def _attrs(raw: Any) -> dict:
    if isinstance(raw, dict):
        return {k: v for k, v in raw.items() if isinstance(v, (str, int, float, bool)) or v is None}
    out = {}
    for item in raw or []:
        if isinstance(item, dict) and "key" in item:
            out[item["key"]] = _value(item.get("value"))
    return out


def _spans(doc: Any) -> Iterator[dict]:
    if isinstance(doc, list):
        for item in doc:
            yield from _spans(item)
        return
    if not isinstance(doc, dict):
        return
    if "resourceSpans" in doc:
        for resource in doc["resourceSpans"] or []:
            for scope in resource.get("scopeSpans", resource.get("instrumentationLibrarySpans", [])) or []:
                yield from scope.get("spans", []) or []
        return
    if "spanId" in doc or "span_id" in doc:
        yield doc


def _kind(attrs: dict) -> str:
    keys = list(attrs)
    if any(k.startswith("gen_ai.") for k in keys):
        return "model"
    if any(k.startswith(("http.", "db.")) for k in keys):
        return "tool"
    return "function"


def _nanos(span: dict, *keys: str) -> float | None:
    for key in keys:
        if span.get(key) is not None:
            return int(span[key]) / 1e6
    return None


class OtelJson:
    id = "otel.json"
    version = 1

    def detect(self, source: Path) -> bool:
        if source.suffix.lower() not in (".json", ".jsonl", ".ndjson"):
            return False
        try:
            head = source.read_text(encoding="utf-8")[:65536]
        except (OSError, UnicodeDecodeError):
            return False
        return "resourceSpans" in head or '"spanId"' in head or '"span_id"' in head

    def events(self, source: Path, repo: Path, **opts: Any):
        tag = f"{self.id}@{self.version}"
        try:
            docs = _load(source)
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as err:
            yield Diagnostic(tag, None, "error", f"{source.name}: not OTLP JSON: {err}")
            return
        origin = Origin(tag, "extracted", None)
        count = 0
        for doc in docs:
            for span in _spans(doc):
                span_id = span.get("spanId") or span.get("span_id")
                trace = span.get("traceId") or span.get("trace_id") or source.stem
                start = _nanos(span, "startTimeUnixNano", "start_time_unix_nano")
                end = _nanos(span, "endTimeUnixNano", "end_time_unix_nano")
                if not span_id or start is None:
                    yield Diagnostic(tag, None, "warning", f"{source.name}: span without id or start time skipped")
                    continue
                attrs = _attrs(span.get("attributes"))
                parent = span.get("parentSpanId") or span.get("parent_span_id") or None
                count += 1
                yield CallEvent(str(trace), str(span_id), str(parent) if parent else None, str(span.get("name", "")),
                                _kind(attrs), start, (end - start) if end is not None else None, attrs, origin)  # type: ignore[arg-type]
        if count == 0:
            yield Diagnostic(tag, None, "warning", f"{source.name}: no spans")


PLUGINS = [OtelJson()]
