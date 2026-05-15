from datetime import date, datetime
from pathlib import Path

import config
import flight_storage
from flight_storage import ensure_flight_directory
from flight_storage import flight_directory
from flight_storage import get_video_output_path
from flight_storage import write_flight_text_file
from models import Flight


def test_flight_directory_uses_date_and_daily_sequence(db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    first = Flight(
        id="flight-first",
        flight_date=date(2026, 5, 15),
        departure_time=datetime(2026, 5, 15, 9, 0),
        created_at=datetime(2026, 5, 15, 9, 1),
    )
    second = Flight(
        id="flight-second",
        flight_date=date(2026, 5, 15),
        departure_time=datetime(2026, 5, 15, 14, 0),
        created_at=datetime(2026, 5, 15, 14, 1),
    )
    db_session.add_all([first, second])
    db_session.commit()

    assert flight_directory(db_session, first) == tmp_path / "20260515" / "1"
    assert flight_directory(db_session, second) == tmp_path / "20260515" / "2"


def test_flight_directory_uses_departure_time_order(db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    first = Flight(
        id="flight-first",
        flight_date=date(2026, 5, 15),
        departure_time=datetime(2026, 5, 15, 14, 0),
        created_at=datetime(2026, 5, 15, 9, 1),
    )
    second = Flight(
        id="flight-second",
        flight_date=date(2026, 5, 15),
        departure_time=datetime(2026, 5, 15, 9, 0),
        created_at=datetime(2026, 5, 15, 14, 1),
    )
    db_session.add_all([first, second])
    db_session.commit()

    assert flight_directory(db_session, second) == tmp_path / "20260515" / "1"
    assert flight_directory(db_session, first) == tmp_path / "20260515" / "2"

    first.departure_time = datetime(2026, 5, 15, 8, 0)
    second.departure_time = datetime(2026, 5, 15, 7, 0)
    db_session.commit()

    assert flight_directory(db_session, second) == tmp_path / "20260515" / "1"
    assert flight_directory(db_session, first) == tmp_path / "20260515" / "2"


def test_write_flight_text_file_creates_file_in_flight_directory(db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    flight = Flight(id="flight-gpx", flight_date=date(2026, 5, 15))
    db_session.add(flight)
    db_session.commit()

    file_path = write_flight_text_file(db_session, flight, "watch.gpx", "<gpx />")

    assert file_path == tmp_path / "20260515" / "1" / "watch.gpx"
    assert file_path.read_text() == "<gpx />"


def test_ensure_flight_directory_creates_directory(db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    flight = Flight(id="flight-dir", flight_date=date(2026, 5, 16))
    db_session.add(flight)
    db_session.commit()

    directory = ensure_flight_directory(db_session, flight)

    assert directory == Path(tmp_path / "20260516" / "1")
    assert directory.is_dir()


def test_get_video_output_path_uses_flight_directory(db_session, monkeypatch, tmp_path, test_db):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    monkeypatch.setattr(flight_storage, "SessionLocal", test_db)
    flight = Flight(id="flight-video", flight_date=date(2026, 5, 17))
    db_session.add(flight)
    db_session.commit()

    output_path = get_video_output_path("flight-video", "20260517-120000")

    assert output_path == tmp_path / "20260517" / "1" / "history-20260517-120000.mp4"


def test_get_video_output_path_falls_back_to_export_root(monkeypatch, tmp_path, test_db):
    monkeypatch.setattr(config, "VIDEO_EXPORT_DIR", str(tmp_path / "videos"))
    monkeypatch.setattr(flight_storage, "SessionLocal", test_db)

    output_path = get_video_output_path("missing-flight", "20260517-120000")

    assert output_path == tmp_path / "videos" / "flight-missing-flight-20260517-120000.mp4"
