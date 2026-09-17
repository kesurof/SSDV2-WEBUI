from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    ssdv2_source: Path = Path("/home/utilisateur/seedbox-compose")
    ssdv2_storage: Path = Path("/home/utilisateur/seedbox")
    ssdv2ctl_path: Path = Path("ssdv2ctl")
    ssdv2ctl_timeout: int = 60
    backup_dir: Path = Path("/home/utilisateur/backup")
    webui_data: Path = Path("/data")
    static_dir: Path = Path("/app/static")

    admin_user: str = Field(default="admin", validation_alias="WEBUI_ADMIN_USER")
    admin_password: str | None = Field(default=None, validation_alias="WEBUI_ADMIN_PASSWORD")

    session_ttl_hours: int = 12
    cookie_secure: bool = False
    login_max_attempts: int = 5
    login_window_seconds: int = 60
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
