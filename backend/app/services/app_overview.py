import docker

from app.core.config import Settings
from app.schemas.app import AppStateOut
from app.services.app_state import (
    WARNING_CATALOGUE_UNAVAILABLE,
    WARNING_SSDDB_UNAVAILABLE,
    build_app_states,
)
from app.services.catalogue import read_catalogue
from app.services.docker_state import collect_containers
from app.services.registries import read_registries
from app.services.ssddb import read_ssddb


def load_app_states(
    settings: Settings,
    docker_client: docker.DockerClient | None,
    domain: str | None = None,
) -> list[AppStateOut]:
    entries, catalogue_error = read_catalogue(settings.catalogue_file)
    ssddb = read_ssddb(settings.ssddb_file)
    registries = read_registries(settings.registries_dir)
    snapshot = collect_containers(docker_client)
    states = build_app_states(entries, ssddb, registries, snapshot, domain)

    extra_warnings: list[str] = []
    if catalogue_error:
        extra_warnings.append(WARNING_CATALOGUE_UNAVAILABLE)
    if ssddb.warnings:
        extra_warnings.append(WARNING_SSDDB_UNAVAILABLE)
    for state in states:
        state.warnings.extend(extra_warnings)
    return states
