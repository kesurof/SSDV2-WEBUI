from collections.abc import Iterator
from dataclasses import dataclass

import docker


@dataclass(frozen=True)
class ContainerInfo:
    name: str
    image: str
    state: str
    health: str | None
    app_label: str | None


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
                )
            )
        return DockerSnapshot(containers, None)
    except docker.errors.DockerException as exc:
        return DockerSnapshot([], f"Docker indisponible: {exc}")
