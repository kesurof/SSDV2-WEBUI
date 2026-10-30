import logging
import os
import socket
import threading
from collections.abc import Callable
from datetime import datetime, time, timedelta

import docker
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Job
from app.db.session import get_session_factory
from app.services import audit, notifications, self_update
from app.services import settings as webui_settings
from app.services.app_overview import load_app_states
from app.services.jobs import ACTION_TIMEOUTS, DEFAULT_TIMEOUT, TERMINAL_STATUSES, job_manager
from app.services.updates import build_updates

logger = logging.getLogger(__name__)

SCHEDULER_USER = "scheduler"
POLL_INTERVAL = 30.0
JOB_POLL_INTERVAL = 5.0
DEFAULT_START = time(3, 0)
DEFAULT_END = time(5, 0)
SCAN_RETRY_DELAY = timedelta(minutes=5)


def parse_hhmm(value: str, default: time) -> time:
    try:
        hour, minute = value.split(":", 1)
        return time(hour=int(hour), minute=int(minute))
    except (AttributeError, TypeError, ValueError):
        return default


def within_window(current: time, start: time, end: time) -> bool:
    return start <= current < end


def server_timezone() -> str:
    name = os.environ.get("TZ")
    if name:
        return name
    return datetime.now().astimezone().tzname() or "UTC"


def container_app_name(container: docker.models.containers.Container) -> str:
    """Nom d'application SSDV2 (label) plutôt que nom de conteneur, pour l'exclusion."""
    labels = getattr(container, "labels", None) or {}
    return labels.get("ssdv2.app") or container.name


def next_run(db: Session, now: datetime | None = None) -> datetime | None:
    """Prochaine exécution prévue, dans l'heure locale du serveur, ou None si désactivé."""
    if not webui_settings.updates_auto_enabled(db):
        return None
    reference = now or datetime.now()
    start_value, end_value = webui_settings.updates_auto_window(db)
    start = parse_hhmm(start_value, DEFAULT_START)
    end = parse_hhmm(end_value, DEFAULT_END)
    last_run = webui_settings.updates_auto_last_run(db)
    today_start = datetime.combine(reference.date(), start)
    if last_run is not None and last_run.date() >= reference.date():
        return today_start + timedelta(days=1)
    if reference < today_start:
        return today_start
    if reference.time() < end:
        # La tranche est ouverte et l'exécution du jour n'a pas encore eu lieu :
        # le planificateur la déclenchera au prochain passage.
        return reference.replace(microsecond=0)
    return today_start + timedelta(days=1)


class UpdateScheduler:
    """Déclenche une fois par jour les mises à jour image seule dans une tranche horaire.

    Le worker de jobs reste le seul exécutant : ce planificateur se contente de scanner
    les digests puis de soumettre les jobs un par un, en s'arrêtant à la fin de la
    tranche. Une exécution interrompue n'est pas reprise le même jour.
    """

    def __init__(self) -> None:
        self._thread: threading.Thread | None = None
        self._stopping = threading.Event()
        self._clock: Callable[[], datetime] = datetime.now
        self._last_scan_failure: datetime | None = None
        self.poll_interval = POLL_INTERVAL
        self.job_poll_interval = JOB_POLL_INTERVAL

    def start(self) -> None:
        if self._thread is not None:
            return
        self._stopping.clear()
        self._thread = threading.Thread(target=self._loop, name="ssdv2-webui-updates", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stopping.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
            if not self._thread.is_alive():
                self._thread = None

    def _loop(self) -> None:
        while not self._stopping.is_set():
            # Attendre un cycle avant le premier passage : le démarrage de l'application
            # n'est pas bloqué et les tests disposent d'une fenêtre déterministe.
            self._stopping.wait(self.poll_interval)
            if self._stopping.is_set():
                break
            try:
                self.tick()
            except (SQLAlchemyError, OSError) as exc:
                logger.warning("planificateur de mises à jour indisponible: %s", exc)
            except Exception:
                logger.exception("échec inattendu du planificateur de mises à jour")

    def tick(self, now: datetime | None = None) -> None:
        reference = now or self._clock()
        with get_session_factory()() as session:
            enabled = webui_settings.updates_auto_enabled(session)
            start_value, end_value = webui_settings.updates_auto_window(session)
            last_run = webui_settings.updates_auto_last_run(session)
        if not enabled:
            return
        start = parse_hhmm(start_value, DEFAULT_START)
        end = parse_hhmm(end_value, DEFAULT_END)
        if not within_window(reference.time(), start, end):
            return
        if last_run is not None and last_run.date() == reference.date():
            return
        if (
            self._last_scan_failure is not None
            and reference - self._last_scan_failure < SCAN_RETRY_DELAY
        ):
            return
        if self._queue_busy():
            logger.info(
                "mise à jour automatique : file de jobs occupée, nouvel essai au prochain passage"
            )
            return
        self.run_once(start, end)

    def run_once(self, start: time, end: time) -> bool:
        """Exécute un passage ; True si la journée est consommée (succès ou abandon)."""
        started_at = self._clock()
        settings = get_settings()
        client = self._docker_client()
        try:
            states = load_app_states(settings, client)
            snapshot = build_updates(states, client, force=True)
            self_name = self._self_app_name(client)
        except (docker.errors.DockerException, SQLAlchemyError, OSError):
            logger.exception("mise à jour automatique : scan impossible")
            self._last_scan_failure = started_at
            notifications.create_notification(
                severity="error",
                title="Mise à jour automatique : scan impossible",
                message="La vérification des images a échoué ; nouvelle tentative dans la tranche.",
                source="updates",
                link="/updates",
            )
            return False
        finally:
            if client is not None:
                close = getattr(client, "close", None)
                if callable(close):
                    try:
                        close()
                    except docker.errors.DockerException:
                        pass
        self._last_scan_failure = None

        # Marquer la journée seulement après un scan réussi : un échec transitoire
        # reste rejouable dans la même tranche.
        with get_session_factory()() as session:
            webui_settings.set_updates_auto_last_run(session, started_at)

        if client is not None and self_name is None:
            logger.warning(
                "mise à jour automatique : conteneur de la WebUI introuvable, passage annulé"
            )
            detail = "conteneur de la WebUI introuvable ; aucune mise à jour lancée"
            notifications.create_notification(
                severity="warning",
                title="Mise à jour automatique annulée",
                message=detail,
                source="updates",
                link="/updates",
            )
            audit.record("updates_auto", "failed", username=SCHEDULER_USER, detail=detail)
            return True

        logger.info(
            "mise à jour automatique : début (tranche %s–%s)",
            start.strftime("%H:%M"),
            end.strftime("%H:%M"),
        )
        candidates = [
            entry.app
            for entry in snapshot.entries
            if entry.status == "available" and entry.app != self_name
        ]

        deadline = datetime.combine(started_at.date(), end) + timedelta(
            seconds=ACTION_TIMEOUTS.get("app_update", DEFAULT_TIMEOUT) + 60
        )
        updated: list[str] = []
        failed: list[str] = []
        skipped: list[str] = []
        remaining: list[str] = []
        for index, app in enumerate(candidates):
            if self._stopping.is_set() or not within_window(self._clock().time(), start, end):
                remaining.extend(candidates[index:])
                break
            if self._has_pending_update(app):
                skipped.append(app)
                continue
            try:
                job = job_manager.submit("app_update", app, SCHEDULER_USER)
            except Exception:
                logger.exception("mise à jour automatique : soumission impossible pour %s", app)
                failed.append(app)
                continue
            status = self._wait_for_job(job.id, deadline)
            if status == "success":
                updated.append(app)
            elif status in ("failed", "interrupted"):
                failed.append(app)
            else:
                # Job bloqué (worker arrêté ou file figée) : ne pas empiler davantage.
                remaining.append(app)
                remaining.extend(candidates[index + 1 :])
                break

        self._publish_result(updated, failed, skipped, remaining)
        return True

    def _publish_result(
        self,
        updated: list[str],
        failed: list[str],
        skipped: list[str],
        remaining: list[str],
    ) -> None:
        parts: list[str] = []
        if updated:
            parts.append(f"{len(updated)} mise(s) à jour")
        if failed:
            parts.append(f"échec(s) : {', '.join(failed)}")
        if skipped:
            parts.append(f"déjà en cours : {', '.join(skipped)}")
        if remaining:
            parts.append(f"reportée(s) : {', '.join(remaining)}")
        if not parts:
            logger.info("mise à jour automatique : aucune mise à jour disponible")
            return

        detail = ", ".join(parts)
        if remaining:
            title = "Mise à jour automatique partielle"
        else:
            title = "Mise à jour automatique terminée"
        notifications.create_notification(
            severity="warning" if failed or remaining else "success",
            title=title,
            message=detail,
            source="updates",
            link="/updates",
        )
        audit.record(
            "updates_auto",
            "failed" if failed or remaining else "success",
            username=SCHEDULER_USER,
            detail=detail,
        )
        logger.info("mise à jour automatique : %s", detail)

    def _docker_client(self) -> docker.DockerClient | None:
        try:
            return docker.from_env()
        except docker.errors.DockerException:
            return None

    def _self_app_name(self, client: docker.DockerClient | None) -> str | None:
        if client is None:
            return None
        container = self_update.self_container(client)
        if container is not None:
            return container_app_name(container)
        # Repli : certains environnements exposent un hostname qui n'est pas
        # directement un ID de conteneur ; on retrouve alors le conteneur par préfixe.
        hostname = socket.gethostname()
        try:
            for candidate in client.containers.list(all=True):
                if candidate.id.startswith(hostname):
                    return container_app_name(candidate)
        except docker.errors.DockerException:
            return None
        return None

    def _queue_busy(self) -> bool:
        with get_session_factory()() as session:
            return (
                session.scalar(select(Job.id).where(Job.status.in_(("queued", "running"))).limit(1))
                is not None
            )

    def _has_pending_update(self, app: str) -> bool:
        with get_session_factory()() as session:
            return (
                session.scalar(
                    select(Job.id)
                    .where(
                        Job.type == "app_update",
                        Job.target == app,
                        Job.status.in_(("queued", "running")),
                    )
                    .limit(1)
                )
                is not None
            )

    def _wait_for_job(self, job_id: int, deadline: datetime) -> str:
        while not self._stopping.is_set():
            with get_session_factory()() as session:
                job = session.get(Job, job_id)
                if job is not None and job.status in TERMINAL_STATUSES:
                    return job.status
            if self._clock() >= deadline:
                return "pending"
            self._stopping.wait(self.job_poll_interval)
        return "pending"


update_scheduler = UpdateScheduler()
