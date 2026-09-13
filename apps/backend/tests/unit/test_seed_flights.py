from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pytest
import config
import seed_flights
from models import Flight, Site
from sqlalchemy.orm import sessionmaker


def test_create_sample_video_embeds_gpx_start_time(tmp_path: Path) -> None:
    start_time = datetime(2026, 9, 13, 10, 30, 0)
    video_path = tmp_path / "camera.mp4"

    with patch("seed_flights.subprocess.run") as run:
        seed_flights.create_sample_video(video_path, "0x24527a", start_time)

    command = run.call_args.args[0]
    assert "creation_time=2026-09-13T10:30:00Z" in command


def test_seed_flights_can_create_staging_media(
    test_db: sessionmaker,
    arguel_site: Site,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(seed_flights, "SessionLocal", test_db)
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    created_videos: list[Path] = []

    def write_sample_video(path: Path, color: str, start_time) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(f"sample-{color}".encode())
        created_videos.append(path)

    monkeypatch.setattr(seed_flights, "create_sample_video", write_sample_video)

    assert seed_flights.seed_flights(include_media=True) == 5

    with test_db() as db:
        flights = db.query(Flight).all()
        assert len(flights) == 5
        for flight in flights:
            directory = tmp_path / flight.flight_date.strftime("%Y%m%d")
            assert list(directory.rglob("camera.mp4"))
            assert Path(flight.video_file_path).is_file()
            assert flight.video_export_status == "completed"
            assert Path(flight.pano_video_file_path).is_file()
            assert Path(flight.gopro_overlay_file_path).is_file()
            assert flight.gopro_overlay_status == "completed"

        imported_flight = Flight(
            id="imported-flight",
            title="Imported flight",
            notes="Imported from an external service.",
            flight_date=flights[0].flight_date,
        )
        db.add(imported_flight)
        db.commit()

    assert seed_flights.seed_flights(include_media=True) == 0
    assert len(created_videos) == 40

    with test_db() as db:
        imported_flight = db.get(Flight, "imported-flight")
        assert imported_flight is not None
        assert imported_flight.gopro_overlay_file_path is None
        assert imported_flight.gopro_overlay_status is None
