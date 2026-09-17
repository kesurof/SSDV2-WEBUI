from typing import Annotated

import docker
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, hash_token
from app.db.models import User, UserSession, utcnow
from app.db.session import get_db

SettingsDep = Annotated[Settings, Depends(get_settings)]
DbDep = Annotated[Session, Depends(get_db)]


def get_docker_client() -> docker.DockerClient | None:
    try:
        return docker.from_env()
    except docker.errors.DockerException:
        return None


DockerDep = Annotated[docker.DockerClient | None, Depends(get_docker_client)]


def get_current_user(request: Request, db: DbDep) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Non authentifié")
    session = db.get(UserSession, hash_token(token))
    if session is None or session.expires_at < utcnow():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expirée")
    user = db.get(User, session.user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Utilisateur inconnu")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_csrf(request: Request) -> None:
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get(CSRF_HEADER)
    if not cookie or not header or cookie != header:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Jeton CSRF invalide")
