import json
import logging
import queue
import threading
from collections.abc import Callable

from sqlalchemy import select, update

from app.adapters.ssdv2_cli import Ssdv2CtlError, Ssdv2CtlRunner
from app.db.models import Job, JobEvent, utcnow
from app.db.session import get_session_factory
from app.services import audit, notifications
from app.services import settings as webui_settings

logger = logging.getLogger(__name__)

TERMINAL_STATUSES = ("success", "failed", "cancelled", "interrupted")

JOB_LABELS = {
    "app_install": "Installation",
    "app_remove": "Suppression",
    "app_reinstall": "Réinstallation",
    "app_recreate": "Recréation",
    "app_backup": "Sauvegarde",
    "auth_bulk": "Changement d'authentification",
    "app_start": "Démarrage",
    "app_stop": "Arrêt",
    "app_restart": "Redémarrage",
    "diagnostics_rebuild_registries": "Régénération des registres",
    "diagnostics_cleanup_containers": "Nettoyage des conteneurs orphelins",
    "diagnostics_cleanup_volumes": "Nettoyage des volumes orphelins",
}

NOTIFY_JOB_TYPES = (
    "app_install",
    "app_remove",
    "app_reinstall",
    "app_recreate",
    "app_backup",
    "auth_bulk",
)

JOB_TYPE_ACTIONS = {
    "app_start": "start",
    "app_stop": "stop",
    "app_restart": "restart",
    "app_reinstall": "reinstall",
    "app_recreate": "recreate",
    "app_backup": "backup",
}

DIAGNOSTICS_JOBS = {
    "diagnostics_rebuild_registries": "rebuild-registries",
    "diagnostics_cleanup_containers": "cleanup-orphan-containers",
    "diagnostics_cleanup_volumes": "cleanup-dangling-volumes",
}

ACTION_TIMEOUTS = {
    "app_start": 600,
    "app_stop": 600,
    "app_restart": 600,
    "app_install": 1800,
    "app_remove": 900,
    "app_reinstall": 1800,
    "app_recreate": 1800,
    "app_backup": 1800,
    "auth_bulk": 900,
    "diagnostics_rebuild_registries": 900,
    "diagnostics_cleanup_containers": 600,
    "diagnostics_cleanup_volumes": 600,
}

DEFAULT_TIMEOUT = 600


def build_job_args(job_type: str, target: str, params: dict) -> list[str]:
    if job_type in DIAGNOSTICS_JOBS:
        return ["diagnostics", DIAGNOSTICS_JOBS[job_type]]
    if job_type == "auth_bulk":
        apps = [str(app) for app in params.get("apps", [])]
        return ["auth", "set-many", str(params.get("auth", "")), *apps]
    if job_type == "app_install":
        args = ["app", "install", target, "--subdomain", str(params.get("subdomain") or target)]
        if params.get("auth"):
            args += ["--auth", str(params["auth"])]
        return args
    if job_type == "app_remove":
        args = ["app", "remove", target]
        if params.get("delete_data"):
            args.append("--delete-data")
        return args
    action = JOB_TYPE_ACTIONS.get(job_type)
    if action is None:
        raise Ssdv2CtlError("unknown_job_type", f"type de job inconnu: {job_type}")
    return ["app", action, target]


DIAGNOSTICS_JOB_TYPES = {
    "rebuild-registries": "diagnostics_rebuild_registries",
    "cleanup-orphan-containers": "diagnostics_cleanup_containers",
    "cleanup-dangling-volumes": "diagnostics_cleanup_volumes",
}


class JobManager:
    def __init__(self) -> None:
        self._queue: queue.Queue[int] = queue.Queue()
        self._thread: threading.Thread | None = None
        self._stopping = threading.Event()
        self._runner_provider: Callable[[], Ssdv2CtlRunner] | None = None

    def configure(self, runner_provider: Callable[[], Ssdv2CtlRunner]) -> None:
        self._runner_provider = runner_provider

    def reset_interrupted(self) -> None:
        with get_session_factory()() as session:
            session.execute(
                update(Job)
                .where(Job.status.in_(("queued", "running")))
                .values(status="interrupted", finished_at=utcnow())
            )
            session.commit()

    def start(self) -> None:
        if self._thread is not None:
            return
        self._stopping.clear()
        self._thread = threading.Thread(target=self._loop, name="ssdv2-webui-jobs", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stopping.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None

    def submit(
        self, job_type: str, target: str, created_by: str | None, params: dict | None = None
    ) -> Job:
        with get_session_factory()() as session:
            job = Job(
                type=job_type,
                target=target,
                created_by=created_by,
                params=json.dumps(params, ensure_ascii=False) if params else None,
            )
            session.add(job)
            session.commit()
            session.refresh(job)
            job_id = job.id
        self._queue.put(job_id)
        return job

    def _loop(self) -> None:
        while not self._stopping.is_set():
            try:
                job_id = self._queue.get(timeout=0.5)
            except queue.Empty:
                continue
            try:
                self.run_job(job_id)
            except Exception:
                logger.exception("échec inattendu du job %s", job_id)

    def _add_event(self, job_id: int, line: str) -> None:
        with get_session_factory()() as session:
            session.add(JobEvent(job_id=job_id, line=line))
            session.commit()

    def run_job(self, job_id: int) -> None:
        with get_session_factory()() as session:
            job = session.get(Job, job_id)
            if job is None or job.status != "queued":
                return
            job.status = "running"
            job.started_at = utcnow()
            session.commit()
            job_type = job.type
            target = job.target
            params = json.loads(job.params) if job.params else {}

        exit_code: int | None = None
        message: str | None = None
        try:
            if self._runner_provider is None:
                raise Ssdv2CtlError("jobs_unavailable", "gestionnaire de jobs non configuré")
            args = build_job_args(job_type, target, params)
            timeout = ACTION_TIMEOUTS.get(job_type, DEFAULT_TIMEOUT)
            self._add_event(job_id, f"Job {job_type} sur {target} démarré")
            runner = self._runner_provider()
            exit_code = runner.run_streaming(
                args, lambda line: self._add_event(job_id, line), timeout
            )
            if exit_code == 0:
                status = "success"
            else:
                status = "failed"
                message = f"ssdv2ctl a retourné le code {exit_code}"
            self._add_event(job_id, f"Job terminé (code {exit_code})")
        except Ssdv2CtlError as exc:
            status = "failed"
            message = exc.message
            self._add_event(job_id, f"Échec : {exc.message}")
        except Exception as exc:
            logger.exception("job %s en échec", job_id)
            status = "failed"
            message = str(exc)
            self._add_event(job_id, f"Échec inattendu : {exc}")

        with get_session_factory()() as session:
            job = session.get(Job, job_id)
            if job is not None and job.status == "running":
                job.status = status
                job.exit_code = exit_code
                job.message = message
                job.finished_at = utcnow()
                session.commit()
                finished = {
                    "username": job.created_by,
                    "type": job.type,
                    "target": job.target,
                    "message": job.message,
                }
            else:
                finished = None

        if finished is not None:
            self._publish_outcome(job_id, status, finished)

    def _publish_outcome(self, job_id: int, status: str, finished: dict) -> None:
        job_type = finished["type"]
        target = finished["target"]
        label = JOB_LABELS.get(job_type, job_type)
        audit.record(
            action=job_type,
            status=status,
            username=finished["username"],
            target=target,
            detail=finished["message"],
        )
        if status == "failed":
            notifications.create_notification(
                severity="error",
                title=f"Échec : {label} {target}",
                message=finished["message"],
                source="jobs",
                link=f"/jobs/{job_id}",
            )
        elif status == "success" and job_type in NOTIFY_JOB_TYPES:
            with get_session_factory()() as session:
                if not webui_settings.notify_job_success_enabled(session):
                    return
            notifications.create_notification(
                severity="success",
                title=f"{label} terminée : {target}",
                message=None,
                source="jobs",
                link=f"/jobs/{job_id}",
            )

    def events_after(self, job_id: int, last_id: int) -> tuple[list[JobEvent], Job | None]:
        with get_session_factory()() as session:
            events = list(
                session.scalars(
                    select(JobEvent)
                    .where(JobEvent.job_id == job_id, JobEvent.id > last_id)
                    .order_by(JobEvent.id)
                )
            )
            job = session.get(Job, job_id)
            return events, job


job_manager = JobManager()
