import logging
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from models import Flight


def calculate_and_persist_missing_max_speed(
    db: Session,
    flight: Flight,
    *,
    parse_coordinates: Callable[[Path], list[dict[str, Any]]],
    calculate_speed_kmh: Callable[[list[dict[str, Any]]], float],
    base_dir: Path,
    logger: logging.Logger,
) -> bool:
    """Calculate and persist max speed when missing and GPX/IGC is available."""
    if flight.max_speed_kmh is not None or not flight.gpx_file_path:
        return False

    gpx_path = base_dir / flight.gpx_file_path
    if not gpx_path.exists():
        logger.debug(
            "Skipping max speed backfill for flight %s: GPX not found at %s",
            flight.id,
            gpx_path,
        )
        return False

    try:
        coordinates = parse_coordinates(gpx_path)
        if len(coordinates) < 2:
            return False

        max_speed_kmh = calculate_speed_kmh(coordinates)
        if max_speed_kmh <= 0:
            return False

        flight.max_speed_kmh = max_speed_kmh
        flight.updated_at = datetime.utcnow()
        return True
    except Exception as exc:
        logger.warning(
            "Failed to backfill max speed for flight %s from %s: %s",
            flight.id,
            gpx_path,
            exc,
        )
        return False
