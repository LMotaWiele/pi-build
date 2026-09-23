#!/usr/bin/env bash
set -euo pipefail
REPO="$(cd "$(dirname "$0")" && pwd)"
HOST="${PI_HOST:-$(hostname)}"
PI_PACKAGE="${PI_PACKAGE:-@earendil-works/pi-coding-agent}"
PI_VERSION="${PI_VERSION:-0.87.0}"

node_ok() {
  node -e 'const [M,m,p]=(process.versions.node.split(".").map(Number)); if (M>22 || (M===22 && (m>19 || (m===19 && p>=0)))) process.exit(0); process.exit(1);'
}

if command -v mise >/dev/null; then
  mise install
elif node_ok; then
  echo "→ mise is not installed; continuing with $(node -v)"
else
  echo "install mise, or install Node >= 22.19.0" >&2
  exit 1
fi

npm i -g "${PI_PACKAGE}@${PI_VERSION}"

SETTINGS="$REPO/settings/hosts/${HOST}.json"
if [ ! -f "$SETTINGS" ] && [ -f "$REPO/settings/hosts/machina.json" ]; then
  echo "→ no settings/hosts/${HOST}.json; using machina.json"
  echo "→ machina.json is the author's models. Copy settings/hosts/example.json to settings/hosts/${HOST}.json and put your provider ids there before relying on this host."
  SETTINGS="$REPO/settings/hosts/machina.json"
fi
[ -f "$SETTINGS" ] || { echo "missing $SETTINGS" >&2; exit 1; }

mkdir -p ~/.pi/agent

# Replace a symlink. Refuse a real directory so install does not nest a link inside it.
link_into_agent() {
  local src="$1" dest="$2"
  if [ -e "$dest" ] && [ ! -L "$dest" ]; then
    echo "refusing to replace $dest (it exists and is not a symlink)" >&2
    echo "move it aside and re-run ./install.sh" >&2
    exit 1
  fi
  ln -sfn "$src" "$dest"
}

link_into_agent "$SETTINGS" ~/.pi/agent/settings.json
link_into_agent "$REPO/agent/AGENTS.md" ~/.pi/agent/AGENTS.md
link_into_agent "$REPO/agent/models.json" ~/.pi/agent/models.json
link_into_agent "$REPO/settings/web-search.json" ~/.pi/agent/web-search.json
# Pi discovers extensions and skills. Extension imports of ../lib are resolved
# from the symlink path, so lib has to be linked beside extensions.
link_into_agent "$REPO/extensions" ~/.pi/agent/extensions
link_into_agent "$REPO/skills" ~/.pi/agent/skills
link_into_agent "$REPO/lib" ~/.pi/agent/lib
link_into_agent "$REPO/docs/design/SPEC-delegation-ab.md" ~/.pi/agent/SPEC-delegation-ab.md

if [ ! -f ~/.config/pi/env ]; then
  mkdir -p ~/.config/pi
  install -m 600 /dev/null ~/.config/pi/env
  cat "$REPO/secrets.example.env" >> ~/.config/pi/env
  echo "→ fill in ~/.config/pi/env"
fi

# pi 0.87.0 rejects a bare `pi install` (Missing install source).
pi install git:github.com/nicobailon/pi-web-access@v0.30.0
pi install git:github.com/mjakl/pi-subagent@ce26a686f2571188d2e2b4d586e15a82606a7b72

echo "→ doctor.sh fails closed until every name in secrets.example.env is exported"
"$REPO/doctor.sh"
