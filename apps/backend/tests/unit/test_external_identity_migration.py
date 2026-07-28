import sqlite3
from pathlib import Path

MIGRATION = Path(__file__).parents[2] / "sql_migrations" / "014_add_flight_external_identity.sql"


def apply_migration(connection: sqlite3.Connection) -> None:
    sql = MIGRATION.read_text()
    for raw_statement in sql.split(";"):
        lines = [line for line in raw_statement.splitlines() if not line.strip().startswith("--")]
        statement = "\n".join(lines).strip()
        if not statement:
            continue
        try:
            connection.execute(statement)
            connection.commit()
        except sqlite3.OperationalError as exc:
            if (
                "duplicate column name" not in str(exc).lower()
                and "already exists" not in str(exc).lower()
            ):
                raise


def test_migration_backfills_legacy_identity_and_is_idempotent():
    connection = sqlite3.connect(":memory:")
    connection.execute("CREATE TABLE flights (id VARCHAR PRIMARY KEY, strava_id VARCHAR UNIQUE)")
    connection.execute("INSERT INTO flights (id, strava_id) VALUES ('flight', '123')")

    apply_migration(connection)
    apply_migration(connection)

    row = connection.execute(
        "SELECT external_provider, external_activity_id FROM flights WHERE id = 'flight'"
    ).fetchone()
    indexes = connection.execute("PRAGMA index_list(flights)").fetchall()
    assert row == ("strava", "123")
    assert any(index[1] == "uq_flights_external_activity" and index[2] for index in indexes)


def test_migration_tolerates_fresh_schema_columns_and_index():
    connection = sqlite3.connect(":memory:")
    connection.execute(
        "CREATE TABLE flights (id VARCHAR PRIMARY KEY, strava_id VARCHAR UNIQUE, "
        "external_provider VARCHAR, external_activity_id VARCHAR)"
    )
    connection.execute(
        "CREATE UNIQUE INDEX uq_flights_external_activity "
        "ON flights (external_provider, external_activity_id)"
    )

    apply_migration(connection)

    columns = {row[1] for row in connection.execute("PRAGMA table_info(flights)")}
    assert {"external_provider", "external_activity_id"} <= columns
