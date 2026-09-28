import threading
import time
from collections.abc import Iterator
from dataclasses import dataclass

import docker

CACHE_TTL_SECONDS = 3.0

_cache_snapshot: "DockerSnapshot | None" = None
_cache_at: float = 0.0
_cache_lock = threading.Lock()


def clear_docker_cache() -> None:
    global _cache_snapshot, _cache_at
    with _cache_lock:
        _cache_snapshot = None
        _cache_at = 0.0


@dataclass(frozen=True)
class ContainerInfo:
    name: str
    image: str
    state: str
    health: str | None
    app_label: str | None
    started_at: str | None = None
    created_at: str | None = None
    image_id: str | None = None


@dataclass(frozen=True)
class DockerSnapshot:
    containers: list[ContainerInfo]
    error: str | None


def read_container_logs(
    client: docker.DockerClient,
    name: str,
    lines: int = 200,
    timestamps: bool = True,
) -> list[str]:
    container = client.containers.get(name)
    raw = container.logs(tail=lines, timestamps=timestamps)
    if isinstance(raw, bytes):
        text = raw.decode("utf-8", errors="replace")
    else:
        text = str(raw)
    return [line for line in text.splitlines() if line.strip()]


def stream_container_logs(
    client: docker.DockerClient,
    name: str,
    lines: int = 100,
    timestamps: bool = True,
) -> Iterator[str]:
    container = client.containers.get(name)
    stream = container.logs(stream=True, follow=True, tail=lines, timestamps=timestamps)
    try:
        for chunk in stream:
            text = (
                chunk.decode("utf-8", errors="replace") if isinstance(chunk, bytes) else str(chunk)
            )
            for line in text.splitlines():
                if line.strip():
                    yield line
    finally:
        close = getattr(stream, "close", None)
        if callable(close):
            close()


def collect_containers(client: docker.DockerClient | None) -> DockerSnapshot:
    global _cache_snapshot, _cache_at

    with _cache_lock:
        if _cache_snapshot is not None and time.monotonic() - _cache_at < CACHE_TTL_SECONDS:
            return _cache_snapshot

    snapshot = _collect_containers_uncached(client)
    with _cache_lock:
        # Un autre thread a pu rafraîchir pendant le calcul : garder sa valeur
        # (fraîche) pour éviter d'écraser un résultat plus récent.
        if _cache_snapshot is not None and time.monotonic() - _cache_at < CACHE_TTL_SECONDS:
            return _cache_snapshot
        _cache_snapshot = snapshot
        _cache_at = time.monotonic()
    return snapshot


def _collect_containers_uncached(client: docker.DockerClient | None) -> DockerSnapshot:
    if client is None:
        return DockerSnapshot([], "Docker indisponible")
    try:
        containers: list[ContainerInfo] = []
        for container in client.containers.list(all=True):
            state = container.attrs.get("State", {})
            health = state.get("Health", {}).get("Status")
            image = container.attrs.get("Config", {}).get("Image") or ""
            containers.append(
                ContainerInfo(
                    name=container.name,
                    image=image,
                    state=container.status,
                    health=health,
                    app_label=container.labels.get("ssdv2.app"),
                    started_at=state.get("StartedAt"),
                    created_at=container.attrs.get("Created"),
                    image_id=container.attrs.get("Image"),
                )
            )
        return DockerSnapshot(containers, None)
    except docker.errors.DockerException as exc:
        return DockerSnapshot([], f"Docker indisponible: {exc}")
