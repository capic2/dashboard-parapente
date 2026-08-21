import sqlite3
from pathlib import Path

MIGRATION = Path(__file__).parents[2] / "sql_migrations" / "024_add_flight_pano_video_path.sql"


def test_migration_adds_nullable_panorama_path() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute("CREATE TABLE flights (id VARCHAR PRIMARY KEY)")

    connection.executescript(MIGRATION.read_text())

    columns = {row[1]: row for row in connection.execute("PRAGMA table_info(flights)").fetchall()}
    assert columns["pano_video_file_path"][3] == 0
    connection.close()
