from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

JobStatus = Literal["queued", "running", "success", "failed", "cancelled", "interrupted"]


class JobInputRequest(BaseModel):
    prompt_id: str = Field(min_length=1, max_length=64)
    value: str = Field(default="", max_length=200)


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
