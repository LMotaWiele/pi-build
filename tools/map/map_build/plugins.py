"""Plugin protocols and discovery.

Every package or module under `extractors/`, `metrics/`, and `traces/` may export
`PLUGINS: list` and, for tree-sitter languages, `GRAMMARS: dict[str, Callable[[str], Language]]`
(grammar key → a function from repo-relative path to a Language). The core never names a language.
"""

from __future__ import annotations

import importlib
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterable, Protocol, Sequence, runtime_checkable

from .context import FileContext
from .ir import Access, CallEvent, Diagnostic, Entity, Field, FileMetric, FunctionMetric, Relation

TOOL_ROOT = Path(__file__).resolve().parent.parent
PLUGIN_DIRS = ("extractors", "metrics", "traces")


@runtime_checkable
class StructureExtractor(Protocol):
    id: str
    version: int
    languages: frozenset[str]
    globs: tuple[str, ...]
    grammar: str | None

    def extract(self, ctx: FileContext) -> Iterable[Entity | Field | Relation | Access | Diagnostic]: ...


@runtime_checkable
class MetricProvider(Protocol):
    id: str
    version: int
    languages: frozenset[str]

    def measure(self, paths: Sequence[str], repo: Path) -> Iterable[FileMetric | FunctionMetric | Diagnostic]: ...


@runtime_checkable
class TraceAdapter(Protocol):
    id: str
    version: int

    def detect(self, source: Path) -> bool: ...

    def events(self, source: Path, repo: Path, **opts: Any) -> Iterable[CallEvent | Diagnostic]: ...


class PluginError(Exception):
    """A core error: discovery could not produce a consistent plugin set."""


@dataclass
class Registry:
    structure: list[Any] = field(default_factory=list)
    metrics: list[Any] = field(default_factory=list)
    traces: list[Any] = field(default_factory=list)
    grammars: dict[str, Callable[[str], Any]] = field(default_factory=dict)
    fixtures: dict[str, Path] = field(default_factory=dict)  # plugin id → its fixtures dir

    def all(self) -> list[Any]:
        return [*self.structure, *self.metrics, *self.traces]

    def by_id(self, plugin_id: str) -> Any:
        for plugin in self.all():
            if plugin.id == plugin_id:
                return plugin
        raise KeyError(plugin_id)


def kind_of(plugin: Any) -> str:
    if hasattr(plugin, "extract"):
        return "structure"
    if hasattr(plugin, "measure"):
        return "metrics"
    if hasattr(plugin, "events") and hasattr(plugin, "detect"):
        return "traces"
    raise PluginError(f"plugin {getattr(plugin, 'id', plugin)!r} implements no known protocol")


def _module_names(root: Path) -> list[tuple[str, Path]]:
    names: list[tuple[str, Path]] = []
    for top in PLUGIN_DIRS:
        base = root / top
        if not base.is_dir():
            continue
        for child in sorted(base.iterdir()):
            if child.name.startswith(("_", ".")) or child.name in ("fixtures", "__pycache__"):
                continue
            if child.is_dir() and (child / "__init__.py").is_file():
                names.append((f"{top}.{child.name}", child))
            elif child.suffix == ".py":
                names.append((f"{top}.{child.stem}", child))
    return names


def discover(root: Path = TOOL_ROOT) -> Registry:
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    registry = Registry()
    seen: dict[str, str] = {}
    for module_name, location in _module_names(root):
        module = importlib.import_module(module_name)
        for key, loader in (getattr(module, "GRAMMARS", None) or {}).items():
            if key in registry.grammars and registry.grammars[key] is not loader:
                raise PluginError(f"grammar {key!r} registered twice ({module_name})")
            registry.grammars[key] = loader
        fixtures = location / "fixtures" if location.is_dir() else location.parent / "fixtures"
        for plugin in getattr(module, "PLUGINS", None) or []:
            if plugin.id in seen:
                raise PluginError(f"duplicate plugin id {plugin.id!r} in {module_name} and {seen[plugin.id]}")
            seen[plugin.id] = module_name
            getattr(registry, kind_of(plugin)).append(plugin)
            registry.fixtures[plugin.id] = _plugin_fixtures(fixtures, plugin.id)
    for plugin in registry.structure:
        if plugin.grammar and plugin.grammar not in registry.grammars:
            raise PluginError(f"plugin {plugin.id!r} names grammar {plugin.grammar!r} that no package registers")
    return registry


def _plugin_fixtures(fixtures: Path, plugin_id: str) -> Path:
    """A module that shares a fixtures dir with siblings keeps its inputs under `fixtures/<plugin id>/`."""
    nested = fixtures / plugin_id
    return nested if nested.is_dir() else fixtures


def origin_tag(plugin: Any) -> str:
    return f"{plugin.id}@{plugin.version}"
