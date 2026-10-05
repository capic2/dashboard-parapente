import sqlite3
from pathlib import Path

MIGRATION = Path(__file__).parents[2] / "sql_migrations" / "019_add_youtube_uploads.sql"


def test_youtube_upload_migration_creates_credentials_and_jobs() -> None:
    connection = sqlite3.connect(":memory:")
    connection.executescript(
        "CREATE TABLE users (id INTEGER PRIMARY KEY);"
        "CREATE TABLE flights (id VARCHAR PRIMARY KEY);"
    )

    connection.executescript(MIGRATION.read_text())

    tables = {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).fetchall()
    }
    assert "youtube_credentials" in tables
    assert "youtube_upload_jobs" in tables
