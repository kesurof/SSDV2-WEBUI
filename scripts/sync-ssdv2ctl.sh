#!/usr/bin/env bash
# Synchronise la copie vendored de ssdv2ctl depuis le clone SSDV2 local.
# Usage : scripts/sync-ssdv2ctl.sh  (SSDV2_REPO=/chemin/vers/ssdv2 pour surcharger)
set -euo pipefail

repo="${SSDV2_REPO:-$HOME/Developer/ssdv2}"
src="$repo/ssdv2ctl"
dest="$(cd "$(dirname "$0")/.." && pwd)/vendor/ssdv2ctl/ssdv2ctl"

if [ ! -f "$src" ]; then
  echo "ssdv2ctl introuvable : $src (définir SSDV2_REPO)" >&2
  exit 1
fi

cp "$src" "$dest"
chmod 0755 "$dest"
echo "ssdv2ctl synchronisé depuis $src"
if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$dest"
else
  sha256sum "$dest"
fi
