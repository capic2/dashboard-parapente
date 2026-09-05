"""Idempotent migration of legacy per-flight temporary artefacts."""

import logging
import re
import shutil
from pathlib import Path

import config
from database import SessionLocal
from flight_storage import flight_directory, flight_temporary_directory
from models import Flight, VideoExportJob

logger = logging.getLogger(__name__)

_LEGACY_THUMBNAIL_NAME = re.compile(
    r"^\.(?P<video_name>.+)\.thumbnail\.(?P<extension>jpg|json|lock)$"
)
_LEGACY_PREVIEW_NAMES = {
    ".camera.preview.json",
    ".camera.preview.lock",
    ".camera.preview.state.lock",
}


def _move_if_destination_is_empty(source: Path, destination: Path) -> bool:
    if not source.exists() or destination.exists():
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source), str(destination))
    return True


def _legacy_hidden_file_destination(temporary_root: Path, source: Path) -> Path:
    thumbnail_match = _LEGACY_THUMBNAIL_NAME.fullmatch(source.name)
    if thumbnail_match:
        return (
            temporary_root
            / "thumbnails"
            / (
                f"{thumbnail_match.group('video_name')}.thumbnail."
                f"{thumbnail_match.group('extension')}"
            )
        )
    if source.name in _LEGACY_PREVIEW_NAMES:
        return temporary_root / "gopro-preview" / source.name.removeprefix(".")
    return temporary_root / "legacy-hidden" / source.name.removeprefix(".")


def migrate_legacy_flight_temporary_files() -> int:
    """Move known legacy job artefacts below their owning flight's ``temp``.

    Existing destinations are never merged or overwritten. This makes startup
    retries safe and leaves ambiguous/orphaned global artefacts untouched.
    """
    moved = 0
    legacy_video_root = Path(config.VIDEO_LEGACY_TEMP_IMAGES_DIR)

    try:
        with SessionLocal() as db:
            flights = db.query(Flight).all()
            for flight in flights:
                directory = flight_directory(db, flight)
                temporary_root = directory / "temp"
                hidden_temporary_root = directory / ".tmp"
                if hidden_temporary_root.is_dir():
                    temporary_root.mkdir(parents=True, exist_ok=True)
                    for child in hidden_temporary_root.iterdir():
                        if _move_if_destination_is_empty(child, temporary_root / child.name):
                            moved += 1
                    if not any(hidden_temporary_root.iterdir()):
                        hidden_temporary_root.rmdir()

                legacy_overlay_root = directory / ".gopro-overlay-work"
                destination = flight_temporary_directory(db, flight, "gopro-overlay")
                if _move_if_destination_is_empty(legacy_overlay_root, destination):
                    moved += 1

                legacy_highlights = directory / "highlights"
                highlights_destination = flight_temporary_directory(db, flight, "highlights")
                if _move_if_destination_is_empty(legacy_highlights, highlights_destination):
                    moved += 1

                legacy_preview = directory / "camera.preview.mp4"
                preview_destination = flight_temporary_directory(db, flight, "gopro-preview")
                if _move_if_destination_is_empty(
                    legacy_preview, preview_destination / legacy_preview.name
                ):
                    moved += 1

                for child in directory.iterdir():
                    if child.name.startswith(".") and child.name not in {
                        ".tmp",
                        ".gopro-overlay-work",
                    }:
                        if _move_if_destination_is_empty(
                            child, _legacy_hidden_file_destination(temporary_root, child)
                        ):
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
