"""Writes one self-contained index.html: template + inline CSS/JS + vendored libraries + embedded data."""

from __future__ import annotations

import json
import re
import os
from pathlib import Path
from typing import Any

HERE = Path(__file__).parent
VENDOR = ("d3.min.js", "dagre.min.js")
DATASETS = ("treemap", "callgraph", "erd", "diagnostics", "meta")


def _strip_source_maps(text: str) -> str:
    return re.sub(r"^//# sourceMappingURL=.*$", "", text, flags=re.M)


def _script_safe(text: str) -> str:
    """Nothing inside an inline <script> may close it."""
    return text.replace("</", "<\\/").replace("<!--", "<\\!--")


def _json(data: Any) -> str:
    return _script_safe(json.dumps(data, separators=(",", ":"), default=str))


def render_page(target: Path, views: dict[str, Any]) -> Path:
    template = (HERE / "template.html").read_text(encoding="utf-8")
    vendor = "\n".join(
        f"<script>/* {name} */\n{_script_safe(_strip_source_maps((HERE / 'vendor' / name).read_text(encoding='utf-8')))}\n</script>"
        for name in VENDOR if (HERE / "vendor" / name).is_file()
    )
    data = "\n".join(
        f'<script type="application/json" id="data-{name}">{_json(views.get(name))}</script>' for name in DATASETS
    )
    app = f"<script>\n{_script_safe((HERE / 'app.js').read_text(encoding='utf-8'))}\n</script>"
    meta = views.get("meta") or {}
    html = (template
            .replace("{{TITLE}}", _escape(f"{meta.get('repo_name', 'project')} map"))
            .replace("{{DATA}}", data)
            .replace("{{VENDOR}}", vendor)
            .replace("{{APP}}", app))
    tmp = target.with_suffix(".tmp")
    tmp.write_text(html, encoding="utf-8")
    os.replace(tmp, target)
    return target


def _escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
