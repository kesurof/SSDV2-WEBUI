import json
import time
from collections.abc import Iterator

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.db.models import Job, utcnow
from app.db.session import get_session_factory
from app.deps import CurrentUser, DbDep
from app.schemas.job import JobInputRequest, JobOut
from app.services.jobs import TERMINAL_STATUSES, job_manager

router = APIRouter(prefix="/jobs", tags=["jobs"])


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
def job_events(job_id: int, _user: CurrentUser) -> StreamingResponse:
    # Vérification d'existence via une session courte : ne jamais conserver une
    # connexion du pool pendant toute la durée du flux SSE (sinon épuisement).
    with get_session_factory()() as session:
        if session.get(Job, job_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"job inconnu: {job_id}")

    def stream() -> Iterator[str]:
        last_id = 0
        last_prompt: str | None = None
        while True:
            events, job = job_manager.events_after(job_id, last_id)
            for event in events:
                last_id = event.id
                payload = json.dumps({"id": event.id, "line": event.line}, ensure_ascii=False)
                yield f"data: {payload}\n\n"
            prompt = job_manager.pending_prompt(job_id)
            if prompt is not None and prompt["id"] != last_prompt:
                last_prompt = prompt["id"]
                yield f"data: {json.dumps({'prompt': prompt}, ensure_ascii=False)}\n\n"
            if job is None or job.status in TERMINAL_STATUSES:
                done = json.dumps({"status": job.status if job else "unknown", "done": True})
                yield f"data: {done}\n\n"
                return
            time.sleep(0.5)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
