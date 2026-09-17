from typing import Literal

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    username: str


class HealthOut(BaseModel):
    status: Literal["ok", "degraded"]
    docker: bool
    ssdv2: bool
    database: bool
