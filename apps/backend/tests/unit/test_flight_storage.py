from datetime import date, datetime
from pathlib import Path

import config
import flight_storage
from flight_storage import ensure_flight_directory
from flight_storage import flight_directory
from flight_storage import flight_sequence_number
from flight_storage import get_video_output_path
from flight_storage import pano_video_path
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

    assert flight_directory(db_session, first) == tmp_path / "20260515" / "01"
    assert flight_directory(db_session, second) == tmp_path / "20260515" / "02"


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

    assert flight_directory(db_session, second) == tmp_path / "20260515" / "01"
    assert flight_directory(db_session, first) == tmp_path / "20260515" / "02"

    first.departure_time = datetime(2026, 5, 15, 8, 0)
    second.departure_time = datetime(2026, 5, 15, 7, 0)
    db_session.commit()

    assert flight_directory(db_session, second) == tmp_path / "20260515" / "01"
    assert flight_directory(db_session, first) == tmp_path / "20260515" / "02"


def test_flight_directory_sequence_changes_when_departure_order_reverses(
    db_session, monkeypatch, tmp_path
):
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

    assert flight_directory(db_session, first) == tmp_path / "20260515" / "01"
    assert flight_directory(db_session, second) == tmp_path / "20260515" / "02"

    first.departure_time = datetime(2026, 5, 15, 15, 0)
    second.departure_time = datetime(2026, 5, 15, 8, 0)
    db_session.commit()

    assert flight_directory(db_session, second) == tmp_path / "20260515" / "01"
    assert flight_directory(db_session, first) == tmp_path / "20260515" / "02"


def test_flight_sequence_places_missing_departure_time_last(db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    morning = Flight(
        id="flight-morning",
        flight_date=date(2026, 5, 15),
        departure_time=datetime(2026, 5, 15, 9, 0),
    )
    afternoon = Flight(
        id="flight-afternoon",
        flight_date=date(2026, 5, 15),
        departure_time=datetime(2026, 5, 15, 14, 0),
    )
    missing_a = Flight(
        id="flight-missing-a",
        flight_date=date(2026, 5, 15),
        created_at=datetime(2026, 5, 15, 15, 0),
    )
    missing_b = Flight(
        id="flight-missing-b",
        flight_date=date(2026, 5, 15),
        created_at=datetime(2026, 5, 15, 16, 0),
    )
    db_session.add_all([missing_b, afternoon, missing_a, morning])
    db_session.commit()

    assert flight_sequence_number(db_session, morning) == 1
    assert flight_sequence_number(db_session, afternoon) == 2
    assert flight_sequence_number(db_session, missing_a) == 3
    assert flight_sequence_number(db_session, missing_b) == 4


def test_missing_departure_time_sorts_after_year_9999(db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    dated = Flight(
        id="flight-year-9999",
        flight_date=date(9999, 1, 1),
        departure_time=datetime(9999, 1, 1, 12),
    )
    missing = Flight(id="flight-missing-time", flight_date=date(9999, 1, 1))
    db_session.add_all([missing, dated])
    db_session.commit()

    assert flight_sequence_number(db_session, dated) == 1
    assert flight_sequence_number(db_session, missing) == 2


def test_write_flight_text_file_creates_file_in_flight_directory(db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    flight = Flight(id="flight-gpx", flight_date=date(2026, 5, 15))
    db_session.add(flight)
    db_session.commit()

    file_path = write_flight_text_file(db_session, flight, "watch.gpx", "<gpx />")

    assert file_path == tmp_path / "20260515" / "01" / "watch.gpx"
    assert file_path.read_text() == "<gpx />"


def test_ensure_flight_directory_creates_directory(db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    flight = Flight(id="flight-dir", flight_date=date(2026, 5, 16))
    db_session.add(flight)
    db_session.commit()

    directory = ensure_flight_directory(db_session, flight)

    assert directory == Path(tmp_path / "20260516" / "01")
    assert directory.is_dir()


def test_pano_video_path_uses_exact_flight_filename(db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    flight = Flight(id="flight-pano", flight_date=date(2026, 5, 16))
    db_session.add(flight)
    db_session.commit()

    path = pano_video_path(db_session, flight)

    assert path == tmp_path / "20260516" / "01" / "pano.mp4"


def test_pano_video_path_supports_an_unpersisted_flight(db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    flight = Flight(id="flight-transient-pano", flight_date=date(2026, 5, 16))

    assert pano_video_path(db_session, flight) == tmp_path / "20260516" / "01" / "pano.mp4"


def test_pano_video_path_stays_stable_after_daily_order_changes(db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    flight = Flight(
        id="flight-pano-stable",
        flight_date=date(2026, 5, 16),
        departure_time=datetime(2026, 5, 16, 12),
    )
    db_session.add(flight)
    db_session.commit()
    original_path = tmp_path / "20260516" / "01" / "pano.mp4"
    original_path.parent.mkdir(parents=True)
    original_path.write_bytes(b"pano")

    assert pano_video_path(db_session, flight) == original_path.resolve()
    db_session.commit()
    db_session.add(
        Flight(
            id="flight-earlier",
            flight_date=date(2026, 5, 16),
            departure_time=datetime(2026, 5, 16, 8),
        )
    )
    db_session.commit()

    assert pano_video_path(db_session, flight) == original_path.resolve()
    assert flight.pano_video_file_path == str(original_path.resolve())


def test_get_video_output_path_uses_flight_directory(db_session, monkeypatch, tmp_path, test_db):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    monkeypatch.setattr(flight_storage, "SessionLocal", test_db)
    flight = Flight(id="flight-video", flight_date=date(2026, 5, 17))
    db_session.add(flight)
    db_session.commit()

    output_path = get_video_output_path("flight-video", "20260517-120000")

    assert output_path == tmp_path / "20260517" / "01" / "flight-20260517-120000.mp4"


def test_get_video_output_path_falls_back_to_export_root(monkeypatch, tmp_path, test_db):
    monkeypatch.setattr(config, "VIDEO_EXPORT_DIR", str(tmp_path / "videos"))
    monkeypatch.setattr(flight_storage, "SessionLocal", test_db)

    output_path = get_video_output_path("missing-flight", "20260517-120000")

    assert output_path == tmp_path / "videos" / "flight-missing-flight-20260517-120000.mp4"
