from datetime import timedelta
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select

from app.core.config import get_settings
from app.core.ratelimit import FixedWindowLimiter
from app.core.security import (
    CSRF_COOKIE,
    SESSION_COOKIE,
    hash_token,
    new_token,
    verify_password,
)
from app.db.models import User, UserSession, utcnow
from app.deps import CurrentUser, DbDep, SettingsDep, require_csrf
from app.schemas.auth import LoginRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@lru_cache
def login_limiter() -> FixedWindowLimiter:
    settings = get_settings()
    return FixedWindowLimiter(settings.login_max_attempts, settings.login_window_seconds)


@router.post("/login", response_model=UserOut)
def login(payload: LoginRequest, response: Response, db: DbDep, settings: SettingsDep) -> UserOut:
    limiter = login_limiter()
    key = f"login:{payload.username}"
    if not limiter.allow(key):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Trop de tentatives, réessayez plus tard"
        )
    user = db.scalar(select(User).where(User.username == payload.username))
    if user is None or not verify_password(user.password_hash, payload.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Identifiants invalides")
    limiter.reset(key)

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
    return UserOut(username=user.username)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    db: DbDep,
    _user: CurrentUser,
    _csrf: None = Depends(require_csrf),
) -> None:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        session = db.get(UserSession, hash_token(token))
        if session is not None:
            db.delete(session)
            db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return UserOut(username=user.username)
