import docker
from fastapi import APIRouter, HTTPException, Query, status

from app.deps import CurrentUser, DockerDep, SettingsDep
from app.schemas.app import AppDetailOut, AppStateOut, LogsOut
from app.services.app_overview import load_app_states
from app.services.app_state import WARNING_SSDDB_UNAVAILABLE, build_app_detail
from app.services.catalogue import read_catalogue
from app.services.docker_state import collect_containers, read_container_logs
from app.services.registries import read_registries
from app.services.ssddb import read_ssddb

router = APIRouter(prefix="/apps", tags=["apps"])


@router.get("", response_model=list[AppStateOut])
def list_apps(
    settings: SettingsDep,
    docker_client: DockerDep,
    _user: CurrentUser,
) -> list[AppStateOut]:
    return load_app_states(settings, docker_client)


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


@router.get("/{app}/logs", response_model=LogsOut)
def get_app_logs(
    app: str,
    settings: SettingsDep,
    docker_client: DockerDep,
    _user: CurrentUser,
    container: str | None = None,
    lines: int = Query(default=200, ge=1, le=1000),
) -> LogsOut:
    entries, catalogue_error = read_catalogue(settings.catalogue_file)
    if catalogue_error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, catalogue_error)
    entry = next((item for item in entries if item.name == app), None)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"application inconnue: {app}")
    if docker_client is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Docker est indisponible")

    ssddb = read_ssddb(settings.ssddb_file)
    registries = read_registries(settings.registries_dir)
    snapshot = collect_containers(docker_client)
    detail = build_app_detail(entry, ssddb, registries.get(app), snapshot)
    names = [item.name for item in detail.container_list]
    if not names:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"aucun conteneur pour {app}")

    selected = container or (app if app in names else names[0])
    if selected not in names:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"conteneur non rattaché à {app}: {selected}"
        )
    try:
        logs = read_container_logs(docker_client, selected, lines=lines)
    except docker.errors.NotFound as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"conteneur introuvable: {selected}"
        ) from exc
    except docker.errors.DockerException as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    return LogsOut(app=app, container=selected, lines=logs)
