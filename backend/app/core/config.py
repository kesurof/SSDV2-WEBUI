from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

HOME = Path.home()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    ssdv2_source: Path = HOME / "seedbox-compose"
    ssdv2_storage: Path = HOME / "seedbox"
    ssdv2ctl_path: Path = Path("/usr/local/bin/ssdv2ctl")
    ssdv2ctl_timeout: int = 60
    backup_dir: Path = HOME / "backup"
    webui_data: Path = Path("/data")
    static_dir: Path = Path("/app/static")

    admin_user: str = Field(default="admin", validation_alias="WEBUI_ADMIN_USER")
    admin_password: str | None = Field(default=None, validation_alias="WEBUI_ADMIN_PASSWORD")

    session_ttl_hours: int = 12
    cookie_secure: bool = False
    login_max_attempts: int = 5
    login_window_seconds: int = 60
    # Mode d'authentification imposé par l'environnement (facultatif) : internal ou proxy.
    # Toute autre valeur retombe sur « internal » (aucun accès ouvert).
    auth_mode: str | None = Field(default=None, validation_alias="WEBUI_AUTH_MODE")
    # Opt-in moins strict : faire confiance à l'en-tête d'identité sans liste d'IP.
    # À n'utiliser que si le port WebUI n'est joignable que via le proxy.
    trust_proxy: bool = Field(default=False, validation_alias="WEBUI_TRUST_PROXY")
    # Liste explicite d'IP/CIDR des proxies de confiance (jamais de détection automatique).
    trusted_proxies: str = Field(default="", validation_alias="WEBUI_TRUSTED_PROXIES")
    # En-tête unique d'identité transmis par le proxy (écrasé via authResponseHeaders).
    proxy_identity_header: str = Field(
        default="X-Auth-Request-User", validation_alias="WEBUI_PROXY_IDENTITY_HEADER"
    )
    # URL de déconnexion du fournisseur d'identité (facultative).
    external_logout_url: str | None = Field(
        default=None, validation_alias="WEBUI_EXTERNAL_LOGOUT_URL"
    )
    # Durée maximale d'un flux SSE avant fermeture propre : force une reconnexion
    # périodique (réauthentification, renouvellement de session, libération des ressources).
    sse_max_seconds: int = Field(default=900, validation_alias="WEBUI_SSE_MAX_SECONDS")
    log_level: str = "INFO"

    @property
    def catalogue_file(self) -> Path:
        return self.ssdv2_source / "includes" / "config" / "services-available"

    @property
    def ssddb_file(self) -> Path:
        return self.ssdv2_source / "ssddb"

    @property
    def registries_dir(self) -> Path:
        return self.ssdv2_storage / "conf"

    @property
    def webui_db_file(self) -> Path:
        return self.webui_data / "webui.sqlite3"


@lru_cache
def get_settings() -> Settings:
    return Settings()
