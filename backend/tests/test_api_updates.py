from collections.abc import Iterator

import pytest
from sqlalchemy import delete, select

from app.db.models import AuditEvent, Notification
from app.db.session import get_session_factory, init_db
from app.services import settings as webui_settings


@pytest.fixture(autouse=True)
def _reset_schedule() -> Iterator[None]:
    init_db()
    with get_session_factory()() as session:
        webui_settings.set_updates_auto(session, enabled=False, start="03:00", end="05:00")
        webui_settings.set_updates_auto_last_run(session, None)
        session.execute(delete(AuditEvent).where(AuditEvent.action == "updates_schedule"))
        session.execute(delete(Notification).where(Notification.source == "updates"))
        session.commit()
    yield
    with get_session_factory()() as session:
        webui_settings.set_updates_auto(session, enabled=False, start="03:00", end="05:00")
        webui_settings.set_updates_auto_last_run(session, None)
        session.execute(delete(AuditEvent).where(AuditEvent.action == "updates_schedule"))
        session.execute(delete(Notification).where(Notification.source == "updates"))
        session.commit()


def test_schedule_requires_authentication(client):
    assert client.get("/api/v1/updates/schedule").status_code == 401
    assert (
        client.patch(
            "/api/v1/updates/schedule",
            json={"enabled": True, "start": "03:00", "end": "05:00"},
        ).status_code
        == 401
    )


def test_schedule_defaults(auth_client):
    response = auth_client.get("/api/v1/updates/schedule")

    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is False
    assert body["start"] == "03:00"
    assert body["end"] == "05:00"
    assert body["timezone"]
    assert body["last_run_at"] is None
    assert body["next_run_at"] is None


def test_schedule_round_trip_and_audit(auth_client):
    response = auth_client.patch(
        "/api/v1/updates/schedule",
        json={"enabled": True, "start": "01:30", "end": "02:30"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is True
    assert body["start"] == "01:30"
    assert body["end"] == "02:30"
    assert body["next_run_at"] is not None

    stored = auth_client.get("/api/v1/updates/schedule").json()
    assert stored["enabled"] is True
    assert stored["start"] == "01:30"

    with get_session_factory()() as session:
        event = session.scalar(select(AuditEvent).where(AuditEvent.action == "updates_schedule"))
        assert event is not None
        assert event.status == "success"
        assert "01:30" in (event.detail or "")


def test_schedule_can_be_disabled(auth_client):
    auth_client.patch(
        "/api/v1/updates/schedule",
        json={"enabled": True, "start": "01:30", "end": "02:30"},
    )

    response = auth_client.patch(
        "/api/v1/updates/schedule",
        json={"enabled": False, "start": "01:30", "end": "02:30"},
    )

    assert response.status_code == 200
    assert response.json()["enabled"] is False
    assert response.json()["next_run_at"] is None


@pytest.mark.parametrize(
    "payload",
    [
        {"enabled": True, "start": "25:00", "end": "26:00"},
        {"enabled": True, "start": "3:00", "end": "05:00"},
        {"enabled": True, "start": "05:00", "end": "03:00"},
        {"enabled": True, "start": "03:00", "end": "03:00"},
        {"enabled": True, "start": "03:00"},
        {"enabled": True, "start": 300, "end": "05:00"},
    ],
)
def test_schedule_rejects_invalid_window(auth_client, payload):
    response = auth_client.patch("/api/v1/updates/schedule", json=payload)

    assert response.status_code == 422
