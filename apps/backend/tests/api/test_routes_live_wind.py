"""API tests for SpotAiR live wind endpoint."""

from unittest.mock import AsyncMock, patch

from models import Site

API_PREFIX = "/api"


class TestLiveWindEndpoint:
    def test_returns_404_for_unknown_site(self, client):
        response = client.get(f"{API_PREFIX}/sites/unknown/live-wind")
        assert response.status_code == 404
        assert response.json()["detail"] == "Site not found"

    def test_returns_400_for_site_without_coordinates(self, client, db_session):
        site = Site(id="site-no-coords", name="No Coords", latitude=None, longitude=None)
        db_session.add(site)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/sites/{site.id}/live-wind")
        assert response.status_code == 400
        assert response.json()["detail"] == "Site has no coordinates"

    def test_returns_cached_payload_when_available(self, client, db_session):
        site = Site(id="site-1", name="Arguel", latitude=47.2, longitude=6.0)
        db_session.add(site)
        db_session.commit()

        cached_payload = {
            "site_id": site.id,
            "site_name": site.name,
            "source": "spotair",
            "radius_km": 10,
            "stations": [{"id": "ffvl_123", "name": "Arguel Nord"}],
        }

        with (
            patch("cache.get_cached", new=AsyncMock(return_value=cached_payload)),
            patch("cache.set_cached", new=AsyncMock()) as mock_set,
            patch("spotair_live_wind.fetch_live_wind_stations", new=AsyncMock()) as mock_fetch,
        ):
            response = client.get(f"{API_PREFIX}/sites/{site.id}/live-wind")

        assert response.status_code == 200
        assert response.json() == cached_payload
        mock_fetch.assert_not_called()
        mock_set.assert_not_called()

    def test_fetches_and_caches_when_cache_miss(self, client, db_session):
        site = Site(id="site-2", name="Chalais", latitude=47.18, longitude=6.22)
        db_session.add(site)
        db_session.commit()

        fetched_stations = [
            {
                "id": "ffvl_5043",
                "provider": "ffvl",
                "provider_id": "5043",
                "name": "Arguel Nord",
                "distance_km": 1.2,
                "age_minutes": 8,
                "is_outdated": False,
            }
        ]

        with (
            patch("cache.get_cached", new=AsyncMock(return_value=None)),
            patch("cache.set_cached", new=AsyncMock()) as mock_set,
            patch(
                "spotair_live_wind.fetch_live_wind_stations",
                new=AsyncMock(return_value=fetched_stations),
            ) as mock_fetch,
        ):
            response = client.get(f"{API_PREFIX}/sites/{site.id}/live-wind")

        assert response.status_code == 200
        data = response.json()
        assert data["site_id"] == site.id
        assert data["site_name"] == site.name
        assert data["source"] == "spotair"
        assert data["stations"] == fetched_stations

        mock_fetch.assert_awaited_once()
        mock_set.assert_awaited_once()

    def test_returns_502_when_spotair_fetch_fails(self, client, db_session):
        site = Site(id="site-3", name="Buvilly", latitude=46.95, longitude=5.7)
        db_session.add(site)
        db_session.commit()

        with (
            patch("cache.get_cached", new=AsyncMock(return_value=None)),
            patch("cache.set_cached", new=AsyncMock()) as mock_set,
            patch(
                "spotair_live_wind.fetch_live_wind_stations",
                new=AsyncMock(side_effect=RuntimeError("boom")),
            ),
        ):
            response = client.get(f"{API_PREFIX}/sites/{site.id}/live-wind")

        assert response.status_code == 502
        assert response.json()["detail"] == "Failed to fetch SpotAiR live wind"
        mock_set.assert_not_awaited()
