from agent.config import Settings, TOOLS
from agent.memory import MemoryStore
from agent.models import Message, Role, Turn


class Runner:
    settings: Settings
    store: MemoryStore

    def __init__(self, settings: Settings):
        self.settings = settings
        self.store = MemoryStore(settings.memory_path)

    def step(self, turn: Turn, text: str) -> Turn:
        tool = TOOLS["search"]()
        reply = tool.run(text)
        return Turn(turn.turn_id, turn.messages + [Message(Role.ASSISTANT, reply)], parent=turn)


def main() -> None:
    runner = Runner(Settings())
    runner.store.save(Turn("t1", []))
