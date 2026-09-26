import sqlite3
from typing import TypedDict

from ..models import Message, Turn


class MemoryRow(TypedDict):
    turn_id: str
    role: str
    text: str


class MemoryStore:
    def __init__(self, path: str):
        self.path = path
        self.db = sqlite3.connect(path)
        self.db.executescript(
            """
            CREATE TABLE IF NOT EXISTS turns (
              id TEXT PRIMARY KEY,
              parent_id TEXT
            );
            CREATE TABLE IF NOT EXISTS messages (
              id INTEGER PRIMARY KEY,
              turn_id TEXT NOT NULL REFERENCES turns(id),
              role TEXT NOT NULL,
              text TEXT NOT NULL
            );
            """
        )

    def save(self, turn: Turn) -> None:
        self.db.execute("INSERT INTO turns (id, parent_id) VALUES (?, ?)", (turn.turn_id, None))
        for message in turn.messages:
            self.db.execute(
                "INSERT INTO messages (turn_id, role, text) VALUES (?, ?, ?)",
                (turn.turn_id, message.role.value, message.text),
            )

    def history(self, turn_id: str) -> list[MemoryRow]:
        rows = self.db.execute("SELECT turn_id, role, text FROM messages WHERE turn_id = ?", (turn_id,))
        return [MemoryRow(turn_id=r[0], role=r[1], text=r[2]) for r in rows]

    def forget(self, turn_id: str) -> None:
        self.db.execute("DELETE FROM messages WHERE turn_id = ?", (turn_id,))
