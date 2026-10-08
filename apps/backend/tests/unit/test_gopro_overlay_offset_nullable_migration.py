import sqlite3
from pathlib import Path

MIGRATION = (
    Path(__file__).parents[2]
    / "sql_migrations"
    / "044_make_flight_gopro_overlay_gpx_offset_nullable.sql"
)


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


def test_migration_makes_offsets_nullable_and_preserves_saved_offsets() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute("""CREATE TABLE flights (
            id VARCHAR PRIMARY KEY,
            gopro_overlay_gpx_offset FLOAT NOT NULL DEFAULT 0.0,
            gopro_overlay_job_id VARCHAR,
            gopro_overlay_status VARCHAR,
            gopro_overlay_file_path VARCHAR
        )""")
    connection.execute("CREATE TABLE gopro_overlay_jobs (flight_id VARCHAR)")
    connection.executemany(
        """INSERT INTO flights (
            id,
            gopro_overlay_gpx_offset,
            gopro_overlay_job_id,
            gopro_overlay_status,
            gopro_overlay_file_path
        ) VALUES (?, ?, ?, ?, ?)""",
        [
            ("unset-zero", 0.0, None, None, None),
            ("saved-zero", 0.0, "job-1", "completed", "overlay.mp4"),
            ("saved-nonzero", 2.5, None, None, None),
            ("related-job", 0.0, None, None, None),
        ],
    )
    connection.execute("INSERT INTO gopro_overlay_jobs (flight_id) VALUES (?)", ("related-job",))
    connection.commit()

    apply_migration(connection)
    apply_migration(connection)

    columns = {row[1]: row for row in connection.execute("PRAGMA table_info(flights)").fetchall()}
    assert columns["gopro_overlay_gpx_offset"][3] == 0
    offsets = dict(
        connection.execute("SELECT id, gopro_overlay_gpx_offset FROM flights").fetchall()
    )
    assert offsets == {
        "unset-zero": None,
        "saved-zero": 0.0,
        "saved-nonzero": 2.5,
        "related-job": 0.0,
    }

    connection.execute(
        "INSERT INTO flights (id, gopro_overlay_gpx_offset) VALUES (?, NULL)",
        ("new-unset",),
    )
    assert (
        connection.execute(
            "SELECT gopro_overlay_gpx_offset FROM flights WHERE id = 'new-unset'"
        ).fetchone()[0]
        is None
    )
    connection.close()
