import sqlite3
from pathlib import Path

MIGRATION = Path(__file__).parents[2] / "sql_migrations" / "023_add_youtube_source_type.sql"


def test_migration_backfills_existing_uploads_as_gopro_overlays() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute(
        "CREATE TABLE youtube_upload_jobs (id VARCHAR PRIMARY KEY, status VARCHAR NOT NULL)"
    )
    connection.execute(
        "INSERT INTO youtube_upload_jobs (id, status) VALUES ('existing', 'completed')"
    )

    connection.executescript(MIGRATION.read_text())

    row = connection.execute(
        "SELECT source_type FROM youtube_upload_jobs WHERE id = 'existing'"
    ).fetchone()
    assert row == ("gopro_overlay",)
    connection.close()
