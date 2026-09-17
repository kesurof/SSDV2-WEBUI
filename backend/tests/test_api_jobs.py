import json
import time

from app.db.models import Job
from app.db.session import get_session_factory
from app.services.jobs import job_manager
from tests.conftest import FakeStreamingRunner

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


def test_jobs_requires_authentication(client):
    assert client.get("/api/v1/jobs").status_code == 401
    assert client.get("/api/v1/jobs/1").status_code == 401


def test_app_action_creates_job(auth_client, write_catalogue):
    write_catalogue("sonarr - Gestion Séries\n")
    runner = FakeStreamingRunner(lines=("action en cours", "terminé"))
    job_manager.configure(lambda: runner)

    response = auth_client.post("/api/v1/apps/sonarr/restart")

    assert response.status_code == 202
    job = response.json()
    assert job["type"] == "app_restart"
    assert job["target"] == "sonarr"
    assert job["status"] in ("queued", "running", "success")

    finished = wait_for_job(auth_client, job["id"])
    assert finished["status"] == "success"
    assert runner.calls == [["app", "restart", "sonarr"]]

    events = auth_client.get(f"/api/v1/jobs/{job['id']}").json()
    assert events["exit_code"] == 0


def test_app_action_unknown_app(auth_client, write_catalogue):
    write_catalogue("wallos - Budget\n")

    assert auth_client.post("/api/v1/apps/sonarr/start").status_code == 404


def test_job_events_stream(auth_client, write_catalogue):
    write_catalogue("sonarr - Gestion Séries\n")
    job_manager.configure(lambda: FakeStreamingRunner(lines=("ligne de job",)))

    response = auth_client.post("/api/v1/apps/sonarr/start")
    job_id = response.json()["id"]
    wait_for_job(auth_client, job_id)

    with auth_client.stream("GET", f"/api/v1/jobs/{job_id}/events") as stream:
        assert stream.status_code == 200
        body = "".join(stream.iter_text())

    assert "ligne de job" in body
    assert '{"status": "success", "done": true}' in body


def test_job_events_unknown_job(auth_client):
    assert auth_client.get("/api/v1/jobs/99999/events").status_code == 404


def test_cancel_queued_job(auth_client, write_catalogue):
    write_catalogue("sonarr - Gestion Séries\n")
    with get_session_factory()() as session:
        job = Job(type="app_restart", target="sonarr", status="queued", created_by="admin")
        session.add(job)
        session.commit()
        session.refresh(job)
        job_id = job.id

    response = auth_client.post(f"/api/v1/jobs/{job_id}/cancel")

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


def test_cancel_finished_job_conflicts(auth_client, write_catalogue):
    write_catalogue("sonarr - Gestion Séries\n")
    job_manager.configure(lambda: FakeStreamingRunner())

    response = auth_client.post("/api/v1/apps/sonarr/stop")
    job_id = response.json()["id"]
    wait_for_job(auth_client, job_id)

    conflict = auth_client.post(f"/api/v1/jobs/{job_id}/cancel")

    assert conflict.status_code == 409


def test_list_jobs(auth_client, write_catalogue):
    write_catalogue("sonarr - Gestion Séries\n")
    job_manager.configure(lambda: FakeStreamingRunner())
    auth_client.post("/api/v1/apps/sonarr/restart")

    response = auth_client.get("/api/v1/jobs")

    assert response.status_code == 200
    jobs = response.json()
    assert jobs
    assert json.dumps(jobs[0])  # sérialisable
    assert jobs[0]["target"] == "sonarr"
