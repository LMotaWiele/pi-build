"""Settings model and the name → class registry the runner reads."""

from agent.memory.store import MemoryStore
from agent.tools.files import FileTool
from agent.tools.search import SearchTool


class BaseModel:
    """Stand-in for pydantic.BaseModel; the extractor matches by base name."""


class Settings(BaseModel):
    model: str = "small"
    max_turns: int = 20
    memory_path: str = "memory.db"
    notes_path: str = "notes.md"


TOOLS = {
    "files": FileTool,
    "search": SearchTool,
}

STORES = {"sqlite": MemoryStore}
