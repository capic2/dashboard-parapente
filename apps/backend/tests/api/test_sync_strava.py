"""
API tests for POST /flights/sync-strava endpoint

Verifies that Strava activity sync creates flights with the correct
normalized name format: "Vol du DD/MM/YYYY à HH:MM"
"""

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

from models import Flight

API_PREFIX = "/api"


class TestSyncStravaEndpoint:
    """Tests for POST /flights/sync-strava"""

    def test_sync_strava_flight_name_format(self, client, db_session, sample_strava_activity):
        """Sync creates flight with name 'Vol du DD/MM/YYYY à HH:MM'"""
        with (
            patch(
                "strava.get_activities_by_period",
                new=AsyncMock(return_value=[sample_strava_activity]),
            ),
            patch("strava.download_gpx", new=AsyncMock(return_value=None)),
            patch("strava.save_gpx_file", new=MagicMock(return_value=None)),
        ):
            response = client.post(
                f"{API_PREFIX}/flights/sync-strava",
                json={"date_from": "2026-03-01", "date_to": "2026-03-31"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["imported"] == 1

        flight = db_session.query(Flight).filter(Flight.strava_id == "123456789").first()
        assert flight is not None
        assert flight.name == "Vol du 15/03/2026 à 15:00"
        # title keeps the raw Strava name
        assert flight.title == "Arguel 15-03 14h00"

    def test_sync_strava_flight_name_without_time(self, client, db_session):
        """Sync with unparseable datetime falls back to 'Vol du DD/MM/YYYY'"""
        activity = {
            "id": 999888777,
            "name": "Morning Flight",
            "start_date_local": "2026-06-10T00:00:00",
            "moving_time": 1800,
            "distance": 5000.0,
            "total_elevation_gain": 300.0,
            "elev_high": 900.0,
        }

        with (
            patch("strava.get_activities_by_period", new=AsyncMock(return_value=[activity])),
            patch("strava.download_gpx", new=AsyncMock(return_value=None)),
            patch("strava.save_gpx_file", new=MagicMock(return_value=None)),
        ):
            response = client.post(
                f"{API_PREFIX}/flights/sync-strava",
                json={"date_from": "2026-06-01", "date_to": "2026-06-30"},
            )

        assert response.status_code == 200
        flight = db_session.query(Flight).filter(Flight.strava_id == "999888777").first()
        assert flight is not None
        assert flight.name == "Vol du 10/06/2026 à 00:00"

    def test_sync_strava_skips_duplicates(self, client, db_session, sample_strava_activity):
        """Sync skips activities that already exist in DB"""
        existing = Flight(
            id="existing-flight",
            name="Vol du 15/03/2026 à 15:00",
            flight_date=date(2026, 3, 15),
            strava_id="123456789",
        )
        db_session.add(existing)
        db_session.commit()

        with (
            patch(
                "strava.get_activities_by_period",
                new=AsyncMock(return_value=[sample_strava_activity]),
            ),
            patch("strava.download_gpx", new=AsyncMock(return_value=None)),
            patch("strava.save_gpx_file", new=MagicMock(return_value=None)),
        ):
            response = client.post(
                f"{API_PREFIX}/flights/sync-strava",
                json={"date_from": "2026-03-01", "date_to": "2026-03-31"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["imported"] == 0
        assert data["skipped"] == 1

        flights = db_session.query(Flight).filter(Flight.strava_id == "123456789").all()
        assert len(flights) == 1
