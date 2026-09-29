import json
import sqlite3 as sql
from dataclasses import dataclass
from enum import IntEnum
from pathlib import Path
from typing import Optional, TypedDict

from .pkg import helpers
from . import pkg


class BaseModel:
    pass


class Level(IntEnum):
    LOW = 1
    HIGH = 2


@dataclass
class Point:
    x: int
    y: int
    label: Optional["Label"] = None


class Label(BaseModel):
    text: str
    points: list[Point]
    lookup: dict[str, Point] | None = None


class Row(TypedDict):
    id: int
    level: Level


class Store:
    def __init__(self, path):
        self.path = path
        self.db = sql.connect(path)

    def load(self):
        return self.db.execute("SELECT id, level FROM rows JOIN labels ON labels.row_id = rows.id").fetchall()

    def save(self, row: Row):
        self.db.execute('INSERT INTO rows (id, level) VALUES (?, ?)', (row["id"], row["level"]))

    def dump(self, target):
        with open(target, "w") as handle:
            json.dump([], handle)
        Path("out/cache.json").write_text("{}")


def read_config(name):
    with open("config/" + name) as handle:
        return handle.read()
