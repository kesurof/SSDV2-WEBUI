from app.adapters.ssdv2_cli import Ssdv2CtlError
from app.deps import get_ssdv2ctl
from app.main import app
from tests.conftest import FakeRunner


def test_config_requires_authentication(client):
    assert client.get("/api/v1/config").status_code == 401


def test_config_returns_values(auth_client):
    runner = FakeRunner(
        payload={
            "schema": 1,
            "config": {"user.domain": "example.com", "rclone.remote": None},
        }
    )
    app.dependency_overrides[get_ssdv2ctl] = lambda: runner

    response = auth_client.get("/api/v1/config")

    assert response.status_code == 200
    body = response.json()
    assert body["schema"] == 1
    assert body["config"]["user.domain"] == "example.com"
    assert body["config"]["rclone.remote"] is None
    assert runner.calls == [["config", "list"]]


def test_config_adapter_failure(auth_client):
    app.dependency_overrides[get_ssdv2ctl] = lambda: FakeRunner(
        error=Ssdv2CtlError("ssdv2ctl_failed", "échec")
    )

    assert auth_client.get("/api/v1/config").status_code == 502
