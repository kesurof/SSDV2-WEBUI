#!/bin/sh
set -e

if [ "$(id -u)" = "0" ] && [ -n "${PUID:-}" ] && [ -n "${PGID:-}" ]; then
  groupadd -o -g "$PGID" ssdv2 2>/dev/null || true
  useradd -o -u "$PUID" -g "$PGID" -M -d "${HOME:-/home/ssdv2}" -s /bin/sh ssdv2 2>/dev/null || true
  printf 'ssdv2 ALL=(ALL:ALL) NOPASSWD: ALL\n' > /etc/sudoers.d/ssdv2
  chmod 0440 /etc/sudoers.d/ssdv2
  mkdir -p /data
  chown "$PUID:$PGID" /data
  exec gosu "$PUID:$PGID" "$@"
fi

exec "$@"
