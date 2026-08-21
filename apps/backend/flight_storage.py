from pathlib import Path
from collections.abc import Iterable

from sqlalchemy.orm import Session

import config
from database import SessionLocal
from models import Flight


def flight_storage_root() -> Path:
    return Path(config.PARAGLIDING_DATA_ROOT)


def _flight_sort_key(flight: Flight) -> tuple[bool, str, bool, str, str]:
    return (
        flight.departure_time is None,
        flight.departure_time.isoformat() if flight.departure_time else "",
        flight.created_at is None,
        flight.created_at.isoformat() if flight.created_at else "",
        flight.id,
    )


def flight_sequence_number(db: Session, flight: Flight) -> int:
    flights = list(db.query(Flight).filter(Flight.flight_date == flight.flight_date).all())
    if not any(existing.id == flight.id for existing in flights):
        flights.append(flight)

    flights.sort(key=_flight_sort_key)
    for index, candidate in enumerate(flights, start=1):
        if candidate.id == flight.id:
            return index

    raise RuntimeError(f"Flight {flight.id} was not found in daily sequence")


def flight_directory(db: Session, flight: Flight) -> Path:
    day_dir = flight_storage_root() / flight.flight_date.strftime("%Y%m%d")
    return day_dir / f"{flight_sequence_number(db, flight):02d}"


def pano_video_path(db: Session, flight: Flight) -> Path:
    return pano_video_paths(db, [flight])[flight.id]


def pano_video_paths(db: Session, flights: Iterable[Flight]) -> dict[str, Path]:
    selected = list(flights)
    paths = {
        flight.id: Path(flight.pano_video_file_path)
        for flight in selected
        if flight.pano_video_file_path
    }
    unresolved = [flight for flight in selected if flight.id not in paths]
    if not unresolved:
        return paths

    dates = {flight.flight_date for flight in unresolved}
    daily_flights = list(db.query(Flight).filter(Flight.flight_date.in_(dates)).all())
    sequences: dict[str, int] = {}
    for flight_date in dates:
        flights_for_date = [flight for flight in daily_flights if flight.flight_date == flight_date]
        known_ids = {flight.id for flight in flights_for_date}
        flights_for_date.extend(
            flight
            for flight in unresolved
            if flight.flight_date == flight_date and flight.id not in known_ids
        )
        flights_for_date.sort(key=_flight_sort_key)
        sequences.update(
            {flight.id: index for index, flight in enumerate(flights_for_date, start=1)}
        )

    root = flight_storage_root()
    for flight in unresolved:
        path = (
            root
            / flight.flight_date.strftime("%Y%m%d")
            / f"{sequences[flight.id]:02d}"
            / "pano.mp4"
        )
        paths[flight.id] = path
        if path.is_file():
            resolved_path = path.resolve()
            flight.pano_video_file_path = str(resolved_path)
            paths[flight.id] = resolved_path
    return paths


def ensure_flight_directory(db: Session, flight: Flight) -> Path:
    directory = flight_directory(db, flight)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def write_flight_text_file(db: Session, flight: Flight, filename: str, content: str) -> Path:
    file_path = ensure_flight_directory(db, flight) / filename
    file_path.write_text(content, encoding="utf-8")
    return file_path


def write_flight_bytes_file(db: Session, flight: Flight, filename: str, content: bytes) -> Path:
    file_path = ensure_flight_directory(db, flight) / filename
    file_path.write_bytes(content)
    return file_path


def get_video_output_path(flight_id: str, timestamp: str) -> Path:
    try:
        with SessionLocal() as db:
            flight = db.query(Flight).filter(Flight.id == flight_id).first()
            if flight:
                return ensure_flight_directory(db, flight) / f"flight-{timestamp}.mp4"
    except Exception as exc:
        print(f"⚠️ Could not resolve flight storage directory: {exc}")

    return Path(config.VIDEO_EXPORT_DIR) / f"flight-{flight_id}-{timestamp}.mp4"
