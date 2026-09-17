from sqlalchemy import select

from app.db.models import AuditEvent
from app.db.session import get_session_factory
from tests.conftest import login_payload


def test_security_requires_authentication(client):
    assert client.get("/api/v1/security").status_code == 401
    assert client.patch("/api/v1/security", json={"internal_auth": False}).status_code == 401


def test_security_default_enabled(auth_client):
    response = auth_client.get("/api/v1/security")

    assert response.status_code == 200
    assert response.json() == {"internal_auth": True}


def test_disable_internal_auth(client):
    client.post("/api/v1/auth/login", json=login_payload())

    disabled = client.patch("/api/v1/security", json={"internal_auth": False})

    assert disabled.status_code == 200
    assert disabled.json() == {"internal_auth": False}

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json() == {"username": "auth-externe", "internal_auth": False}

    assert client.get("/api/v1/apps").status_code == 200

    login = client.post("/api/v1/auth/login", json=login_payload())
    assert login.status_code == 409

    idempotent = client.patch("/api/v1/security", json={"internal_auth": False})
    assert idempotent.status_code == 409


def test_reenable_internal_auth_requires_login_again(client):
    client.post("/api/v1/auth/login", json=login_payload())
    client.patch("/api/v1/security", json={"internal_auth": False})

    enabled = client.patch("/api/v1/security", json={"internal_auth": True})

    assert enabled.status_code == 200
    assert enabled.json() == {"internal_auth": True}
    assert client.get("/api/v1/auth/me").status_code == 401

    fresh = client.post("/api/v1/auth/login", json=login_payload())
    assert fresh.status_code == 200


def test_security_change_is_audited(auth_client):
    auth_client.patch("/api/v1/security", json={"internal_auth": True})

    with get_session_factory()() as session:
        events = list(
            session.scalars(
                select(AuditEvent)
                .where(AuditEvent.action == "security_internal_auth")
                .order_by(AuditEvent.id.desc())
            )
        )
        assert events
        assert events[0].detail == "activée"
        assert events[0].username == "admin"
