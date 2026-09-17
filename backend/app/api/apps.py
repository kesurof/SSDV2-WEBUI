from fastapi import APIRouter, HTTPException, status

from app.deps import CurrentUser, DockerDep, SettingsDep
from app.schemas.app import AppDetailOut, AppStateOut
from app.services.app_state import (
    WARNING_CATALOGUE_UNAVAILABLE,
    WARNING_SSDDB_UNAVAILABLE,
    build_app_detail,
    build_app_states,
)
from app.services.catalogue import read_catalogue
from app.services.docker_state import collect_containers
from app.services.registries import read_registries
from app.services.ssddb import read_ssddb

router = APIRouter(prefix="/apps", tags=["apps"])


@router.get("", response_model=list[AppStateOut])
def list_apps(
    settings: SettingsDep,
    docker_client: DockerDep,
    _user: CurrentUser,
) -> list[AppStateOut]:
    entries, catalogue_error = read_catalogue(settings.catalogue_file)
    ssddb = read_ssddb(settings.ssddb_file)
    registries = read_registries(settings.registries_dir)
    snapshot = collect_containers(docker_client)
    states = build_app_states(entries, ssddb, registries, snapshot)

    extra_warnings: list[str] = []
    if catalogue_error:
        extra_warnings.append(WARNING_CATALOGUE_UNAVAILABLE)
    if ssddb.warnings:
        extra_warnings.append(WARNING_SSDDB_UNAVAILABLE)
    for state in states:
        state.warnings.extend(extra_warnings)
    return states


@router.get("/{app}", response_model=AppDetailOut)
def get_app(
    app: str,
    settings: SettingsDep,
    docker_client: DockerDep,
    _user: CurrentUser,
) -> AppDetailOut:
    entries, catalogue_error = read_catalogue(settings.catalogue_file)
    if catalogue_error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, catalogue_error)
    entry = next((item for item in entries if item.name == app), None)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"application inconnue: {app}")

    ssddb = read_ssddb(settings.ssddb_file)
    registries = read_registries(settings.registries_dir)
    snapshot = collect_containers(docker_client)
    detail = build_app_detail(entry, ssddb, registries.get(app), snapshot)
    if ssddb.warnings:
        detail.warnings.append(WARNING_SSDDB_UNAVAILABLE)
    return detail
