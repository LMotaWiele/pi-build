"""lizard: nloc, function count, and cyclomatic complexity per file and function."""

from __future__ import annotations

from pathlib import Path
from typing import Sequence

import re

import lizard

from map_build.ir import Diagnostic, FileMetric, FunctionMetric, Origin, Source

# Extension → IR language key. Growing this set is how a language gets metrics.
LANG_BY_EXT = {".py": "py", ".pyi": "py", ".ts": "ts", ".tsx": "ts", ".mts": "ts"}


class LizardProvider:
    id = "lizard"
    version = 1
    languages = frozenset({"python", "typescript"})

    def handles(self, path: str) -> bool:
        return Path(path).suffix in LANG_BY_EXT

    def measure(self, paths: Sequence[str], repo: Path):
        tag = f"{self.id}@{self.version}"
        for path in paths:
            lang = LANG_BY_EXT.get(Path(path).suffix)
            if lang is None:
                continue
            raw = (repo / path).read_bytes()
            try:
                code = raw.decode("utf-8")
                info = lizard.analyze_file.analyze_source_code(path, code)
            except Exception as err:  # lizard's readers raise freely on odd input
                yield Diagnostic(tag, path, "warning", f"lizard could not parse: {type(err).__name__}: {err}")
                text = raw.decode("utf-8", "replace")
                nloc = sum(1 for line in text.splitlines() if line.strip())
                yield FileMetric(path, lang, nloc, 0, 0, 0, Origin(tag, "inferred", Source(path, 1, max(1, text.count("\n") + 1))))
                continue
            functions = info.function_list
            seen: dict[str, int] = {}
            def ident(fn) -> str:
                # Ids carry no whitespace: TypeScript accessors come back as "get busy".
                return re.sub(r"\s+", "_", fn.name.strip()).replace("::", ".")

            for fn in functions:
                name = ident(fn)
                seen[name] = seen.get(name, 0) + 1
            emitted: dict[str, int] = {}
            for fn in functions:
                name = ident(fn)
                qual = name if seen[name] == 1 else f"{name}@{fn.start_line}"
                emitted[qual] = emitted.get(qual, 0) + 1
                if emitted[qual] > 1:
                    qual = f"{qual}#{emitted[qual]}"
                yield FunctionMetric(
                    id=f"{lang}:{path}::{qual}",
                    path=path,
                    name=fn.name.replace("::", "."),
                    start_line=fn.start_line,
                    end_line=fn.end_line,
                    nloc=fn.nloc,
                    ccn=fn.cyclomatic_complexity,
                    params=len(fn.parameters),
                    origin=Origin(tag, "extracted", Source(path, fn.start_line, fn.end_line)),
                )
            ccns = [fn.cyclomatic_complexity for fn in functions]
            yield FileMetric(
                path, lang, info.nloc, len(functions), max(ccns, default=0), sum(ccns),
                Origin(tag, "extracted", None),
            )


PLUGINS = [LizardProvider()]
