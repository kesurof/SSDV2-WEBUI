import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from tests.conftest import TEST_ADMIN_PASSWORD, login_payload


@pytest.fixture
def restore_admin_password():
    """Le changement de mot de passe est persistant : on restaure après le test."""

    from app.core.security import hash_password
    from app.db.models import User
    from app.db.session import get_session_factory

    yield
    with get_session_factory()() as session:
        user = session.scalar(select(User).where(User.username == "admin"))
        user.password_hash = hash_password(TEST_ADMIN_PASSWORD)
        session.commit()


def test_me_requires_authentication(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_login_invalid_credentials(client):
    response = client.post("/api/v1/auth/login", json=login_payload("mauvais"))
    assert response.status_code == 401


def test_login_logout_flow(client):
    response = client.post("/api/v1/auth/login", json=login_payload())
    assert response.status_code == 200
    assert response.json() == {
        "username": "admin",
        "internal_auth": True,
        "auth_mode": "internal",
    }
    assert client.get("/api/v1/auth/me").json() == {
        "username": "admin",
        "internal_auth": True,
        "auth_mode": "internal",
    }

    csrf = client.cookies.get("ssdv2_webui_csrf")
    assert csrf

    assert client.post("/api/v1/auth/logout").status_code == 403
    response = client.post("/api/v1/auth/logout", headers={"x-csrf-token": csrf})
    assert response.status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401


def test_login_rate_limited(client):
    for _ in range(5):
        client.post("/api/v1/auth/login", json=login_payload("mauvais"))
    response = client.post("/api/v1/auth/login", json=login_payload("mauvais"))
    assert response.status_code == 429


def test_change_password_requires_authentication(client):
    response = client.post(
        "/api/v1/auth/password",
        json={"current_password": TEST_ADMIN_PASSWORD, "new_password": "nouveau-mot-de-passe"},
    )
    assert response.status_code == 401


def test_change_password_requires_csrf(auth_client):
    response = auth_client.post(
        "/api/v1/auth/password",
        json={"current_password": TEST_ADMIN_PASSWORD, "new_password": "nouveau-mot-de-passe"},
    )
    assert response.status_code == 403


def test_change_password_rejects_wrong_current(auth_client):
    csrf = auth_client.cookies.get("ssdv2_webui_csrf")
    response = auth_client.post(
        "/api/v1/auth/password",
        headers={"x-csrf-token": csrf},
        json={"current_password": "mauvais", "new_password": "nouveau-mot-de-passe"},
    )
    assert response.status_code == 401


def test_change_password_rejects_short_new(auth_client):
    csrf = auth_client.cookies.get("ssdv2_webui_csrf")
    response = auth_client.post(
        "/api/v1/auth/password",
        headers={"x-csrf-token": csrf},
        json={"current_password": TEST_ADMIN_PASSWORD, "new_password": "court"},
    )
    assert response.status_code == 422


def test_change_password_updates_credentials(client, restore_admin_password):
    client.post("/api/v1/auth/login", json=login_payload())
    csrf = client.cookies.get("ssdv2_webui_csrf")

    response = client.post(
        "/api/v1/auth/password",
        headers={"x-csrf-token": csrf},
        json={"current_password": TEST_ADMIN_PASSWORD, "new_password": "nouveau-mot-de-passe"},
    )
    assert response.status_code == 204

    # La session courante reste valide.
    assert client.get("/api/v1/auth/me").status_code == 200

    client.post("/api/v1/auth/logout", headers={"x-csrf-token": csrf})
    assert client.post("/api/v1/auth/login", json=login_payload()).status_code == 401
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "nouveau-mot-de-passe"},
        ).status_code
        == 200
    )


def test_change_password_invalidates_other_sessions(client, restore_admin_password):
    client.post("/api/v1/auth/login", json=login_payload())
    first_csrf = client.cookies.get("ssdv2_webui_csrf")

    with TestClient(client.app) as other:
        other.post("/api/v1/auth/login", json=login_payload())
        assert other.get("/api/v1/auth/me").status_code == 200

        response = client.post(
            "/api/v1/auth/password",
            headers={"x-csrf-token": first_csrf},
            json={"current_password": TEST_ADMIN_PASSWORD, "new_password": "nouveau-mot-de-passe"},
        )
        assert response.status_code == 204

        assert other.get("/api/v1/auth/me").status_code == 401
        assert client.get("/api/v1/auth/me").status_code == 200


def test_change_password_disabled_internal_auth(client, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setenv("WEBUI_TRUST_PROXY", "true")
    get_settings.cache_clear()

    client.post("/api/v1/auth/login", json=login_payload())
    csrf = client.cookies.get("ssdv2_webui_csrf")
    disabled = client.patch("/api/v1/security", json={"mode": "proxy"})
    assert disabled.status_code == 200

    # Mode proxy : l'identité vient de l'en-tête, le mot de passe n'est pas géré ici.
    response = client.post(
        "/api/v1/auth/password",
        headers={"x-csrf-token": csrf, "X-Auth-Request-User": "alice"},
        json={"current_password": TEST_ADMIN_PASSWORD, "new_password": "nouveau-mot-de-passe"},
    )
    assert response.status_code == 409
