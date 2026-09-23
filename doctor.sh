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

(cd "$REPO" && node --experimental-strip-types --test tests/*.test.ts) || fail "unit tests"
ok "unit tests"

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
