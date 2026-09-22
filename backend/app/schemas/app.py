from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

RuntimeStatus = Literal["running", "partial", "stopped", "unknown", "not_installed"]
AuthType = Literal["aucune", "basique", "authelia", "oauth", "oauth2-proxy"]
HistoryKind = Literal["job", "audit", "notification", "backup"]

SUBDOMAIN_PATTERN = r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$"


class AppStateOut(BaseModel):
    name: str
    description: str
    available: bool
    installed: bool
    runtime_status: RuntimeStatus
    healthy: bool | None
    url: str | None
    domain: str | None
    image: str | None
    containers: int
    warnings: list[str]


class ContainerOut(BaseModel):
    name: str
    image: str | None
    state: str
    health: str | None
    started_at: str | None = None
    created_at: str | None = None
    image_id: str | None = None


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


class AppAuthOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schema_version: int = Field(alias="schema")
    app: str
    auth: str | None


class AppInstallRequest(BaseModel):
    auth: AuthType
    subdomain: str | None = Field(default=None, pattern=SUBDOMAIN_PATTERN)


class AppRemoveRequest(BaseModel):
    delete_data: bool = False


class AppHistoryEvent(BaseModel):
    kind: HistoryKind
    at: datetime
    actor: str | None = None
    label: str
    result: str
    job_id: int | None = None


class AppHistoryOut(BaseModel):
    schema_version: int = 1
    app: str
    events: list[AppHistoryEvent]


class ContainerStatsOut(BaseModel):
    name: str
    cpu_percent: float | None = None
    memory_used_bytes: int | None = None
    memory_limit_bytes: int | None = None
    memory_percent: float | None = None


class AppStatsOut(BaseModel):
    schema_version: int = 1
    app: str
    containers: list[ContainerStatsOut]


class AppEnvVarOut(BaseModel):
    name: str
    value: str


class AppEnvOut(BaseModel):
    schema_version: int = 1
    app: str
    variables: list[AppEnvVarOut]


class VolumeUsageOut(BaseModel):
    name: str
    size_bytes: int | None = None
    ref_count: int | None = None


class AppStorageOut(BaseModel):
    schema_version: int = 1
    app: str
    volumes: list[VolumeUsageOut]
    total_size_bytes: int | None = None
    warnings: list[str] = []
