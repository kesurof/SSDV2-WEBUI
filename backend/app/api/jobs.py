import json
import time
from collections.abc import Iterator

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.db.models import Job, utcnow
from app.deps import CurrentUser, DbDep
from app.schemas.job import JobOut
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
    if job.status != "queued":
        raise HTTPException(status.HTTP_409_CONFLICT, "seuls les jobs en attente sont annulables")
    job.status = "cancelled"
    job.finished_at = utcnow()
    db.commit()
    return job


@router.get("/{job_id}/events")
def job_events(job_id: int, db: DbDep, _user: CurrentUser) -> StreamingResponse:
    if db.get(Job, job_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"job inconnu: {job_id}")

    def stream() -> Iterator[str]:
        last_id = 0
        while True:
            events, job = job_manager.events_after(job_id, last_id)
            for event in events:
                last_id = event.id
                payload = json.dumps({"id": event.id, "line": event.line}, ensure_ascii=False)
                yield f"data: {payload}\n\n"
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
