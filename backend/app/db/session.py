from collections.abc import Iterator
from functools import lru_cache

from fastapi import HTTPException, status
from sqlalchemy import Engine, create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.models import Base


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    settings.webui_data.mkdir(parents=True, exist_ok=True)
    return create_engine(
        f"sqlite:///{settings.webui_db_file}",
        connect_args={"check_same_thread": False},
    )


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def init_db() -> None:
    Base.metadata.create_all(get_engine())


def get_db() -> Iterator[Session]:
    try:
        with get_session_factory()() as session:
            yield session
    except (SQLAlchemyError, OSError) as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Base de données indisponible"
        ) from exc
