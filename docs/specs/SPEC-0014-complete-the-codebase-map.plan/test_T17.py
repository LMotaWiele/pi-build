"""Acceptance for walkthrough turn links; marker takes precedence over filename."""
from map_build.build import _explain_links


def test_explain_links_fall_back_to_strict_turn_filename(tmp_path):
    d = tmp_path / ".agent" / "explain"
    d.mkdir(parents=True)
    (d / "2026-09-30-turn-uuid-one.md").write_text("# Walkthrough\n")
    (d / "2026-09-30-turn-uuid-two.md").write_text("<!-- turn: older -->\n# Walkthrough\n")
    (d / "known.md").write_text("# No turn\n")
    (d / "draft-turn-no.md").write_text("# No turn\n")
    links = _explain_links(tmp_path, ".agent/explain")
    assert links["uuid-one"] == [".agent/explain/2026-09-30-turn-uuid-one.md"]
    assert links["older"] == [".agent/explain/2026-09-30-turn-uuid-two.md"]
    assert "uuid-two" not in links
    assert not any("known.md" in p or "draft-turn-no.md" in p for paths in links.values() for p in paths)
