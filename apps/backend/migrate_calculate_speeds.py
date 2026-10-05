"""Recalculate persisted flight max speeds from their stored track files."""

import argparse
import logging
import math
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import Session

from database import SessionLocal
from flight_tracks import calculate_track_stats, normalize_track
from models import Flight

logger = logging.getLogger(__name__)


@dataclass
class BackfillReport:
    scanned: int = 0
    updated: int = 0
    unchanged: int = 0
    failed: int = 0
    batches: int = 0


def _track_path(stored_path: str, base_dir: Path) -> Path:
    path = Path(stored_path)
    return path if path.is_absolute() else base_dir / path


def backfill_missing_max_speeds(
    session_factory: Callable[[], Session] = SessionLocal,
    *,
    batch_size: int = 100,
    base_dir: Path = Path(__file__).parent,
) -> BackfillReport:
    """Recalculate every flight with a stored track, in small transactions."""
    if batch_size < 1:
        raise ValueError("batch_size must be positive")

    report = BackfillReport()
    last_id: str | None = None
    with session_factory() as db:
        while True:
            query = db.query(Flight).filter(
                Flight.gpx_file_path.isnot(None),
                Flight.gpx_file_path != "",
            )
            if last_id is not None:
                query = query.filter(Flight.id > last_id)
            flights = query.order_by(Flight.id).limit(batch_size).all()
            if not flights:
                break

            report.batches += 1
            for flight in flights:
                report.scanned += 1
                last_id = flight.id
                try:
                    path = _track_path(flight.gpx_file_path, base_dir)
                    content = path.read_bytes()
                    file_type = "gpx.gz" if path.name.lower().endswith(".gpx.gz") else path.suffix
                    _, points = normalize_track(content, file_type)
                    max_speed = float(calculate_track_stats(points)["max_speed_kmh"])
                    has_explicit_speed = any(
                        "speed_kmh" in point
                        and math.isfinite(point["speed_kmh"])
                        and 0 <= point["speed_kmh"] < 150
                        for point in points
                    )
                    has_timestamp_pair = any(
                        previous.get("segment", 0) == current.get("segment", 0)
                        and current.get("timestamp", 0) > previous.get("timestamp", 0)
                        for previous, current in zip(points, points[1:], strict=False)
                    )
                    if not has_explicit_speed and not has_timestamp_pair:
                        report.unchanged += 1
                        continue
                    was_changed = flight.max_speed_kmh != max_speed
                    updated = (
                        db.query(Flight)
                        .filter(Flight.id == flight.id)
                        .update({Flight.max_speed_kmh: max_speed}, synchronize_session=False)
                    )
                    if updated and was_changed:
                        report.updated += updated
                    else:
                        report.unchanged += 1
                except Exception as exc:
                    report.failed += 1
                    logger.warning("Failed to backfill flight %s: %s", flight.id, exc)

            db.commit()
            db.expire_all()
            logger.info(
                "Max-speed backfill progress: scanned=%d updated=%d unchanged=%d failed=%d",
                report.scanned,
                report.updated,
                report.unchanged,
                report.failed,
            )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument(
        "--base-dir",
        type=Path,
        default=Path(__file__).parent,
        help="Root directory used to resolve relative stored track paths",
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    report = backfill_missing_max_speeds(batch_size=args.batch_size, base_dir=args.base_dir)
    logger.info(
        "Max-speed backfill complete: batches=%d scanned=%d updated=%d unchanged=%d failed=%d",
        report.batches,
        report.scanned,
        report.updated,
        report.unchanged,
        report.failed,
    )


if __name__ == "__main__":
    main()
