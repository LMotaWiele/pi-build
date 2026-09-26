"""Project configuration and the per-file context handed to extractors."""

from __future__ import annotations

import os
import re
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

_UNSET_VAR = re.compile(r"\$\{?[A-Za-z_][A-Za-z0-9_]*\}?")


@dataclass(frozen=True)
class SqliteStore:
    id: str
    paths: tuple[str, ...]
    identifiers: tuple[str, ...] = ()

    def resolve(self, repo: Path) -> Path | None:
        """First candidate that expands fully and exists. Relative paths are repo-relative."""
        for raw in self.paths:
            expanded = os.path.expanduser(os.path.expandvars(raw))
            if _UNSET_VAR.search(expanded) or not expanded:
                continue
            candidate = Path(expanded)
            if not candidate.is_absolute():
                candidate = repo / candidate
            if candidate.exists():
                return candidate
        return None


@dataclass(frozen=True)
class FileStore:
    id: str
    globs: tuple[str, ...]
    identifiers: tuple[str, ...] = ()


@dataclass(frozen=True)
class Rule:
    file: str
    language: str


@dataclass(frozen=True)
class ProjectConfig:
    repo: Path
    exclude: tuple[str, ...] = ()
    sqlite: tuple[SqliteStore, ...] = ()
    files: tuple[FileStore, ...] = ()
    rules: tuple[Rule, ...] = ()
    explain_dir: str = ".agent/explain"
    errors: tuple[str, ...] = field(default=())

    @property
    def rules_dir(self) -> Path:
        return self.repo / ".map" / "rules"


def _strings(value: Any) -> tuple[str, ...]:
    if isinstance(value, str):
        return (value,)
    if isinstance(value, list):
        return tuple(str(v) for v in value if isinstance(v, str))
    return ()


def parse_config(repo: Path, data: dict, rules_data: dict | None = None) -> ProjectConfig:
    errors: list[str] = []
    stores = data.get("stores", {}) if isinstance(data.get("stores"), dict) else {}
    sqlite: list[SqliteStore] = []
    for entry in stores.get("sqlite", []) or []:
        if not isinstance(entry, dict) or not isinstance(entry.get("id"), str) or not _strings(entry.get("path")):
            errors.append(f"stores.sqlite entry needs id and path: {entry!r}")
            continue
        sqlite.append(SqliteStore(entry["id"], _strings(entry["path"]), _strings(entry.get("identifiers"))))
    files: list[FileStore] = []
    for entry in stores.get("file", []) or []:
        if not isinstance(entry, dict) or not isinstance(entry.get("id"), str) or not _strings(entry.get("globs")):
            errors.append(f"stores.file entry needs id and globs: {entry!r}")
            continue
        files.append(FileStore(entry["id"], _strings(entry["globs"]), _strings(entry.get("identifiers"))))
    rules: list[Rule] = []
    for entry in (rules_data or {}).get("rule", []) or []:
        if not isinstance(entry, dict) or not isinstance(entry.get("file"), str) or not isinstance(entry.get("language"), str):
            errors.append(f"rule entry needs file and language: {entry!r}")
            continue
        rules.append(Rule(entry["file"], entry["language"]))
    explain_dir = data.get("explain_dir", ".agent/explain")
    return ProjectConfig(
        repo=repo,
        exclude=_strings(data.get("exclude")),
        sqlite=tuple(sqlite),
        files=tuple(files),
        rules=tuple(rules),
        explain_dir=explain_dir if isinstance(explain_dir, str) else ".agent/explain",
        errors=tuple(errors),
    )


def load_toml(path: Path) -> tuple[dict, str | None]:
    if not path.is_file():
        return {}, None
    try:
        return tomllib.loads(path.read_text(encoding="utf-8")), None
    except (tomllib.TOMLDecodeError, UnicodeDecodeError) as err:
        return {}, f"{path.name}: {err}"


def load_project(repo: Path, config_path: Path | None = None) -> ProjectConfig:
    """Read `<repo>/.map/project.toml` and `<repo>/.map/rules.toml`. Both are optional."""
    data, error = load_toml(config_path or repo / ".map" / "project.toml")
    rules, rules_error = load_toml(repo / ".map" / "rules.toml")
    config = parse_config(repo, data, rules)
    extra = tuple(e for e in (error, rules_error) if e)
    if extra:
        config = ProjectConfig(**{**config.__dict__, "errors": config.errors + extra})
    return config


@dataclass(frozen=True)
class FileContext:
    path: str
    text: str
    tree: Any
    project: ProjectConfig
