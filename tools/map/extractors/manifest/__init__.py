"""manifest.stores: file stores declared in project.toml."""

from __future__ import annotations

from map_build.context import FileContext
from map_build.ir import Diagnostic, Entity, Origin


class ManifestStores:
    id = "manifest.stores"
    version = 1
    languages = frozenset({"manifest"})
    globs: tuple[str, ...] = ()
    grammar = None

    def extract(self, ctx: FileContext):
        tag = f"{self.id}@{self.version}"
        out: list = [Diagnostic(tag, ".map/project.toml", "warning", message) for message in ctx.project.errors]
        for store in ctx.project.files:
            out.append(Entity(f"file:{store.id}", "file_store", store.id, Origin(tag, "extracted", None)))
        return out


PLUGINS = [ManifestStores()]
