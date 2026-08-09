import sqlite3
from pathlib import Path

MIGRATION = Path(__file__).parents[2] / "sql_migrations" / "015_add_flight_summary_indexes.sql"


def apply_migration(connection: sqlite3.Connection) -> None:
    for statement in MIGRATION.read_text().split(";"):
        lines = [line for line in statement.splitlines() if not line.strip().startswith("--")]
        if sql := "\n".join(lines).strip():
            connection.execute(sql)
    connection.commit()


def test_flight_summary_indexes_are_idempotent() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute(
        "CREATE TABLE flights (id VARCHAR PRIMARY KEY, site_id VARCHAR, "
        "flight_date DATE NOT NULL, departure_time DATETIME)"
    )

    apply_migration(connection)
    apply_migration(connection)

    indexes = {row[1] for row in connection.execute("PRAGMA index_list(flights)")}
    assert "idx_flights_summary_default" in indexes
    assert "idx_flights_summary_site_default" in indexes
