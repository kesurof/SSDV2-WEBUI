from fastapi import APIRouter, Query

from app.deps import CurrentUser, DbDep
from app.schemas.audit import AuditEventOut
from app.services import audit

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditEventOut])
def list_audit(
    db: DbDep,
    _user: CurrentUser,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[AuditEventOut]:
    return audit.list_events(db, limit)
