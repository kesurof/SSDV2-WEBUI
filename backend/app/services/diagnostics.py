import docker

from app.adapters.ssdv2_cli import Ssdv2CtlRunner
from app.core.config import Settings
from app.schemas.diagnostics import DiagnosticsOut
from app.services.app_state import matching_containers
from app.services.docker_state import collect_containers
from app.services.registries import read_registries


def stale_apps(
    settings: Settings, docker_client: docker.DockerClient | None, missing: list[str]
) -> list[str]:
    registries = read_registries(settings.registries_dir)
    snapshot = collect_containers(docker_client)
    return [
        app
        for app in missing
        if not matching_containers(app, registries.get(app), snapshot.containers)
    ]


def load_diagnostics(
    settings: Settings, docker_client: docker.DockerClient | None, runner: Ssdv2CtlRunner
) -> DiagnosticsOut:
    payload = runner.run(["diagnostics", "run"])
    result = DiagnosticsOut.model_validate(payload)
    result.checks.stale_apps = stale_apps(settings, docker_client, result.checks.missing_registries)
    return result
