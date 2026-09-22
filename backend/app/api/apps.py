import json
from collections.abc import Iterator

import docker
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.adapters.ssdv2_cli import Ssdv2CtlError
from app.deps import CurrentUser, DbDep, DockerDep, SettingsDep, Ssdv2CtlDep
from app.schemas.app import (
    AppAuthOut,
    AppDetailOut,
    AppEnvOut,
    AppHistoryOut,
    AppInstallRequest,
    AppRemoveRequest,
    AppStateOut,
    AppStatsOut,
    AppStorageOut,
    LogsOut,
)
from app.schemas.job import JobOut
from app.services.app_history import build_app_history
from app.services.app_overview import load_app_states
from app.services.app_state import WARNING_SSDDB_UNAVAILABLE, build_app_detail
from app.services.app_stats import filter_env, read_container_stats
from app.services.app_storage import build_app_storage, read_volume_usage
from app.services.catalogue import read_catalogue
from app.services.docker_state import (
    collect_containers,
    read_container_logs,
    stream_container_logs,
)
from app.services.domain import get_global_domain
from app.services.jobs import job_manager
from app.services.registries import read_registries
from app.services.ssddb import read_ssddb

router = APIRouter(prefix="/apps", tags=["apps"])


@router.get("", response_model=list[AppStateOut])
def list_apps(
    settings: SettingsDep,
    docker_client: DockerDep,
    runner: Ssdv2CtlDep,
    _user: CurrentUser,
) -> list[AppStateOut]:
    ssddb = read_ssddb(settings.ssddb_file)
    domain = get_global_domain(runner, ssddb.domain)
    return load_app_states(settings, docker_client, domain)


@router.get("/{app}", response_model=AppDetailOut)
def get_app(
    app: str,
    settings: SettingsDep,
    docker_client: DockerDep,
    runner: Ssdv2CtlDep,
    _user: CurrentUser,
) -> AppDetailOut:
    entries, catalogue_error = read_catalogue(settings.catalogue_file)
    if catalogue_error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, catalogue_error)
    entry = next((item for item in entries if item.name == app), None)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"application inconnue: {app}")

    ssddb = read_ssddb(settings.ssddb_file)
    domain = get_global_domain(runner, ssddb.domain)
    registries = read_registries(settings.registries_dir)
    snapshot = collect_containers(docker_client)
    detail = build_app_detail(entry, ssddb, registries.get(app), snapshot, domain)
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


def _submit_job(
    app: str,
    job_type: str,
    settings: SettingsDep,
    user: CurrentUser,
    params: dict | None = None,
) -> JobOut:
    entries, catalogue_error = read_catalogue(settings.catalogue_file)
    if catalogue_error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, catalogue_error)
    if not any(item.name == app for item in entries):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"application inconnue: {app}")
    job = job_manager.submit(job_type, app, user.username, params)
    return JobOut.model_validate(job)


def _submit_app_action(app: str, action: str, settings: SettingsDep, user: CurrentUser) -> JobOut:
    return _submit_job(app, f"app_{action}", settings, user)


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


@router.post("/{app}/install", response_model=JobOut, status_code=status.HTTP_202_ACCEPTED)
def install_app(
    app: str,
    payload: AppInstallRequest,
    settings: SettingsDep,
    _user: CurrentUser,
) -> JobOut:
    return _submit_job(
        app,
        "app_install",
        settings,
        _user,
        {"subdomain": payload.subdomain, "auth": payload.auth},
    )


@router.post("/{app}/remove", response_model=JobOut, status_code=status.HTTP_202_ACCEPTED)
def remove_app(
    app: str,
    payload: AppRemoveRequest,
    settings: SettingsDep,
    _user: CurrentUser,
) -> JobOut:
    return _submit_job(app, "app_remove", settings, _user, {"delete_data": payload.delete_data})


@router.post("/{app}/reinstall", response_model=JobOut, status_code=status.HTTP_202_ACCEPTED)
def reinstall_app(
    app: str,
    settings: SettingsDep,
    _user: CurrentUser,
) -> JobOut:
    return _submit_job(app, "app_reinstall", settings, _user)


@router.post("/{app}/recreate", response_model=JobOut, status_code=status.HTTP_202_ACCEPTED)
def recreate_app(
    app: str,
    settings: SettingsDep,
    _user: CurrentUser,
) -> JobOut:
    return _submit_job(app, "app_recreate", settings, _user)


@router.post("/{app}/backup", response_model=JobOut, status_code=status.HTTP_202_ACCEPTED)
def backup_app(
    app: str,
    settings: SettingsDep,
    _user: CurrentUser,
) -> JobOut:
    return _submit_job(app, "app_backup", settings, _user)


def _app_container_names(
    app: str,
    settings: SettingsDep,
    docker_client: DockerDep,
) -> list[str]:
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
    return [item.name for item in detail.container_list]


@router.get("/{app}/history", response_model=AppHistoryOut)
def get_app_history(
    app: str,
    settings: SettingsDep,
    db: DbDep,
    _user: CurrentUser,
    kind: str | None = Query(default=None, pattern="^(job|audit|notification|backup|errors)$"),
    limit: int = Query(default=100, ge=1, le=500),
) -> AppHistoryOut:
    entries, catalogue_error = read_catalogue(settings.catalogue_file)
    if catalogue_error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, catalogue_error)
    if not any(item.name == app for item in entries):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"application inconnue: {app}")
    events = build_app_history(db, settings, app, kind=kind, limit=limit)
    return AppHistoryOut(app=app, events=events)


@router.get("/{app}/stats", response_model=AppStatsOut)
def get_app_stats(
    app: str,
    settings: SettingsDep,
    docker_client: DockerDep,
    _user: CurrentUser,
) -> AppStatsOut:
    names = _app_container_names(app, settings, docker_client)
    return AppStatsOut(app=app, containers=read_container_stats(docker_client, names))


@router.get("/{app}/env", response_model=AppEnvOut)
def get_app_env(
    app: str,
    settings: SettingsDep,
    docker_client: DockerDep,
    _user: CurrentUser,
) -> AppEnvOut:
    names = _app_container_names(app, settings, docker_client)
    if docker_client is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Docker est indisponible")
    variables = []
    seen: set[str] = set()
    for name in names:
        try:
            container = docker_client.containers.get(name)
        except docker.errors.DockerException:
            continue
        raw_env = (container.attrs.get("Config") or {}).get("Env") or []
        for variable in filter_env(raw_env):
            if variable.name in seen:
                continue
            seen.add(variable.name)
            variables.append(variable)
    return AppEnvOut(app=app, variables=sorted(variables, key=lambda item: item.name))


@router.get("/{app}/storage", response_model=AppStorageOut)
def get_app_storage(
    app: str,
    settings: SettingsDep,
    docker_client: DockerDep,
    _user: CurrentUser,
) -> AppStorageOut:
    entries, catalogue_error = read_catalogue(settings.catalogue_file)
    if catalogue_error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, catalogue_error)
    if not any(item.name == app for item in entries):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"application inconnue: {app}")
    registries = read_registries(settings.registries_dir)
    registry = registries.get(app)
    usage = read_volume_usage(docker_client)
    return build_app_storage(app, registry.volumes if registry else [], usage)


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
