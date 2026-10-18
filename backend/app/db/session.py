from collections.abc import Iterator
from functools import lru_cache

from fastapi import HTTPException, status
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.models import Base


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    settings.webui_data.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        f"sqlite:///{settings.webui_db_file}",
        connect_args={"check_same_thread": False},
        pool_size=10,
        max_overflow=20,
        pool_timeout=20,
        pool_pre_ping=True,
    )

    @event.listens_for(engine, "connect")
    def configure_sqlite(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        # WAL : les lectures de l'UI ne sont plus bloquées par les écritures du worker
        # de jobs ; busy_timeout évite un « database is locked » immédiat, synchronous
        # NORMAL reste sûr en WAL.
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def _apply_migrations(engine: Engine) -> None:
    with engine.begin() as connection:
        columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(jobs)")}
        if "params" not in columns:
            connection.exec_driver_sql("ALTER TABLE jobs ADD COLUMN params TEXT")


def init_db() -> None:
    engine = get_engine()
    Base.metadata.create_all(engine)
    _apply_migrations(engine)


def get_db() -> Iterator[Session]:
    try:
        with get_session_factory()() as session:
            yield session
    except (SQLAlchemyError, OSError) as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Base de données indisponible"
        ) from exc
