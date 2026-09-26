#!/usr/bin/env bash
# Section 12.6a. Pin, run, restore, grade, append one matrix row.
set -euo pipefail
if [[ $# -ne 2 ]]; then
  echo "usage: scripts/run-arm.sh <luna|sol|terra|terra-low> <task-list>" >&2
  exit 2
fi
cd "$(dirname "$0")/.."
exec node scripts/run-arm.mjs "$1" "$2"
