import socket
import sqlite3
import ssl
from datetime import UTC, datetime, timedelta

import docker
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.adapters.ssdv2_cli import Ssdv2CtlRunner
from app.core.config import Settings
from app.db.models import Job, Notification
from app.schemas.auth import HealthOut
from app.schemas.system import (
    AlertsCheck,
    BackupCheck,
    DnsCheck,
    JobsCheck,
    ServiceCheck,
    SystemHealthOut,
    TlsCheck,
)
from app.services.backups import list_backups

TLS_CACHE_TTL = timedelta(minutes=5)
TLS_WARNING_DAYS = 21
FAILED_JOB_WINDOW = timedelta(hours=24)
TLS_PROBE_TIMEOUT = 4.0

_tls_cache: dict[str, tuple[datetime, TlsCheck]] = {}


def database_available(settings: Settings) -> bool:
    if not settings.webui_db_file.is_file():
        return False
    try:
        with sqlite3.connect(f"file:{settings.webui_db_file.as_posix()}?mode=ro", uri=True) as conn:
            conn.execute("select 1")
        return True
    except sqlite3.Error:
        return False


def docker_available() -> bool:
    try:
        client = docker.from_env()
        client.ping()
        return True
    except docker.errors.DockerException:
        return False


def ssdv2ctl_available(settings: Settings) -> bool:
    return Ssdv2CtlRunner(settings).version() is not None


def build_health_status(settings: Settings) -> HealthOut:
    docker_ok = docker_available()
    ssdv2_ok = settings.catalogue_file.is_file() and settings.ssddb_file.is_file()
    ssdv2ctl_ok = ssdv2ctl_available(settings)
    database_ok = database_available(settings)
    status = "ok" if docker_ok and ssdv2_ok and ssdv2ctl_ok and database_ok else "degraded"
    return HealthOut(
        status=status,
        docker=docker_ok,
        ssdv2=ssdv2_ok,
        ssdv2ctl=ssdv2ctl_ok,
        database=database_ok,
    )


def resolve_dns(hostname: str | None) -> DnsCheck:
    if not hostname:
        return DnsCheck(status="unknown")
    try:
        infos = socket.getaddrinfo(hostname, 443, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        return DnsCheck(status="failed", hostname=hostname)
    addresses = sorted({str(info[4][0]) for info in infos})
    return DnsCheck(
        status="ok" if addresses else "failed",
        hostname=hostname,
        addresses=addresses,
    )


def parse_certificate_expiry(not_after: str) -> datetime | None:
    try:
        return datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z")
    except ValueError:
        return None


def tls_check_from_expiry(hostname: str, expires_at: datetime | None, now: datetime) -> TlsCheck:
    if expires_at is None:
        return TlsCheck(status="unknown", hostname=hostname)
    days = (expires_at - now).days
    return TlsCheck(
        status="warning" if days <= TLS_WARNING_DAYS else "ok",
        hostname=hostname,
        days_remaining=days,
        expires_at=expires_at,
    )


def probe_tls(
    hostname: str | None,
    *,
    now: datetime | None = None,
    force: bool = False,
) -> TlsCheck:
    reference = now or datetime.now(UTC).replace(tzinfo=None)
    if not hostname:
        return TlsCheck(status="unknown")
    cached = _tls_cache.get(hostname)
    if cached is not None and not force and reference - cached[0] < TLS_CACHE_TTL:
        return cached[1]

    context = ssl.create_default_context()
    try:
        with socket.create_connection((hostname, 443), timeout=TLS_PROBE_TIMEOUT) as raw:
            with context.wrap_socket(raw, server_hostname=hostname) as tls:
                certificate = tls.getpeercert()
    except (OSError, ssl.SSLError):
        check = TlsCheck(status="unknown", hostname=hostname)
        _tls_cache[hostname] = (reference, check)
        return check

    not_after = certificate.get("notAfter") if isinstance(certificate, dict) else None
    check = tls_check_from_expiry(hostname, parse_certificate_expiry(not_after or ""), reference)
    _tls_cache[hostname] = (reference, check)
    return check


def build_system_health(
    settings: Settings,
    db: Session,
    *,
    hostname: str | None,
    now: datetime | None = None,
) -> SystemHealthOut:
    reference = now or datetime.now(UTC).replace(tzinfo=None)
    health = build_health_status(settings)

    services = [
        ServiceCheck(key="docker", status="ok" if health.docker else "degraded"),
        ServiceCheck(key="ssdv2", status="ok" if health.ssdv2 else "degraded"),
        ServiceCheck(key="ssdv2ctl", status="ok" if health.ssdv2ctl else "degraded"),
        ServiceCheck(key="database", status="ok" if health.database else "degraded"),
    ]

    backups = list_backups(settings.backup_dir)
    backup_check = BackupCheck(
        status="ok" if settings.backup_dir.is_dir() else "unknown",
        last_at=backups[0].created_at if backups else None,
        count=len(backups),
    )
    services.append(
        ServiceCheck(key="backups", status="ok" if backup_check.status == "ok" else "unknown")
    )

    active_jobs = (
        db.scalar(
            select(func.count()).select_from(Job).where(Job.status.in_(("queued", "running")))
        )
        or 0
    )
    failed_jobs = (
        db.scalar(
            select(func.count())
            .select_from(Job)
            .where(Job.status == "failed", Job.finished_at >= reference - FAILED_JOB_WINDOW)
        )
        or 0
    )
    jobs_check = JobsCheck(status="ok", active=active_jobs, failed_recent=failed_jobs)
    services.append(ServiceCheck(key="jobs", status="ok"))

    unread = (
        db.scalar(
            select(func.count()).select_from(Notification).where(Notification.read_at.is_(None))
        )
        or 0
    )
    alerts_check = AlertsCheck(status="warning" if unread else "ok", unread=unread)

    dns_check = resolve_dns(hostname)
    tls_check = probe_tls(hostname, now=reference)

    degraded = any(service.status != "ok" for service in services) or dns_check.status == "failed"
    return SystemHealthOut(
        status="degraded" if degraded else "ok",
        checked_at=reference,
        services=services,
        tls=tls_check,
        dns=dns_check,
        backups=backup_check,
        jobs=jobs_check,
        alerts=alerts_check,
    )
