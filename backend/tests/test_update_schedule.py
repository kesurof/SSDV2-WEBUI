from collections.abc import Iterator
from datetime import datetime, time
from types import SimpleNamespace

import pytest
from sqlalchemy import delete, select

from app.db.models import AuditEvent, Job, Notification
from app.db.session import get_session_factory, init_db
from app.schemas.updates import UpdateEntry, UpdatesOut
from app.services import settings as webui_settings
from app.services import update_schedule
from app.services.update_schedule import UpdateScheduler, next_run, within_window


@pytest.fixture(autouse=True)
def _reset_schedule() -> Iterator[None]:
    init_db()
    with get_session_factory()() as session:
        webui_settings.set_updates_auto(session, enabled=False, start="03:00", end="05:00")
        webui_settings.set_updates_auto_last_run(session, None)
        session.execute(delete(Job).where(Job.created_by == "scheduler"))
        session.execute(delete(Notification).where(Notification.source == "updates"))
        session.execute(delete(AuditEvent).where(AuditEvent.action == "updates_auto"))
        session.commit()
    yield
    with get_session_factory()() as session:
        webui_settings.set_updates_auto(session, enabled=False, start="03:00", end="05:00")
        webui_settings.set_updates_auto_last_run(session, None)
        session.execute(delete(Job).where(Job.created_by == "scheduler"))
        session.execute(delete(Notification).where(Notification.source == "updates"))
        session.execute(delete(AuditEvent).where(AuditEvent.action == "updates_auto"))
        session.commit()


class FakeJobManager:
    def __init__(self) -> None:
        self.submitted: list[tuple[str, str, str | None]] = []

    def submit(self, job_type: str, target: str, created_by: str | None):  # type: ignore[no-untyped-def]
        self.submitted.append((job_type, target, created_by))
        return SimpleNamespace(id=len(self.submitted))


def _snapshot(*entries: tuple[str, str]) -> UpdatesOut:
    return UpdatesOut(
        checked_at=datetime(2026, 10, 30, 3, 0),
        entries=[
            UpdateEntry(
                app=app,
                image=f"example/{app}:latest",
                current_digest="aaaa11112222",
                available_digest="bbbb33334444",
                status=status,  # type: ignore[arg-type]
            )
            for app, status in entries
        ],
        available=sum(1 for _app, status in entries if status == "available"),
    )


def _fixed_clock(value: datetime):
    return lambda: value


def test_within_window_bounds() -> None:
    assert within_window(time(3, 0), time(3, 0), time(5, 0)) is True
    assert within_window(time(4, 59), time(3, 0), time(5, 0)) is True
    assert within_window(time(5, 0), time(3, 0), time(5, 0)) is False
    assert within_window(time(2, 59), time(3, 0), time(5, 0)) is False


def test_next_run_disabled_returns_none() -> None:
    with get_session_factory()() as session:
        assert next_run(session, datetime(2026, 10, 30, 2, 0)) is None


def test_next_run_before_and_after_window() -> None:
    with get_session_factory()() as session:
        webui_settings.set_updates_auto(session, enabled=True, start="03:00", end="05:00")

        assert next_run(session, datetime(2026, 10, 30, 2, 0)) == datetime(2026, 10, 30, 3, 0)
        assert next_run(session, datetime(2026, 10, 30, 6, 0)) == datetime(2026, 10, 31, 3, 0)
        assert next_run(session, datetime(2026, 10, 30, 3, 30)) == datetime(2026, 10, 30, 3, 30)

        webui_settings.set_updates_auto_last_run(session, datetime(2026, 10, 30, 3, 5))
        assert next_run(session, datetime(2026, 10, 30, 4, 0)) == datetime(2026, 10, 31, 3, 0)


def test_tick_runs_once_per_day(monkeypatch) -> None:
    scheduler = UpdateScheduler()
    calls: list[tuple[time, time]] = []
    monkeypatch.setattr(scheduler, "run_once", lambda start, end: calls.append((start, end)))
    monkeypatch.setattr(scheduler, "_queue_busy", lambda: False)
    with get_session_factory()() as session:
        webui_settings.set_updates_auto(session, enabled=True, start="03:00", end="05:00")

    scheduler.tick(datetime(2026, 10, 30, 2, 30))
    assert calls == []

    scheduler.tick(datetime(2026, 10, 30, 3, 30))
    assert calls == [(time(3, 0), time(5, 0))]

    with get_session_factory()() as session:
        webui_settings.set_updates_auto_last_run(session, datetime(2026, 10, 30, 3, 30))
    scheduler.tick(datetime(2026, 10, 30, 4, 0))
    assert calls == [(time(3, 0), time(5, 0))]

    scheduler.tick(datetime(2026, 10, 31, 3, 10))
    assert calls == [(time(3, 0), time(5, 0)), (time(3, 0), time(5, 0))]


def test_tick_ignores_disabled_schedule(monkeypatch) -> None:
    scheduler = UpdateScheduler()
    calls: list[tuple[time, time]] = []
    monkeypatch.setattr(scheduler, "run_once", lambda start, end: calls.append((start, end)))

    scheduler.tick(datetime(2026, 10, 30, 3, 30))
    assert calls == []


def test_run_once_submits_updates_and_excludes_self(monkeypatch) -> None:
    scheduler = UpdateScheduler()
    scheduler._clock = _fixed_clock(datetime(2026, 10, 30, 3, 10))  # type: ignore[method-assign]
    fake_manager = FakeJobManager()
    snapshot = _snapshot(
        ("plex", "available"), ("ssdv2webui", "available"), ("sonarr", "up_to_date")
    )
    monkeypatch.setattr(update_schedule, "job_manager", fake_manager)
    monkeypatch.setattr(update_schedule, "load_app_states", lambda *_args: [])
    monkeypatch.setattr(update_schedule, "build_updates", lambda *_args, **_kwargs: snapshot)
    monkeypatch.setattr(scheduler, "_docker_client", lambda: object())
    monkeypatch.setattr(
        update_schedule.self_update,
        "self_container",
        lambda _client: SimpleNamespace(name="ssdv2webui"),
    )
    monkeypatch.setattr(scheduler, "_wait_for_job", lambda _job_id, _deadline: "success")

    scheduler.run_once(time(3, 0), time(5, 0))

    assert fake_manager.submitted == [("app_update", "plex", "scheduler")]
    with get_session_factory()() as session:
        notification = session.scalar(select(Notification).where(Notification.source == "updates"))
        assert notification is not None
        assert notification.severity == "success"
        assert "1 mise(s) à jour" in (notification.message or "")
        assert webui_settings.updates_auto_last_run(session) is not None


def test_run_once_stops_launching_at_window_end(monkeypatch) -> None:
    scheduler = UpdateScheduler()
    clock = iter(
        [
            datetime(2026, 10, 30, 3, 10),  # mémorisation du démarrage
            datetime(2026, 10, 30, 3, 10),  # premier lancement
            datetime(2026, 10, 30, 5, 1),  # tranche terminée
        ]
    )
    scheduler._clock = lambda: next(clock)  # type: ignore[method-assign]
    fake_manager = FakeJobManager()
    snapshot = _snapshot(("plex", "available"), ("sonarr", "available"))
    monkeypatch.setattr(update_schedule, "job_manager", fake_manager)
    monkeypatch.setattr(update_schedule, "load_app_states", lambda *_args: [])
    monkeypatch.setattr(update_schedule, "build_updates", lambda *_args, **_kwargs: snapshot)
    monkeypatch.setattr(scheduler, "_docker_client", lambda: None)
    monkeypatch.setattr(scheduler, "_wait_for_job", lambda _job_id, _deadline: "success")

    scheduler.run_once(time(3, 0), time(5, 0))

    assert fake_manager.submitted == [("app_update", "plex", "scheduler")]
    with get_session_factory()() as session:
        notification = session.scalar(select(Notification).where(Notification.source == "updates"))
        assert notification is not None
        assert notification.severity == "warning"
        assert "reportée(s)" in (notification.message or "")
        assert "sonarr" in (notification.message or "")


def test_run_once_skips_app_with_pending_job(monkeypatch) -> None:
    scheduler = UpdateScheduler()
    scheduler._clock = _fixed_clock(datetime(2026, 10, 30, 3, 10))  # type: ignore[method-assign]
    fake_manager = FakeJobManager()
    snapshot = _snapshot(("plex", "available"))
    monkeypatch.setattr(update_schedule, "job_manager", fake_manager)
    monkeypatch.setattr(update_schedule, "load_app_states", lambda *_args: [])
    monkeypatch.setattr(update_schedule, "build_updates", lambda *_args, **_kwargs: snapshot)
    monkeypatch.setattr(scheduler, "_docker_client", lambda: None)
    monkeypatch.setattr(scheduler, "_wait_for_job", lambda _job_id, _deadline: "success")
    with get_session_factory()() as session:
        session.add(Job(type="app_update", target="plex", created_by="scheduler"))
        session.commit()

    scheduler.run_once(time(3, 0), time(5, 0))

    assert fake_manager.submitted == []


def test_run_once_scan_failure_remains_retryable(monkeypatch) -> None:
    import docker

    scheduler = UpdateScheduler()
    scheduler._clock = _fixed_clock(datetime(2026, 10, 30, 3, 10))  # type: ignore[method-assign]

    def failing_scan(*_args):
        raise docker.errors.DockerException("registre indisponible")

    monkeypatch.setattr(update_schedule, "load_app_states", failing_scan)
    monkeypatch.setattr(scheduler, "_docker_client", lambda: None)

    assert scheduler.run_once(time(3, 0), time(5, 0)) is False
    assert scheduler._last_scan_failure == datetime(2026, 10, 30, 3, 10)
    with get_session_factory()() as session:
        assert webui_settings.updates_auto_last_run(session) is None
        notification = session.scalar(select(Notification).where(Notification.source == "updates"))
        assert notification is not None
        assert notification.severity == "error"


def test_tick_backs_off_after_scan_failure(monkeypatch) -> None:
    scheduler = UpdateScheduler()
    calls: list[int] = []
    monkeypatch.setattr(scheduler, "run_once", lambda _start, _end: calls.append(1) or False)
    monkeypatch.setattr(scheduler, "_queue_busy", lambda: False)
    with get_session_factory()() as session:
        webui_settings.set_updates_auto(session, enabled=True, start="03:00", end="05:00")

    scheduler._last_scan_failure = datetime(2026, 10, 30, 3, 10)
    scheduler.tick(datetime(2026, 10, 30, 3, 11))
    assert calls == []

    scheduler.tick(datetime(2026, 10, 30, 3, 20))
    assert calls == [1]


def test_run_once_aborts_when_self_container_unknown(monkeypatch) -> None:
    class FakeClient:
        def close(self) -> None:
            pass

    scheduler = UpdateScheduler()
    scheduler._clock = _fixed_clock(datetime(2026, 10, 30, 3, 10))  # type: ignore[method-assign]
    fake_manager = FakeJobManager()
    snapshot = _snapshot(("plex", "available"))
    monkeypatch.setattr(update_schedule, "job_manager", fake_manager)
    monkeypatch.setattr(update_schedule, "load_app_states", lambda *_args: [])
    monkeypatch.setattr(update_schedule, "build_updates", lambda *_args, **_kwargs: snapshot)
    monkeypatch.setattr(scheduler, "_docker_client", lambda: FakeClient())
    monkeypatch.setattr(scheduler, "_self_app_name", lambda _client: None)

    assert scheduler.run_once(time(3, 0), time(5, 0)) is True
    assert fake_manager.submitted == []
    with get_session_factory()() as session:
        notification = session.scalar(select(Notification).where(Notification.source == "updates"))
        assert notification is not None
        assert notification.severity == "warning"
        assert "annulée" in notification.title.lower()
