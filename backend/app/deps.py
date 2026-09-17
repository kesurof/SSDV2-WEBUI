from dataclasses import dataclass
from typing import Annotated

import docker
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.adapters.ssdv2_cli import Ssdv2CtlRunner
from app.core.config import Settings, get_settings
from app.core.security import CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, hash_token
from app.db.models import User, UserSession, utcnow
from app.db.session import get_db
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


def get_current_user(request: Request, db: DbDep) -> AuthenticatedUser:
    if not webui_settings.internal_auth_enabled(db):
        return AuthenticatedUser(username="auth-externe", internal_auth=False)
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Non authentifié")
    session = db.get(UserSession, hash_token(token))
    if session is None or session.expires_at < utcnow():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expirée")
    user = db.get(User, session.user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Utilisateur inconnu")
    return AuthenticatedUser(username=user.username, internal_auth=True)


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


def require_csrf(request: Request) -> None:
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get(CSRF_HEADER)
    if not cookie or not header or cookie != header:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Jeton CSRF invalide")
