from fastapi import APIRouter, Request

from app.deps import CurrentUser, DbDep, DockerDep, SettingsDep
from app.schemas.system import HostMetricsOut, SystemHealthOut, SystemSummaryOut
from app.services.app_overview import load_app_states
from app.services.docker_state import collect_containers
from app.services.health import build_system_health
from app.services.host_metrics import read_metrics
from app.services.system import build_summary

router = APIRouter(prefix="/system", tags=["system"])

NON_ROUTABLE_HOSTNAMES = {"testserver", "localhost", "127.0.0.1", "::1"}


@router.get("/summary", response_model=SystemSummaryOut)
def get_summary(
    settings: SettingsDep,
    docker_client: DockerDep,
    _user: CurrentUser,
) -> SystemSummaryOut:
    states = load_app_states(settings, docker_client)
    return build_summary(settings, states, docker_client)


@router.get("/metrics", response_model=HostMetricsOut)
def get_metrics(
    settings: SettingsDep,
    docker_client: DockerDep,
    _user: CurrentUser,
) -> HostMetricsOut:
    snapshot = collect_containers(docker_client)
    return read_metrics(settings, snapshot, docker_client)


@router.get("/health", response_model=SystemHealthOut)
def get_system_health(
    request: Request,
    settings: SettingsDep,
    db: DbDep,
    _user: CurrentUser,
) -> SystemHealthOut:
    hostname = request.url.hostname
    if hostname in NON_ROUTABLE_HOSTNAMES:
        hostname = None
    return build_system_health(settings, db, hostname=hostname)
