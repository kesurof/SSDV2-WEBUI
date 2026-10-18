from collections.abc import Iterator

import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import AuditEvent
from app.db.session import get_session_factory
from tests.conftest import login_payload


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> Iterator[None]:
    yield
    get_settings.cache_clear()


def test_security_requires_authentication(client):
    assert client.get("/api/v1/security").status_code == 401
    assert client.patch("/api/v1/security", json={"mode": "internal"}).status_code == 401


def test_security_default_internal(auth_client):
    response = auth_client.get("/api/v1/security")

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "internal"
    assert body["mode_source"] == "settings"
    assert body["internal_auth"] is True


def test_security_proxy_requires_trusted_proxies(client):
    client.post("/api/v1/auth/login", json=login_payload())

    response = client.patch("/api/v1/security", json={"mode": "proxy"})

    assert response.status_code == 409


def test_proxy_mode_round_trip(client, monkeypatch):
    monkeypatch.setenv("WEBUI_TRUST_PROXY", "true")
    get_settings.cache_clear()
    client.post("/api/v1/auth/login", json=login_payload())

    disabled = client.patch("/api/v1/security", json={"mode": "proxy"})
    assert disabled.status_code == 200
    assert disabled.json()["mode"] == "proxy"

    # Sans en-tête d'identité, l'accès est refusé (fail-closed).
    assert client.get("/api/v1/auth/me").status_code == 401
    me = client.get("/api/v1/auth/me", headers={"X-Auth-Request-User": "alice"})
    assert me.status_code == 200
    assert me.json() == {"username": "alice", "internal_auth": False, "auth_mode": "proxy"}

    login = client.post("/api/v1/auth/login", json=login_payload())
    assert login.status_code == 409

    enabled = client.patch(
        "/api/v1/security", json={"mode": "internal"}, headers={"X-Auth-Request-User": "alice"}
    )
    assert enabled.status_code == 200
    assert enabled.json()["mode"] == "internal"

    assert client.get("/api/v1/auth/me").status_code == 401
    fresh = client.post("/api/v1/auth/login", json=login_payload())
    assert fresh.status_code == 200


def test_security_change_is_audited(auth_client):
    auth_client.patch("/api/v1/security", json={"mode": "internal"})

    with get_session_factory()() as session:
        events = list(
            session.scalars(
                select(AuditEvent)
                .where(AuditEvent.action == "security_auth_mode")
                .order_by(AuditEvent.id.desc())
            )
        )
        assert events
        assert events[0].detail == "internal -> internal"
        assert events[0].username == "admin"
