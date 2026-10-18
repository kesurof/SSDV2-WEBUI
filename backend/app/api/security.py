from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete

from app.core.proxy_auth import trusted_proxies_configured
from app.db.models import UserSession
from app.deps import CurrentUser, DbDep, SettingsDep
from app.schemas.security import SecurityOut, SecurityUpdateRequest
from app.services import audit
from app.services import settings as webui_settings

router = APIRouter(prefix="/security", tags=["security"])


def _payload(mode: str, source: str, settings: SettingsDep) -> SecurityOut:
    return SecurityOut(
        mode=mode,
        mode_source=source,
        internal_auth=mode == "internal",
        external_logout_url=settings.external_logout_url,
        trusted_proxies_configured=trusted_proxies_configured(settings),
    )


@router.get("", response_model=SecurityOut)
def get_security(db: DbDep, settings: SettingsDep, _user: CurrentUser) -> SecurityOut:
    mode, source = webui_settings.effective_auth_mode(db)
    return _payload(mode, source, settings)


@router.patch("", response_model=SecurityOut)
def update_security(
    payload: SecurityUpdateRequest,
    db: DbDep,
    settings: SettingsDep,
    _user: CurrentUser,
) -> SecurityOut:
    mode, source = webui_settings.effective_auth_mode(db)
    if source == "env":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "le mode d'authentification est imposé par WEBUI_AUTH_MODE",
        )
    if payload.mode == "proxy" and not trusted_proxies_configured(settings):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "aucun proxy de confiance configuré (WEBUI_TRUSTED_PROXIES)",
        )
    webui_settings.set_auth_mode(db, payload.mode or "internal")
    if payload.mode != "internal":
        db.execute(delete(UserSession))
        db.commit()
    audit.record(
        "security_auth_mode",
        "success",
        username=_user.username,
        detail=f"{mode} -> {payload.mode}",
    )
    return _payload(payload.mode or "internal", "settings", settings)
