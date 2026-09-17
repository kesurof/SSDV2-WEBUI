from datetime import datetime
from typing import Literal

from pydantic import BaseModel

UpdateStatus = Literal["up_to_date", "available", "unknown"]


class UpdateEntry(BaseModel):
    app: str
    image: str
    current_digest: str | None = None
    available_digest: str | None = None
    status: UpdateStatus = "unknown"


class UpdatesOut(BaseModel):
    schema_version: int = 1
    checked_at: datetime
    entries: list[UpdateEntry]
    available: int = 0
