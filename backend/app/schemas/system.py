from datetime import datetime
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


class MemoryMetric(BaseModel):
    total_bytes: int | None = None
    used_bytes: int | None = None
    percent: float | None = None


class DiskMetric(BaseModel):
    total_bytes: int | None = None
    used_bytes: int | None = None
    percent: float | None = None


class ContainerMetrics(BaseModel):
    total: int = 0
    running: int = 0
    healthy: int = 0
    unhealthy: int = 0
    stopped: int = 0


class HostMetricsOut(BaseModel):
    schema_version: int = 1
    cpu_percent: float | None = None
    cpu_count: int | None = None
    memory: MemoryMetric = MemoryMetric()
    disk: DiskMetric = DiskMetric()
    containers: ContainerMetrics = ContainerMetrics()
    warnings: list[str] = []


class ServiceCheck(BaseModel):
    key: str
    status: Literal["ok", "degraded", "unknown"]
    detail: str | None = None


class TlsCheck(BaseModel):
    status: Literal["ok", "warning", "unknown"]
    hostname: str | None = None
    days_remaining: int | None = None
    expires_at: datetime | None = None


class DnsCheck(BaseModel):
    status: Literal["ok", "failed", "unknown"]
    hostname: str | None = None
    addresses: list[str] = []


class BackupCheck(BaseModel):
    status: Literal["ok", "unknown"]
    last_at: datetime | None = None
    count: int = 0


class JobsCheck(BaseModel):
    status: Literal["ok", "degraded"]
    active: int = 0
    failed_recent: int = 0


class AlertsCheck(BaseModel):
    status: Literal["ok", "warning"]
    unread: int = 0


class SystemHealthOut(BaseModel):
    schema_version: int = 1
    status: Literal["ok", "degraded"]
    checked_at: datetime
    services: list[ServiceCheck]
    tls: TlsCheck
    dns: DnsCheck
    backups: BackupCheck
    jobs: JobsCheck
    alerts: AlertsCheck
