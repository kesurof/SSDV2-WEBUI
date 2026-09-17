from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

VALID_PAYLOAD = {
    "username": "admin2",
    "password": "motdepasse-tres-long",
    "internal_auth": True,
    "instance_name": "Prod SSDV2",
    "notify_job_success": False,
}


@pytest.fixture
def setup_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    from app.core.config import get_settings
    from app.db.session import get_engine, get_session_factory

    data = tmp_path / "data"
    monkeypatch.setenv("WEBUI_DATA", str(data))
    monkeypatch.delenv("WEBUI_ADMIN_PASSWORD", raising=False)
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    yield data
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


@pytest.fixture
def setup_client(setup_env: Path) -> Iterator[tuple[TestClient, str]]:
    from app.main import app
    from app.services import setup as setup_service

    with TestClient(app) as client:
        token = setup_service.read_setup_token(setup_env)
        assert token
        yield client, token


def test_setup_status_requires_no_auth(setup_client):
    client, _ = setup_client

    response = client.get("/api/v1/setup/status")

    assert response.status_code == 200
    body = response.json()
    assert body["required"] is True
    assert body["instance_name"] == "SSDV2 WebUI"


def test_setup_rejects_wrong_token(setup_client):
    client, _ = setup_client

    response = client.post("/api/v1/setup", json={**VALID_PAYLOAD, "token": "mauvais-jeton"})

    assert response.status_code == 403


def test_setup_validates_password_policy(setup_client):
    client, token = setup_client

    too_short = client.post(
        "/api/v1/setup", json={**VALID_PAYLOAD, "token": token, "password": "court"}
    )
    assert too_short.status_code == 422

    same_as_username = client.post(
        "/api/v1/setup",
        json={
            **VALID_PAYLOAD,
            "token": token,
            "username": "adminadmin12",
            "password": "adminadmin12",
        },
    )
    assert same_as_username.status_code == 422


def test_setup_success_and_closure(setup_client, setup_env):
    client, token = setup_client

    response = client.post("/api/v1/setup", json={**VALID_PAYLOAD, "token": token})

    assert response.status_code == 201
    assert response.json() == {"username": "admin2", "internal_auth": True}

    assert client.get("/api/v1/apps").status_code == 200

    status = client.get("/api/v1/setup/status").json()
    assert status["required"] is False
    assert status["instance_name"] == "Prod SSDV2"

    assert not (setup_env / "setup-token").exists()

    login = client.post(
        "/api/v1/auth/login", json={"username": "admin2", "password": "motdepasse-tres-long"}
    )
    assert login.status_code == 200

    closed = client.post("/api/v1/setup", json={**VALID_PAYLOAD, "token": token})
    assert closed.status_code == 409

    from sqlalchemy import select

    from app.db.models import AuditEvent
    from app.db.session import get_session_factory

    with get_session_factory()() as session:
        events = list(session.scalars(select(AuditEvent).where(AuditEvent.action == "setup")))
        assert events
        assert events[0].username == "admin2"


def test_setup_without_internal_auth(setup_client):
    client, token = setup_client

    response = client.post(
        "/api/v1/setup", json={**VALID_PAYLOAD, "token": token, "internal_auth": False}
    )

    assert response.status_code == 201
    assert response.json() == {"username": "admin2", "internal_auth": False}
    assert client.get("/api/v1/apps").status_code == 200
    assert client.get("/api/v1/security").json() == {"internal_auth": False}
    login = client.post("/api/v1/auth/login", json={"username": "admin2", "password": "x" * 12})
    assert login.status_code == 409


def test_env_bootstrap_completes_setup(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from sqlalchemy import select

    from app.core.config import get_settings
    from app.db.models import User
    from app.db.session import get_engine, get_session_factory, init_db
    from app.main import bootstrap_admin
    from app.services import settings as webui_settings

    data = tmp_path / "data"
    monkeypatch.setenv("WEBUI_DATA", str(data))
    monkeypatch.setenv("WEBUI_ADMIN_PASSWORD", "env-password-long")
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()

    init_db()
    bootstrap_admin()

    with get_session_factory()() as session:
        assert session.scalars(select(User)).first() is not None
        assert webui_settings.setup_required(session) is False

    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
