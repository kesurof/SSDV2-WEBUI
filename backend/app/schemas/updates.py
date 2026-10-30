import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator, model_validator

UpdateStatus = Literal["up_to_date", "available", "unknown"]

TIME_PATTERN = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


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


class UpdateScheduleOut(BaseModel):
    schema_version: int = 1
    enabled: bool
    start: str
    end: str
    timezone: str
    last_run_at: datetime | None = None
    next_run_at: datetime | None = None


class UpdateScheduleUpdateRequest(BaseModel):
    enabled: bool
    start: str
    end: str

    @field_validator("start", "end")
    @classmethod
    def validate_time(cls, value: str) -> str:
        if not TIME_PATTERN.match(value):
            raise ValueError("heure attendue au format HH:MM")
        return value

    @model_validator(mode="after")
    def validate_window(self) -> "UpdateScheduleUpdateRequest":
        if self.start >= self.end:
            raise ValueError("l'heure de fin doit être postérieure à l'heure de début")
        return self
