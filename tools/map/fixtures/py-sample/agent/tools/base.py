class Tool:
    name: str = "tool"

    def run(self, argument: str) -> str:
        raise NotImplementedError
