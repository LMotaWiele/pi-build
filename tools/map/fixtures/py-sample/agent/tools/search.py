from .base import Tool


class SearchTool(Tool):
    name = "search"
    limit: int = 5

    def run(self, argument: str) -> str:
        return argument[: self.limit]
