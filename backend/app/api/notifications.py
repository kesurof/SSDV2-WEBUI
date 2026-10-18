import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

from app.deps import CurrentUser, DbDep, SettingsDep, StreamUser
from app.schemas.notification import NotificationListOut, NotificationOut
from app.services import notifications

router = APIRouter(prefix="/notifications", tags=["notifications"])

# Intervalle des commentaires « keep-alive » : évite que les proxies ne coupent un
# flux inactif (timeout de lecture usuel de 60 s) et détecte les connexions mortes.
HEARTBEAT_SECONDS = 25
POLL_SECONDS = 2

SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


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
async def notification_events(
    settings: SettingsDep,
    _user: StreamUser,
    after: int = Query(default=0, ge=0),
    once: bool = Query(default=False),
    last_event_id: str | None = Header(default=None),
) -> StreamingResponse:
    # Non authentifié : flux « propre » plutôt qu'un 401 (EventSource n'expose pas le
    # code HTTP) ; le client détecte la perte d'authentification et arrête les reconnexions.
    if _user is None:

        async def auth_required() -> AsyncIterator[str]:
            yield 'retry: 5000\ndata: {"auth":"required"}\n\n'

        return StreamingResponse(
            auth_required(), media_type="text/event-stream", headers=SSE_HEADERS
        )

    async def stream() -> AsyncIterator[str]:
        yield "retry: 5000\n\n"
        last_id = after
        if last_event_id and last_event_id.isascii() and last_event_id.isdecimal():
            last_id = max(after, int(last_event_id))
        loop = asyncio.get_running_loop()
        started = loop.time()
        last_ping = started
        yield 'data: {"ready": true}\n\n'
        while True:
            events = await run_in_threadpool(notifications.events_after, last_id)
            for event in events:
                last_id = event.id
                payload = json.dumps(
                    {"id": event.id, "severity": event.severity, "title": event.title},
                    ensure_ascii=False,
                )
                yield f"id: {event.id}\ndata: {payload}\n\n"
            if once:
                return
            now = loop.time()
            # Durée maximale : fermeture propre, le client reprend via ?after / Last-Event-ID.
            if now - started >= settings.sse_max_seconds:
                return
            if now - last_ping >= HEARTBEAT_SECONDS:
                yield ": keep-alive\n\n"
                last_ping = now
            await asyncio.sleep(POLL_SECONDS)

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)
