"""typescript.structure: interfaces, object types, classes, enums, exported functions, imports, fs and SQL accesses."""

from __future__ import annotations

from pathlib import Path

import tree_sitter
import tree_sitter_typescript

from map_build.context import FileContext
from map_build.queries import run_queries

from .module import SPEC

HERE = Path(__file__).parent
_TS = tree_sitter.Language(tree_sitter_typescript.language_typescript())
_TSX = tree_sitter.Language(tree_sitter_typescript.language_tsx())


def _grammar(path: str) -> tree_sitter.Language:
    return _TSX if path.endswith(".tsx") else _TS


class TypeScriptStructure:
    id = "typescript.structure"
    version = 1
    languages = frozenset({"typescript"})
    globs = ("**/*.ts", "**/*.tsx", "**/*.mts")
    grammar = "typescript"
    spec = SPEC

    def __init__(self) -> None:
        self.queries = [p.read_text(encoding="utf-8") for p in sorted(HERE.glob("*.scm"))]

    def extract(self, ctx: FileContext):
        return run_queries(ctx, self.queries, SPEC, f"{self.id}@{self.version}")


GRAMMARS = {"typescript": _grammar}
PLUGINS = [TypeScriptStructure()]
