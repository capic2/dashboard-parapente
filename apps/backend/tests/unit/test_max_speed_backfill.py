from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session, sessionmaker

from migrate_calculate_speeds import backfill_missing_max_speeds
from models import Flight


def test_backfill_recalculates_existing_values_and_is_idempotent(
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
                gpx_file_path="track.gpx",
            ),
            Flight(
                id="backfill-b",
                title="B",
                flight_date=date(2026, 1, 2),
                gpx_file_path="track.gpx",
            ),
            Flight(
                id="already-set",
                title="Existing",
                flight_date=date(2026, 1, 3),
                gpx_file_path="track.gpx",
                max_speed_kmh=42,
            ),
            Flight(
                id="no-speed-evidence",
                title="No speed evidence",
                flight_date=date(2026, 1, 3),
                gpx_file_path=str(tmp_path / "no-speed.gpx"),
                max_speed_kmh=42,
            ),
            Flight(
                id="missing-track",
                title="Missing",
                flight_date=date(2026, 1, 4),
                gpx_file_path="missing.gpx",
            ),
        ]
    )
    (tmp_path / "no-speed.gpx").write_text(
        "<gpx><trk><trkseg><trkpt lat=\"47.2\" lon=\"6.0\"/>"
        "<trkpt lat=\"47.201\" lon=\"6.001\"/></trkseg></trk></gpx>"
    )
    db_session.commit()

    first = backfill_missing_max_speeds(test_db, batch_size=1, base_dir=tmp_path)
    second = backfill_missing_max_speeds(test_db, batch_size=1, base_dir=tmp_path)

    assert first.scanned == 5
    assert first.updated == 3
    assert first.failed == 1
    assert first.batches == 5

    with test_db() as verification:
        updated = {
            flight.id: flight.max_speed_kmh
            for flight in verification.query(Flight)
            .filter(
                Flight.id.in_(
                    ["backfill-a", "backfill-b", "already-set", "no-speed-evidence"]
                )
            )
            .all()
        }
    assert updated["backfill-a"] is not None and updated["backfill-a"] > 0
    assert updated["backfill-b"] is not None and updated["backfill-b"] > 0
    assert updated["already-set"] != 42
    assert updated["no-speed-evidence"] == 42

    assert second.scanned == 5
    assert second.updated == 0
    assert second.failed == 1
