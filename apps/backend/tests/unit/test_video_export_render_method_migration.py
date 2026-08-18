import sqlite3
from pathlib import Path

MIGRATION = Path(__file__).parents[2] / "sql_migrations" / "020_add_video_export_render_method.sql"


def apply_migration(connection: sqlite3.Connection) -> None:
    for raw_statement in MIGRATION.read_text().split(";"):
        lines = [line for line in raw_statement.splitlines() if not line.strip().startswith("--")]
        statement = "\n".join(lines).strip()
        if not statement:
            continue
        try:
            connection.execute(statement)
            connection.commit()
        except sqlite3.OperationalError as exc:
            if "duplicate column name" not in str(exc).lower():
                raise


def test_migration_adds_render_method_without_losing_existing_jobs() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute(
        "CREATE TABLE video_export_jobs " "(id VARCHAR PRIMARY KEY, status VARCHAR NOT NULL)"
    )
    connection.execute("INSERT INTO video_export_jobs (id, status) VALUES ('video-job', 'queued')")

    apply_migration(connection)
    apply_migration(connection)

    columns = {row[1] for row in connection.execute("PRAGMA table_info(video_export_jobs)")}
    job = connection.execute(
        "SELECT id, status, render_method FROM video_export_jobs WHERE id = 'video-job'"
    ).fetchone()

    assert "render_method" in columns
    assert job == ("video-job", "queued", None)
