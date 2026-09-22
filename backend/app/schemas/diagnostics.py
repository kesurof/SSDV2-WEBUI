from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

APP_NAME = r"^[a-z0-9][a-z0-9._-]{0,63}$"


class DiagnosticsChecks(BaseModel):
    missing_registries: list[str]
    orphan_containers: list[str]
    dangling_volumes: int
    stale_apps: list[str] = Field(default_factory=list)


class DiagnosticsOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schema_version: int = Field(alias="schema")
    checks: DiagnosticsChecks
    warnings: list[str]


class DiagnosticsPurgeRequest(BaseModel):
    apps: list[Annotated[str, StringConstraints(pattern=APP_NAME)]] = Field(
        min_length=1, max_length=50
    )
    delete_data: bool = False
