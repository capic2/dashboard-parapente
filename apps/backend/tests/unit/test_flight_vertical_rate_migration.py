import sqlite3
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy.orm import Session, sessionmaker

from flight_vertical_rate_migration import backfill_missing_vertical_rates
from models import Flight

MIGRATION = Path(__file__).parents[2] / "sql_migrations" / "031_add_flight_vertical_rates.sql"


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


def test_migration_adds_vertical_rate_columns_idempotently() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute("CREATE TABLE flights (id VARCHAR PRIMARY KEY)")

    apply_migration(connection)
    apply_migration(connection)

    columns = {row[1] for row in connection.execute("PRAGMA table_info(flights)")}
    assert {"max_climb_rate_ms", "max_sink_rate_ms"} <= columns


def test_backfill_persists_only_missing_vertical_rates(
    test_db: sessionmaker[Session],
    db_session: Session,
    tmp_path: Path,
    sample_gpx: str,
) -> None:
    track = tmp_path / "track.gpx"
    track.write_text(sample_gpx)
    db_session.add_all(
        [
            Flight(
                id="missing-rates",
                title="Missing rates",
                flight_date=date(2026, 1, 1),
                gpx_file_path="track.gpx",
            ),
            Flight(
                id="stored-rates",
                title="Stored rates",
                flight_date=date(2026, 1, 2),
                gpx_file_path="track.gpx",
                max_climb_rate_ms=4.2,
                max_sink_rate_ms=3.4,
            ),
            Flight(
                id="stored-climb-only",
                title="Stored climb only",
                flight_date=date(2026, 1, 3),
                gpx_file_path="track.gpx",
                max_climb_rate_ms=4.8,
            ),
            Flight(
                id="missing-track",
                title="Missing track",
                flight_date=date(2026, 1, 4),
                gpx_file_path="missing.gpx",
            ),
        ]
    )
    db_session.commit()

    first = backfill_missing_vertical_rates(test_db, batch_size=1, base_dir=tmp_path)
    second = backfill_missing_vertical_rates(test_db, batch_size=1, base_dir=tmp_path)

    assert first.scanned == 3
    assert first.updated == 2
    assert first.failed == 1
    assert first.batches == 3
    assert second.scanned == 1
    assert second.updated == 0
    assert second.failed == 1

    with test_db() as verification:
        missing = verification.get(Flight, "missing-rates")
        stored = verification.get(Flight, "stored-rates")
        partial = verification.get(Flight, "stored-climb-only")
        assert missing is not None
        assert missing.max_climb_rate_ms == 1.0
        assert missing.max_sink_rate_ms == 0.77
        assert stored is not None
        assert stored.max_climb_rate_ms == 4.2
        assert stored.max_sink_rate_ms == 3.4
        assert partial is not None
        assert partial.max_climb_rate_ms == 4.8
        assert partial.max_sink_rate_ms == 0.77


def test_backfill_propagates_database_failures() -> None:
    def failing_session_factory() -> Session:
        raise RuntimeError("database unavailable")

    with pytest.raises(RuntimeError, match="database unavailable"):
        backfill_missing_vertical_rates(failing_session_factory)
