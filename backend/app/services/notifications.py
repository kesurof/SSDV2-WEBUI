from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.models import Notification, utcnow
from app.db.session import get_session_factory


def create_notification(
    severity: str,
    title: str,
    message: str | None = None,
    source: str | None = None,
    link: str | None = None,
) -> Notification:
    with get_session_factory()() as session:
        notification = Notification(
            severity=severity,
            title=title,
            message=message,
            source=source,
            link=link,
        )
        session.add(notification)
        session.commit()
        session.refresh(notification)
        return notification


def list_notifications(db: Session, limit: int = 50) -> list[Notification]:
    return list(db.scalars(select(Notification).order_by(Notification.id.desc()).limit(limit)))


def unread_count(db: Session) -> int:
    return len(list(db.scalars(select(Notification.id).where(Notification.read_at.is_(None)))))


def mark_read(db: Session, notification_id: int) -> Notification | None:
    notification = db.get(Notification, notification_id)
    if notification is None:
        return None
    if notification.read_at is None:
        notification.read_at = utcnow()
        db.commit()
    return notification


def mark_all_read(db: Session) -> int:
    result = db.execute(
        update(Notification).where(Notification.read_at.is_(None)).values(read_at=utcnow())
    )
    db.commit()
    return result.rowcount or 0


def events_after(last_id: int, limit: int = 50) -> list[Notification]:
    with get_session_factory()() as session:
        return list(
            session.scalars(
                select(Notification)
                .where(Notification.id > last_id)
                .order_by(Notification.id)
                .limit(limit)
            )
        )
