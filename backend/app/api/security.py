from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete

from app.db.models import UserSession
from app.deps import CurrentUser, DbDep
from app.schemas.security import SecurityOut, SecurityUpdateRequest
from app.services import audit
from app.services import settings as webui_settings

router = APIRouter(prefix="/security", tags=["security"])


@router.get("", response_model=SecurityOut)
def get_security(db: DbDep, _user: CurrentUser) -> SecurityOut:
    return SecurityOut(internal_auth=webui_settings.internal_auth_enabled(db))


@router.patch("", response_model=SecurityOut)
def update_security(payload: SecurityUpdateRequest, db: DbDep, _user: CurrentUser) -> SecurityOut:
    if not payload.internal_auth and not webui_settings.internal_auth_enabled(db):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "l'authentification interne est déjà désactivée"
        )
    webui_settings.set_internal_auth(db, payload.internal_auth)
    if not payload.internal_auth:
        db.execute(delete(UserSession))
        db.commit()
    audit.record(
        "security_internal_auth",
        "success",
        username=_user.username,
        detail="activée" if payload.internal_auth else "désactivée",
    )
    return SecurityOut(internal_auth=payload.internal_auth)
