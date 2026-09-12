from pathlib import Path

import config
import seed_flights
from models import Flight


def test_seed_flights_can_create_staging_media(
    test_db, arguel_site, tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(seed_flights, "SessionLocal", test_db)
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))

    def write_sample_video(path: Path, color: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(f"sample-{color}".encode())

    monkeypatch.setattr(seed_flights, "create_sample_video", write_sample_video)

    assert seed_flights.seed_flights(include_media=True) == 5

    with test_db() as db:
        flights = db.query(Flight).all()
        assert len(flights) == 5
        for flight in flights:
            directory = tmp_path / flight.flight_date.strftime("%Y%m%d")
            assert list(directory.rglob("camera.mp4"))
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

    with test_db() as db:
        imported_flight = db.get(Flight, "imported-flight")
        assert imported_flight is not None
        assert imported_flight.gopro_overlay_file_path is None
        assert imported_flight.gopro_overlay_status is None
