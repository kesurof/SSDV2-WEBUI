from pydantic import BaseModel


class SecurityOut(BaseModel):
    internal_auth: bool


class SecurityUpdateRequest(BaseModel):
    internal_auth: bool
