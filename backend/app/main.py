import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from app.adapters.ssdv2_cli import Ssdv2CtlRunner
from app.api import (
    apps,
    audit,
    auth,
    backups,
    config,
    diagnostics,
    health,
    jobs,
    notifications,
    security,
    setup,
    system,
)
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.core.security import hash_password
from app.db.models import User
from app.db.session import get_session_factory, init_db
from app.services import settings as webui_settings
from app.services import setup as setup_service
from app.services.jobs import job_manager

logger = logging.getLogger(__name__)


def bootstrap_admin() -> None:
    settings = get_settings()
    with get_session_factory()() as db:
        if db.scalar(select(func.count()).select_from(User)):
            return
        if not settings.admin_password:
            logger.warning("Aucun compte admin : assistant de premier démarrage disponible")
            return
        db.add(
            User(
                username=settings.admin_user,
                password_hash=hash_password(settings.admin_password),
            )
        )
        webui_settings.mark_setup_completed(db)
        logger.info("Compte admin '%s' créé", settings.admin_user)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    try:
        init_db()
        bootstrap_admin()
        settings = get_settings()
        with get_session_factory()() as db:
            if webui_settings.setup_required(db):
                setup_service.ensure_setup_token(settings.webui_data)
        job_manager.configure(lambda: Ssdv2CtlRunner(settings))
        job_manager.reset_interrupted()
        job_manager.start()
    except (SQLAlchemyError, OSError) as exc:
        logger.error("Base de données indisponible au démarrage: %s", exc)
    yield
    job_manager.stop()


def create_app() -> FastAPI:
    setup_logging(get_settings().log_level)
    app = FastAPI(title="SSDV2 WebUI", version="0.1.0", lifespan=lifespan)

    api_router = APIRouter(prefix="/api/v1")
    api_router.include_router(apps.router)
    api_router.include_router(audit.router)
    api_router.include_router(auth.router)
    api_router.include_router(backups.router)
    api_router.include_router(config.router)
    api_router.include_router(diagnostics.router)
    api_router.include_router(health.router)
    api_router.include_router(jobs.router)
    api_router.include_router(notifications.router)
    api_router.include_router(security.router)
    api_router.include_router(setup.router)
    api_router.include_router(system.router)
    app.include_router(api_router)
    app.include_router(health.router)

    _mount_frontend(app)
    return app


def _mount_frontend(app: FastAPI) -> None:
    dist = get_settings().static_dir
    if not dist.is_dir():
        return

    assets = dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str) -> FileResponse:
        if path.startswith(("api/", "health")):
            raise HTTPException(status_code=404)
        candidate = dist / path
        if path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(dist / "index.html")


app = create_app()
