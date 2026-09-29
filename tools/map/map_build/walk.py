"""File discovery, exclusions, and hashing."""

from __future__ import annotations

import functools
import hashlib
import os
import re
from dataclasses import dataclass
from pathlib import Path

BUILTIN_DIRS = frozenset({".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build"})
MAX_BYTES = 1_000_000


@dataclass(frozen=True)
class WalkedFile:
    path: str  # repo-relative, forward slashes
    sha256: str
    size: int


@functools.lru_cache(maxsize=512)
def glob_regex(pattern: str) -> re.Pattern[str]:
    """`**` crosses directories, `*` and `?` do not. A pattern without `/` matches at any depth."""
    pattern = pattern.strip()
    if pattern.endswith("/"):
        pattern += "**"
    anchored = "/" in pattern.rstrip("/")
    out = []
    i = 0
    while i < len(pattern):
        c = pattern[i]
        if pattern.startswith("**/", i):
            out.append("(?:.*/)?")
            i += 3
        elif pattern.startswith("**", i):
            out.append(".*")
            i += 2
        elif c == "*":
            out.append("[^/]*")
            i += 1
        elif c == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(c))
            i += 1
    body = "".join(out)
    prefix = "" if anchored else "(?:.*/)?"
    return re.compile(f"^{prefix}{body}$")


def glob_match(pattern: str, path: str) -> bool:
    return bool(glob_regex(pattern).match(path))


def any_match(patterns: tuple[str, ...] | list[str], path: str) -> bool:
    return any(glob_match(p, path) for p in patterns)


def _is_binary(head: bytes) -> bool:
    return b"\0" in head


def walk(repo: Path, exclude: tuple[str, ...] = (), out_dir: Path | None = None) -> list[WalkedFile]:
    """Every text file under the repo, sorted, minus built-in and project excludes."""
    repo = repo.resolve()
    out_rel = None
    if out_dir is not None:
        try:
            out_rel = out_dir.resolve().relative_to(repo).as_posix()
        except ValueError:
            out_rel = None
    found: list[WalkedFile] = []
    for root, dirs, files in os.walk(repo):
        rel_root = Path(root).relative_to(repo).as_posix()
        rel_root = "" if rel_root == "." else rel_root
        kept = []
        for name in sorted(dirs):
            rel = f"{rel_root}/{name}" if rel_root else name
            if name in BUILTIN_DIRS or (out_rel and rel == out_rel):
                continue
            if exclude and any_match(exclude, rel + "/"):
                continue
            kept.append(name)
        dirs[:] = kept
        for name in sorted(files):
            rel = f"{rel_root}/{name}" if rel_root else name
            if exclude and any_match(exclude, rel):
                continue
            full = Path(root) / name
            try:
                if full.is_symlink() or not full.is_file():
                    continue
                size = full.stat().st_size
                if size > MAX_BYTES:
                    continue
                data = full.read_bytes()
            except OSError:
                continue
            if _is_binary(data[:8192]):
                continue
            found.append(WalkedFile(rel, hashlib.sha256(data).hexdigest(), size))
    found.sort(key=lambda f: f.path)
    return found
