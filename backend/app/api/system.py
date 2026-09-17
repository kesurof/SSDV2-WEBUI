from fastapi import APIRouter

from app.deps import CurrentUser, DockerDep, SettingsDep
from app.schemas.system import SystemSummaryOut
from app.services.app_overview import load_app_states
from app.services.system import build_summary

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/summary", response_model=SystemSummaryOut)
def get_summary(
    settings: SettingsDep,
    docker_client: DockerDep,
    _user: CurrentUser,
) -> SystemSummaryOut:
    states = load_app_states(settings, docker_client)
    return build_summary(settings, states, docker_client)
