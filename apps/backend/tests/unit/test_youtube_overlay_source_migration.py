import sqlite3
from pathlib import Path

MIGRATION = Path(__file__).parents[2] / "sql_migrations" / "021_add_youtube_overlay_source.sql"


def test_migration_cancels_active_uploads_without_overlay_source() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute("""CREATE TABLE youtube_upload_jobs (
            id VARCHAR PRIMARY KEY,
            status VARCHAR NOT NULL,
            upload_session_encrypted TEXT,
            updated_at DATETIME
        )""")
    connection.execute(
        "INSERT INTO youtube_upload_jobs VALUES "
        "('active-job', 'uploading', 'encrypted-session', CURRENT_TIMESTAMP), "
        "('completed-job', 'completed', NULL, CURRENT_TIMESTAMP)"
    )

    connection.executescript(MIGRATION.read_text())

    active = connection.execute(
        "SELECT status, upload_session_encrypted, gopro_overlay_job_id "
        "FROM youtube_upload_jobs WHERE id = 'active-job'"
    ).fetchone()
    completed = connection.execute(
        "SELECT status FROM youtube_upload_jobs WHERE id = 'completed-job'"
    ).fetchone()
    assert active == ("cancelled", None, None)
    assert completed == ("completed",)
