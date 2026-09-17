from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.models import AuditEvent, Job, Notification
from app.schemas.app import AppHistoryEvent
from app.services.backups import list_backups

MAX_EVENTS_PER_SOURCE = 200


def _job_event(job: Job) -> AppHistoryEvent:
    return AppHistoryEvent(
        kind="job",
        at=job.finished_at or job.started_at or job.created_at,
        actor=job.created_by,
        label=job.type,
        result=job.status,
        job_id=job.id,
    )


def build_app_history(
    db: Session,
    settings: Settings,
    app: str,
    *,
    kind: str | None = None,
    limit: int = 100,
) -> list[AppHistoryEvent]:
    events: list[AppHistoryEvent] = []

    jobs = db.scalars(
        select(Job)
        .where(Job.target == app)
        .order_by(Job.created_at.desc())
        .limit(MAX_EVENTS_PER_SOURCE)
    ).all()
    job_ids = {job.id for job in jobs}
    events.extend(_job_event(job) for job in jobs)

    audits = db.scalars(
        select(AuditEvent)
        .where(AuditEvent.target == app)
        .order_by(AuditEvent.created_at.desc())
        .limit(MAX_EVENTS_PER_SOURCE)
    ).all()
    events.extend(
        AppHistoryEvent(
            kind="audit",
            at=audit.created_at,
            actor=audit.username,
            label=audit.action,
            result=audit.status,
        )
        for audit in audits
    )

    if job_ids:
        links = {f"/jobs/{job_id}": job_id for job_id in job_ids}
        notifications = db.scalars(
            select(Notification)
            .where(Notification.link.in_(links.keys()))
            .order_by(Notification.created_at.desc())
            .limit(MAX_EVENTS_PER_SOURCE)
        ).all()
        events.extend(
            AppHistoryEvent(
                kind="notification",
                at=notification.created_at,
                actor=None,
                label=notification.title,
                result=notification.severity,
                job_id=links.get(notification.link or ""),
            )
            for notification in notifications
        )

    for backup in list_backups(settings.backup_dir):
        if backup.app != app:
            continue
        events.append(
            AppHistoryEvent(
                kind="backup",
                at=backup.created_at,
                actor=None,
                label=backup.file,
                result="success",
            )
        )

    if kind in ("job", "audit", "notification", "backup"):
        events = [event for event in events if event.kind == kind]
    elif kind == "errors":
        events = [event for event in events if event.result in ("failed", "error", "cancelled")]

    events.sort(key=lambda event: event.at, reverse=True)
    return events[:limit]
