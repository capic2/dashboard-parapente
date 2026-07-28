from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session, sessionmaker

from migrate_calculate_speeds import backfill_missing_max_speeds
from models import Flight


def test_backfill_is_progressive_and_idempotent(
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
                id="backfill-a",
                title="A",
                flight_date=date(2026, 1, 1),
                gpx_file_path=str(track),
            ),
            Flight(
                id="backfill-b",
                title="B",
                flight_date=date(2026, 1, 2),
                gpx_file_path=str(track),
            ),
            Flight(
                id="already-set",
                title="Existing",
                flight_date=date(2026, 1, 3),
                gpx_file_path=str(track),
                max_speed_kmh=42,
            ),
            Flight(
                id="missing-track",
                title="Missing",
                flight_date=date(2026, 1, 4),
                gpx_file_path=str(tmp_path / "missing.gpx"),
            ),
        ]
    )
    db_session.commit()

    first = backfill_missing_max_speeds(test_db, batch_size=1)
    second = backfill_missing_max_speeds(test_db, batch_size=1)

    assert first.scanned == 3
    assert first.updated == 2
    assert first.failed == 1
    assert first.batches == 3

    with test_db() as verification:
        updated = {
            flight.id: flight.max_speed_kmh
            for flight in verification.query(Flight)
            .filter(Flight.id.in_(["backfill-a", "backfill-b", "already-set"]))
            .all()
        }
    assert updated["backfill-a"] is not None and updated["backfill-a"] > 0
    assert updated["backfill-b"] is not None and updated["backfill-b"] > 0
    assert updated["already-set"] == 42

    assert second.scanned == 1
    assert second.updated == 0
    assert second.failed == 1
