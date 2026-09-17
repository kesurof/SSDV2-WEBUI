import time

from app.adapters.ssdv2_cli import Ssdv2CtlError
from app.deps import get_ssdv2ctl
from app.main import app
from app.services.jobs import job_manager
from tests.conftest import FakeRunner

TERMINAL = ("success", "failed", "cancelled", "interrupted")


def wait_for_job(client, job_id: int, timeout: float = 5.0) -> dict:
    deadline = time.time() + timeout
    body: dict = {}
    while time.time() < deadline:
        body = client.get(f"/api/v1/jobs/{job_id}").json()
        if body["status"] in TERMINAL:
            return body
        time.sleep(0.05)
    raise AssertionError(f"job {job_id} non terminé: {body}")


def test_auth_apps_requires_authentication(client):
    assert client.get("/api/v1/auth/apps").status_code == 401


def test_auth_apps_lists_values(auth_client):
    runner = FakeRunner(
        payload={
            "schema": 1,
            "count": 2,
            "apps": [{"app": "sonarr", "auth": "authelia"}, {"app": "radarr", "auth": None}],
        }
    )
    app.dependency_overrides[get_ssdv2ctl] = lambda: runner

    response = auth_client.get("/api/v1/auth/apps")

    assert response.status_code == 200
    assert response.json() == [
        {"app": "sonarr", "auth": "authelia"},
        {"app": "radarr", "auth": None},
    ]
    assert runner.calls == [["auth", "list"]]


def test_auth_apps_adapter_failure(auth_client):
    app.dependency_overrides[get_ssdv2ctl] = lambda: FakeRunner(
        error=Ssdv2CtlError("ssdv2ctl_unavailable", "ssdv2ctl introuvable")
    )

    assert auth_client.get("/api/v1/auth/apps").status_code == 503


def test_bulk_auth_creates_job(auth_client):
    runner = FakeRunner(lines=("changement",))
    job_manager.configure(lambda: runner)

    response = auth_client.post(
        "/api/v1/auth/bulk", json={"apps": ["sonarr", "radarr"], "auth": "authelia"}
    )

    assert response.status_code == 202
    job = response.json()
    assert job["type"] == "auth_bulk"
    finished = wait_for_job(auth_client, job["id"])
    assert finished["status"] == "success"
    assert runner.calls == [["auth", "set-many", "authelia", "sonarr", "radarr"]]


def test_bulk_auth_validations(auth_client):
    empty = auth_client.post("/api/v1/auth/bulk", json={"apps": [], "auth": "aucune"})
    assert empty.status_code == 422
    invalid = auth_client.post("/api/v1/auth/bulk", json={"apps": ["sonarr"], "auth": "bidon"})
    assert invalid.status_code == 422
