from fastapi import APIRouter, Query

from app.deps import CurrentUser, DockerDep, SettingsDep
from app.schemas.updates import UpdatesOut
from app.services.app_overview import load_app_states
from app.services.updates import build_updates

router = APIRouter(prefix="/updates", tags=["updates"])


@router.get("", response_model=UpdatesOut)
def get_updates(
    settings: SettingsDep,
    docker_client: DockerDep,
    _user: CurrentUser,
    refresh: bool = Query(default=False),
) -> UpdatesOut:
    states = load_app_states(settings, docker_client)
    return build_updates(states, docker_client, force=refresh)
