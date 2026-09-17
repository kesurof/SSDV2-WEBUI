from datetime import datetime

from app.db.models import AuditEvent, Job, Notification


def test_app_history_requires_authentication(client):
    assert client.get("/api/v1/apps/dozzle/history").status_code == 401


def test_app_history_unknown_app(auth_client, write_catalogue):
    write_catalogue("dozzle - Visualisation des logs\n")
    assert auth_client.get("/api/v1/apps/inconnue/history").status_code == 404


def test_app_history_aggregates_sources(auth_client, write_catalogue, settings):
    app = "historytest"
    write_catalogue(f"{app} - Application de test\n")

    from app.db.session import get_session_factory as session_factory

    with session_factory()() as db:
        job = Job(
            type="app_restart",
            target=app,
            status="failed",
            created_by="admin",
            created_at=datetime(2026, 9, 17, 10, 0, 0),
            finished_at=datetime(2026, 9, 17, 10, 1, 0),
        )
        db.add(job)
        db.flush()
        db.add(
            AuditEvent(
                action="app_restart",
                target=app,
                status="failed",
                username="admin",
                created_at=datetime(2026, 9, 17, 10, 1, 0),
            )
        )
        db.add(
            Notification(
                severity="error",
                title="Échec : redémarrage",
                source="jobs",
                link=f"/jobs/{job.id}",
                created_at=datetime(2026, 9, 17, 10, 1, 0),
            )
        )
        db.commit()

    backup_dir = settings.backup_dir / app
    backup_dir.mkdir(parents=True, exist_ok=True)
    archive = backup_dir / f"{app}-20260917-1000.tar.gz"
    archive.write_bytes(b"archive")
    try:
        response = auth_client.get(f"/api/v1/apps/{app}/history")

        assert response.status_code == 200
        body = response.json()
        assert body["app"] == app
        kinds = {event["kind"] for event in body["events"]}
        assert kinds == {"job", "audit", "notification", "backup"}
        assert all(event["at"] for event in body["events"])

        errors = auth_client.get(f"/api/v1/apps/{app}/history?kind=errors")
        assert errors.status_code == 200
        assert errors.json()["events"]

        jobs_only = auth_client.get(f"/api/v1/apps/{app}/history?kind=job")
        assert {event["kind"] for event in jobs_only.json()["events"]} == {"job"}
    finally:
        archive.unlink(missing_ok=True)
        backup_dir.rmdir()
