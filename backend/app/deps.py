from dataclasses import dataclass
from datetime import timedelta
from typing import Annotated

import docker
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.adapters.ssdv2_cli import Ssdv2CtlRunner
from app.core.config import Settings, get_settings
from app.core.proxy_auth import proxy_identity
from app.core.security import CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, hash_token, new_token
from app.db.models import User, UserSession, utcnow
from app.db.session import get_db, get_session_factory
from app.services import settings as webui_settings


@dataclass(frozen=True)
class AuthenticatedUser:
    username: str
    internal_auth: bool


SettingsDep = Annotated[Settings, Depends(get_settings)]
DbDep = Annotated[Session, Depends(get_db)]


def get_ssdv2ctl(settings: SettingsDep) -> Ssdv2CtlRunner:
    return Ssdv2CtlRunner(settings)


Ssdv2CtlDep = Annotated[Ssdv2CtlRunner, Depends(get_ssdv2ctl)]


def get_docker_client() -> docker.DockerClient | None:
    try:
        return docker.from_env()
    except docker.errors.DockerException:
        return None


DockerDep = Annotated[docker.DockerClient | None, Depends(get_docker_client)]


def _session_cookie_options(settings: Settings) -> dict:
    return {
        "httponly": True,
        "samesite": "lax",
        "secure": settings.cookie_secure,
        "path": "/",
    }


def _csrf_cookie_options(settings: Settings) -> dict:
    return {
        "httponly": False,
        "samesite": "lax",
        "secure": settings.cookie_secure,
        "path": "/",
    }


def _resolve_user(
    request: Request,
    db: Session,
    settings: Settings,
    response: Response | None = None,
) -> AuthenticatedUser | None:
    """Résout l'utilisateur courant, avec renouvellement glissant si ``response`` est fourni.

    ``response=None`` (flux SSE) évite toute écriture de cookie et permet d'utiliser
    une session courte : aucune connexion n'est retenue pendant le stream.
    """
    mode, _source = webui_settings.effective_auth_mode(db)
    if mode == "proxy":
        # Fail-closed : une identité validée par le proxy autorisé est obligatoire.
        identity = proxy_identity(request, settings)
        if identity is None:
            return None
        return AuthenticatedUser(username=identity, internal_auth=False)

    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    session = db.get(UserSession, hash_token(token))
    now = utcnow()
    if session is None or session.expires_at <= now:
        return None
    user = db.get(User, session.user_id)
    if user is None:
        return None

    if response is not None:
        ttl = timedelta(hours=settings.session_ttl_hours)
        max_age = settings.session_ttl_hours * 3600
        if session.expires_at - now <= ttl / 2:
            session.expires_at = now + ttl
            db.commit()
            response.set_cookie(
                SESSION_COOKIE, token, max_age=max_age, **_session_cookie_options(settings)
            )
        if not request.cookies.get(CSRF_COOKIE):
            response.set_cookie(
                CSRF_COOKIE, new_token(), max_age=max_age, **_csrf_cookie_options(settings)
            )
    return AuthenticatedUser(username=user.username, internal_auth=True)


def get_current_user(
    request: Request, response: Response, db: DbDep, settings: SettingsDep
) -> AuthenticatedUser:
    user = _resolve_user(request, db, settings, response=response)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Non authentifié")
    return user


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


def get_stream_user(request: Request, settings: SettingsDep) -> AuthenticatedUser | None:
    """Résolution pour les flux SSE : session courte, libérée avant le stream.

    Évite de retenir une connexion du pool pendant toute la durée du flux (les flux
    SSE sont longs, voire infinis pour les notifications).
    """
    with get_session_factory()() as db:
        return _resolve_user(request, db, settings)


StreamUser = Annotated[AuthenticatedUser | None, Depends(get_stream_user)]


def require_csrf(request: Request) -> None:
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get(CSRF_HEADER)
    if not cookie or not header or cookie != header:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Jeton CSRF invalide")
