from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Role(Enum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


@dataclass
class Message:
    role: Role
    text: str
    tool_call: Optional["ToolCall"] = None


@dataclass
class ToolCall:
    name: str
    arguments: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class Turn:
    turn_id: str
    messages: list[Message]
    parent: Turn | None = None
