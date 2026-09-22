import socket
from pathlib import Path

import docker

from app.adapters.ssdv2_cli import Ssdv2CtlError
from app.core.config import Settings


def self_container(client: docker.DockerClient) -> docker.models.containers.Container | None:
    """Conteneur qui exécute la WebUI (via l'ID court utilisé comme hostname)."""
    try:
        return client.containers.get(socket.gethostname())
    except docker.errors.DockerException:
        return None


def is_self_update(client: docker.DockerClient, target: str) -> bool:
    container = self_container(client)
    return container is not None and container.name == target


def _helper_environment(
    container: docker.models.containers.Container, settings: Settings
) -> list[str]:
    environment: dict[str, str] = {}
    home = ""
    for entry in container.attrs["Config"].get("Env") or []:
        key, separator, value = entry.partition("=")
        if not separator or key in {"SSDV2_NON_INTERACTIVE", "SETTINGS_SOURCE", "SETTINGS_STORAGE"}:
            continue
        environment[key] = value
        if key == "HOME":
            home = value
    environment["SSDV2_NON_INTERACTIVE"] = "1"
    environment["SETTINGS_SOURCE"] = str(settings.ssdv2_source)
    environment["SETTINGS_STORAGE"] = str(settings.ssdv2_storage)
    if not environment.get("USER") and home:
        environment["USER"] = Path(home).name
    return [f"{key}={value}" for key, value in environment.items()]


def launch_updater(
    client: docker.DockerClient,
    settings: Settings,
    target: str,
    command: list[str],
) -> str:
    """Démarre un conteneur d'assistance détaché qui survit au remplacement de la WebUI."""
    container = self_container(client)
    if container is None:
        raise Ssdv2CtlError(
            "self_update_unavailable", "conteneur de la WebUI introuvable pour la mise à jour"
        )
    binds = container.attrs["HostConfig"].get("Binds") or []
    environment = _helper_environment(container, settings)
    network = container.attrs["HostConfig"].get("NetworkMode") or "bridge"
    image = container.attrs["Config"].get("Image") or str(target)
    name = f"{target}-updater"
    try:
        client.containers.get(name).remove(force=True)
    except docker.errors.DockerException:
        pass
    try:
        client.containers.run(
            image,
            command=command,
            name=name,
            detach=True,
            remove=True,
            volumes=binds,
            environment=environment,
            network_mode=network,
        )
    except docker.errors.DockerException as exc:
        raise Ssdv2CtlError("self_update_failed", f"conteneur d'assistance refusé: {exc}") from exc
    return name
