from sqlalchemy import text

from database import engine


def test_sqlite_connections_use_concurrency_safe_settings():
    with engine.connect() as connection:
        assert connection.execute(text("PRAGMA busy_timeout")).scalar_one() == 30_000
        assert connection.execute(text("PRAGMA journal_mode")).scalar_one().lower() == "wal"
        assert connection.execute(text("PRAGMA synchronous")).scalar_one() == 1
