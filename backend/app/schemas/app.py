from typing import Literal

from pydantic import BaseModel

RuntimeStatus = Literal["running", "partial", "stopped", "unknown", "not_installed"]


class AppStateOut(BaseModel):
    name: str
    description: str
    available: bool
    installed: bool
    runtime_status: RuntimeStatus
    healthy: bool | None
    url: str | None
    image: str | None
    containers: int
    warnings: list[str]


class ContainerOut(BaseModel):
    name: str
    image: str | None
    state: str
    health: str | None


class SsddbAppOut(BaseModel):
    status: int | None
    subdomain: str | None
    port: int | None


class RegistriesOut(BaseModel):
    containers: list[str]
    volumes: list[str]
    dns: list[str]


class AppDetailOut(AppStateOut):
    container_list: list[ContainerOut]
    ssddb: SsddbAppOut | None
    registries: RegistriesOut


class LogsOut(BaseModel):
    app: str
    container: str
    lines: list[str]
