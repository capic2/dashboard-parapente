"""Backfill persisted vertical-rate metrics for existing flight tracks."""

import logging
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import SessionLocal
from flight_tracks import calculate_track_stats, normalize_track
from models import Flight

logger = logging.getLogger(__name__)


@dataclass
class VerticalRateBackfillReport:
    scanned: int = 0
    updated: int = 0
    failed: int = 0
    batches: int = 0


def _track_path(stored_path: str, base_dir: Path) -> Path:
    path = Path(stored_path)
    return path if path.is_absolute() else base_dir / path


def backfill_missing_vertical_rates(
    session_factory: Callable[[], Session] = SessionLocal,
    *,
    batch_size: int = 100,
    base_dir: Path = Path(__file__).parent,
) -> VerticalRateBackfillReport:
    """Persist missing climb and sink rates once, outside API request handling."""
    if batch_size < 1:
        raise ValueError("batch_size must be positive")

    report = VerticalRateBackfillReport()
    last_id: str | None = None
    try:
        with session_factory() as db:
            while True:
                query = db.query(Flight).filter(
                    Flight.gpx_file_path.isnot(None),
                    Flight.gpx_file_path != "",
                    or_(
                        Flight.max_climb_rate_ms.is_(None),
                        Flight.max_sink_rate_ms.is_(None),
                    ),
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
                        file_type = (
                            "gpx.gz" if path.name.lower().endswith(".gpx.gz") else path.suffix
                        )
                        _, points = normalize_track(path.read_bytes(), file_type)
                        stats = calculate_track_stats(points)
                        if flight.max_climb_rate_ms is None:
                            flight.max_climb_rate_ms = float(stats["max_climb_rate_ms"])
                        if flight.max_sink_rate_ms is None:
                            flight.max_sink_rate_ms = float(stats["max_sink_rate_ms"])
                        report.updated += 1
                    except Exception as exc:
                        report.failed += 1
                        logger.warning(
                            "Failed to backfill vertical rates for flight %s: %s", flight.id, exc
                        )

                db.commit()
                db.expire_all()
    except Exception:
        logger.exception("Unable to backfill missing flight vertical rates")
        raise

    if report.scanned:
        logger.info(
            "Vertical-rate backfill complete: batches=%d scanned=%d updated=%d failed=%d",
            report.batches,
            report.scanned,
            report.updated,
            report.failed,
        )
    return report
