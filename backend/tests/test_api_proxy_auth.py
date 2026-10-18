from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> Iterator[None]:
    yield
    get_settings.cache_clear()


def _client(host: str) -> TestClient:
    from app.main import app

    return TestClient(app, client=(host, 50000))


@pytest.fixture
def proxy_mode(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("WEBUI_AUTH_MODE", "proxy")
    monkeypatch.setenv("WEBUI_TRUSTED_PROXIES", "172.18.0.0/16,10.1.2.3")
    get_settings.cache_clear()
    yield


def test_proxy_accepts_trusted_identity(proxy_mode: None) -> None:
    with _client("172.18.0.5") as client:
        response = client.get("/api/v1/auth/me", headers={"X-Auth-Request-User": "alice"})
    assert response.status_code == 200
    assert response.json() == {
        "username": "alice",
        "internal_auth": False,
        "auth_mode": "proxy",
    }


def test_proxy_fail_closed_without_header(proxy_mode: None) -> None:
    with _client("172.18.0.5") as client:
        assert client.get("/api/v1/auth/me").status_code == 401


def test_proxy_fail_closed_untrusted_source(proxy_mode: None) -> None:
    with _client("8.8.8.8") as client:
        response = client.get("/api/v1/auth/me", headers={"X-Auth-Request-User": "alice"})
    assert response.status_code == 401


def test_proxy_ignores_other_identity_headers(proxy_mode: None) -> None:
    # Seul l'en-tête configuré est lu : forger X-Forwarded-User/Remote-User ne suffit pas.
    with _client("172.18.0.5") as client:
        response = client.get(
            "/api/v1/auth/me",
            headers={"X-Forwarded-User": "admin", "Remote-User": "admin"},
        )
    assert response.status_code == 401


def test_proxy_identity_header_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("WEBUI_AUTH_MODE", "proxy")
    monkeypatch.setenv("WEBUI_TRUSTED_PROXIES", "172.18.0.0/16")
    monkeypatch.setenv("WEBUI_PROXY_IDENTITY_HEADER", "X-Forwarded-User")
    get_settings.cache_clear()
    with _client("172.18.0.5") as client:
        response = client.get("/api/v1/auth/me", headers={"X-Forwarded-User": "bob"})
    assert response.status_code == 200
    assert response.json()["username"] == "bob"


def test_legacy_none_environment_requires_internal_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("WEBUI_AUTH_MODE", "none")
    get_settings.cache_clear()
    with _client("203.0.113.9") as client:
        assert client.get("/api/v1/auth/me").status_code == 401


def test_security_env_lock(monkeypatch: pytest.MonkeyPatch, auth_client: TestClient) -> None:
    monkeypatch.setenv("WEBUI_AUTH_MODE", "internal")
    get_settings.cache_clear()
    body = auth_client.get("/api/v1/security").json()
    assert body["mode"] == "internal"
    assert body["mode_source"] == "env"
    response = auth_client.patch("/api/v1/security", json={"mode": "proxy"})
    assert response.status_code == 409


def test_security_rejects_unknown_mode(auth_client: TestClient) -> None:
    assert auth_client.patch("/api/v1/security", json={"mode": "none"}).status_code == 422
    assert auth_client.get("/api/v1/auth/me").json()["auth_mode"] == "internal"
