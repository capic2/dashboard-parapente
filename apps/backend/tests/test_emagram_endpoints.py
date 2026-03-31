"""
Test emagram analysis endpoints
"""

import json
from datetime import datetime

import pytest

from models import EmagramAnalysis, Site


class TestEmagramEndpoints:
    """Test /api/emagram endpoints"""

    def test_get_latest_no_data(self, client, db_session):
        """Get latest emagram when no data exists"""
        response = client.get("/api/emagram/latest?user_lat=47.0&user_lon=6.0")
        assert response.status_code == 200
        assert response.json() is None

    def test_get_latest_requires_params(self, client, db_session):
        """Get latest emagram without any location params returns 400"""
        response = client.get("/api/emagram/latest")
        assert response.status_code == 400

    def test_get_latest_with_data(self, client, db_session):
        """Get latest emagram analysis"""
        # Add a site
        site = Site(
            id="site-test",
            code="TEST",
            name="Test Site",
            latitude=47.0,
            longitude=6.0,
            elevation_m=500,
        )
        db_session.add(site)
        db_session.commit()

        # Add emagram analysis
        analysis = EmagramAnalysis(
            id="test-analysis-1",
            station_code="site-test",
            station_name="Test Site",
            station_latitude=47.0,
            station_longitude=6.0,
            analysis_date=datetime.now().date(),
            analysis_time=datetime.now().time(),
            analysis_datetime=datetime.now(),  # Required field
            forecast_date=datetime.now().date(),
            distance_km=0.0,  # Required field
            data_source="wyoming",  # Required field
            sounding_time="12Z",  # Required field
            analysis_method="test",  # Required field
            plafond_thermique_m=3500,
            force_thermique_ms=2.5,
            score_volabilite=80,
            conseils_vol="Good flying conditions",
            analysis_status="completed",
            screenshot_paths=json.dumps({"meteo-parapente": "/tmp/test.png"}),
        )
        db_session.add(analysis)
        db_session.commit()

        response = client.get("/api/emagram/latest?user_lat=47.0&user_lon=6.0")
        assert response.status_code == 200
        data = response.json()
        assert data["station_name"] == "Test Site"
        assert data["score_volabilite"] == 80
        assert data["plafond_thermique_m"] == 3500
        assert "screenshot_paths" in data

    def test_get_latest_with_site_id(self, client, db_session):
        """Get latest emagram by site_id"""
        site = Site(
            id="site-arguel",
            code="ARG",
            name="Arguel",
            latitude=47.2,
            longitude=6.0,
            elevation_m=427,
        )
        db_session.add(site)

        analysis = EmagramAnalysis(
            id="test-site-analysis",
            station_code="site-arguel",
            station_name="Arguel",
            station_latitude=47.2,
            station_longitude=6.0,
            analysis_date=datetime(2026, 3, 24).date(),
            analysis_time=datetime(2026, 3, 24, 12, 0).time(),
            analysis_datetime=datetime.utcnow(),
            forecast_date=datetime.utcnow().date(),
            distance_km=0.0,
            data_source="test",
            sounding_time="12Z",
            analysis_method="llm_vision",
            plafond_thermique_m=2800,
            force_thermique_ms=2.0,
            score_volabilite=72,
            analysis_status="completed",
        )
        db_session.add(analysis)
        db_session.commit()

        response = client.get("/api/emagram/latest?site_id=site-arguel")
        assert response.status_code == 200
        data = response.json()
        assert data is not None
        assert data["station_code"] == "site-arguel"
        assert data["score_volabilite"] == 72

    def test_get_latest_with_site_id_not_found(self, client, db_session):
        """Get latest emagram with non-existent site_id returns 404"""
        response = client.get("/api/emagram/latest?site_id=nonexistent")
        assert response.status_code == 404

    def test_get_latest_with_day_index(self, client, db_session):
        """Get latest emagram with day_index filters by date"""
        site = Site(
            id="site-test-day",
            code="TSD",
            name="Test Day",
            latitude=47.0,
            longitude=6.0,
            elevation_m=500,
        )
        db_session.add(site)

        # Analysis for today
        analysis = EmagramAnalysis(
            id="today-analysis",
            station_code="site-test-day",
            station_name="Test Day",
            station_latitude=47.0,
            station_longitude=6.0,
            analysis_date=datetime.utcnow().date(),
            analysis_time=datetime.utcnow().time(),
            analysis_datetime=datetime.utcnow(),
            forecast_date=datetime.utcnow().date(),
            distance_km=0.0,
            data_source="test",
            sounding_time="12Z",
            analysis_method="llm_vision",
            score_volabilite=80,
            analysis_status="completed",
        )
        db_session.add(analysis)
        db_session.commit()

        # day_index=0 should find today's analysis
        response = client.get("/api/emagram/latest?site_id=site-test-day&day_index=0")
        assert response.status_code == 200
        assert response.json() is not None

        # day_index=3 should not find anything (no future analyses)
        response = client.get("/api/emagram/latest?site_id=site-test-day&day_index=3")
        assert response.status_code == 200
        assert response.json() is None

    def test_analyze_with_site_id(self, client, db_session):
        """Trigger analysis accepts site_id without lat/lon"""
        response = client.post(
            "/api/emagram/analyze",
            json={"site_id": "nonexistent"},
        )
        assert response.status_code == 404

    def test_analyze_requires_location(self, client, db_session):
        """Trigger analysis without site_id or lat/lon returns 400"""
        response = client.post(
            "/api/emagram/analyze",
            json={"force_refresh": True},
        )
        assert response.status_code == 400

    def test_list_analyses_empty(self, client):
        """List analyses when DB is empty"""
        response = client.get("/api/emagram/history?user_lat=47.0&user_lon=6.0")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert data == []

    def test_list_analyses_with_data(self, client, db_session):
        """List all emagram analyses"""
        # Add multiple analyses near user location (47.0, 6.0)
        for i in range(3):
            analysis = EmagramAnalysis(
                id=f"test-analysis-{i}",
                station_code=f"site-{i}",
                station_name=f"Site {i}",
                station_latitude=47.0 + i * 0.01,  # Close to user location
                station_longitude=6.0 + i * 0.01,
                analysis_date=datetime.now().date(),
                analysis_time=datetime.now().time(),
                analysis_datetime=datetime.now(),  # Required field
                distance_km=0.0,  # Required field
                data_source="wyoming",  # Required field
                sounding_time="12Z",  # Required field
                analysis_method="test",  # Required field
                plafond_thermique_m=3000 + i * 100,
                force_thermique_ms=2.0,
                score_volabilite=75 + i * 5,
                conseils_vol=f"Advice {i}",
                analysis_status="completed",
            )
            db_session.add(analysis)
        db_session.commit()

        response = client.get("/api/emagram/history?user_lat=47.0&user_lon=6.0")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 3

    def test_list_analyses_with_days_filter(self, client, db_session):
        """List analyses with days filter"""
        # Add 5 analyses at same location
        for i in range(5):
            analysis = EmagramAnalysis(
                id=f"test-analysis-{i}",
                station_code=f"site-{i}",
                station_name=f"Site {i}",
                station_latitude=47.0,
                station_longitude=6.0,
                analysis_date=datetime.now().date(),
                analysis_time=datetime.now().time(),
                analysis_datetime=datetime.now(),  # Required field
                distance_km=0.0,  # Required field
                data_source="wyoming",  # Required field
                sounding_time="12Z",  # Required field
                analysis_method="test",  # Required field
                plafond_thermique_m=3000,
                force_thermique_ms=2.0,
                score_volabilite=75,
                conseils_vol="Test",
                analysis_status="completed",
            )
            db_session.add(analysis)
        db_session.commit()

        # The history endpoint uses days parameter, not limit
        response = client.get("/api/emagram/history?user_lat=47.0&user_lon=6.0&days=7")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 5  # All 5 are within 7 days

    def test_analyze_missing_params(self, client):
        """Trigger analysis without any location params returns 400"""
        response = client.post("/api/emagram/analyze", json={})
        assert response.status_code == 400

    def test_analyze_invalid_coordinates(self, client):
        """Trigger analysis with invalid coordinates"""
        response = client.post(
            "/api/emagram/analyze",
            json={
                "user_latitude": 200,  # Invalid latitude
                "user_longitude": 6.0,
                "station_name": "Test",
            },
        )
        assert response.status_code == 422

    @pytest.mark.slow
    @pytest.mark.integration
    def test_analyze_full_workflow(self, client, db_session):
        """Full emagram analysis workflow (slow integration test)"""
        # This test requires actual scraping and LLM calls
        pytest.skip("Full workflow test requires live APIs and is slow")

        # Add a site
        site = Site(
            id="site-test",
            code="TEST",
            name="Test Site",
            latitude=47.0,
            longitude=6.0,
            elevation_m=500,
        )
        db_session.add(site)
        db_session.commit()

        response = client.post(
            "/api/emagram/analyze",
            json={
                "user_latitude": 47.0,
                "user_longitude": 6.0,
                "station_name": "Test Site",
                "force_refresh": True,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "score_volabilite" in data
        assert "screenshot_paths" in data
