"""Per-file extraction cache.

Keyed by (plugin id, plugin version, sha256(file)). The path is part of the key too: two
files with the same bytes (empty `__init__.py`) produce records that name different paths.
One JSON file per plugin version, loaded once and written once per build.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from .ir import from_dict, to_dict

CACHE_FORMAT = 1


class ExtractionCache:
    def __init__(self, directory: Path | None):
        self.directory = directory
        self.tables: dict[str, dict[str, list[dict]]] = {}
        self.dirty: set[str] = set()
        self.hits = 0
        self.misses = 0

    def _file(self, table: str) -> Path:
        assert self.directory is not None
        safe = table.replace("/", "_").replace(":", "_")
        return self.directory / f"{safe}.json"

    def _table(self, table: str) -> dict[str, list[dict]]:
        if table not in self.tables:
            data: dict[str, list[dict]] = {}
            if self.directory is not None:
                try:
                    raw = json.loads(self._file(table).read_text(encoding="utf-8"))
                    if raw.get("format") == CACHE_FORMAT:
                        data = raw.get("entries", {})
                except (OSError, ValueError):
                    data = {}
            self.tables[table] = data
        return self.tables[table]

    @staticmethod
    def table_name(plugin_id: str, version: int) -> str:
        return f"{plugin_id}@{version}"

    @staticmethod
    def key(path: str, sha: str) -> str:
        return f"{sha}:{path}"

    def get(self, table: str, path: str, sha: str) -> list[Any] | None:
        entry = self._table(table).get(self.key(path, sha))
        if entry is None:
            self.misses += 1
            return None
        self.hits += 1
        return [from_dict(item) for item in entry]

    def put(self, table: str, path: str, sha: str, records: list[Any]) -> None:
        self._table(table)[self.key(path, sha)] = [to_dict(r) for r in records]
        self.dirty.add(table)

    def prune(self, table: str, live: set[str]) -> None:
        entries = self._table(table)
        stale = [k for k in entries if k not in live]
        for k in stale:
            del entries[k]
        if stale:
            self.dirty.add(table)

    def save(self) -> None:
        if self.directory is None:
            return
        self.directory.mkdir(parents=True, exist_ok=True)
        for table in sorted(self.dirty):
            target = self._file(table)
            tmp = target.with_suffix(".tmp")
            tmp.write_text(json.dumps({"format": CACHE_FORMAT, "entries": self.tables[table]}, sort_keys=True), encoding="utf-8")
            os.replace(tmp, target)
        self.dirty.clear()
