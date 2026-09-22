import json
import logging
import queue
import re
import threading
from collections.abc import Callable

from sqlalchemy import select, update

from app.adapters.ssdv2_bash import InteractiveProcess, PromptTimeout, Ssdv2BashRunner
from app.adapters.ssdv2_cli import Ssdv2CtlError, Ssdv2CtlRunner
from app.db.models import Job, JobEvent, utcnow
from app.db.session import get_session_factory
from app.services import audit, notifications
from app.services import settings as webui_settings
from app.services.prompts import PromptSpec, detect, strip_ansi, to_payload

logger = logging.getLogger(__name__)

TERMINAL_STATUSES = ("success", "failed", "cancelled", "interrupted")

INTERACTIVE_JOB_TYPES = ("app_install", "app_reinstall", "app_recreate")
PROMPT_IDLE_TIMEOUT = 900
FAILURE_PATTERN = re.compile(r"FAILED!|fatal:|\[ERROR\]|action_failed|failed=[1-9]")

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
        self._bash_provider: Callable[[], Ssdv2BashRunner] | None = None
        self._interactive_lock = threading.Lock()
        self._processes: dict[int, InteractiveProcess] = {}
        self._prompts: dict[int, dict] = {}
        self._prompt_seq: dict[int, int] = {}

    def configure(self, runner_provider: Callable[[], Ssdv2CtlRunner]) -> None:
        self._runner_provider = runner_provider

    def configure_bash(self, provider: Callable[[], Ssdv2BashRunner]) -> None:
        self._bash_provider = provider

    def pending_prompt(self, job_id: int) -> dict | None:
        with self._interactive_lock:
            return self._prompts.get(job_id)

    def submit_input(self, job_id: int, prompt_id: str, value: str) -> bool:
        with self._interactive_lock:
            prompt = self._prompts.get(job_id)
            process = self._processes.get(job_id)
            if prompt is None or process is None or prompt["id"] != prompt_id:
                return False
            self._prompts.pop(job_id, None)
        process.write(value)
        self._add_event(job_id, f"Réponse fournie ({prompt['label']})")
        return True

    def cancel_running(self, job_id: int) -> bool:
        with self._interactive_lock:
            process = self._processes.get(job_id)
            if process is None:
                return False
            self._prompts.pop(job_id, None)
        process.kill()
        return True

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
            session.add(JobEvent(job_id=job_id, line=strip_ansi(line)))
            session.commit()

    def _build_steps(
        self, job_type: str, target: str, params: dict, runner: Ssdv2BashRunner
    ) -> list[tuple]:
        if job_type == "app_recreate":
            return [("bash", "relance_container", [target])]
        if job_type == "app_install":
            subdomain = str(params.get("subdomain") or target)
            steps: list[tuple] = [
                ("bash", "manage_account_yml", [f"sub.{target}.{target}", subdomain])
            ]
            auth = params.get("auth")
            if auth:
                steps.append(("bash", "manage_account_yml", [f"sub.{target}.auth", str(auth)]))
            steps.append(("bash", "launch_service", [target]))
            return steps
        if job_type == "app_reinstall":
            subdomain = runner.capture("get_from_account_yml", [f"sub.{target}.{target}"])
            auth = runner.capture("get_from_account_yml", [f"sub.{target}.auth"])
            if not subdomain or subdomain == "notfound" or not auth or auth == "notfound":
                raise Ssdv2CtlError(
                    "interactive_required", f"valeurs account.yml manquantes pour {target}"
                )
            return [
                ("bash", "suppression_appli", [target, "0"]),
                ("remove", target),
                ("bash", "manage_account_yml", [f"sub.{target}.{target}", subdomain]),
                ("bash", "manage_account_yml", [f"sub.{target}.auth", auth]),
                ("bash", "launch_service", [target]),
            ]
        raise Ssdv2CtlError("unknown_job_type", f"type de job inconnu: {job_type}")

    def _remove_overrides(self, runner: Ssdv2BashRunner, target: str) -> None:
        storage = runner.settings.ssdv2_storage
        for path in (storage / "conf" / f"{target}.yml", storage / "vars" / f"{target}.yml"):
            path.unlink(missing_ok=True)

    def _register_prompt(self, job_id: int, spec: PromptSpec) -> None:
        with self._interactive_lock:
            seq = self._prompt_seq.get(job_id, 0) + 1
            self._prompt_seq[job_id] = seq
            self._prompts[job_id] = to_payload(spec, f"{job_id}:{seq}")
        self._add_event(job_id, f"Saisie requise : {spec.label}")

    def _run_interactive_job(
        self, job_id: int, job_type: str, target: str, params: dict, timeout: int
    ) -> tuple[int, str | None]:
        if self._bash_provider is None:
            raise Ssdv2CtlError("jobs_unavailable", "gestionnaire interactif non configuré")
        runner = self._bash_provider()
        steps = self._build_steps(job_type, target, params, runner)
        state: dict[str, object] = {"failure": False, "timeout": None}

        def on_line(line: str) -> None:
            if FAILURE_PATTERN.search(line):
                state["failure"] = True
            self._add_event(job_id, line)

        def on_prompt(spec: PromptSpec, _raw: str) -> None:
            self._register_prompt(job_id, spec)

        for step in steps:
            if step[0] == "remove":
                self._remove_overrides(runner, target)
                self._add_event(job_id, f"Surcharges supprimées pour {target}")
                continue
            _, function, args = step
            self._add_event(job_id, f"$ {function} {' '.join(args)}")
            process = runner.spawn(function, args, app=target)
            with self._interactive_lock:
                self._processes[job_id] = process
                self._prompts.pop(job_id, None)
            try:
                code = process.run(
                    on_line=on_line,
                    on_prompt=on_prompt,
                    detect_prompt=detect,
                    timeout=timeout,
                    idle_timeout=PROMPT_IDLE_TIMEOUT,
                )
            except PromptTimeout as exc:
                state["timeout"] = exc.kind
                code = 1
            finally:
                with self._interactive_lock:
                    self._processes.pop(job_id, None)
                    self._prompts.pop(job_id, None)
            if state["timeout"] is not None:
                break
            if code != 0:
                return code, f"étape en échec : {function} {target}"

        if state["timeout"] == "idle":
            return 1, "délai d'inactivité dépassé (aucune réponse à la saisie)"
        if state["timeout"] == "global":
            return 1, "délai global dépassé"
        if state["failure"]:
            return 1, "échec détecté dans la sortie de l'installation"
        return 0, None

    def _run_auth_bulk(
        self, job_id: int, runner: Ssdv2CtlRunner, params: dict, timeout: int
    ) -> tuple[int, str | None]:
        auth = str(params.get("auth", ""))
        args = build_job_args("auth_bulk", auth, params)
        payload = runner.run(args, timeout)
        results = payload.get("results") if isinstance(payload, dict) else None
        if not isinstance(results, list):
            raise Ssdv2CtlError("ssdv2ctl_invalid_output", "sortie auth set-many inattendue")

        to_recreate: list[str] = []
        failed: list[str] = []
        for result in results:
            app = str(result.get("app", ""))
            if result.get("error"):
                failed.append(app)
                self._add_event(
                    job_id, f"Échec de l'authentification pour {app} : {result['error']}"
                )
                continue
            if result.get("changed"):
                self._add_event(job_id, f"Authentification modifiée pour {app}")
            else:
                self._add_event(job_id, f"Authentification déjà à jour pour {app}")
            to_recreate.append(app)

        recreate_timeout = ACTION_TIMEOUTS["app_recreate"]
        for app in to_recreate:
            self._add_event(job_id, f"Recréation de {app} pour appliquer l'authentification")
            recreate_args = build_job_args("app_recreate", app, {})
            code = runner.run_streaming(
                recreate_args, lambda line: self._add_event(job_id, line), recreate_timeout
            )
            if code != 0:
                failed.append(app)

        if failed:
            return 1, "échec pour : " + ", ".join(failed)
        return 0, None

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
            timeout = ACTION_TIMEOUTS.get(job_type, DEFAULT_TIMEOUT)
            self._add_event(job_id, f"Job {job_type} sur {target} démarré")
            if job_type in INTERACTIVE_JOB_TYPES:
                exit_code, message = self._run_interactive_job(
                    job_id, job_type, target, params, timeout
                )
            else:
                if self._runner_provider is None:
                    raise Ssdv2CtlError("jobs_unavailable", "gestionnaire de jobs non configuré")
                runner = self._runner_provider()
                if job_type == "auth_bulk":
                    exit_code, message = self._run_auth_bulk(job_id, runner, params, timeout)
                else:
                    args = build_job_args(job_type, target, params)
                    exit_code = runner.run_streaming(
                        args, lambda line: self._add_event(job_id, line), timeout
                    )
            if exit_code == 0:
                status = "success"
            else:
                status = "failed"
                if message is None:
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
