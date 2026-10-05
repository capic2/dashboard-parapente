import sqlite3
from pathlib import Path

MIGRATION = Path(__file__).parents[2] / "sql_migrations" / "018_add_flight_youtube_urls.sql"


def test_flight_youtube_urls_migration_adds_empty_json_array_by_default() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute("CREATE TABLE flights (id TEXT PRIMARY KEY)")
    connection.executescript(MIGRATION.read_text())
    connection.execute("INSERT INTO flights (id) VALUES ('flight-1')")

    row = connection.execute("SELECT youtube_urls FROM flights WHERE id = 'flight-1'").fetchone()

    assert row == ("[]",)
