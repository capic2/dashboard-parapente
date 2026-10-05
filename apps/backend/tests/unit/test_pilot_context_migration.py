import sqlite3
from pathlib import Path

MIGRATION = Path(__file__).parents[2] / "sql_migrations" / "029_add_pilot_context_fields.sql"


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


def test_migration_adds_pilot_context_fields_idempotently() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute("CREATE TABLE sites (id VARCHAR PRIMARY KEY, name VARCHAR NOT NULL)")
    connection.execute("CREATE TABLE flights (id VARCHAR PRIMARY KEY, title VARCHAR)")
    connection.execute("INSERT INTO sites (id, name) VALUES ('site-1', 'Test site')")
    connection.execute("INSERT INTO flights (id, title) VALUES ('flight-1', 'Test flight')")

    apply_migration(connection)
    apply_migration(connection)

    site_columns = {row[1] for row in connection.execute("PRAGMA table_info(sites)")}
    flight_columns = {row[1] for row in connection.execute("PRAGMA table_info(flights)")}

    assert "practical_info" in site_columns
    assert {"tags", "conditions_feedback", "decision_snapshot"} <= flight_columns

    site = connection.execute("SELECT practical_info FROM sites WHERE id = 'site-1'").fetchone()
    flight = connection.execute(
        "SELECT tags, conditions_feedback, decision_snapshot FROM flights WHERE id = 'flight-1'"
    ).fetchone()
    assert site == ("{}",)
    assert flight == ("[]", None, None)
