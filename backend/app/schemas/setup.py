from pydantic import BaseModel, Field, field_validator, model_validator

PASSWORD_MIN_LENGTH = 12

AUTH_MODES = ("internal", "proxy")


class SetupStatusOut(BaseModel):
    required: bool
    token_required: bool
    instance_name: str
    external_auth: bool = False
    auth_mode: str = "internal"
    external_logout_url: str | None = None
    trusted_proxies_configured: bool = False


class SetupRequest(BaseModel):
    token: str = Field(min_length=8, max_length=128)
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-z0-9][a-z0-9._-]*$")
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=200)
    auth_mode: str | None = None
    # Compatibilité transitoire : ancien booléen internal_auth.
    internal_auth: bool | None = None
    instance_name: str = Field(default="SSDV2 WebUI", min_length=1, max_length=100)
    notify_job_success: bool = True

    @field_validator("password")
    @classmethod
    def password_differs_from_username(cls, value: str, info) -> str:
        username = info.data.get("username")
        if username and value.lower() == str(username).lower():
            raise ValueError("le mot de passe doit être différent de l'identifiant")
        return value

    @model_validator(mode="after")
    def resolve_auth_mode(self) -> "SetupRequest":
        # Le setup initial ne propose que internal (défaut) ou proxy.
        if self.auth_mode is None:
            self.auth_mode = "internal" if self.internal_auth in (None, True) else "proxy"
        if self.auth_mode not in AUTH_MODES:
            raise ValueError("au premier démarrage : internal ou proxy uniquement")
        return self
