import json
import time
from collections.abc import Iterator

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.deps import CurrentUser, DbDep
from app.schemas.notification import NotificationListOut, NotificationOut
from app.services import notifications

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListOut)
def list_notifications(
    db: DbDep,
    _user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=200),
) -> NotificationListOut:
    return NotificationListOut(
        items=notifications.list_notifications(db, limit),
        unread=notifications.unread_count(db),
    )


@router.post("/read-all")
def read_all(db: DbDep, _user: CurrentUser) -> dict:
    return {"updated": notifications.mark_all_read(db)}


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: int, db: DbDep, _user: CurrentUser) -> NotificationOut:
    notification = notifications.mark_read(db, notification_id)
    if notification is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"notification inconnue: {notification_id}")
    return notification


@router.get("/events")
def notification_events(
    _user: CurrentUser,
    after: int = Query(default=0, ge=0),
    once: bool = Query(default=False),
) -> StreamingResponse:
    def stream() -> Iterator[str]:
        last_id = after
        yield 'data: {"ready": true}\n\n'
        while True:
            events = notifications.events_after(last_id)
            for event in events:
                last_id = event.id
                payload = json.dumps(
                    {"id": event.id, "severity": event.severity, "title": event.title},
                    ensure_ascii=False,
                )
                yield f"data: {payload}\n\n"
            if once:
                return
            time.sleep(2)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
