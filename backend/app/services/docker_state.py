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
