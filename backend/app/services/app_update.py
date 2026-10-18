"""Mise à jour « image seule » d'une application SSDV2.

Recrée les conteneurs d'une application avec leur image mise à jour, en
rejouant **exactement** la configuration Docker existante (env, labels, binds,
réseaux, ports, policies…). Aucun playbook ni tâche de configuration SSDV2
n'est exécuté : c'est l'équivalent transparent de ``docker compose pull && up``
sans réinstallation. Les données (volumes nommés, binds) sont conservées.
"""

from __future__ import annotations

import re
from collections.abc import Callable

import docker
from docker.types import Mount

from app.adapters.ssdv2_cli import Ssdv2CtlError
from app.core.config import Settings
from app.services.app_state import matching_containers
from app.services.docker_state import collect_containers
from app.services.registries import read_registries

EventSink = Callable[[str], None]


def app_container_names(settings: Settings, client: docker.DockerClient, app: str) -> list[str]:
    """Noms des conteneurs rattachés à l'application (registres + label + nom)."""
    registries = read_registries(settings.registries_dir)
    snapshot = collect_containers(client)
    containers = matching_containers(app, registries.get(app), snapshot.containers)
    # Ordre stable : le conteneur principal (nom = app) en premier.
    return sorted((item.name for item in containers), key=lambda name: (name != app, name))


def app_images(settings: Settings, client: docker.DockerClient, app: str) -> list[str]:
    """Références d'images utilisées par les conteneurs de l'application."""
    images: list[str] = []
    for name in app_container_names(settings, client, app):
        container = client.containers.get(name)
        image = (container.attrs.get("Config") or {}).get("Image")
        if image and image not in images:
            images.append(image)
    return images


def _ulimits(raw: list | None) -> list[dict] | None:
    if not raw:
        return None
    limits = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = item.get("Name")
        if not name:
            continue
        limits.append({"Name": name, "Soft": item.get("Soft"), "Hard": item.get("Hard")})
    return limits or None


def _build_mounts(mounts: list | None) -> list[Mount] | None:
    if not mounts:
        return None
    result: list[Mount] = []
    for mount in mounts:
        if mount.get("Type") != "volume" or not mount.get("Source"):
            continue
        result.append(
            Mount(
                target=mount["Destination"],
                source=mount["Source"],
                type="volume",
                read_only=not mount.get("RW", True),
            )
        )
    return result or None


def _create_host_config(client: docker.DockerClient, kwargs: dict):
    """Construit un HostConfig en tolérant les champs non supportés par le SDK."""
    remaining = {key: value for key, value in kwargs.items() if value is not None}
    for _ in range(len(remaining) + 1):
        try:
            return client.api.create_host_config(**remaining)
        except TypeError as exc:
            match = re.search(r"unexpected keyword argument '([^']+)'", str(exc))
            if match is None or match.group(1) not in remaining:
                raise
            remaining.pop(match.group(1))
    raise Ssdv2CtlError("docker_config", "configuration Docker non rejouable")


def _healthcheck(cfg: dict) -> dict | None:
    raw = cfg.get("Healthcheck")
    if not raw or not raw.get("Test"):
        return None
    mapping = {
        "test": raw.get("Test"),
        "interval": raw.get("Interval"),
        "timeout": raw.get("Timeout"),
        "retries": raw.get("Retries"),
        "start_period": raw.get("StartPeriod"),
    }
    return {key: value for key, value in mapping.items() if value is not None}


def recreate_container(
    client: docker.DockerClient,
    container: docker.models.containers.Container,
    env_overrides: dict[str, str] | None = None,
) -> str:
    """Recrée un conteneur à l'identique, avec une image à jour.

    Le conteneur est arrêté puis supprimé (le nom doit être réutilisable), et
    recréé depuis ses attributs. Retourne l'ID du nouveau conteneur.
    """
    attrs = container.attrs
    cfg = attrs.get("Config") or {}
    hc = attrs.get("HostConfig") or {}
    name = container.name
    was_running = container.status == "running"

    environment = list(cfg.get("Env") or [])
    if env_overrides:
        environment = [
            entry for entry in environment if entry.split("=", 1)[0] not in env_overrides
        ]
        environment.extend(f"{key}={value}" for key, value in env_overrides.items())

    host_config = _create_host_config(
        client,
        {
            "binds": hc.get("Binds"),
            "port_bindings": hc.get("PortBindings"),
            "mounts": _build_mounts(attrs.get("Mounts")),
            "devices": hc.get("Devices"),
            "device_cgroup_rules": hc.get("DeviceCgroupRules"),
            "extra_hosts": hc.get("ExtraHosts"),
            "restart_policy": hc.get("RestartPolicy"),
            "log_config": hc.get("LogConfig"),
            "privileged": hc.get("Privileged", False),
            "read_only": hc.get("ReadonlyRootfs", False),
            "shm_size": hc.get("ShmSize"),
            "network_mode": hc.get("NetworkMode"),
            "cap_add": hc.get("CapAdd"),
            "cap_drop": hc.get("CapDrop"),
            "security_opt": hc.get("SecurityOpt"),
            "group_add": hc.get("GroupAdd"),
            "dns": hc.get("Dns"),
            "dns_search": hc.get("DnsSearch"),
            "dns_opt": hc.get("DnsOptions"),
            "tmpfs": hc.get("Tmpfs"),
            "sysctls": hc.get("Sysctls"),
            "ulimits": _ulimits(hc.get("Ulimits")),
            "pid_mode": hc.get("PidMode"),
            "ipc_mode": hc.get("IpcMode"),
            "init": hc.get("Init"),
            "runtime": hc.get("Runtime"),
        },
    )

    container.stop(timeout=30)
    container.remove()

    created = client.api.create_container(
        cfg.get("Image"),
        command=cfg.get("Cmd"),
        entrypoint=cfg.get("Entrypoint"),
        environment=environment,
        labels=cfg.get("Labels"),
        ports=list((cfg.get("ExposedPorts") or {}).keys()) or None,
        user=cfg.get("User") or None,
        working_dir=cfg.get("WorkingDir") or None,
        domainname=cfg.get("Domainname") or None,
        stop_signal=cfg.get("StopSignal") or None,
        tty=bool(cfg.get("Tty")),
        healthcheck=_healthcheck(cfg),
        host_config=host_config,
        name=name,
    )
    if was_running:
        client.api.start(created["Id"])
    return created["Id"]


def update_app(
    client: docker.DockerClient,
    settings: Settings,
    app: str,
    on_event: EventSink,
) -> tuple[int, str | None]:
    """Applique une mise à jour « image seule » à tous les conteneurs de l'app."""
    names = app_container_names(settings, client, app)
    if not names:
        return 1, f"aucun conteneur pour {app}"

    for name in names:
        try:
            container = client.containers.get(name)
        except docker.errors.NotFound:
            on_event(f"conteneur introuvable : {name}")
            return 1, f"conteneur introuvable : {name}"
        image = (container.attrs.get("Config") or {}).get("Image")
        if image:
            on_event(f"Récupération de l'image {image}")
            try:
                client.images.pull(image)
            except docker.errors.DockerException as exc:
                return 1, f"échec du pull de {image}: {exc}"
        on_event(f"Recréation de {name} (image mise à jour, configuration conservée)")
        try:
            recreate_container(client, container)
        except (docker.errors.DockerException, Ssdv2CtlError) as exc:
            return 1, f"échec de la recréation de {name}: {exc}"
        on_event(f"{name} recréé")
    return 0, None


def _main() -> None:
    import sys

    import docker as docker_sdk

    if len(sys.argv) < 2:
        raise SystemExit("usage: python -m app.services.app_update <app>")
    app = sys.argv[1]
    settings = Settings()
    client = docker_sdk.from_env()
    code, message = update_app(client, settings, app, print)
    if message:
        print(message)
    raise SystemExit(code)


if __name__ == "__main__":
    _main()
