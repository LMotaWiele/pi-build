#!/usr/bin/env bash
# Restore this fixture from git. Does not touch the rest of the tree.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
git checkout HEAD -- tests/fixtures/ab
git clean -fd -- tests/fixtures/ab
