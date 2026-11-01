"""Inventaire Docker SSDv2 pour Security Watch : données explicitement autorisées.

Ce module ne renvoie jamais les variables d'environnement, secrets, chemins
de l'hôte, labels arbitraires, paramètres réseau internes ou montages de volumes.
Les détails Docker restent sur l'hôte jusqu'au téléchargement demandé.
"""
from datetime import UTC, datetime

import docker

MAX_CONTAINERS = 500


class InventoryError(Exception):
    """Docker indisponible ou inventaire trop volumineux."""


def _port_bind_type(ip: str) -> str:
    if ip in ("127.0.0.1", "::1"):
        return "loopback"
    if ip in ("", "0.0.0.0", "::"):
        return "all_interfaces"
    return "specific_interface"


def _safe_container(container) -> dict:
    # reload() effectue un Docker inspect, nécessaire pour les ports et mounts,
    # sans lancer de commande ni écrire dans le conteneur.
    container.reload()
    attrs = container.attrs
    config = attrs.get("Config") or {}
    host = attrs.get("HostConfig") or {}
    labels = config.get("Labels") or {}
    ports = []
    for container_port, bindings in sorted((host.get("PortBindings") or {}).items()):
        for binding in bindings or []:
            if len(ports) >= 100:
                break
            ports.append(
                {
                    "container_port": str(container_port)[:32],
                    "host_port": str(binding.get("HostPort") or "")[:10],
                    "bind_type": _port_bind_type(str(binding.get("HostIp") or "")),
                }
            )
    mounts = attrs.get("Mounts") or []
    name = str(attrs.get("Name") or container.name).lstrip("/")[:128]
    return {
        "name": name,
        "app": str(labels.get("ssdv2.app") or name)[:128],
        "image": str(config.get("Image") or "")[:300],
        "image_id": str(attrs.get("Image") or "")[:100],
        "version": str(labels.get("org.opencontainers.image.version") or "")[:100],
        "version_source": "OCI image label (may not represent app version)",
        "ports": ports,
        "privileged": host.get("Privileged") is True,
        "docker_socket": any(
            isinstance(m, dict) and m.get("Destination") == "/var/run/docker.sock" for m in mounts
        ),
    }


def build_inventory(client: docker.DockerClient | None) -> dict:
    if client is None:
        raise InventoryError("Docker indisponible")
    try:
        containers = client.containers.list(all=True)
        if len(containers) > MAX_CONTAINERS:
            raise InventoryError("Inventaire trop volumineux pour un export sécurisé")
        entries = [_safe_container(container) for container in containers]
    except docker.errors.DockerException as exc:
        raise InventoryError("Lecture Docker impossible") from exc

    return {
        "schema_version": 1,
        "generated_at": datetime.now(UTC).isoformat(),
        "scope": "local_read_only",
        "containers": entries,
    }
