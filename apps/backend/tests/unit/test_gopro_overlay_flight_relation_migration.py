import sqlite3
from pathlib import Path

MIGRATION = (
    Path(__file__).parents[2] / "sql_migrations" / "018_add_gopro_overlay_flight_relation.sql"
)


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
            message = str(exc).lower()
            if "duplicate column name" not in message and "already exists" not in message:
                raise


def test_migration_links_existing_overlay_jobs_to_their_flights() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute(
        "CREATE TABLE flights (id VARCHAR PRIMARY KEY, gopro_overlay_job_id VARCHAR)"
    )
    connection.execute(
        "CREATE TABLE gopro_overlay_jobs (id VARCHAR PRIMARY KEY, status VARCHAR NOT NULL)"
    )
    connection.execute("INSERT INTO flights VALUES ('flight-1', 'overlay-1080p')")
    connection.execute("INSERT INTO gopro_overlay_jobs VALUES ('overlay-1080p', 'completed')")

    apply_migration(connection)
    apply_migration(connection)

    linked_job = connection.execute(
        "SELECT id, flight_id FROM gopro_overlay_jobs WHERE id = 'overlay-1080p'"
    ).fetchone()
    assert linked_job == ("overlay-1080p", "flight-1")
