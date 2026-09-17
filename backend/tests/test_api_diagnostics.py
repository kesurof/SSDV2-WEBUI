import time

from app.adapters.ssdv2_cli import Ssdv2CtlError
from app.deps import get_ssdv2ctl
from app.main import app
from app.services.jobs import job_manager
from tests.conftest import FakeStreamingRunner

PAYLOAD = {
    "schema": 1,
    "checks": {
        "missing_registries": ["appname"],
        "orphan_containers": [],
        "dangling_volumes": 2,
    },
    "warnings": [],
}


class FakeRunner:
    def __init__(self, payload=None, error=None) -> None:
        self.payload = payload
        self.error = error
        self.calls: list[list[str]] = []

    def run(self, args, timeout=None):
        self.calls.append(args)
        if self.error is not None:
            raise self.error
        return self.payload


def test_diagnostics_requires_authentication(client):
    assert client.get("/api/v1/diagnostics").status_code == 401


def test_diagnostics_returns_checks(auth_client):
    runner = FakeRunner(payload=PAYLOAD)
    app.dependency_overrides[get_ssdv2ctl] = lambda: runner

    response = auth_client.get("/api/v1/diagnostics")

    assert response.status_code == 200
    body = response.json()
    assert body["schema"] == 1
    assert body["checks"]["missing_registries"] == ["appname"]
    assert body["checks"]["dangling_volumes"] == 2
    assert runner.calls == [["diagnostics", "run"]]


def test_diagnostics_unavailable(auth_client):
    app.dependency_overrides[get_ssdv2ctl] = lambda: FakeRunner(
        error=Ssdv2CtlError("ssdv2ctl_unavailable", "ssdv2ctl introuvable")
    )

    response = auth_client.get("/api/v1/diagnostics")

    assert response.status_code == 503


def test_diagnostics_command_failure(auth_client):
    app.dependency_overrides[get_ssdv2ctl] = lambda: FakeRunner(
        error=Ssdv2CtlError("ssddb_unavailable", "ssddb illisible")
    )

    response = auth_client.get("/api/v1/diagnostics")

    assert response.status_code == 502


def wait_for_job(client, job_id: int, timeout: float = 5.0) -> dict:
    deadline = time.time() + timeout
    body: dict = {}
    while time.time() < deadline:
        body = client.get(f"/api/v1/jobs/{job_id}").json()
        if body["status"] in ("success", "failed", "cancelled", "interrupted"):
            return body
        time.sleep(0.05)
    raise AssertionError(f"job {job_id} non terminé: {body}")


def test_diagnostics_repair_jobs(auth_client):
    runner = FakeStreamingRunner(lines=("réparation",))
    job_manager.configure(lambda: runner)

    cases = {
        "rebuild-registries": "diagnostics_rebuild_registries",
        "cleanup-orphan-containers": "diagnostics_cleanup_containers",
        "cleanup-dangling-volumes": "diagnostics_cleanup_volumes",
    }
    for action, job_type in cases.items():
        response = auth_client.post(f"/api/v1/diagnostics/{action}")
        assert response.status_code == 202
        body = response.json()
        assert body["type"] == job_type
        assert body["target"] == "diagnostics"
        assert wait_for_job(auth_client, body["id"])["status"] == "success"

    assert runner.calls == [
        ["diagnostics", "rebuild-registries"],
        ["diagnostics", "cleanup-orphan-containers"],
        ["diagnostics", "cleanup-dangling-volumes"],
    ]
