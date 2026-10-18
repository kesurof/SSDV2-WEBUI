import pytest
from sqlalchemy import select

from app.adapters.ssdv2_cli import Ssdv2CtlError
from app.db.models import AuditEvent, Job, JobEvent, Notification, utcnow
from app.db.session import get_session_factory, init_db
from app.services.jobs import JobManager, build_job_args
from tests.conftest import FakeStreamingRunner


def test_build_job_args_install() -> None:
    assert build_job_args("app_install", "wallos", {"subdomain": "wallos", "auth": "aucune"}) == [
        "app",
        "install",
        "wallos",
        "--subdomain",
        "wallos",
        "--auth",
        "aucune",
    ]
    assert build_job_args("app_install", "wallos", {}) == [
        "app",
        "install",
        "wallos",
        "--subdomain",
        "wallos",
    ]


def test_build_job_args_remove() -> None:
    assert build_job_args("app_remove", "wallos", {"delete_data": True}) == [
        "app",
        "remove",
        "wallos",
        "--delete-data",
    ]
    assert build_job_args("app_remove", "wallos", {}) == ["app", "remove", "wallos"]


def test_build_job_args_actions() -> None:
    assert build_job_args("app_reinstall", "wallos", {}) == ["app", "reinstall", "wallos"]
    assert build_job_args("app_recreate", "wallos", {}) == ["app", "recreate", "wallos"]
    assert build_job_args("app_backup", "wallos", {}) == ["app", "backup", "wallos"]


def test_build_job_args_auth_bulk() -> None:
    assert build_job_args(
        "auth_bulk", "authelia", {"apps": ["sonarr", "radarr"], "auth": "authelia"}
    ) == ["auth", "set-many", "authelia", "sonarr", "radarr"]


def test_build_job_args_diagnostics() -> None:
    assert build_job_args("diagnostics_rebuild_registries", "diagnostics", {}) == [
        "diagnostics",
        "rebuild-registries",
    ]
    assert build_job_args("diagnostics_cleanup_containers", "diagnostics", {}) == [
        "diagnostics",
        "cleanup-orphan-containers",
    ]
    assert build_job_args("diagnostics_cleanup_volumes", "diagnostics", {}) == [
        "diagnostics",
        "cleanup-dangling-volumes",
    ]


def test_build_job_args_unknown() -> None:
    with pytest.raises(Ssdv2CtlError) as error:
        build_job_args("app_unknown", "wallos", {})
    assert error.value.code == "unknown_job_type"


def make_manager(**runner_kwargs: object) -> tuple[JobManager, FakeStreamingRunner]:
    init_db()
    manager = JobManager()
    runner = FakeStreamingRunner(**runner_kwargs)  # type: ignore[arg-type]
    manager.configure(lambda: runner)
    return manager, runner


def stored_job(job_id: int) -> Job:
    with get_session_factory()() as session:
        job = session.get(Job, job_id)
        assert job is not None
        return job


def stored_events(job_id: int) -> list[str]:
    with get_session_factory()() as session:
        return [
            event.line
            for event in session.scalars(
                select(JobEvent).where(JobEvent.job_id == job_id).order_by(JobEvent.id)
            )
        ]


def test_run_job_success() -> None:
    manager, runner = make_manager(lines=("sortie 1", "sortie 2"))
    job = manager.submit("app_restart", "sonarr", "admin")

    manager.run_job(job.id)

    stored = stored_job(job.id)
    assert stored.status == "success"
    assert stored.exit_code == 0
    assert stored.started_at is not None
    assert stored.finished_at is not None
    assert runner.calls == [["app", "restart", "sonarr"]]
    events = stored_events(job.id)
    assert "sortie 1" in events
    assert events[-1] == "Job terminé (code 0)"


def test_run_job_failure() -> None:
    manager, _ = make_manager(exit_code=1)
    job = manager.submit("app_stop", "sonarr", "admin")

    manager.run_job(job.id)

    stored = stored_job(job.id)
    assert stored.status == "failed"
    assert stored.exit_code == 1
    assert "code 1" in (stored.message or "")


def test_run_job_error() -> None:
    manager, _ = make_manager(error=Ssdv2CtlError("no_containers", "aucun conteneur"))
    job = manager.submit("app_start", "wallos", "admin")

    manager.run_job(job.id)

    stored = stored_job(job.id)
    assert stored.status == "failed"
    assert stored.message == "aucun conteneur"
    assert any("aucun conteneur" in line for line in stored_events(job.id))


def test_run_job_ignores_cancelled() -> None:
    manager, runner = make_manager()
    job = manager.submit("app_restart", "sonarr", "admin")
    with get_session_factory()() as session:
        stored = session.get(Job, job.id)
        assert stored is not None
        stored.status = "cancelled"
        session.commit()

    manager.run_job(job.id)

    assert stored_job(job.id).status == "cancelled"
    assert runner.calls == []


def test_reset_interrupted() -> None:
    manager, _ = make_manager()
    job = manager.submit("app_restart", "sonarr", "admin")
    with get_session_factory()() as session:
        stored = session.get(Job, job.id)
        assert stored is not None
        stored.status = "running"
        stored.started_at = utcnow()
        session.commit()

    manager.reset_interrupted()

    stored = stored_job(job.id)
    assert stored.status == "interrupted"
    assert stored.finished_at is not None


def test_detect_prompt_prefers_marker() -> None:
    from app.services.jobs import _detect_prompt

    marker = 'SSDV2_PROMPT {"id":"x.y","label":"Libellé","kind":"text","secret":false}'
    spec = _detect_prompt(marker)
    assert spec is not None
    assert spec.id == "x.y"
    assert spec.label == "Libellé"


def test_redact_secret_values() -> None:
    manager = JobManager()
    manager._secrets[1] = ["s3cret"]
    assert manager._redact(1, "echo s3cret here") == "echo *** here"
    assert manager._redact(1, "s3") == "s3"
    assert manager._redact(2, "no secret") == "no secret"


def test_run_job_publishes_notification_and_audit() -> None:
    manager, _ = make_manager()
    job = manager.submit("app_backup", "wallos", "admin")

    manager.run_job(job.id)

    with get_session_factory()() as session:
        notification = session.scalars(
            select(Notification).order_by(Notification.id.desc())
        ).first()
        assert notification is not None
        assert notification.severity == "success"
        assert "wallos" in notification.title
        assert notification.link == f"/jobs/{job.id}"

        audit_row = session.scalars(select(AuditEvent).order_by(AuditEvent.id.desc())).first()
        assert audit_row is not None
        assert audit_row.action == "app_backup"
        assert audit_row.status == "success"
        assert audit_row.username == "admin"
        assert audit_row.target == "wallos"


def test_run_job_failure_publishes_error_notification() -> None:
    manager, _ = make_manager(exit_code=1)
    job = manager.submit("app_remove", "wallos", "admin")

    manager.run_job(job.id)

    with get_session_factory()() as session:
        notification = session.scalars(
            select(Notification).order_by(Notification.id.desc())
        ).first()
        assert notification is not None
        assert notification.severity == "error"
        assert "wallos" in notification.title


def test_run_job_actions_do_not_notify() -> None:
    manager, _ = make_manager()
    with get_session_factory()() as session:
        before = session.scalars(select(Notification)).all()
    job = manager.submit("app_restart", "sonarr", "admin")

    manager.run_job(job.id)

    with get_session_factory()() as session:
        after = session.scalars(select(Notification)).all()
        assert len(after) == len(before)


def make_auth_manager(payload: dict, settings, monkeypatch) -> tuple[JobManager, object]:
    import docker

    init_db()
    manager = JobManager()

    class AuthRunner:
        def __init__(self) -> None:
            self.settings = settings
            self.calls: list[list[str]] = []

        def run(self, args, timeout=None) -> dict:
            self.calls.append(args)
            return payload

        def run_streaming(self, args, on_line, timeout=None) -> int:
            self.calls.append(args)
            return 0

    runner = AuthRunner()
    manager.configure(lambda: runner)

    class FakeContainers:
        @staticmethod
        def get(name: str):
            raise docker.errors.NotFound(name)

    class FakeClient:
        containers = FakeContainers()

    monkeypatch.setattr(manager, "_docker_client", lambda: FakeClient())
    return manager, runner


def test_run_job_auth_bulk_applies_label_only(settings, monkeypatch) -> None:
    manager, runner = make_auth_manager(
        {
            "results": [
                {"app": "sonarr", "changed": True, "error": None},
                {"app": "radarr", "changed": False, "error": None},
            ]
        },
        settings,
        monkeypatch,
    )
    job = manager.submit(
        "auth_bulk",
        "aucune",
        "admin",
        {"apps": ["sonarr", "radarr"], "auth": "aucune"},
    )

    manager.run_job(job.id)

    assert stored_job(job.id).status == "success"
    assert runner.calls == [
        ["auth", "set-many", "aucune", "sonarr", "radarr"],
        ["auth", "apply", "sonarr"],
    ]
    events = stored_events(job.id)
    assert any("radarr" in line and "déjà à jour" in line for line in events)
    assert not any("Recréation" in line for line in events)


def test_run_job_auth_bulk_reports_partial_failure(settings, monkeypatch) -> None:
    manager, runner = make_auth_manager(
        {
            "results": [
                {"app": "sonarr", "changed": True, "error": None},
                {"app": "lidarr", "changed": False, "error": "n'est pas installé"},
            ]
        },
        settings,
        monkeypatch,
    )
    job = manager.submit(
        "auth_bulk",
        "authelia",
        "admin",
        {"apps": ["sonarr", "lidarr"], "auth": "authelia"},
    )

    manager.run_job(job.id)

    stored = stored_job(job.id)
    assert stored.status == "failed"
    assert "lidarr" in (stored.message or "")
    assert any("lidarr" in line and "pas installé" in line for line in stored_events(job.id))
    assert ["auth", "apply", "sonarr"] in runner.calls


def test_run_job_auth_bulk_blocks_self(settings, monkeypatch) -> None:
    init_db()
    manager = JobManager()

    class AuthRunner:
        def __init__(self) -> None:
            self.settings = settings
            self.calls: list[list[str]] = []

        def run(self, args, timeout=None) -> dict:
            self.calls.append(args)
            return {"results": [{"app": "ssdv2webui", "changed": True, "error": None}]}

        def run_streaming(self, args, on_line, timeout=None) -> int:
            self.calls.append(args)
            return 0

    runner = AuthRunner()
    manager.configure(lambda: runner)

    class SelfContainer:
        name = "ssdv2webui"

    class FakeContainers:
        @staticmethod
        def get(name: str):
            return SelfContainer()

    class FakeClient:
        containers = FakeContainers()

    monkeypatch.setattr(manager, "_docker_client", lambda: FakeClient())

    job = manager.submit("auth_bulk", "aucune", "admin", {"apps": ["ssdv2webui"], "auth": "aucune"})
    manager.run_job(job.id)

    assert stored_job(job.id).status == "failed"
    assert all(call[:3] != ["auth", "apply", "ssdv2webui"] for call in runner.calls)
    assert any("ssdv2webui" in line for line in stored_events(job.id))


def test_run_job_app_update_invokes_ssdv2ctl(settings, monkeypatch) -> None:
    import docker

    init_db()
    manager = JobManager()

    class UpdateRunner:
        def __init__(self) -> None:
            self.settings = settings
            self.calls: list[list[str]] = []

        def run(self, args, timeout=None) -> dict:
            self.calls.append(args)
            return {}

        def run_streaming(self, args, on_line, timeout=None) -> int:
            self.calls.append(args)
            return 0

    runner = UpdateRunner()
    manager.configure(lambda: runner)

    class FakeContainers:
        @staticmethod
        def get(name: str):
            raise docker.errors.NotFound(name)

    class FakeClient:
        containers = FakeContainers()

    monkeypatch.setattr(manager, "_docker_client", lambda: FakeClient())

    job = manager.submit("app_update", "plex", "admin")
    manager.run_job(job.id)

    assert stored_job(job.id).status == "success"
    assert runner.calls == [["app", "update", "plex"]]
