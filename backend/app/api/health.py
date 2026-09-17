import sqlite3

import docker
from fastapi import APIRouter

from app.adapters.ssdv2_cli import Ssdv2CtlRunner
from app.core.config import Settings
from app.deps import SettingsDep
from app.schemas.auth import HealthOut

router = APIRouter(tags=["health"])


def _database_available(settings: Settings) -> bool:
    if not settings.webui_db_file.is_file():
        return False
    try:
        with sqlite3.connect(f"file:{settings.webui_db_file.as_posix()}?mode=ro", uri=True) as conn:
            conn.execute("select 1")
        return True
    except sqlite3.Error:
        return False


def _docker_available() -> bool:
    try:
        client = docker.from_env()
        client.ping()
        return True
    except docker.errors.DockerException:
        return False


def _ssdv2ctl_available(settings: Settings) -> bool:
    return Ssdv2CtlRunner(settings).version() is not None


@router.get("/health", response_model=HealthOut)
def health(settings: SettingsDep) -> HealthOut:
    return _build_health(settings)


def _build_health(settings: Settings) -> HealthOut:
    docker_ok = _docker_available()
    ssdv2_ok = settings.catalogue_file.is_file() and settings.ssddb_file.is_file()
    ssdv2ctl_ok = _ssdv2ctl_available(settings)
    database_ok = _database_available(settings)
    status = "ok" if docker_ok and ssdv2_ok and ssdv2ctl_ok and database_ok else "degraded"
    return HealthOut(
        status=status,
        docker=docker_ok,
        ssdv2=ssdv2_ok,
        ssdv2ctl=ssdv2ctl_ok,
        database=database_ok,
    )
