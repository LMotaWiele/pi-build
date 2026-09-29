"""python.structure: classes, dataclasses, models, fields, imports, file and SQL accesses."""

from __future__ import annotations

from pathlib import Path

import tree_sitter
import tree_sitter_python

from map_build.context import FileContext
from map_build.queries import run_queries

from .module import SPEC

HERE = Path(__file__).parent
_LANGUAGE = tree_sitter.Language(tree_sitter_python.language())


def _grammar(path: str) -> tree_sitter.Language:
    return _LANGUAGE


class PythonStructure:
    id = "python.structure"
    version = 1
    languages = frozenset({"python"})
    globs = ("**/*.py", "**/*.pyi")
    grammar = "python"
    spec = SPEC

    def __init__(self) -> None:
        self.queries = [p.read_text(encoding="utf-8") for p in sorted(HERE.glob("*.scm"))]

    def extract(self, ctx: FileContext):
        return run_queries(ctx, self.queries, SPEC, f"{self.id}@{self.version}")


GRAMMARS = {"python": _grammar}
PLUGINS = [PythonStructure()]
