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
    assert body["checks"]["stale_apps"] == ["appname"]
    assert body["checks"]["dangling_volumes"] == 2
    assert runner.calls == [["diagnostics", "run"]]


def test_diagnostics_stale_apps_excludes_apps_with_containers(
    auth_client, write_registry, fake_containers
):
    from tests.conftest import FakeContainer

    payload = {
        "schema": 1,
        "checks": {
            "missing_registries": ["sonarr", "hermes"],
            "orphan_containers": [],
            "dangling_volumes": 0,
        },
        "warnings": [],
    }
    app.dependency_overrides[get_ssdv2ctl] = lambda: FakeRunner(payload=payload)
    write_registry("sonarr", "containers", ["sonarr"])
    fake_containers.append(FakeContainer(name="sonarr"))

    response = auth_client.get("/api/v1/diagnostics")

    assert response.json()["checks"]["stale_apps"] == ["hermes"]


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


def test_purge_apps_submits_job(auth_client, settings):
    from tests.conftest import FakeBashRunner

    runner = FakeBashRunner(settings=settings)
    job_manager.configure_bash(lambda: runner)

    response = auth_client.post(
        "/api/v1/diagnostics/purge-apps",
        json={"apps": ["hermes", "webtop"], "delete_data": False},
    )

    assert response.status_code == 202
    job = response.json()
    assert job["type"] == "diagnostics_purge_apps"
    assert wait_for_job(auth_client, job["id"])["status"] == "success"
    assert runner.calls == [
        ("suppression_appli", ["hermes", "0"]),
        ("suppression_appli", ["webtop", "0"]),
    ]


def test_purge_apps_delete_data(auth_client, settings):
    from tests.conftest import FakeBashRunner

    runner = FakeBashRunner(settings=settings)
    job_manager.configure_bash(lambda: runner)

    response = auth_client.post(
        "/api/v1/diagnostics/purge-apps",
        json={"apps": ["hermes"], "delete_data": True},
    )
    wait_for_job(auth_client, response.json()["id"])

    assert runner.calls == [("suppression_appli", ["hermes", "1"])]


def test_purge_apps_rejects_apps_with_containers(auth_client, fake_containers):
    from tests.conftest import FakeContainer

    fake_containers.append(FakeContainer(name="plex"))

    response = auth_client.post(
        "/api/v1/diagnostics/purge-apps", json={"apps": ["plex"], "delete_data": False}
    )

    assert response.status_code == 409
    assert "plex" in response.json()["detail"]


def test_purge_apps_rejects_invalid_name(auth_client):
    response = auth_client.post(
        "/api/v1/diagnostics/purge-apps", json={"apps": ["Bad Name"], "delete_data": False}
    )
    assert response.status_code == 422
