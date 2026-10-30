from fastapi import APIRouter, Query
from sqlalchemy.orm import Session

from app.deps import CurrentUser, DbDep, DockerDep, SettingsDep
from app.schemas.updates import (
    UpdateScheduleOut,
    UpdateScheduleUpdateRequest,
    UpdatesOut,
)
from app.services import audit
from app.services import settings as webui_settings
from app.services.app_overview import load_app_states
from app.services.update_schedule import next_run, server_timezone
from app.services.updates import build_updates

router = APIRouter(prefix="/updates", tags=["updates"])


def _schedule_payload(db: Session) -> UpdateScheduleOut:
    start, end = webui_settings.updates_auto_window(db)
    return UpdateScheduleOut(
        enabled=webui_settings.updates_auto_enabled(db),
        start=start,
        end=end,
        timezone=server_timezone(),
        last_run_at=webui_settings.updates_auto_last_run(db),
        next_run_at=next_run(db),
    )


@router.get("/schedule", response_model=UpdateScheduleOut)
def get_update_schedule(db: DbDep, _user: CurrentUser) -> UpdateScheduleOut:
    return _schedule_payload(db)


@router.patch("/schedule", response_model=UpdateScheduleOut)
def update_update_schedule(
    payload: UpdateScheduleUpdateRequest,
    db: DbDep,
    _user: CurrentUser,
) -> UpdateScheduleOut:
    webui_settings.set_updates_auto(
        db, enabled=payload.enabled, start=payload.start, end=payload.end
    )
    audit.record(
        "updates_schedule",
        "success",
        username=_user.username,
        detail=(f"{'activé' if payload.enabled else 'désactivé'} {payload.start}–{payload.end}"),
    )
    return _schedule_payload(db)


@router.get("", response_model=UpdatesOut)
def get_updates(
    settings: SettingsDep,
    docker_client: DockerDep,
    _user: CurrentUser,
    refresh: bool = Query(default=False),
) -> UpdatesOut:
    states = load_app_states(settings, docker_client)
    return build_updates(states, docker_client, force=refresh)
