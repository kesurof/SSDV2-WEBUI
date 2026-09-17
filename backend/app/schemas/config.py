from pydantic import BaseModel, ConfigDict, Field


class ConfigOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schema_version: int = Field(alias="schema")
    config: dict[str, str | None]
