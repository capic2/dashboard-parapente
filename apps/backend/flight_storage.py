from pathlib import Path

from sqlalchemy.orm import Session

import config
from database import SessionLocal
from models import Flight


def flight_storage_root() -> Path:
    return Path(config.PARAGLIDING_DATA_ROOT)


def flight_sequence_number(db: Session, flight: Flight) -> int:
    flights = list(db.query(Flight).filter(Flight.flight_date == flight.flight_date).all())
    if not any(existing.id == flight.id for existing in flights):
        flights.append(flight)

    def sort_key(candidate: Flight) -> tuple[str, str, str]:
        departure_time = (
            candidate.departure_time.isoformat() if candidate.departure_time else "9999"
        )
        created_at = candidate.created_at.isoformat() if candidate.created_at else "9999"
        return departure_time, created_at, candidate.id

    flights.sort(key=sort_key)
    for index, candidate in enumerate(flights, start=1):
        if candidate.id == flight.id:
            return index

    raise RuntimeError(f"Flight {flight.id} was not found in daily sequence")


def flight_directory(db: Session, flight: Flight) -> Path:
    day_dir = flight_storage_root() / flight.flight_date.strftime("%Y%m%d")
    return day_dir / f"{flight_sequence_number(db, flight):02d}"


def ensure_flight_directory(db: Session, flight: Flight) -> Path:
    directory = flight_directory(db, flight)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def write_flight_text_file(db: Session, flight: Flight, filename: str, content: str) -> Path:
    file_path = ensure_flight_directory(db, flight) / filename
    file_path.write_text(content, encoding="utf-8")
    return file_path


def get_video_output_path(flight_id: str, timestamp: str) -> Path:
    try:
        with SessionLocal() as db:
            flight = db.query(Flight).filter(Flight.id == flight_id).first()
            if flight:
                return ensure_flight_directory(db, flight) / f"history-{timestamp}.mp4"
    except Exception as exc:
        print(f"⚠️ Could not resolve flight storage directory: {exc}")

    return Path(config.VIDEO_EXPORT_DIR) / f"flight-{flight_id}-{timestamp}.mp4"
