from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.app import AuthType


class LoginRequest(BaseModel):
    username: str
    password: str


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
