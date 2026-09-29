#!/usr/bin/env bash
# Fail closed when a live check was requested and a credential is missing.
# --offline runs every check that does not need a provider.
set -euo pipefail
REPO="$(cd "$(dirname "$0")" && pwd)"

OFFLINE=0
PROJECT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --emit-skill)
      node --experimental-strip-types "$REPO/lib/skill.ts" "$REPO/.agent/notes/README.md"
      exit 0
      ;;
    --offline)
      OFFLINE=1
      shift
      ;;
    --project)
      PROJECT="${2:-}"
      if [ -z "$PROJECT" ]; then
        echo "usage: doctor.sh --project <path>" >&2
        exit 2
      fi
      shift 2
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [ -n "$PROJECT" ]; then
  node --experimental-strip-types "$REPO/lib/scaffold.ts" --validate "$PROJECT"
  exit $?
fi

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "ok: $*"; }

shopt -s nullglob
json_files=("$REPO"/settings/hosts/*.json "$REPO/settings/web-search.json" "$REPO/agent/models.json")
for f in "${json_files[@]}"; do
  jq empty "$f" || fail "invalid JSON: ${f#"$REPO"/}"
done
ok "json"

for host in "$REPO"/settings/hosts/*.json; do
  default_provider="$(jq -r '.defaultProvider // empty' "$host")"
  default_model="$(jq -r '.defaultModel // empty' "$host")"
  if [[ "$default_model" == */* ]]; then
    fail "$(basename "$host"): defaultModel must be a bare id"
  fi
  if [ -n "$default_model" ] && [ -n "$default_provider" ] && jq -e '.enabledModels? | type == "array" and length > 0' "$host" >/dev/null; then
    jq -e --arg model "$default_provider/$default_model" '.enabledModels | index($model) != null' "$host" >/dev/null \
      || fail "$(basename "$host"): enabledModels omits $default_provider/$default_model"
  fi
done
ok "host default models"

node --experimental-strip-types "$REPO/lib/settings-keys.ts" || fail "unread settings key"
ok "settings keys"

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ""|\#*) continue ;;
  esac
  name="${line%% *}"
  rest="${line#"$name"}"
  rest="${rest#" "}"
  case "$name" in
    node)
      node -e 'const need=process.argv[1].replace(">=","").split(".").map(Number); const got=process.versions.node.split(".").map(Number); const pad=(a,b)=>a.length<b.length?pad(a.concat(0),b):a; const A=pad(got,need), B=pad(need,got); for (let i=0;i<A.length;i++){ if(A[i]>B[i]) process.exit(0); if(A[i]<B[i]) process.exit(1);} ' "${rest:-0}" \
        || fail "node $(node -v) is older than ${rest}"
      ok "node $(node -v)"
      ;;
    jq) command -v jq >/dev/null || fail "jq missing"; ok "jq $(jq --version)" ;;
    git) command -v git >/dev/null || fail "git missing"; ok "git $(git --version)" ;;
    uv)
      # Optional: the map (extensions/map.ts, tools/map) stays off without it.
      if command -v uv >/dev/null; then ok "uv $(uv --version)"; else echo "skipped: uv not installed"; fi
      ;;
    pi)
      command -v pi >/dev/null || fail "pi missing"
      got="$(pi --version | head -n1 | tr -d '[:space:]')"
      [ "$got" = "$rest" ] || fail "pi version $got, deps.txt wants $rest"
      ok "pi $got"
      ;;
    *) fail "unknown dep $name" ;;
  esac
done < "$REPO/deps.txt"

mapfile -t sources < <(jq -r '.packages[]? | if type == "string" then . else .source end' "$REPO/settings/hosts/machina.json")
list="$(pi list 2>&1 || true)"
if [ "${#sources[@]}" -eq 0 ]; then
  printf '%s\n' "$list" | grep -q "No packages installed" || fail "packages array is empty but pi list is not"
  ok "pi list matches empty packages"
else
  for source in "${sources[@]}"; do
    printf '%s\n' "$list" | grep -F -q "$source" || fail "pi list missing $source"
  done
  ok "pi list matches packages (${#sources[@]})"
fi

node --experimental-strip-types "$REPO/lib/scaffold.ts" --validate "$REPO" || fail "memory structure"
ok "memory structure"

node "$REPO/scripts/check-spec-index.mjs" "$REPO/docs/specs" || fail "spec index"

shopt -s nullglob
patch_files=("$REPO"/patches/*.patch)
declare -A patch_seen=()
for patch in "${patch_files[@]}"; do
  base="$(basename "$patch" .patch)"
  if [ -n "${patch_seen[$base]:-}" ]; then
    fail "second patch for $base"
  fi
  patch_seen[$base]=1
  grep -q 'Seam:' "$patch" || fail "patch $base does not name a seam"
done
ok "patches (${#patch_files[@]})"

node --experimental-strip-types "$REPO/lib/hook-budget.ts" || fail "hook trace exceeds the invalidation maximum"

(cd "$REPO" && env -u PI_BUILD_PIPELINE -u PI_BUILD_SUBAGENT_ROLE -u PI_BUILD_TELEMETRY_DB node --experimental-strip-types --test tests/*.test.ts) || fail "unit tests"
ok "unit tests"

if command -v uv >/dev/null; then
  env -u PI_BUILD_PIPELINE -u PI_BUILD_SUBAGENT_ROLE -u PI_BUILD_TELEMETRY_DB uv run --project "$REPO/tools/map" pytest -q "$REPO/tools/map" || fail "map tests"
  ok "map tests"
else
  echo "skipped: uv not installed"
fi

python3 - << 'PY'
import subprocess, time
started = time.perf_counter()
subprocess.run(["pi", "--version"], stdout=subprocess.DEVNULL, check=True)
print(f"startup timing: pi --version {int((time.perf_counter() - started) * 1000)} ms (not a tier smoke)")
PY

missing=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ""|\#*) continue ;;
  esac
  var="${line%%=*}"
  if [ -z "${!var:-}" ]; then
    if [ "$OFFLINE" -eq 1 ]; then
      echo "skipped: no credentials — $var is unset"
    else
      echo "FAIL: $var is unset" >&2
      missing=1
    fi
  else
    ok "$var is set"
  fi
done < "$REPO/secrets.example.env"

if [ "$OFFLINE" -eq 1 ]; then
  echo "skipped: no credentials — tier smoke"
  echo "skipped: no credentials — note_open, queue_append, guarded read"
  exit 0
fi

if [ "$missing" -ne 0 ]; then
  echo "FAIL: provider smoke, note_open, queue_append, and guarded read were not run because a secret is unset" >&2
  exit 1
fi

catalog="$(pi --list-models)"
while IFS= read -r model; do
  [ -z "$model" ] && continue
  provider="${model%%/*}"
  id="${model#*/}"
  printf '%s\n' "$catalog" | awk -v provider="$provider" -v id="$id" '$1 == provider && $2 == id { found = 1 } END { exit !found }' \
    || fail "machina.json: model $model is absent from pi --list-models"
done < <(jq -r '[.enabledModels[]?, .routing.tiers[]?, ((.defaultProvider // "") + "/" + (.defaultModel // ""))] | unique[] | select(test("^[^/]+/.+$"))' "$REPO/settings/hosts/machina.json")
ok "host models are in pi catalog"

time_pi() {
  local model="$1"
  python3 - "$model" << 'PY' || fail "tier smoke $model"
import subprocess, sys, time
model = sys.argv[1]
started = time.perf_counter()
result = subprocess.run(["pi", "-p", "reply with OK", "--model", model, "--thinking", "off", "--no-session"])
if result.returncode != 0:
    sys.exit(result.returncode)
print(f"time-to-first-prompt {model}: {int((time.perf_counter() - started) * 1000)} ms (pi does not split this per extension)")
PY
}

mapfile -t models < <(jq -r '.routing.tiers[]' "$REPO/settings/hosts/machina.json" | sort -u)
for model in "${models[@]}"; do
  time_pi "$model"
done

pi -p "Call note_open for topic How to write notes, then queue_append item doctor-smoke source human, then read README.md once. Reply OK." \
  --model "$(jq -r '.routing.tiers.scout' "$REPO/settings/hosts/machina.json")" --thinking off --no-session \
  || fail "custom tool smoke"
ok "note_open, queue_append, guarded read"
