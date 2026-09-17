from pydantic import BaseModel, ConfigDict, Field


class DiagnosticsChecks(BaseModel):
    missing_registries: list[str]
    orphan_containers: list[str]
    dangling_volumes: int


class DiagnosticsOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schema_version: int = Field(alias="schema")
    checks: DiagnosticsChecks
    warnings: list[str]
