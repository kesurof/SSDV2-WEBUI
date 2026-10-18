from sqlalchemy import text

from app.db.session import get_engine


def test_sqlite_uses_wal_and_busy_timeout() -> None:
    with get_engine().connect() as connection:
        assert connection.execute(text("PRAGMA journal_mode")).scalar() == "wal"
        assert connection.execute(text("PRAGMA busy_timeout")).scalar() == 5000
        # NORMAL == 1
        assert connection.execute(text("PRAGMA synchronous")).scalar() == 1
        assert connection.execute(text("PRAGMA foreign_keys")).scalar() == 1
