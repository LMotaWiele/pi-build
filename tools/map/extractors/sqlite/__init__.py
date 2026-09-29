"""sqlite.schema: tables, columns, and declared foreign keys of the SQLite stores in project.toml."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from map_build.context import FileContext
from map_build.ir import Diagnostic, Entity, Field, Origin, Relation


class SqliteSchema:
    id = "sqlite.schema"
    version = 1
    languages = frozenset({"sqlite"})
    globs: tuple[str, ...] = ()
    grammar = None

    def extract(self, ctx: FileContext):
        tag = f"{self.id}@{self.version}"
        out: list = []
        for store in ctx.project.sqlite:
            found = store.resolve(ctx.project.repo)
            if found is None:
                out.append(Diagnostic(tag, None, "warning", f"store {store.id!r}: no database at {', '.join(store.paths)}"))
                continue
            origin = Origin(tag, "extracted", None)
            try:
                out.extend(self._schema(store.id, found, origin))
            except sqlite3.DatabaseError as err:
                out.append(Diagnostic(tag, None, "warning", f"store {store.id!r}: {err}"))
                continue
        return out

    @staticmethod
    def _schema(store_id: str, path: Path, origin: Origin) -> list:
        uri = f"file:{path.resolve().as_posix()}?mode=ro"
        con = sqlite3.connect(uri, uri=True)
        try:
            tables = [row[0] for row in con.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )]
            out: list = [Entity(f"db:{store_id}", "file_store", store_id, origin)]
            for table in tables:
                table_id = f"db:{store_id}::{table}"
                out.append(Entity(table_id, "table", table, origin))
                quoted = table.replace('"', '""')
                for _, name, declared, *_ in con.execute(f'PRAGMA table_info("{quoted}")'):
                    out.append(Field(table_id, name, declared or None, origin))
                for row in con.execute(f'PRAGMA foreign_key_list("{quoted}")'):
                    out.append(Relation(table_id, f"db:{store_id}::{row[2]}", "fk", origin))
            return out
        finally:
            con.close()


PLUGINS = [SqliteSchema()]
