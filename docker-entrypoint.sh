#!/bin/sh
set -e

if [ "$(id -u)" = "0" ] && [ -n "${PUID:-}" ] && [ -n "${PGID:-}" ]; then
  groupadd -o -g "$PGID" ssdv2 2>/dev/null || true
  useradd -o -u "$PUID" -g "$PGID" -M -d "${HOME:-/home/ssdv2}" -s /bin/sh ssdv2 2>/dev/null || true
  if [ -n "${DOCKER_GID:-}" ]; then
    groupadd -o -g "$DOCKER_GID" docker 2>/dev/null || true
    usermod -aG docker ssdv2 2>/dev/null || true
  fi
  printf 'ssdv2 ALL=(ALL:ALL) NOPASSWD: ALL\n' > /etc/sudoers.d/ssdv2
  chmod 0440 /etc/sudoers.d/ssdv2
  mkdir -p /data
  chown "$PUID:$PGID" /data
  exec setpriv --reuid "$PUID" --regid "$PGID" --init-groups "$@"
fi

exec "$@"
