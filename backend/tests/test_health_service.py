import socket
from datetime import datetime, timedelta

import app.services.health as health_service
from app.schemas.system import DnsCheck, TlsCheck
from app.services.health import (
    build_system_health,
    parse_certificate_expiry,
    resolve_dns,
    tls_check_from_expiry,
)


def test_parse_certificate_expiry():
    assert parse_certificate_expiry("Sep 17 12:00:00 2026 GMT") == datetime(2026, 9, 17, 12, 0, 0)


def test_parse_certificate_expiry_invalid():
    assert parse_certificate_expiry("n'importe quoi") is None


def test_tls_check_from_expiry_ok():
    now = datetime(2026, 9, 17, 12, 0, 0)
    check = tls_check_from_expiry("exemple.tld", now + timedelta(days=60), now)
    assert check.status == "ok"
    assert check.days_remaining == 60


def test_tls_check_from_expiry_warning():
    now = datetime(2026, 9, 17, 12, 0, 0)
    check = tls_check_from_expiry("exemple.tld", now + timedelta(days=10), now)
    assert check.status == "warning"
    assert check.days_remaining == 10


def test_tls_check_unknown_without_expiry():
    now = datetime(2026, 9, 17, 12, 0, 0)
    assert tls_check_from_expiry("exemple.tld", None, now).status == "unknown"


def test_resolve_dns_unknown_without_hostname():
    assert resolve_dns(None).status == "unknown"


def test_resolve_dns_failed(monkeypatch):
    def boom(*_args, **_kwargs):
        raise socket.gaierror("introuvable")

    monkeypatch.setattr(socket, "getaddrinfo", boom)
    assert resolve_dns("invalide.tld").status == "failed"


def test_resolve_dns_ok(monkeypatch):
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [(2, 1, 6, "", ("198.51.100.10", 443))],
    )
    check = resolve_dns("exemple.tld")
    assert check.status == "ok"
    assert check.addresses == ["198.51.100.10"]


def test_build_system_health(monkeypatch, settings):
    monkeypatch.setattr(health_service, "docker_available", lambda: True)
    monkeypatch.setattr(health_service, "ssdv2ctl_available", lambda _settings: True)
    monkeypatch.setattr(health_service, "database_available", lambda _settings: True)
    monkeypatch.setattr(
        health_service,
        "resolve_dns",
        lambda hostname: DnsCheck(status="ok", hostname=hostname, addresses=["198.51.100.10"]),
    )
    monkeypatch.setattr(
        health_service,
        "probe_tls",
        lambda hostname, now=None, force=False: TlsCheck(
            status="ok", hostname=hostname, days_remaining=90
        ),
    )

    settings.catalogue_file.parent.mkdir(parents=True, exist_ok=True)
    settings.catalogue_file.write_text("dozzle - Logs\n", encoding="utf-8")
    settings.ssddb_file.parent.mkdir(parents=True, exist_ok=True)
    if not settings.ssddb_file.exists():
        settings.ssddb_file.write_text("", encoding="utf-8")

    from app.db.session import get_session_factory

    with get_session_factory()() as db:
        report = build_system_health(settings, db, hostname="exemple.tld")

    assert report.status == "ok"
    assert report.dns.status == "ok"
    assert report.tls.status == "ok"
    assert {service.key for service in report.services} == {
        "docker",
        "ssdv2",
        "ssdv2ctl",
        "database",
        "backups",
        "jobs",
    }
    assert report.jobs.status == "ok"
    assert report.alerts.status in {"ok", "warning"}
