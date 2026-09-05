"""Idempotent migration of legacy per-flight temporary artefacts."""

import logging
import shutil
from pathlib import Path

import config
from database import SessionLocal
from flight_storage import flight_directory, flight_temporary_directory
from models import Flight, VideoExportJob

logger = logging.getLogger(__name__)


def _move_if_destination_is_empty(source: Path, destination: Path) -> bool:
    if not source.exists() or destination.exists():
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source), str(destination))
    return True


def migrate_legacy_flight_temporary_files() -> int:
    """Move known legacy job artefacts below their owning flight's ``.tmp``.

    Existing destinations are never merged or overwritten. This makes startup
    retries safe and leaves ambiguous/orphaned global artefacts untouched.
    """
    moved = 0
    legacy_video_root = Path(config.VIDEO_LEGACY_TEMP_IMAGES_DIR)

    try:
        with SessionLocal() as db:
            flights = db.query(Flight).all()
            for flight in flights:
                legacy_overlay_root = flight_directory(db, flight) / ".gopro-overlay-work"
                destination = flight_temporary_directory(db, flight, "gopro-overlay")
                if _move_if_destination_is_empty(legacy_overlay_root, destination):
                    moved += 1

            for job in db.query(VideoExportJob).all():
                flight = db.query(Flight).filter(Flight.id == job.flight_id).first()
                if not flight:
                    continue
                source = legacy_video_root / job.id
                destination = flight_temporary_directory(db, flight, "video-exports") / job.id
                if _move_if_destination_is_empty(source, destination):
                    moved += 1
    except Exception:
        logger.exception("Unable to migrate legacy flight temporary files")
        return moved

    if moved:
        logger.info("Moved %s legacy flight temporary workspace(s)", moved)
    return moved
