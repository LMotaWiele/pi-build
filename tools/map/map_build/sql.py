"""Tables a SQL string reads or writes. Regex-based; CTE names declared in WITH are ignored."""

from __future__ import annotations

import re

_IDENT = r"""(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)?))"""
_COMMENTS = re.compile(r"--[^\n]*|/\*.*?\*/", re.S)
_WRITE = re.compile(
    rf"\b(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|REPLACE\s+INTO|UPDATE(?:\s+OR\s+\w+)?|DELETE\s+FROM"
    rf"|CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE(?:\s+IF\s+NOT\s+EXISTS)?|ALTER\s+TABLE)\s+{_IDENT}",
    re.I,
)
_READ = re.compile(rf"\b(?:FROM|JOIN)\s+{_IDENT}", re.I)
_CTE = re.compile(r"(?:\bWITH(?:\s+RECURSIVE)?|,)\s+([A-Za-z_]\w*)\s*(?:\([^)]*\)\s*)?AS\s*(?:NOT\s+MATERIALIZED\s+|MATERIALIZED\s+)?\(", re.I)
_KEYWORDS = {"select", "where", "values", "set", "on", "using", "lateral", "unnest", "json_each", "json_tree"}


def _name(match: re.Match[str]) -> str:
    raw = next(g for g in match.groups() if g)
    return raw.split(".")[-1]


def sql_accesses(text: str) -> list[tuple[str, str]]:
    """Distinct (table, mode) pairs in order of first appearance."""
    sql = _COMMENTS.sub(" ", text)
    ctes = {m.group(1).lower() for m in _CTE.finditer(sql)}
    found: dict[tuple[str, str], None] = {}
    write_spans: list[tuple[int, int]] = []
    for match in _WRITE.finditer(sql):
        name = _name(match)
        write_spans.append(match.span())
        if name.lower() not in ctes and not name.lower().startswith(("sqlite_", "pragma_")):
            found.setdefault((name, "write"), None)
    for match in _READ.finditer(sql):
        if any(start <= match.start() < end for start, end in write_spans):
            continue
        name = _name(match)
        low = name.lower()
        if low in ctes or low in _KEYWORDS or low.startswith(("sqlite_", "pragma_")):
            continue
        found.setdefault((name, "read"), None)
    return list(found)
