from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.app import AuthType
from app.schemas.setup import PASSWORD_MIN_LENGTH


class LoginRequest(BaseModel):
    username: str
    password: str


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=200)


class UserOut(BaseModel):
    username: str
    internal_auth: bool = True


class AppAuthSummary(BaseModel):
    app: str
    auth: str | None


class AuthBulkRequest(BaseModel):
    apps: list[str] = Field(min_length=1, max_length=100)
    auth: AuthType


class HealthOut(BaseModel):
    status: Literal["ok", "degraded"]
    docker: bool
    ssdv2: bool
    ssdv2ctl: bool
    database: bool
