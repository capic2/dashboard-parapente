import sqlite3
from pathlib import Path

MIGRATION = (
    Path(__file__).parents[2]
    / "sql_migrations"
    / "042_recalculate_real_flight_duration_from_markers.sql"
)


def test_migration_uses_shared_timeline_and_only_integer_timestamps() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute(
        "CREATE TABLE flights "
        "(id TEXT PRIMARY KEY, video_markers TEXT, real_duration_minutes INTEGER)"
    )
    connection.executemany(
        "INSERT INTO flights (id, video_markers, real_duration_minutes) VALUES (?, ?, ?)",
        [
            (
                "different-videos",
                '[{"youtube_video_id":"first","kind":"takeoff",'
                '"timestamp_seconds":100},{"youtube_video_id":"second",'
                '"kind":"landing","timestamp_seconds":3600}]',
                12,
            ),
            (
                "invalid-timestamp",
                '[{"kind":"takeoff","timestamp_seconds":100},'
                '{"kind":"takeoff","timestamp_seconds":"oops"},'
                '{"kind":"landing","timestamp_seconds":3600}]',
                12,
            ),
            ("invalid-json", "not-json", 12),
        ],
    )

    connection.executescript(MIGRATION.read_text())

    results = dict(connection.execute("SELECT id, real_duration_minutes FROM flights").fetchall())
    assert results == {
        "different-videos": 58,
        "invalid-timestamp": 58,
        "invalid-json": None,
    }
