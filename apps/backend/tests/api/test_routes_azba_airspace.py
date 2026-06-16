from unittest.mock import AsyncMock, patch

from models import Site

API_PREFIX = "/api"


class TestAzbaAirspaceEndpoint:
    def test_returns_404_for_unknown_site(self, client):
        response = client.get(f"{API_PREFIX}/sites/unknown/airspace/azba")

        assert response.status_code == 404
        assert response.json()["detail"] == "Site not found"

    def test_returns_400_for_site_without_coordinates(self, client, db_session):
        site = Site(id="site-no-coords", name="No Coords", latitude=None, longitude=None)
        db_session.add(site)
        db_session.commit()

        response = client.get(f"{API_PREFIX}/sites/{site.id}/airspace/azba")

        assert response.status_code == 400
        assert response.json()["detail"] == "Site has no coordinates"

    def test_returns_400_for_invalid_window(self, client, arguel_site):
        response = client.get(
            f"{API_PREFIX}/sites/{arguel_site.id}/airspace/azba"
            "?start=2026-06-16T12:00:00Z&end=2026-06-16T08:00:00Z"
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "end must be after start"

    def test_returns_azba_contract(self, client, arguel_site):
        payload = {
            "site_id": arguel_site.id,
            "site_name": arguel_site.name,
            "status": "blocking",
            "source": "SIA AZBA",
            "source_url": "https://www.sia.aviation-civile.gouv.fr/schedules",
            "retrieved_at": "2026-06-16T07:00:00Z",
            "valid_from": "2026-06-16T06:00:00Z",
            "valid_to": "2026-06-16T20:00:00Z",
            "radius_km": 10,
            "latest_azba_date": "2026-06-16",
            "constraints": [
                {
                    "id": "rtba-near",
                    "name": "RTBA TEST",
                    "valid_from": "2026-06-16T08:00:00Z",
                    "valid_to": "2026-06-16T10:00:00Z",
                    "floor": "SFC",
                    "ceiling": "4500FT",
                    "geometry": None,
                    "distance_km": 1.2,
                }
            ],
            "message": None,
        }

        with patch("routes.evaluate_site_azba_constraints", new=AsyncMock(return_value=payload)):
            response = client.get(f"{API_PREFIX}/sites/{arguel_site.id}/airspace/azba")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "blocking"
        assert data["source"] == "SIA AZBA"
        assert data["constraints"][0]["name"] == "RTBA TEST"
