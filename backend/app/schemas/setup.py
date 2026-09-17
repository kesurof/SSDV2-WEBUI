from pydantic import BaseModel, Field, field_validator

PASSWORD_MIN_LENGTH = 12


class SetupStatusOut(BaseModel):
    required: bool
    token_required: bool
    instance_name: str


class SetupRequest(BaseModel):
    token: str = Field(min_length=8, max_length=128)
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-z0-9][a-z0-9._-]*$")
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=200)
    internal_auth: bool = True
    instance_name: str = Field(default="SSDV2 WebUI", min_length=1, max_length=100)
    notify_job_success: bool = True

    @field_validator("password")
    @classmethod
    def password_differs_from_username(cls, value: str, info) -> str:
        username = info.data.get("username")
        if username and value.lower() == str(username).lower():
            raise ValueError("le mot de passe doit être différent de l'identifiant")
        return value
