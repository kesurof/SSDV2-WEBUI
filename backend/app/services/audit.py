from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuditEvent
from app.db.session import get_session_factory


def record(
    action: str,
    status: str,
    username: str | None = None,
    target: str | None = None,
    detail: str | None = None,
) -> None:
    with get_session_factory()() as session:
        session.add(
            AuditEvent(
                username=username,
                action=action,
                target=target,
                status=status,
                detail=detail,
            )
        )
        session.commit()


def list_events(db: Session, limit: int = 100) -> list[AuditEvent]:
    return list(db.scalars(select(AuditEvent).order_by(AuditEvent.id.desc()).limit(limit)))
