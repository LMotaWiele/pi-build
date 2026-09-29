"""Acceptance for this repository's map exclusions."""
from pathlib import Path
import tomllib
from map_build.walk import any_match


def test_reference_trees_and_test_fixtures_are_excluded_but_live_sources_are_not():
    repo = Path(__file__).resolve().parents[3]
    excludes = tomllib.loads((repo / ".map/project.toml").read_text())["exclude"]
    assert any_match(excludes, "docs/specs/SPEC-0006-translate-specs-with-sol.reference/lib/quota.ts")
    assert any_match(excludes, "tests/fixtures/ab/src/parse.ts")
    assert not any_match(excludes, "lib/quota.ts")
    assert not any_match(excludes, "docs/specs/SPEC-0014-complete-the-codebase-map.tests/test_map_views.py")
