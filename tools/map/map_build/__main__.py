"""CLI: uv run --project tools/map python -m map_build --repo <root> [...]"""

from __future__ import annotations

import argparse
import json
import sys
import traceback
from pathlib import Path

from . import ir


class _Parser(argparse.ArgumentParser):
    def error(self, message: str) -> None:  # exit 2 on bad arguments
        self.print_usage(sys.stderr)
        print(f"map_build: error: {message}", file=sys.stderr)
        sys.exit(2)


def parser() -> argparse.ArgumentParser:
    p = _Parser(prog="map_build", description="Build the codebase map for one project.")
    p.add_argument("--repo", type=Path, help="project root")
    p.add_argument("--out", type=Path, help="output directory (default <repo>/.agent/map)")
    p.add_argument("--telemetry", type=Path, action="append", default=[], help="SQLite trace source; repeatable")
    p.add_argument("--trace", type=Path, action="append", default=[], help="OTel JSON or VizTracer JSON; repeatable")
    p.add_argument("--turn", help="highlight this turn (default: latest turn for this repo)")
    p.add_argument("--window-days", type=float, default=7)
    p.add_argument("--no-cache", action="store_true")
    p.add_argument("--check", action="store_true", help="build to a temp dir; exit non-zero on any core error")
    p.add_argument("--repo-alias", action="append", default=[],
                   help="another absolute path that telemetry used for this repo (a different checkout); repeatable")
    p.add_argument("--print-schema", action="store_true", help="print the IR JSON Schema and exit")
    return p


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if args.print_schema:
        print(json.dumps(ir.json_schema(), indent=2))
        return 0
    if args.repo is None:
        parser().error("--repo is required")
    if not args.repo.is_dir():
        parser().error(f"--repo {args.repo} is not a directory")
    if args.window_days <= 0:
        parser().error("--window-days must be positive")
    from .build import BuildOptions, build, env_aliases

    options = BuildOptions(
        repo=args.repo,
        out=args.out,
        telemetry=args.telemetry,
        traces=args.trace,
        turn=args.turn,
        window_days=args.window_days,
        no_cache=args.no_cache,
        check=args.check,
        aliases=tuple(args.repo_alias) + env_aliases(),
    )
    try:
        result = build(options)
    except Exception:
        traceback.print_exc()
        print("map_build: core failure", file=sys.stderr)
        return 1
    meta = result.meta
    counts = meta["diagnostics"]
    where = "check passed" if args.check else str(result.out / "index.html")
    print(f"map_build: {where} ({meta['files']['measured']} files, {meta['events']} events, "
          f"{counts['warning']} warnings, {counts['error']} errors, {meta['timings_ms']['total']} ms)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
