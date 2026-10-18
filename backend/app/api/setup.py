import secrets
from datetime import timedelta

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.proxy_auth import proxy_identity, trusted_proxies_configured
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
def setup_status(request: Request, db: DbDep, settings: SettingsDep) -> SetupStatusOut:
    mode, _source = webui_settings.effective_auth_mode(db)
    return SetupStatusOut(
        required=webui_settings.setup_required(db),
        token_required=True,
        instance_name=webui_settings.get_instance_name(db),
        external_auth=proxy_identity(request, settings) is not None,
        auth_mode=mode,
        external_logout_url=settings.external_logout_url,
        trusted_proxies_configured=trusted_proxies_configured(settings),
    )


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def run_setup(
    payload: SetupRequest,
    request: Request,
    response: Response,
    db: DbDep,
    settings: SettingsDep,
) -> UserOut:
    if not webui_settings.setup_required(db):
        raise HTTPException(status.HTTP_409_CONFLICT, "l'installation est déjà terminée")
    if not limiter.allow("setup"):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "trop de tentatives")
    expected = setup.read_setup_token(settings.webui_data)
    if not expected or not secrets.compare_digest(payload.token, expected):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "jeton d'installation invalide")
    limiter.reset("setup")

    mode, source = webui_settings.effective_auth_mode(db)
    if source == "env" and payload.auth_mode != mode:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "le mode d'authentification est imposé par WEBUI_AUTH_MODE",
        )
    if payload.auth_mode == "proxy" and not trusted_proxies_configured(settings):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "aucun proxy de confiance configuré (WEBUI_TRUSTED_PROXIES)",
        )
    if payload.auth_mode == "proxy" and proxy_identity(request, settings) is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "identité externe vérifiée requise",
        )

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
    )
    try:
        db.add(user)
        webui_settings.complete_initial_setup(
            db,
            auth_mode=payload.auth_mode or "internal",
            instance_name=payload.instance_name,
            notify_job_success=payload.notify_job_success,
        )
        db.commit()
        db.refresh(user)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "l'installation n'a pas pu être enregistrée",
        ) from exc

    setup.clear_setup_token(settings.webui_data)

    audit.record(
        "setup",
        "success",
        username=user.username,
        detail=f"instance={payload.instance_name} auth_mode={payload.auth_mode}",
    )
    notifications.create_notification(
        severity="info",
        title="Installation initialisée",
        message=f"Instance « {payload.instance_name} » configurée",
        source="setup",
    )

    if payload.auth_mode == "internal":
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
    return UserOut(
        username=user.username,
        internal_auth=payload.auth_mode == "internal",
        auth_mode=payload.auth_mode or "internal",
    )
