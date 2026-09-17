from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

JobStatus = Literal["queued", "running", "success", "failed", "cancelled", "interrupted"]


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    target: str
    status: JobStatus
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    exit_code: int | None
    message: str | None
