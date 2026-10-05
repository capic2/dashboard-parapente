import sqlite3
from pathlib import Path

MIGRATION = Path(__file__).parents[2] / "sql_migrations" / "040_add_real_flight_duration.sql"


def apply_migration(connection: sqlite3.Connection) -> None:
    for statement in MIGRATION.read_text().split(";"):
        if not statement.strip():
            continue
        try:
            connection.execute(statement)
            connection.commit()
        except sqlite3.OperationalError as exc:
            if "duplicate column name" not in str(exc).lower():
                raise


def test_migration_backfills_real_duration_and_is_idempotent() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute(
        "CREATE TABLE flights " "(id VARCHAR PRIMARY KEY, video_markers TEXT NOT NULL DEFAULT '[]')"
    )
    connection.execute(
        "INSERT INTO flights (id, video_markers) VALUES (?, ?)",
        (
            "complete-flight",
            '[{"youtube_video_id":"dQw4w9WgXcQ","kind":"takeoff",'
            '"timestamp_seconds":120},{"youtube_video_id":"dQw4w9WgXcQ",'
            '"kind":"landing","timestamp_seconds":7320}]',
        ),
    )
    connection.execute(
        "INSERT INTO flights (id, video_markers) VALUES (?, ?)",
        (
            "different-videos",
            '[{"youtube_video_id":"dQw4w9WgXcQ","kind":"takeoff",'
            '"timestamp_seconds":120},{"youtube_video_id":"9bZkp7q19f0",'
            '"kind":"landing","timestamp_seconds":7320}]',
        ),
    )
    connection.commit()

    apply_migration(connection)
    apply_migration(connection)

    assert (
        connection.execute(
            "SELECT real_duration_minutes FROM flights WHERE id = 'complete-flight'"
        ).fetchone()[0]
        == 120
    )
    assert (
        connection.execute(
            "SELECT real_duration_minutes FROM flights WHERE id = 'different-videos'"
        ).fetchone()[0]
        is None
    )
