import secrets
from datetime import timedelta

from fastapi import APIRouter, HTTPException, Response, status

from app.core.ratelimit import FixedWindowLimiter
from app.core.security import CSRF_COOKIE, SESSION_COOKIE, hash_password, hash_token, new_token
from app.db.models import User, UserSession, utcnow
from app.deps import DbDep, SettingsDep
from app.schemas.auth import UserOut
from app.schemas.setup import SetupRequest, SetupStatusOut
from app.services import audit, notifications, setup
from app.services import settings as webui_settings

router = APIRouter(prefix="/setup", tags=["setup"])

limiter = FixedWindowLimiter(max_attempts=5, window_seconds=60)


@router.get("/status", response_model=SetupStatusOut)
def setup_status(db: DbDep) -> SetupStatusOut:
    return SetupStatusOut(
        required=webui_settings.setup_required(db),
        token_required=True,
        instance_name=webui_settings.get_instance_name(db),
    )


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def run_setup(
    payload: SetupRequest, response: Response, db: DbDep, settings: SettingsDep
) -> UserOut:
    if not webui_settings.setup_required(db):
        raise HTTPException(status.HTTP_409_CONFLICT, "l'installation est déjà terminée")
    if not limiter.allow("setup"):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "trop de tentatives")
    expected = setup.read_setup_token(settings.webui_data)
    if not expected or not secrets.compare_digest(payload.token, expected):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "jeton d'installation invalide")
    limiter.reset("setup")

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    webui_settings.set_internal_auth(db, payload.internal_auth)
    webui_settings.set_instance_name(db, payload.instance_name)
    webui_settings.set_notify_job_success(db, payload.notify_job_success)
    webui_settings.mark_setup_completed(db)
    setup.clear_setup_token(settings.webui_data)

    audit.record(
        "setup",
        "success",
        username=user.username,
        detail=f"instance={payload.instance_name} auth_interne={payload.internal_auth}",
    )
    notifications.create_notification(
        severity="info",
        title="Installation initialisée",
        message=f"Instance « {payload.instance_name} » configurée",
        source="setup",
    )

    if payload.internal_auth:
        token = new_token()
        expires_at = utcnow() + timedelta(hours=settings.session_ttl_hours)
        db.add(UserSession(id=hash_token(token), user_id=user.id, expires_at=expires_at))
        db.commit()
        max_age = settings.session_ttl_hours * 3600
        response.set_cookie(
            SESSION_COOKIE,
            token,
            max_age=max_age,
            httponly=True,
            samesite="lax",
            secure=settings.cookie_secure,
            path="/",
        )
        response.set_cookie(
            CSRF_COOKIE,
            new_token(),
            max_age=max_age,
            httponly=False,
            samesite="lax",
            secure=settings.cookie_secure,
            path="/",
        )
    return UserOut(username=user.username, internal_auth=payload.internal_auth)
