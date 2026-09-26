from pathlib import Path

from .base import Tool


class FileTool(Tool):
    name = "files"

    def __init__(self, root: str):
        self.root = Path(root)
        self.notes_path = self.root / "notes.md"

    def run(self, argument: str) -> str:
        with open(self.root / argument) as handle:
            return handle.read()

    def note(self, text: str) -> None:
        with open(self.notes_path, "a") as handle:
            handle.write(text + "\n")

    def snapshot(self, text: str) -> None:
        Path("state/snapshot.json").write_text(text)
