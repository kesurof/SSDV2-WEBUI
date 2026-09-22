from fastapi import APIRouter, HTTPException, status

from app.adapters.ssdv2_cli import Ssdv2CtlError
from app.deps import CurrentUser, DockerDep, SettingsDep, Ssdv2CtlDep
from app.schemas.diagnostics import DiagnosticsOut, DiagnosticsPurgeRequest
from app.schemas.job import JobOut
from app.services.app_state import matching_containers
from app.services.diagnostics import load_diagnostics
from app.services.docker_state import collect_containers
from app.services.jobs import DIAGNOSTICS_JOB_TYPES, job_manager
from app.services.registries import read_registries

router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])


@router.get("", response_model=DiagnosticsOut)
def run_diagnostics(
    settings: SettingsDep,
    docker_client: DockerDep,
    runner: Ssdv2CtlDep,
    _user: CurrentUser,
) -> DiagnosticsOut:
    try:
        return load_diagnostics(settings, docker_client, runner)
    except Ssdv2CtlError as exc:
        code = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if exc.code == "ssdv2ctl_unavailable"
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(code, exc.message) from exc


def _submit_diagnostics_job(action: str, user: CurrentUser) -> JobOut:
    job_type = DIAGNOSTICS_JOB_TYPES.get(action)
    if job_type is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"action de diagnostic inconnue: {action}")
    job = job_manager.submit(job_type, "diagnostics", user.username)
    return JobOut.model_validate(job)


@router.post("/rebuild-registries", response_model=JobOut, status_code=status.HTTP_202_ACCEPTED)
def rebuild_registries(_user: CurrentUser) -> JobOut:
    return _submit_diagnostics_job("rebuild-registries", _user)


@router.post(
    "/cleanup-orphan-containers", response_model=JobOut, status_code=status.HTTP_202_ACCEPTED
)
def cleanup_orphan_containers(_user: CurrentUser) -> JobOut:
    return _submit_diagnostics_job("cleanup-orphan-containers", _user)


@router.post(
    "/cleanup-dangling-volumes", response_model=JobOut, status_code=status.HTTP_202_ACCEPTED
)
def cleanup_dangling_volumes(_user: CurrentUser) -> JobOut:
    return _submit_diagnostics_job("cleanup-dangling-volumes", _user)


@router.post("/purge-apps", response_model=JobOut, status_code=status.HTTP_202_ACCEPTED)
def purge_apps(
    payload: DiagnosticsPurgeRequest,
    settings: SettingsDep,
    docker_client: DockerDep,
    _user: CurrentUser,
) -> JobOut:
    registries = read_registries(settings.registries_dir)
    snapshot = collect_containers(docker_client)
    blocking = [
        app
        for app in payload.apps
        if matching_containers(app, registries.get(app), snapshot.containers)
    ]
    if blocking:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "applications encore présentes (conteneurs) : " + ", ".join(blocking),
        )
    job = job_manager.submit(
        "diagnostics_purge_apps",
        "diagnostics",
        _user.username,
        {"apps": payload.apps, "delete_data": payload.delete_data},
    )
    return JobOut.model_validate(job)
