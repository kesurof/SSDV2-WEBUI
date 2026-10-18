from pydantic import BaseModel, model_validator

AUTH_MODES = ("internal", "proxy")


class SecurityOut(BaseModel):
    mode: str
    mode_source: str
    # Champ dérivé conservé pour compatibilité (mode == "internal").
    internal_auth: bool = True
    external_logout_url: str | None = None
    trusted_proxies_configured: bool = False


class SecurityUpdateRequest(BaseModel):
    mode: str | None = None
    # Compatibilité transitoire : ancien booléen internal_auth.
    internal_auth: bool | None = None

    @model_validator(mode="after")
    def resolve_mode(self) -> "SecurityUpdateRequest":
        if self.mode is None:
            if self.internal_auth is None:
                raise ValueError("mode requis")
            self.mode = "internal" if self.internal_auth else "proxy"
        if self.mode not in AUTH_MODES:
            raise ValueError(f"mode invalide: {self.mode}")
        return self
