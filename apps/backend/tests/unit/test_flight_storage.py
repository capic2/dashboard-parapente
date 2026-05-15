from datetime import date, datetime
from pathlib import Path

import config
from flight_storage import ensure_flight_directory
from flight_storage import flight_directory
from flight_storage import write_flight_text_file
from models import Flight


def test_flight_directory_uses_date_and_daily_sequence(db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    first = Flight(
        id="flight-first",
        flight_date=date(2026, 5, 15),
        departure_time=datetime(2026, 5, 15, 9, 0),
    )
    second = Flight(
        id="flight-second",
        flight_date=date(2026, 5, 15),
        departure_time=datetime(2026, 5, 15, 14, 0),
    )
    db_session.add_all([first, second])
    db_session.commit()

    assert flight_directory(db_session, first) == tmp_path / "2026-05-15" / "01"
    assert flight_directory(db_session, second) == tmp_path / "2026-05-15" / "02"


def test_write_flight_text_file_creates_file_in_flight_directory(db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    flight = Flight(id="flight-gpx", flight_date=date(2026, 5, 15))
    db_session.add(flight)
    db_session.commit()

    file_path = write_flight_text_file(db_session, flight, "watch.gpx", "<gpx />")

    assert file_path == tmp_path / "2026-05-15" / "01" / "watch.gpx"
    assert file_path.read_text() == "<gpx />"


def test_ensure_flight_directory_creates_directory(db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    flight = Flight(id="flight-dir", flight_date=date(2026, 5, 16))
    db_session.add(flight)
    db_session.commit()

    directory = ensure_flight_directory(db_session, flight)

    assert directory == Path(tmp_path / "2026-05-16" / "01")
    assert directory.is_dir()
