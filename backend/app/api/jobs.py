import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from app.db.models import Job, utcnow
from app.db.session import get_session_factory
from app.deps import CurrentUser, DbDep, SettingsDep, StreamUser
from app.schemas.job import JobInputRequest, JobOut
from app.services.jobs import TERMINAL_STATUSES, job_manager

router = APIRouter(prefix="/jobs", tags=["jobs"])

HEARTBEAT_SECONDS = 25
POLL_SECONDS = 0.5

SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


@router.get("", response_model=list[JobOut])
def list_jobs(
    db: DbDep,
    _user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[Job]:
    return list(db.scalars(select(Job).order_by(Job.id.desc()).limit(limit)))


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: int, db: DbDep, _user: CurrentUser) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"job inconnu: {job_id}")
    return job


@router.post("/{job_id}/cancel", response_model=JobOut)
def cancel_job(job_id: int, db: DbDep, _user: CurrentUser) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"job inconnu: {job_id}")
    if job.status == "queued" or (job.status == "running" and job_manager.cancel_running(job_id)):
        job.status = "cancelled"
        job.finished_at = utcnow()
        db.commit()
        return job
    raise HTTPException(status.HTTP_409_CONFLICT, "ce job n'est pas annulable")


@router.post("/{job_id}/input", response_model=JobOut)
def submit_job_input(job_id: int, payload: JobInputRequest, db: DbDep, _user: CurrentUser) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"job inconnu: {job_id}")
    if job.status != "running":
        raise HTTPException(status.HTTP_409_CONFLICT, "ce job n'attend aucune saisie")
    if not job_manager.submit_input(job_id, payload.prompt_id, payload.value):
        raise HTTPException(status.HTTP_409_CONFLICT, "aucune saisie attendue pour ce job")
    return job


@router.get("/{job_id}/events")
async def job_events(
    job_id: int,
    settings: SettingsDep,
    _user: StreamUser,
    after: int = Query(default=0, ge=0),
    last_event_id: str | None = Header(default=None),
) -> StreamingResponse:
    # Non authentifié : flux « propre » (EventSource n'expose pas le code HTTP), sans
    # révéler l'existence du job.
    if _user is None:

        async def auth_required() -> AsyncIterator[str]:
            yield 'retry: 5000\ndata: {"auth":"required"}\n\n'

        return StreamingResponse(
            auth_required(), media_type="text/event-stream", headers=SSE_HEADERS
        )

    # Vérification d'existence via une session courte : ne jamais conserver une
    # connexion du pool pendant toute la durée du flux SSE.
    with get_session_factory()() as session:
        if session.get(Job, job_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"job inconnu: {job_id}")

    async def stream() -> AsyncIterator[str]:
        yield "retry: 5000\n\n"
        last_id = after
        if last_event_id and last_event_id.isascii() and last_event_id.isdecimal():
            last_id = max(after, int(last_event_id))
        loop = asyncio.get_running_loop()
        started = loop.time()
        last_ping = started
        last_prompt: str | None = None
        while True:
            events, job = await run_in_threadpool(job_manager.events_after, job_id, last_id)
            for event in events:
                last_id = event.id
                payload = json.dumps({"id": event.id, "line": event.line}, ensure_ascii=False)
                yield f"id: {event.id}\ndata: {payload}\n\n"
            prompt = await run_in_threadpool(job_manager.pending_prompt, job_id)
            if prompt is not None and prompt["id"] != last_prompt:
                last_prompt = prompt["id"]
                yield f"data: {json.dumps({'prompt': prompt}, ensure_ascii=False)}\n\n"
            if job is None or job.status in TERMINAL_STATUSES:
                done = json.dumps({"status": job.status if job else "unknown", "done": True})
                yield f"data: {done}\n\n"
                return
            now = loop.time()
            # Durée maximale : fermeture propre, le client reprend via ?after / Last-Event-ID.
            if now - started >= settings.sse_max_seconds:
                yield f"data: {json.dumps({'done': False, 'reconnect': True})}\n\n"
                return
            if now - last_ping >= HEARTBEAT_SECONDS:
                yield ": keep-alive\n\n"
                last_ping = now
            await asyncio.sleep(POLL_SECONDS)

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)
