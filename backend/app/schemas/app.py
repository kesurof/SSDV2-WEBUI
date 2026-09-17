from typing import Literal

from pydantic import BaseModel

RuntimeStatus = Literal["running", "partial", "stopped", "unknown", "not_installed"]


class AppStateOut(BaseModel):
    name: str
    description: str
    available: bool
    installed: bool
    runtime_status: RuntimeStatus
    healthy: bool | None
    url: str | None
    image: str | None
    containers: int
    warnings: list[str]
