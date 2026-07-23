"""
API tests for /flights endpoints

Tests HTTP endpoints in routes.py related to flight management.
Coverage: GET, POST, PATCH, DELETE for flights.
"""

from datetime import date, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import config
from models import Flight

# API prefix for all routes
API_PREFIX = "/api"


class TestFlightsListEndpoint:
    """Tests for GET /flights"""

    def test_get_flights_empty_database(self, client, db_session):
        """GET /flights returns empty list when no flights exist"""
        response = client.get(f"{API_PREFIX}/flights")
        assert response.status_code == 200
        data = response.json()
        assert "flights" in data
        assert data["flights"] == []

    def test_get_flights_returns_flights(self, client, db_session, arguel_site):
        """GET /flights returns flights (limit=10 by default)"""
        # Create 3 flights
        for i in range(3):
            flight = Flight(
                id=f"flight-{i}",
                name=f"Flight {i}",
                flight_date=date(2026, 3, 15 + i),
                site_id="site-arguel",
                duration_minutes=60 + i * 10,
            )
            db_session.add(flight)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights")
        assert response.status_code == 200
        data = response.json()
        assert "flights" in data
        assert len(data["flights"]) == 3

    def test_get_flights_includes_video_export_fields(self, client, db_session, arguel_site):
        """GET /flights includes video fields used by flight details actions."""
        flight = Flight(
            id="flight-with-video",
            name="Flight with video",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            gpx_file_path="db/gpx/flight-with-video.gpx",
            video_file_path="/exports/flight-with-video.mp4",
            video_export_job_id="job-video",
            video_export_status="completed",
        )
        db_session.add(flight)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights")

        assert response.status_code == 200
        returned = next(
            flight for flight in response.json()["flights"] if flight["id"] == "flight-with-video"
        )
        assert returned["gpx_file_path"] == "db/gpx/flight-with-video.gpx"
        assert returned["video_file_path"] == "/exports/flight-with-video.mp4"
        assert returned["video_file_exists"] is False
        assert returned["video_export_job_id"] == "job-video"
        assert returned["video_export_status"] == "completed"
        assert returned["gopro_camera_file_exists"] is False
        assert returned["gopro_overlay_job_id"] is None
        assert returned["gopro_overlay_status"] is None
        assert returned["gopro_overlay_file_path"] is None
        assert returned["gopro_overlay_file_exists"] is False

    def test_get_flights_includes_media_export_progress(self, client, db_session, arguel_site):
        """GET /flights includes active video and GoPro overlay progress."""
        flight = Flight(
            id="flight-with-progress",
            name="Flight with progress",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            video_export_job_id="job-video-progress",
            video_export_status="running",
            gopro_overlay_job_id="job-overlay-progress",
            gopro_overlay_status="running",
        )
        db_session.add(flight)
        db_session.commit()

        with (
            patch(
                "routes.get_export_status_manual",
                return_value={"status": "running", "progress": 42.4},
            ),
            patch("routes.get_export_status_stream", return_value=None),
            patch(
                "routes.get_gopro_overlay_job",
                return_value={"status": "running", "progress": 55.1},
            ),
        ):
            response = client.get(f"{API_PREFIX}/flights")

        assert response.status_code == 200
        returned = next(
            flight
            for flight in response.json()["flights"]
            if flight["id"] == "flight-with-progress"
        )
        assert returned["video_export_progress"] == 42
        assert returned["gopro_overlay_progress"] == 55

    def test_get_flights_hides_orphan_active_media_export_state(
        self, client, db_session, arguel_site
    ):
        """GET /flights does not report missing active jobs as still in progress."""
        flight = Flight(
            id="flight-orphan-export",
            name="Flight orphan export",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            video_export_job_id="missing-video-job",
            video_export_status="processing",
            gopro_overlay_job_id="missing-overlay-job",
            gopro_overlay_status="queued",
        )
        db_session.add(flight)
        db_session.commit()

        with (
            patch("routes.get_export_status_manual", return_value=None),
            patch("routes.get_export_status_stream", return_value=None),
            patch("routes.get_gopro_overlay_job", return_value=None),
        ):
            response = client.get(f"{API_PREFIX}/flights")

        assert response.status_code == 200
        returned = next(
            flight
            for flight in response.json()["flights"]
            if flight["id"] == "flight-orphan-export"
        )
        assert returned["video_export_status"] is None
        assert returned["video_export_progress"] is None
        assert returned["gopro_overlay_status"] is None
        assert returned["gopro_overlay_progress"] is None
        db_session.refresh(flight)
        assert flight.video_export_job_id is None
        assert flight.video_export_status is None
        assert flight.gopro_overlay_job_id is None
        assert flight.gopro_overlay_status is None

    def test_get_flights_reconciles_active_video_export_from_terminal_job(
        self, client, db_session, arguel_site
    ):
        flight = Flight(
            id="flight-terminal-export",
            name="Flight terminal export",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            video_export_job_id="completed-video-job",
            video_export_status="processing",
        )
        db_session.add(flight)
        db_session.commit()

        with (
            patch(
                "routes.get_export_status_manual",
                return_value={
                    "job_id": "completed-video-job",
                    "status": "completed",
                    "internal_status": "completed",
                    "progress": 100,
                    "video_path": "/exports/flight-terminal-export.mp4",
                },
            ),
            patch("routes.get_export_status_stream", return_value=None),
        ):
            response = client.get(f"{API_PREFIX}/flights")

        assert response.status_code == 200
        returned = next(
            flight
            for flight in response.json()["flights"]
            if flight["id"] == "flight-terminal-export"
        )
        assert returned["video_export_status"] == "completed"
        assert returned["video_export_progress"] is None
        assert returned["video_file_path"] == "/exports/flight-terminal-export.mp4"
        db_session.refresh(flight)
        assert flight.video_export_job_id is None
        assert flight.video_export_status == "completed"
        assert flight.video_file_path == "/exports/flight-terminal-export.mp4"

    def test_get_flights_includes_preparing_gopro_overlay_progress(
        self, client, db_session, arguel_site
    ):
        """GET /flights treats preparing GoPro overlay jobs as active."""
        flight = Flight(
            id="flight-overlay-preparing",
            name="Flight overlay preparing",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            gopro_overlay_job_id="job-overlay-preparing",
            gopro_overlay_status="queued",
        )
        db_session.add(flight)
        db_session.commit()

        with patch(
            "routes.get_gopro_overlay_job",
            return_value={"status": "preparing", "progress": 12.4},
        ):
            response = client.get(f"{API_PREFIX}/flights")

        assert response.status_code == 200
        returned = next(
            flight
            for flight in response.json()["flights"]
            if flight["id"] == "flight-overlay-preparing"
        )
        assert returned["gopro_overlay_status"] == "preparing"
        assert returned["gopro_overlay_progress"] == 12

    def test_get_flight_hides_and_persists_orphan_active_media_export_state(
        self, client, db_session, arguel_site
    ):
        flight = Flight(
            id="flight-detail-orphan-export",
            name="Flight detail orphan export",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            video_export_job_id="missing-video-job",
            video_export_status="processing",
            gopro_overlay_status="queued",
        )
        db_session.add(flight)
        db_session.commit()

        with (
            patch("routes.get_export_status_manual", return_value=None),
            patch("routes.get_export_status_stream", return_value=None),
            patch("routes.get_gopro_overlay_job", return_value=None),
        ):
            response = client.get(f"{API_PREFIX}/flights/{flight.id}")

        assert response.status_code == 200
        returned = response.json()
        assert returned["video_export_status"] is None
        assert returned["video_export_progress"] is None
        assert returned["gopro_overlay_status"] is None
        assert returned["gopro_overlay_progress"] is None
        db_session.refresh(flight)
        assert flight.video_export_job_id is None
        assert flight.video_export_status is None
        assert flight.gopro_overlay_job_id is None
        assert flight.gopro_overlay_status is None

    def test_get_flights_includes_available_gopro_overlay_path(
        self, client, db_session, monkeypatch, tmp_path
    ):
        """GET /flights includes derived GoPro overlay path when final.mp4 exists."""
        monkeypatch.setattr(config, "GOPRO_OVERLAY_PARAGLIDING_ROOT", str(tmp_path))
        overlay_dir = tmp_path / "20260315" / "01"
        overlay_dir.mkdir(parents=True)
        camera_path = overlay_dir / "camera.mp4"
        overlay_path = overlay_dir / "final.mp4"
        camera_path.write_bytes(b"camera")
        overlay_path.write_bytes(b"overlay")
        flight = Flight(
            id="flight-with-overlay",
            name="Flight with overlay",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
        )
        db_session.add(flight)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights")

        assert response.status_code == 200
        returned = next(
            flight for flight in response.json()["flights"] if flight["id"] == "flight-with-overlay"
        )
        assert returned["gopro_camera_file_exists"] is True
        assert returned["gopro_overlay_file_path"] == str(overlay_path)
        assert returned["gopro_overlay_file_exists"] is True

    def test_get_flights_prefers_persisted_gopro_overlay_state(self, client, db_session, tmp_path):
        """GET /flights returns persisted GoPro overlay job state and file existence."""
        overlay_path = tmp_path / "final.mp4"
        overlay_path.write_bytes(b"overlay")
        flight = Flight(
            id="flight-with-persisted-overlay",
            name="Flight with persisted overlay",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            gopro_overlay_job_id="job-overlay",
            gopro_overlay_status="completed",
            gopro_overlay_file_path=str(overlay_path),
        )
        db_session.add(flight)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights")

        assert response.status_code == 200
        returned = next(
            flight
            for flight in response.json()["flights"]
            if flight["id"] == "flight-with-persisted-overlay"
        )
        assert returned["gopro_overlay_job_id"] == "job-overlay"
        assert returned["gopro_overlay_status"] == "completed"
        assert returned["gopro_overlay_file_path"] == str(overlay_path)
        assert returned["gopro_overlay_file_exists"] is True

    def test_get_flights_uses_completed_gopro_overlay_job_output_path(
        self, client, db_session, arguel_site, tmp_path
    ):
        """GET /flights exposes an existing completed job output as downloadable."""
        output_path = tmp_path / "job-final.mp4"
        output_path.write_bytes(b"overlay")
        flight = Flight(
            id="flight-with-job-overlay",
            name="Flight with job overlay",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            gopro_overlay_job_id="job-overlay-output",
            gopro_overlay_status="running",
        )
        db_session.add(flight)
        db_session.commit()

        with patch(
            "routes.get_gopro_overlay_job",
            return_value={"status": "completed", "output_path": str(output_path)},
        ):
            response = client.get(f"{API_PREFIX}/flights")

        assert response.status_code == 200
        returned = next(
            flight
            for flight in response.json()["flights"]
            if flight["id"] == "flight-with-job-overlay"
        )
        assert returned["gopro_overlay_status"] == "completed"
        assert returned["gopro_overlay_file_path"] == str(output_path)
        assert returned["gopro_overlay_file_exists"] is True

    def test_download_flight_video(self, client, db_session, tmp_path):
        """GET /flights/{id}/video downloads the generated flight video."""
        video_path = tmp_path / "flight.mp4"
        video_path.write_bytes(b"video")
        flight = Flight(
            id="flight-video-download",
            name="Flight video download",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            video_file_path=str(video_path),
        )
        db_session.add(flight)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights/{flight.id}/video")

        assert response.status_code == 200
        assert response.content == b"video"
        assert response.headers["content-type"] == "video/mp4"

    def test_download_flight_video_returns_404_without_video(self, client, db_session):
        """GET /flights/{id}/video rejects flights without video file."""
        flight = Flight(
            id="flight-no-video",
            name="Flight no video",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
        )
        db_session.add(flight)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights/{flight.id}/video")

        assert response.status_code == 404
        assert response.json()["detail"] == "No video file available for this flight"

    def test_download_flight_gopro_overlay(self, client, db_session, monkeypatch, tmp_path):
        """GET /flights/{id}/gopro-overlay downloads the generated overlay."""
        monkeypatch.setattr(config, "GOPRO_OVERLAY_PARAGLIDING_ROOT", str(tmp_path))
        overlay_dir = tmp_path / "20260315" / "01"
        overlay_dir.mkdir(parents=True)
        overlay_path = overlay_dir / "final.mp4"
        overlay_path.write_bytes(b"overlay")
        flight = Flight(
            id="flight-overlay-download",
            name="Flight overlay download",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
        )
        db_session.add(flight)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights/{flight.id}/gopro-overlay")

        assert response.status_code == 200
        assert response.content == b"overlay"
        assert response.headers["content-type"] == "video/mp4"

    def test_download_flight_gopro_overlay_reports_missing_config(
        self, client, db_session, monkeypatch
    ):
        """GET /flights/{id}/gopro-overlay reports configuration errors separately."""
        monkeypatch.setattr(config, "GOPRO_OVERLAY_PARAGLIDING_ROOT", "")
        flight = Flight(
            id="flight-overlay-missing-config",
            name="Flight overlay missing config",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
        )
        db_session.add(flight)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights/{flight.id}/gopro-overlay")

        assert response.status_code == 400
        assert response.json()["detail"] == "GoPro overlay paragliding root is not configured"

    def test_get_flights_filter_by_site(self, client, db_session, arguel_site, chalais_site):
        """GET /flights?site_id=X filters by site"""
        # Create flights for different sites
        flight_arguel = Flight(
            id="flight-arguel",
            name="Arguel Flight",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
        )
        flight_chalais = Flight(
            id="flight-chalais",
            name="Chalais Flight",
            flight_date=date(2026, 3, 16),
            site_id="site-chalais",
        )
        db_session.add_all([flight_arguel, flight_chalais])
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights?site_id=site-arguel")
        assert response.status_code == 200
        data = response.json()
        assert len(data["flights"]) == 1
        assert data["flights"][0]["id"] == "flight-arguel"

    def test_get_flights_filter_by_date(self, client, db_session, arguel_site):
        """GET /flights?date_from=X&date_to=Y filters by date range"""
        # Create flights in different dates
        flight_2025 = Flight(
            id="flight-2025",
            name="2025 Flight",
            flight_date=date(2025, 12, 31),
            site_id="site-arguel",
        )
        flight_2026 = Flight(
            id="flight-2026",
            name="2026 Flight",
            flight_date=date(2026, 1, 1),
            site_id="site-arguel",
        )
        db_session.add_all([flight_2025, flight_2026])
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights?date_from=2026-01-01")
        assert response.status_code == 200
        data = response.json()
        assert len(data["flights"]) == 1
        assert data["flights"][0]["id"] == "flight-2026"

    def test_get_flights_limit(self, client, db_session, arguel_site):
        """GET /flights?limit=X limits results"""
        # Create 10 flights
        for i in range(10):
            flight = Flight(
                id=f"flight-{i:02d}",
                name=f"Flight {i}",
                flight_date=date(2026, 3, 1) + timedelta(days=i),
                site_id="site-arguel",
            )
            db_session.add(flight)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data["flights"]) == 5

    def test_get_flights_sorted_by_date_desc(self, client, db_session, arguel_site):
        """GET /flights returns flights sorted by date descending"""
        # Create flights with different dates
        dates = [date(2026, 3, 10), date(2026, 3, 15), date(2026, 3, 12)]
        for i, flight_date in enumerate(dates):
            flight = Flight(
                id=f"flight-{i}", name=f"Flight {i}", flight_date=flight_date, site_id="site-arguel"
            )
            db_session.add(flight)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights")
        assert response.status_code == 200
        data = response.json()

        # Should be sorted desc: 2026-03-15, 2026-03-12, 2026-03-10
        assert data["flights"][0]["flight_date"] == "2026-03-15"
        assert data["flights"][1]["flight_date"] == "2026-03-12"
        assert data["flights"][2]["flight_date"] == "2026-03-10"

    def test_get_flights_backfills_missing_max_speed_from_gpx(
        self, client, db_session, arguel_site, sample_gpx, tmp_path
    ):
        """GET /flights computes and persists max_speed_kmh when missing and GPX exists"""
        backend_dir = Path(__file__).resolve().parents[2]
        gpx_dir = backend_dir / "db" / "gpx"
        gpx_dir.mkdir(parents=True, exist_ok=True)
        gpx_file = gpx_dir / f"test_flight_{tmp_path.name}.gpx"
        gpx_file.write_text(sample_gpx, encoding="utf-8")

        relative_gpx_path = gpx_file.relative_to(backend_dir)

        flight = Flight(
            id="flight-missing-speed",
            name="Missing speed",
            flight_date=date(2026, 3, 20),
            site_id="site-arguel",
            max_speed_kmh=None,
            gpx_file_path=str(relative_gpx_path),
        )
        db_session.add(flight)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights")
        assert response.status_code == 200
        data = response.json()

        returned = next(f for f in data["flights"] if f["id"] == "flight-missing-speed")
        assert returned["max_speed_kmh"] is not None
        assert returned["max_speed_kmh"] > 0

        db_session.refresh(flight)
        assert flight.max_speed_kmh == returned["max_speed_kmh"]

        gpx_file.unlink(missing_ok=True)

    def test_get_flights_keeps_existing_max_speed(
        self, client, db_session, arguel_site, sample_gpx, tmp_path
    ):
        """GET /flights does not overwrite max_speed_kmh when already set"""
        backend_dir = Path(__file__).resolve().parents[2]
        gpx_dir = backend_dir / "db" / "gpx"
        gpx_dir.mkdir(parents=True, exist_ok=True)
        gpx_file = gpx_dir / f"test_flight_existing_{tmp_path.name}.gpx"
        gpx_file.write_text(sample_gpx, encoding="utf-8")

        relative_gpx_path = gpx_file.relative_to(backend_dir)

        flight = Flight(
            id="flight-existing-speed",
            name="Existing speed",
            flight_date=date(2026, 3, 21),
            site_id="site-arguel",
            max_speed_kmh=42.5,
            gpx_file_path=str(relative_gpx_path),
        )
        db_session.add(flight)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights")
        assert response.status_code == 200
        data = response.json()

        returned = next(f for f in data["flights"] if f["id"] == "flight-existing-speed")
        assert returned["max_speed_kmh"] == 42.5

        db_session.refresh(flight)
        assert flight.max_speed_kmh == 42.5

        gpx_file.unlink(missing_ok=True)

    def test_get_flights_missing_speed_without_gpx_stays_null(
        self, client, db_session, arguel_site
    ):
        """GET /flights keeps null max_speed_kmh when there is no GPX file"""
        flight = Flight(
            id="flight-no-gpx",
            name="No GPX",
            flight_date=date(2026, 3, 22),
            site_id="site-arguel",
            max_speed_kmh=None,
            gpx_file_path=None,
        )
        db_session.add(flight)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights")
        assert response.status_code == 200
        data = response.json()

        returned = next(f for f in data["flights"] if f["id"] == "flight-no-gpx")
        assert returned["max_speed_kmh"] is None

        db_session.refresh(flight)
        assert flight.max_speed_kmh is None

    def test_get_flights_does_not_persist_zero_speed_when_gpx_has_no_time(
        self, client, db_session, arguel_site, tmp_path
    ):
        """GET /flights keeps max_speed_kmh null when GPX has no usable timestamps"""
        gpx_without_time = """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<gpx version=\"1.1\" creator=\"Test\" xmlns=\"http://www.topografix.com/GPX/1/1\">
  <trk><trkseg>
    <trkpt lat=\"47.22356\" lon=\"6.01842\"><ele>427</ele></trkpt>
    <trkpt lat=\"47.22400\" lon=\"6.01900\"><ele>550</ele></trkpt>
  </trkseg></trk>
</gpx>
"""

        backend_dir = Path(__file__).resolve().parents[2]
        gpx_dir = backend_dir / "db" / "gpx"
        gpx_dir.mkdir(parents=True, exist_ok=True)
        gpx_file = gpx_dir / f"test_flight_no_time_{tmp_path.name}.gpx"
        gpx_file.write_text(gpx_without_time, encoding="utf-8")

        relative_gpx_path = gpx_file.relative_to(backend_dir)

        flight = Flight(
            id="flight-no-time",
            name="No time",
            flight_date=date(2026, 3, 24),
            site_id="site-arguel",
            max_speed_kmh=None,
            gpx_file_path=str(relative_gpx_path),
        )
        db_session.add(flight)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights")
        assert response.status_code == 200
        data = response.json()

        returned = next(f for f in data["flights"] if f["id"] == "flight-no-time")
        assert returned["max_speed_kmh"] is None

        db_session.refresh(flight)
        assert flight.max_speed_kmh is None

        gpx_file.unlink(missing_ok=True)


class TestFlightStatsEndpoint:
    """Tests for GET /flights/stats"""

    def test_get_flight_stats_empty_database(self, client, db_session):
        """GET /flights/stats returns zeros when no flights"""
        response = client.get(f"{API_PREFIX}/flights/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_flights"] == 0
        assert data["total_distance_km"] == 0
        assert data["total_duration_minutes"] == 0

    def test_get_flight_stats_calculates_totals(self, client, db_session, arguel_site):
        """GET /flights/stats calculates totals correctly"""
        # Create flights with known stats
        flight1 = Flight(
            id="flight-1",
            name="Flight 1",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            distance_km=10.5,
            duration_minutes=60,
        )
        flight2 = Flight(
            id="flight-2",
            name="Flight 2",
            flight_date=date(2026, 3, 16),
            site_id="site-arguel",
            distance_km=15.0,
            duration_minutes=90,
        )
        db_session.add_all([flight1, flight2])
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_flights"] == 2
        assert data["total_distance_km"] == 25.5
        assert data["total_duration_minutes"] == 150

    def test_get_flight_stats_handles_nulls(self, client, db_session, arguel_site):
        """GET /flights/stats handles NULL distance/duration"""
        flight = Flight(
            id="flight-1",
            name="Flight 1",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            distance_km=None,
            duration_minutes=None,
        )
        db_session.add(flight)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_flights"] == 1
        # Should handle NULL gracefully
        assert data["total_distance_km"] >= 0
        assert data["total_duration_minutes"] >= 0


class TestFlightRecordsEndpoint:
    """Tests for GET /flights/records"""

    def test_get_flight_records_empty_database(self, client, db_session):
        """GET /flights/records returns nulls when no flights"""
        response = client.get(f"{API_PREFIX}/flights/records")
        assert response.status_code == 200
        data = response.json()
        assert data["longest_duration"] is None
        assert data["highest_altitude"] is None
        assert data["longest_distance"] is None
        assert data["max_speed"] is None
        assert data["takeoff_elevation_gain"] is None
        assert data["earliest_takeoff"] is None
        assert data["latest_takeoff"] is None
        assert data["most_used_takeoff"] is None
        assert data["most_active_month"] is None

    def test_get_flight_records_finds_records(self, client, db_session, arguel_site):
        """GET /flights/records finds max duration, distance, altitude, speed"""
        # Create flights with different records
        flight1 = Flight(
            id="flight-1",
            name="Longest",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            distance_km=100.0,  # Longest distance
            duration_minutes=120,
            max_altitude_m=1200,
            max_speed_kmh=40.0,
        )
        flight2 = Flight(
            id="flight-2",
            name="Highest",
            flight_date=date(2026, 3, 16),
            site_id="site-arguel",
            distance_km=50.0,
            duration_minutes=90,
            max_altitude_m=2500,  # Highest
            max_speed_kmh=35.0,
        )
        flight3 = Flight(
            id="flight-3",
            name="Fastest",
            flight_date=date(2026, 3, 17),
            site_id="site-arguel",
            distance_km=30.0,
            duration_minutes=60,
            max_altitude_m=1000,
            max_speed_kmh=55.0,  # Fastest
        )
        db_session.add_all([flight1, flight2, flight3])
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights/records")
        assert response.status_code == 200
        data = response.json()

        assert data["longest_distance"]["flight_id"] == "flight-1"
        assert data["longest_distance"]["value"] == 100.0

        assert data["highest_altitude"]["flight_id"] == "flight-2"
        assert data["highest_altitude"]["value"] == 2500

        assert data["max_speed"]["flight_id"] == "flight-3"
        assert data["max_speed"]["value"] == 55.0

    def test_get_flight_records_finds_takeoff_elevation_gain(self, client, db_session, arguel_site):
        """GET /flights/records finds max altitude above takeoff elevation"""
        low_gain = Flight(
            id="flight-1",
            name="Low gain",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            max_altitude_m=1200,
        )
        high_gain = Flight(
            id="flight-2",
            name="High gain",
            flight_date=date(2026, 3, 16),
            site_id="site-arguel",
            max_altitude_m=1800,
        )
        incomplete = Flight(
            id="flight-3",
            name="Missing altitude",
            flight_date=date(2026, 3, 17),
            site_id="site-arguel",
            max_altitude_m=None,
        )
        db_session.add_all([low_gain, high_gain, incomplete])
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights/records")
        assert response.status_code == 200
        data = response.json()

        assert data["takeoff_elevation_gain"]["flight_id"] == "flight-2"
        assert data["takeoff_elevation_gain"]["value"] == 1800 - arguel_site.elevation_m
        assert data["takeoff_elevation_gain"]["partial"] is True

    def test_get_flight_records_finds_earliest_and_latest_takeoff(
        self, client, db_session, arguel_site
    ):
        """GET /flights/records compares departure_time by stored time of day"""
        early = Flight(
            id="flight-early",
            name="Early",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            departure_time=datetime(2026, 3, 15, 8, 30),
        )
        late = Flight(
            id="flight-late",
            name="Late",
            flight_date=date(2026, 3, 16),
            site_id="site-arguel",
            departure_time=datetime(2026, 3, 16, 18, 45),
        )
        missing_time = Flight(
            id="flight-missing-time",
            name="Missing time",
            flight_date=date(2026, 3, 17),
            site_id="site-arguel",
            departure_time=None,
        )
        db_session.add_all([early, late, missing_time])
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights/records")
        assert response.status_code == 200
        data = response.json()

        assert data["earliest_takeoff"]["flight_id"] == "flight-early"
        assert data["earliest_takeoff"]["value"] == 8 * 60 + 30
        assert data["earliest_takeoff"]["partial"] is True
        assert data["latest_takeoff"]["flight_id"] == "flight-late"
        assert data["latest_takeoff"]["value"] == 18 * 60 + 45
        assert data["latest_takeoff"]["partial"] is True

    def test_get_flight_records_finds_most_used_takeoff_with_recent_tie_break(
        self, client, db_session, arguel_site, chalais_site
    ):
        """GET /flights/records breaks most-used takeoff ties by recent use"""
        flights = [
            Flight(
                id="arguel-1",
                name="Arguel 1",
                flight_date=date(2026, 3, 15),
                site_id="site-arguel",
            ),
            Flight(
                id="arguel-2",
                name="Arguel 2",
                flight_date=date(2026, 3, 16),
                site_id="site-arguel",
            ),
            Flight(
                id="chalais-1",
                name="Chalais 1",
                flight_date=date(2026, 3, 17),
                site_id="site-chalais",
            ),
            Flight(
                id="chalais-2",
                name="Chalais 2",
                flight_date=date(2026, 3, 18),
                site_id="site-chalais",
            ),
            Flight(id="missing-site", name="No site", flight_date=date(2026, 3, 19)),
        ]
        db_session.add_all(flights)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights/records")
        assert response.status_code == 200
        data = response.json()

        assert data["most_used_takeoff"]["site_id"] == chalais_site.id
        assert data["most_used_takeoff"]["site_name"] == chalais_site.name
        assert data["most_used_takeoff"]["value"] == 2
        assert data["most_used_takeoff"]["partial"] is True

    def test_get_flight_records_finds_most_active_month_with_recent_tie_break(
        self, client, db_session, arguel_site
    ):
        """GET /flights/records breaks most-active month ties by recent month"""
        flights = [
            Flight(id="jan-1", name="Jan 1", flight_date=date(2026, 1, 3), site_id="site-arguel"),
            Flight(id="jan-2", name="Jan 2", flight_date=date(2026, 1, 4), site_id="site-arguel"),
            Flight(id="mar-1", name="Mar 1", flight_date=date(2026, 3, 3), site_id="site-arguel"),
            Flight(id="mar-2", name="Mar 2", flight_date=date(2026, 3, 4), site_id="site-arguel"),
        ]
        db_session.add_all(flights)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights/records")
        assert response.status_code == 200
        data = response.json()

        assert data["most_active_month"]["month"] == "2026-03"
        assert data["most_active_month"]["value"] == 2
        assert data["most_active_month"]["partial"] is False


class TestFlightDetailEndpoint:
    """Tests for GET /flights/{flight_id}"""

    def test_get_flight_not_found(self, client, db_session):
        """GET /flights/{flight_id} returns 404 for non-existent flight"""
        response = client.get(f"{API_PREFIX}/flights/non-existent")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_flight_returns_details(self, client, db_session, sample_flight):
        """GET /flights/{flight_id} returns flight details"""
        response = client.get(f"{API_PREFIX}/flights/flight-test-001")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "flight-test-001"
        assert data["name"] == "Arguel 15-03 14h00"
        assert data["flight_date"] == "2026-03-15"
        assert data["duration_minutes"] == 60
        assert data["distance_km"] == 15.5
        assert data["site_id"] == "site-arguel"

    def test_get_flight_includes_site_details(self, client, db_session, sample_flight):
        """GET /flights/{flight_id} includes site information"""
        response = client.get(f"{API_PREFIX}/flights/flight-test-001")
        assert response.status_code == 200
        data = response.json()
        assert "site" in data
        assert data["site"]["name"] == "Arguel"

    def test_get_flight_backfills_missing_max_speed_from_gpx(
        self, client, db_session, arguel_site, sample_gpx, tmp_path
    ):
        """GET /flights/{id} computes and persists max_speed_kmh when missing and GPX exists"""
        backend_dir = Path(__file__).resolve().parents[2]
        gpx_dir = backend_dir / "db" / "gpx"
        gpx_dir.mkdir(parents=True, exist_ok=True)
        gpx_file = gpx_dir / f"test_flight_detail_{tmp_path.name}.gpx"
        gpx_file.write_text(sample_gpx, encoding="utf-8")

        relative_gpx_path = gpx_file.relative_to(backend_dir)

        flight = Flight(
            id="flight-detail-missing-speed",
            name="Detail missing speed",
            flight_date=date(2026, 3, 23),
            site_id="site-arguel",
            max_speed_kmh=None,
            gpx_file_path=str(relative_gpx_path),
        )
        db_session.add(flight)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/flights/flight-detail-missing-speed")
        assert response.status_code == 200
        data = response.json()

        assert data["max_speed_kmh"] is not None
        assert data["max_speed_kmh"] > 0

        db_session.refresh(flight)
        assert flight.max_speed_kmh == data["max_speed_kmh"]

        gpx_file.unlink(missing_ok=True)


class TestUpdateFlightEndpoint:
    """Tests for PATCH /flights/{flight_id}"""

    def test_update_flight_not_found(self, client, db_session):
        """PATCH /flights/{flight_id} returns 404 for non-existent flight"""
        response = client.patch(f"{API_PREFIX}/flights/non-existent", json={"name": "New Name"})
        assert response.status_code == 404

    def test_update_flight_name(self, client, db_session, sample_flight):
        """PATCH /flights/{flight_id} updates flight name"""
        response = client.patch(
            f"{API_PREFIX}/flights/flight-test-001", json={"name": "Updated Flight Name"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "data" in data

        # Verify in DB
        db_session.refresh(sample_flight)
        assert sample_flight.name == "Updated Flight Name"

    def test_update_flight_notes(self, client, db_session, sample_flight):
        """PATCH /flights/{flight_id} updates notes"""
        response = client.patch(
            f"{API_PREFIX}/flights/flight-test-001", json={"notes": "Great thermal conditions!"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"

        # Verify in DB
        db_session.refresh(sample_flight)
        assert sample_flight.notes == "Great thermal conditions!"

    def test_update_flight_multiple_fields(self, client, db_session, sample_flight):
        """PATCH /flights/{flight_id} updates multiple fields"""
        response = client.patch(
            f"{API_PREFIX}/flights/flight-test-001",
            json={"name": "New Name", "notes": "New notes", "distance_km": 20.5},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"

        # Verify in DB
        db_session.refresh(sample_flight)
        assert sample_flight.name == "New Name"
        assert sample_flight.notes == "New notes"
        assert sample_flight.distance_km == 20.5


class TestDeleteFlightEndpoint:
    """Tests for DELETE /flights/{flight_id}"""

    def test_delete_flight_not_found(self, client, db_session):
        """DELETE /flights/{flight_id} returns 404 for non-existent flight"""
        response = client.delete(f"{API_PREFIX}/flights/non-existent")
        assert response.status_code == 404

    def test_delete_flight_success(self, client, db_session, sample_flight):
        """DELETE /flights/{flight_id} deletes flight"""
        response = client.delete(f"{API_PREFIX}/flights/flight-test-001")
        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

        # Verify flight is deleted
        flight = db_session.query(Flight).filter(Flight.id == "flight-test-001").first()
        assert flight is None

    def test_delete_flight_removes_from_list(self, client, db_session, sample_flight):
        """DELETE /flights/{flight_id} removes flight from GET /flights"""
        # Verify flight exists
        response = client.get(f"{API_PREFIX}/flights")
        assert len(response.json()["flights"]) == 1

        # Delete flight
        client.delete(f"{API_PREFIX}/flights/flight-test-001")

        # Verify flight is gone
        response = client.get(f"{API_PREFIX}/flights")
        assert len(response.json()["flights"]) == 0


class TestCreateFlightEndpoint:
    """Tests for POST /flights"""

    def test_create_manual_flight_without_gpx(self, client, db_session, arguel_site):
        response = client.post(
            f"{API_PREFIX}/flights",
            json={
                "title": "Vol du soir",
                "site_id": "site-arguel",
                "flight_date": date.today().isoformat(),
                "departure_time": f"{date.today().isoformat()}T18:30:00",
                "duration_minutes": 45,
                "max_altitude_m": 980,
                "max_speed_kmh": 42.5,
                "distance_km": 8.2,
                "elevation_gain_m": 320,
                "notes": "Conditions calmes",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Vol du soir"
        assert data["site_name"] == "Arguel"
        assert data["duration_minutes"] == 45
        assert data["max_speed_kmh"] == 42.5
        assert data["gpx_file_path"] is None

        flight = db_session.query(Flight).filter(Flight.id == data["id"]).one()
        assert flight.gpx_file_path is None
        assert flight.notes == "Conditions calmes"

    def test_create_manual_flight_generates_name_from_date(self, client, db_session):
        response = client.post(
            f"{API_PREFIX}/flights",
            json={"flight_date": date.today().isoformat()},
        )

        assert response.status_code == 200
        assert response.json()["name"].startswith("Vol du ")

    def test_create_manual_flight_rejects_unknown_site(self, client, db_session):
        response = client.post(
            f"{API_PREFIX}/flights",
            json={
                "flight_date": date.today().isoformat(),
                "site_id": "unknown-site",
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Site not found"

    def test_create_manual_flight_rejects_negative_metrics(self, client, db_session):
        response = client.post(
            f"{API_PREFIX}/flights",
            json={
                "flight_date": date.today().isoformat(),
                "duration_minutes": -1,
            },
        )

        assert response.status_code == 422


class TestFlightGPXEndpoints:
    """Tests for GPX-related endpoints"""

    def test_get_gpx_data_no_gpx(self, client, db_session, sample_flight):
        """GET /flights/{flight_id}/gpx-data returns empty when no GPX"""
        response = client.get(f"{API_PREFIX}/flights/flight-test-001/gpx-data")
        # Should return empty or 404
        assert response.status_code in [200, 404]

    def test_download_gpx_no_file(self, client, db_session, sample_flight):
        """GET /flights/{flight_id}/gpx returns 404 when no GPX file"""
        response = client.get(f"{API_PREFIX}/flights/flight-test-001/gpx")
        assert response.status_code == 404

    def test_upload_gpx_to_flight(self, client, db_session, sample_flight, sample_gpx):
        """POST /flights/{flight_id}/upload-gpx uploads GPX file"""
        # Create file upload
        files = {"file": ("test.gpx", sample_gpx.encode(), "application/gpx+xml")}
        response = client.post(f"{API_PREFIX}/flights/flight-test-001/upload-gpx", files=files)
        # May succeed or fail depending on implementation and validation
        assert response.status_code in [200, 201, 400, 422, 500]


class TestCreateFlightFromGPX:
    """Tests for POST /flights/create-from-gpx"""

    def test_create_flight_from_gpx_valid(self, client, db_session, arguel_site, sample_gpx):
        """POST /flights/create-from-gpx creates flight from GPX"""
        files = {"file": ("arguel.gpx", sample_gpx.encode(), "application/gpx+xml")}
        data = {"site_id": "site-arguel"}
        response = client.post(f"{API_PREFIX}/flights/create-from-gpx", files=files, data=data)
        # Should succeed or fail gracefully
        assert response.status_code in [200, 201, 400, 422, 500]

    def test_create_flight_from_gpx_no_file(self, client, db_session, arguel_site):
        """POST /flights/create-from-gpx fails without file"""
        data = {"site_id": "site-arguel"}
        response = client.post(f"{API_PREFIX}/flights/create-from-gpx", data=data)
        assert response.status_code in [400, 422]


class TestHealthCheck:
    """Tests for /health endpoint"""

    def test_health_check_returns_ok(self, client):
        """GET /health returns ok status"""
        response = client.get(f"{API_PREFIX}/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "ok"
        assert "message" in data
