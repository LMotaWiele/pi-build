from __future__ import annotations

import shutil
import sqlite3
import subprocess
from pathlib import Path

import pytest

TOOL = Path(__file__).resolve().parent.parent
REPO = TOOL.parent.parent


def snapshot_source() -> Path:
    """§2: tools/map/fixtures/telemetry.snapshot.db, else the one `.db` git tracks under tools/map/fixtures."""
    preferred = TOOL / "fixtures" / "telemetry.snapshot.db"
    if preferred.is_file():
        return preferred
    tracked = subprocess.run(["git", "-C", str(REPO), "ls-files", "*.db"], capture_output=True, text=True).stdout.split()
    for rel in tracked:
        if rel.startswith("tools/map/fixtures/") and "/" not in rel[len("tools/map/fixtures/"):]:
            return REPO / rel
    return TOOL / "fixtures" / "telemetry.db"


@pytest.fixture
def snapshot(tmp_path: Path) -> Path:
    """A private copy; the committed snapshot stays read-only."""
    target = tmp_path / "telemetry.db"
    shutil.copyfile(snapshot_source(), target)
    return target


def git(repo: Path, *args: str) -> None:
    subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True,
                   env={"GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t",
                        "GIT_COMMITTER_EMAIL": "t@t", "PATH": "/usr/bin:/bin:/usr/local/bin", "HOME": str(repo)})


def make_db(path: Path, sql: str) -> Path:
    con = sqlite3.connect(path)
    con.executescript(sql)
    con.commit()
    con.close()
    return path
