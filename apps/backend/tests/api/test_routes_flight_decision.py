API_PREFIX = "/api"


def _forecast_payload():
    return {
        "success": True,
        "sunrise": "08:00",
        "sunset": "18:00",
        "cached_at": "2026-05-30T10:00:00Z",
        "total_sources": 4,
        "consensus": [
            {
                "hour": 12,
                "num_sources": 4,
                "temperature": 20,
                "wind_speed": 12,
                "wind_gust": 16,
                "wind_direction": 225,
                "precipitation": 0,
                "cloud_cover": 30,
                "cape": 100,
                "lifted_index": 0,
                "thermal_strength": "faible",
            }
        ],
    }


class TestFlightDecisionEndpoint:
    def test_invalid_site_returns_404(self, client, db_session):
        response = client.get(f"{API_PREFIX}/flight-decision/missing-site")

        assert response.status_code == 404

    def test_returns_decision_contract(self, client, db_session, arguel_site, monkeypatch):
        import routes

        async def fake_forecast(*args, **kwargs):
            return _forecast_payload()

        monkeypatch.setattr(routes, "get_normalized_forecast", fake_forecast)

        response = client.get(
            f"{API_PREFIX}/flight-decision/site-arguel?day_index=1&objective=progression"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["site"]["id"] == "site-arguel"
        assert data["objective"] == "progression"
        assert data["timezone"] == "Europe/Paris"
        assert data["summary"]["level"] in {"favorable", "vigilance"}
        assert data["summary"]["translation_key"].startswith("flightDecision.level.")
        assert data["best_window"] is not None
        assert data["hourly"][0]["score_objectif"] >= 0
        assert data["hourly"][0]["wind_decollage"]["status"] == "face"
        assert data["confidence"]["translation_key"].startswith("flightDecision.confidence.")
        assert data["live_wind"]["status"] == "not_evaluated"
        assert data["alternatives"] == []

    def test_invalid_objective_falls_back_to_default(
        self, client, db_session, arguel_site, monkeypatch
    ):
        import routes

        async def fake_forecast(*args, **kwargs):
            return _forecast_payload()

        monkeypatch.setattr(routes, "get_normalized_forecast", fake_forecast)

        response = client.get(f"{API_PREFIX}/flight-decision/site-arguel?objective=distance")

        assert response.status_code == 200
        assert response.json()["objective"] == "tranquille"
