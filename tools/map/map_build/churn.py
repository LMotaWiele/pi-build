"""Git history per current path within the window. Renames fold old paths into new ones."""

from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from .ir import Diagnostic

TAG = "churn@1"
_BRACE = re.compile(r"^(.*)\{(.*) => (.*)\}(.*)$")


@dataclass
class Churn:
    available: bool
    commits: dict[str, int] = field(default_factory=dict)
    lines_changed: dict[str, int] = field(default_factory=dict)
    diagnostics: list[Diagnostic] = field(default_factory=list)

    def for_path(self, path: str) -> dict:
        if not self.available:
            return {"commits": None, "lines_changed": None}
        return {"commits": self.commits.get(path, 0), "lines_changed": self.lines_changed.get(path, 0)}


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args], capture_output=True, text=True, check=True, encoding="utf-8", errors="replace"
    ).stdout


def _expand_rename(spec: str) -> tuple[str, str]:
    """`dir/{a => b}/f.py` or `old => new` → (old, new)."""
    match = _BRACE.match(spec)
    if match:
        pre, old, new, post = match.groups()
        join = lambda mid: re.sub(r"//+", "/", f"{pre}{mid}{post}")  # noqa: E731
        return join(old), join(new)
    old, _, new = spec.partition(" => ")
    return old, new


class _Renames:
    def __init__(self) -> None:
        self.to_new: dict[str, str] = {}

    def current(self, path: str) -> str:
        seen = set()
        while path in self.to_new and path not in seen:
            seen.add(path)
            path = self.to_new[path]
        return path

    def add(self, old: str, new: str) -> None:
        if old != new:
            self.to_new[old] = self.current(new)


def churn(repo: Path, window_days: int) -> Churn:
    """Paths come back relative to `repo`, also when `repo` is a subdirectory of the work tree."""
    try:
        top = _git(repo, "rev-parse", "--show-toplevel").strip()
    except (OSError, subprocess.CalledProcessError):
        return Churn(False, diagnostics=[Diagnostic(TAG, None, "warning", "not a git repository; git fields are null")])
    try:
        prefix = Path(repo).resolve().relative_to(Path(top).resolve()).as_posix()
    except ValueError:
        prefix = ""
    prefix = "" if prefix == "." else prefix
    since = f"--since={window_days} days ago"
    result = Churn(True)
    renames = _Renames()
    try:
        # Newest first: a rename seen now maps every older mention of the old path forward.
        log = _git(repo, "log", "-M", "--name-status", "--format=%x00%H%x09%ct", since, "--", ".")
        for block in log.split("\0")[1:]:
            lines = block.strip("\n").split("\n")
            touched: set[str] = set()
            for line in lines[1:]:
                parts = line.split("\t")
                if len(parts) < 2 or not parts[0]:
                    continue
                status = parts[0]
                if status.startswith(("R", "C")) and len(parts) >= 3:
                    if status.startswith("R"):
                        renames.add(parts[1], parts[2])
                    touched.add(renames.current(parts[2]))
                else:
                    touched.add(renames.current(parts[1]))
            for path in touched:
                result.commits[path] = result.commits.get(path, 0) + 1
        numstat = _git(repo, "log", "-M", "--numstat", "--format=%x00%H", since, "--", ".")
        for block in numstat.split("\0")[1:]:
            for line in block.strip("\n").split("\n")[1:]:
                parts = line.split("\t")
                if len(parts) != 3:
                    continue
                added, deleted, spec = parts
                if added == "-" or deleted == "-":
                    continue
                path = _expand_rename(spec)[1] if " => " in spec else spec
                path = renames.current(path)
                result.lines_changed[path] = result.lines_changed.get(path, 0) + int(added) + int(deleted)
    except (OSError, subprocess.CalledProcessError) as err:
        return Churn(False, diagnostics=[Diagnostic(TAG, None, "warning", f"git log failed: {err}")])
    if prefix:
        cut = prefix + "/"
        result.commits = {p[len(cut):]: n for p, n in result.commits.items() if p.startswith(cut)}
        result.lines_changed = {p[len(cut):]: n for p, n in result.lines_changed.items() if p.startswith(cut)}
    return result
