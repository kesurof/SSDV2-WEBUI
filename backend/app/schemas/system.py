from typing import Literal

from pydantic import BaseModel


class HostSummary(BaseModel):
    hostname: str | None = None
    os: str | None = None
    kernel: str | None = None
    architecture: str | None = None
    cpus: int | None = None
    memory_bytes: int | None = None
    server_version: str | None = None


class Ssdv2Summary(BaseModel):
    branch: str | None = None
    commit: str | None = None
    apps_total: int = 0
    installed: int = 0
    running: int = 0
    stopped: int = 0
    unknown: int = 0
    not_installed: int = 0


class SystemSummaryOut(BaseModel):
    status: Literal["ok", "degraded"]
    host: HostSummary
    ssdv2: Ssdv2Summary
    warnings: list[str]
