import json
from collections.abc import Iterator

import docker
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.adapters.ssdv2_cli import Ssdv2CtlError
from app.deps import CurrentUser, DockerDep, SettingsDep, Ssdv2CtlDep
from app.schemas.app import AppAuthOut, AppDetailOut, AppStateOut, LogsOut
from app.schemas.job import JobOut
from app.services.app_overview import load_app_states
from app.services.app_state import WARNING_SSDDB_UNAVAILABLE, build_app_detail
from app.services.catalogue import read_catalogue
from app.services.docker_state import (
    collect_containers,
    read_container_logs,
    stream_container_logs,
)
from app.services.jobs import job_manager
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


def _resolve_log_container(
    app: str,
    container: str | None,
    settings: SettingsDep,
    docker_client: DockerDep,
) -> str:
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
    return selected


@router.get("/{app}/logs", response_model=LogsOut)
def get_app_logs(
    app: str,
    settings: SettingsDep,
    docker_client: DockerDep,
    _user: CurrentUser,
    container: str | None = None,
    lines: int = Query(default=200, ge=1, le=1000),
) -> LogsOut:
    selected = _resolve_log_container(app, container, settings, docker_client)
    try:
        logs = read_container_logs(docker_client, selected, lines=lines)
    except docker.errors.NotFound as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"conteneur introuvable: {selected}"
        ) from exc
    except docker.errors.DockerException as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    return LogsOut(app=app, container=selected, lines=logs)


@router.get("/{app}/logs/stream")
def stream_app_logs(
    app: str,
    settings: SettingsDep,
    docker_client: DockerDep,
    _user: CurrentUser,
    container: str | None = None,
    lines: int = Query(default=100, ge=1, le=1000),
) -> StreamingResponse:
    selected = _resolve_log_container(app, container, settings, docker_client)

    def events() -> Iterator[str]:
        yield 'data: {"ready": true}\n\n'
        try:
            for line in stream_container_logs(docker_client, selected, lines=lines):
                yield f"data: {json.dumps({'line': line}, ensure_ascii=False)}\n\n"
        except docker.errors.DockerException as exc:
            yield f"data: {json.dumps({'error': str(exc)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _submit_app_action(app: str, action: str, settings: SettingsDep, user: CurrentUser) -> JobOut:
    entries, catalogue_error = read_catalogue(settings.catalogue_file)
    if catalogue_error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, catalogue_error)
    if not any(item.name == app for item in entries):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"application inconnue: {app}")
    job = job_manager.submit(f"app_{action}", app, user.username)
    return JobOut.model_validate(job)


@router.post("/{app}/start", response_model=JobOut, status_code=status.HTTP_202_ACCEPTED)
def start_app(
    app: str,
    settings: SettingsDep,
    _user: CurrentUser,
) -> JobOut:
    return _submit_app_action(app, "start", settings, _user)


@router.post("/{app}/stop", response_model=JobOut, status_code=status.HTTP_202_ACCEPTED)
def stop_app(
    app: str,
    settings: SettingsDep,
    _user: CurrentUser,
) -> JobOut:
    return _submit_app_action(app, "stop", settings, _user)


@router.post("/{app}/restart", response_model=JobOut, status_code=status.HTTP_202_ACCEPTED)
def restart_app(
    app: str,
    settings: SettingsDep,
    _user: CurrentUser,
) -> JobOut:
    return _submit_app_action(app, "restart", settings, _user)


@router.get("/{app}/auth", response_model=AppAuthOut)
def get_app_auth(
    app: str,
    settings: SettingsDep,
    runner: Ssdv2CtlDep,
    _user: CurrentUser,
) -> AppAuthOut:
    entries, catalogue_error = read_catalogue(settings.catalogue_file)
    if catalogue_error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, catalogue_error)
    if not any(item.name == app for item in entries):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"application inconnue: {app}")
    try:
        payload = runner.run(["auth", "get", app])
    except Ssdv2CtlError as exc:
        code = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if exc.code in ("ssdv2ctl_unavailable", "ssdv2_functions_unavailable")
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(code, exc.message) from exc
    return AppAuthOut.model_validate(payload)
