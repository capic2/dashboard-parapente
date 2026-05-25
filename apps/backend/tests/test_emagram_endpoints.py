"""
Test emagram analysis endpoints
"""

import json
from datetime import datetime, time, timedelta
from unittest.mock import AsyncMock, patch

import pytest

import app_settings
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
            analysis_date=datetime.utcnow().date(),
            analysis_time=time(12, 0),
            analysis_datetime=datetime.utcnow(),
            forecast_date=datetime.utcnow().date(),
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

    def test_get_emagram_screenshot_regenerates_missing_file(self, client, db_session, tmp_path):
        """Missing screenshot files are regenerated instead of returning 404"""
        from models import EmagramAnalysis

        missing_file = tmp_path / "missing.png"
        regenerated_file = tmp_path / "regenerated.png"

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
            id="screenshot-analysis",
            station_code="site-arguel",
            station_name="Arguel",
            station_latitude=47.2,
            station_longitude=6.0,
            analysis_date=datetime.utcnow().date(),
            analysis_time=datetime.utcnow().time(),
            analysis_datetime=datetime.utcnow(),
            forecast_date=datetime.utcnow().date(),
            forecast_hour=12,
            distance_km=0.0,
            data_source="multi-source-vision",
            sounding_time="12Z",
            analysis_method="llm_vision",
            analysis_status="completed",
            screenshot_paths=json.dumps({"meteo-parapente": str(missing_file)}),
        )
        db_session.add(analysis)
        db_session.commit()

        async def _regenerate(*args, **kwargs):
            regenerated_file.write_bytes(b"png")
            return {
                "success": True,
                "source": "meteo-parapente",
                "image_path": str(regenerated_file),
                "external_url": "https://example.test",
                "timestamp": datetime.now().isoformat(),
            }

        with patch("scrapers.emagram_screenshots.screenshot_meteo_parapente", new=_regenerate):
            response = client.get("/api/emagram/screenshot/screenshot-analysis/meteo-parapente")

        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert response.content == b"png"

        refreshed = db_session.get(EmagramAnalysis, "screenshot-analysis")
        assert refreshed is not None
        assert json.loads(refreshed.screenshot_paths)["meteo-parapente"] == str(regenerated_file)
        assert regenerated_file.exists()
        assert not missing_file.exists()

    def test_get_emagram_screenshot_does_not_store_missing_regenerated_file(
        self, client, db_session, tmp_path
    ):
        """Regeneration results must point to an existing file before DB update."""
        missing_file = tmp_path / "missing.png"
        regenerated_file = tmp_path / "not-written.png"
        original_paths = json.dumps({"meteo-parapente": str(missing_file)})
        analysis = EmagramAnalysis(
            id="screenshot-missing-regenerated",
            station_code="site-arguel",
            station_name="Arguel",
            station_latitude=47.2,
            station_longitude=6.0,
            analysis_date=datetime.utcnow().date(),
            analysis_time=datetime.utcnow().time(),
            analysis_datetime=datetime.utcnow(),
            forecast_date=datetime.utcnow().date(),
            forecast_hour=12,
            distance_km=0.0,
            data_source="multi-source-vision",
            sounding_time="12Z",
            analysis_method="llm_vision",
            analysis_status="completed",
            screenshot_paths=original_paths,
        )
        db_session.add(analysis)
        db_session.commit()

        async def _regenerate(*args, **kwargs):
            return {
                "success": True,
                "source": "meteo-parapente",
                "image_path": str(regenerated_file),
            }

        with patch("scrapers.emagram_screenshots.screenshot_meteo_parapente", new=_regenerate):
            response = client.get(
                "/api/emagram/screenshot/screenshot-missing-regenerated/meteo-parapente"
            )

        assert response.status_code == 404
        refreshed = db_session.get(EmagramAnalysis, "screenshot-missing-regenerated")
        assert refreshed is not None
        assert refreshed.screenshot_paths == original_paths

    def test_get_emagram_screenshot_does_not_regenerate_past_forecast(
        self, client, db_session, tmp_path
    ):
        """Past forecasts should not trigger invalid screenshot regeneration calls."""
        missing_file = tmp_path / "missing.png"
        analysis = EmagramAnalysis(
            id="screenshot-past-forecast",
            station_code="site-arguel",
            station_name="Arguel",
            station_latitude=47.2,
            station_longitude=6.0,
            analysis_date=datetime.utcnow().date(),
            analysis_time=datetime.utcnow().time(),
            analysis_datetime=datetime.utcnow(),
            forecast_date=(datetime.utcnow() - timedelta(days=1)).date(),
            forecast_hour=12,
            distance_km=0.0,
            data_source="multi-source-vision",
            sounding_time="12Z",
            analysis_method="llm_vision",
            analysis_status="completed",
            screenshot_paths=json.dumps({"meteo-parapente": str(missing_file)}),
        )
        db_session.add(analysis)
        db_session.commit()

        regenerate = AsyncMock()
        with patch("scrapers.emagram_screenshots.screenshot_meteo_parapente", regenerate):
            response = client.get(
                "/api/emagram/screenshot/screenshot-past-forecast/meteo-parapente"
            )

        assert response.status_code == 404
        regenerate.assert_not_called()

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

    def test_get_latest_ignores_stale_analysis(self, client, db_session):
        """Latest endpoint does not return stale analyses outside freshness window."""
        app_settings.invalidate_cache()

        site = Site(
            id="site-stale",
            code="STS",
            name="Stale Site",
            latitude=47.0,
            longitude=6.0,
            elevation_m=500,
        )
        db_session.add(site)

        stale_analysis = EmagramAnalysis(
            id="stale-analysis",
            station_code="site-stale",
            station_name="Stale Site",
            station_latitude=47.0,
            station_longitude=6.0,
            analysis_date=datetime.utcnow().date(),
            analysis_time=datetime.utcnow().time(),
            analysis_datetime=datetime.utcnow() - timedelta(hours=4),
            forecast_date=datetime.utcnow().date(),
            distance_km=0.0,
            data_source="test",
            sounding_time="12Z",
            analysis_method="llm_vision",
            score_volabilite=65,
            analysis_status="completed",
        )
        db_session.add(stale_analysis)
        db_session.commit()

        response = client.get("/api/emagram/latest?site_id=site-stale")
        assert response.status_code == 200
        assert response.json() is None

    def test_get_latest_hour_returns_most_recent_attempt_for_site(self, client, db_session):
        """Latest endpoint returns newest hourly attempt even if it failed."""
        app_settings.invalidate_cache()

        site = Site(
            id="site-latest-hour-recent",
            code="SLR",
            name="Latest Hour Site",
            latitude=47.0,
            longitude=6.0,
            elevation_m=500,
        )
        db_session.add(site)

        completed_old = EmagramAnalysis(
            id="latest-hour-completed-old",
            station_code="site-latest-hour-recent",
            station_name="Latest Hour Site",
            station_latitude=47.0,
            station_longitude=6.0,
            analysis_date=datetime.utcnow().date(),
            analysis_time=datetime.utcnow().time(),
            analysis_datetime=datetime.utcnow() - timedelta(hours=2),
            forecast_date=datetime.utcnow().date(),
            forecast_hour=13,
            distance_km=0.0,
            data_source="test",
            sounding_time="12Z",
            analysis_method="llm_vision",
            score_volabilite=77,
            analysis_status="completed",
        )
        failed_new = EmagramAnalysis(
            id="latest-hour-failed-new",
            station_code="site-latest-hour-recent",
            station_name="Latest Hour Site",
            station_latitude=47.0,
            station_longitude=6.0,
            analysis_date=datetime.utcnow().date(),
            analysis_time=datetime.utcnow().time(),
            analysis_datetime=datetime.utcnow() - timedelta(minutes=10),
            forecast_date=datetime.utcnow().date(),
            forecast_hour=13,
            distance_km=0.0,
            data_source="test",
            sounding_time="12Z",
            analysis_method="llm_vision",
            analysis_status="failed",
            error_message="Recent provider timeout",
        )
        db_session.add(completed_old)
        db_session.add(failed_new)
        db_session.commit()

        response = client.get("/api/emagram/latest?site_id=site-latest-hour-recent&hour=13")
        assert response.status_code == 200

        data = response.json()
        assert data is not None
        assert data["forecast_hour"] == 13
        assert data["analysis_status"] == "failed"
        assert data["error_message"] == "Recent provider timeout"

    def test_get_emagram_hours_ignores_stale_analysis(self, client, db_session):
        """Hourly endpoint excludes stale analyses but still exposes pending slots."""
        app_settings.invalidate_cache()

        site = Site(
            id="site-stale-hours",
            code="STH",
            name="Stale Hours Site",
            latitude=47.0,
            longitude=6.0,
            elevation_m=500,
        )
        db_session.add(site)

        stale_analysis = EmagramAnalysis(
            id="stale-hours-analysis",
            station_code="site-stale-hours",
            station_name="Stale Hours Site",
            station_latitude=47.0,
            station_longitude=6.0,
            analysis_date=datetime.utcnow().date(),
            analysis_time=datetime.utcnow().time(),
            analysis_datetime=datetime.utcnow() - timedelta(hours=4),
            forecast_date=datetime.utcnow().date(),
            forecast_hour=14,
            distance_km=0.0,
            data_source="test",
            sounding_time="12Z",
            analysis_method="llm_vision",
            score_volabilite=70,
            analysis_status="completed",
        )
        db_session.add(stale_analysis)
        db_session.commit()

        with patch(
            "weather_pipeline.get_normalized_forecast",
            new=AsyncMock(side_effect=RuntimeError("forecast unavailable")),
        ):
            response = client.get("/api/emagram/hours?site_id=site-stale-hours&day_index=0")
        assert response.status_code == 200
        hours = response.json()["hours"]
        assert len(hours) == 14
        assert hours[0]["hour"] == 7
        assert hours[-1]["hour"] == 20
        assert all(h["status"] == "pending" for h in hours)

    def test_get_emagram_hours_includes_failed_with_error(self, client, db_session):
        """Hourly endpoint exposes failed hourly analyses and their error message."""
        app_settings.invalidate_cache()

        site = Site(
            id="site-hours-failed",
            code="SHF",
            name="Failed Hours Site",
            latitude=47.0,
            longitude=6.0,
            elevation_m=500,
        )
        db_session.add(site)

        failed_analysis = EmagramAnalysis(
            id="failed-hours-analysis",
            station_code="site-hours-failed",
            station_name="Failed Hours Site",
            station_latitude=47.0,
            station_longitude=6.0,
            analysis_date=datetime.utcnow().date(),
            analysis_time=datetime.utcnow().time(),
            analysis_datetime=datetime.utcnow(),
            forecast_date=datetime.utcnow().date(),
            forecast_hour=14,
            distance_km=0.0,
            data_source="test",
            sounding_time="12Z",
            analysis_method="llm_vision",
            analysis_status="failed",
            error_message="LLM timeout",
        )
        db_session.add(failed_analysis)
        db_session.commit()

        with patch(
            "weather_pipeline.get_normalized_forecast",
            new=AsyncMock(return_value={"sunrise": "13:45", "sunset": "15:10"}),
        ):
            response = client.get("/api/emagram/hours?site_id=site-hours-failed&day_index=0")
        assert response.status_code == 200

        hours = response.json()["hours"]
        assert [h["hour"] for h in hours] == [13, 14, 15]

        failed_hour = next(h for h in hours if h["hour"] == 14)
        assert failed_hour["status"] == "failed"
        assert failed_hour["error_message"] == "LLM timeout"

        pending_hours = [h for h in hours if h["hour"] in (13, 15)]
        assert all(h["status"] == "pending" for h in pending_hours)

    def test_get_emagram_hours_keeps_most_recent_status_per_hour(self, client, db_session):
        """Hourly endpoint returns latest attempt for a given hour."""
        app_settings.invalidate_cache()

        site = Site(
            id="site-hours-most-recent",
            code="SHR",
            name="Most Recent Hours Site",
            latitude=47.0,
            longitude=6.0,
            elevation_m=500,
        )
        db_session.add(site)

        completed_old = EmagramAnalysis(
            id="completed-old",
            station_code="site-hours-most-recent",
            station_name="Most Recent Hours Site",
            station_latitude=47.0,
            station_longitude=6.0,
            analysis_date=datetime.utcnow().date(),
            analysis_time=datetime.utcnow().time(),
            analysis_datetime=datetime.utcnow() - timedelta(hours=2),
            forecast_date=datetime.utcnow().date(),
            forecast_hour=15,
            distance_km=0.0,
            data_source="test",
            sounding_time="12Z",
            analysis_method="llm_vision",
            score_volabilite=78,
            analysis_status="completed",
        )
        failed_new = EmagramAnalysis(
            id="failed-new",
            station_code="site-hours-most-recent",
            station_name="Most Recent Hours Site",
            station_latitude=47.0,
            station_longitude=6.0,
            analysis_date=datetime.utcnow().date(),
            analysis_time=datetime.utcnow().time(),
            analysis_datetime=datetime.utcnow() - timedelta(minutes=20),
            forecast_date=datetime.utcnow().date(),
            forecast_hour=15,
            distance_km=0.0,
            data_source="test",
            sounding_time="12Z",
            analysis_method="llm_vision",
            analysis_status="failed",
            error_message="Source scrape failed",
        )
        db_session.add(completed_old)
        db_session.add(failed_new)
        db_session.commit()

        with patch(
            "weather_pipeline.get_normalized_forecast",
            new=AsyncMock(return_value={"sunrise": "14:00", "sunset": "16:00"}),
        ):
            response = client.get("/api/emagram/hours?site_id=site-hours-most-recent&day_index=0")
        assert response.status_code == 200

        hours = response.json()["hours"]
        assert [h["hour"] for h in hours] == [14, 15, 16]

        selected_hour = next(h for h in hours if h["hour"] == 15)
        assert selected_hour["status"] == "failed"
        assert selected_hour["error_message"] == "Source scrape failed"

        pending_hours = [h for h in hours if h["hour"] in (14, 16)]
        assert all(h["status"] == "pending" for h in pending_hours)

    def test_get_emagram_hours_returns_pending_slots_from_sunrise_sunset(self, client, db_session):
        """Hourly endpoint returns full sunrise/sunset range even without analyses."""
        app_settings.invalidate_cache()

        site = Site(
            id="site-hours-pending-range",
            code="SPR",
            name="Pending Range Site",
            latitude=47.0,
            longitude=6.0,
            elevation_m=500,
        )
        db_session.add(site)
        db_session.commit()

        with patch(
            "weather_pipeline.get_normalized_forecast",
            new=AsyncMock(return_value={"sunrise": "06:32", "sunset": "18:47"}),
        ):
            response = client.get("/api/emagram/hours?site_id=site-hours-pending-range&day_index=0")

        assert response.status_code == 200
        hours = response.json()["hours"]
        assert [h["hour"] for h in hours] == list(range(6, 19))
        assert all(h["status"] == "pending" for h in hours)
        assert all(h["score"] is None for h in hours)

    def test_get_emagram_hours_falls_back_to_default_range_on_forecast_error(
        self, client, db_session
    ):
        """Hourly endpoint uses default 07-20 range when sunrise/sunset cannot be computed."""
        app_settings.invalidate_cache()

        site = Site(
            id="site-hours-default-range",
            code="SDR",
            name="Default Range Site",
            latitude=47.0,
            longitude=6.0,
            elevation_m=500,
        )
        db_session.add(site)
        db_session.commit()

        with patch(
            "weather_pipeline.get_normalized_forecast",
            new=AsyncMock(side_effect=RuntimeError("boom")),
        ):
            response = client.get("/api/emagram/hours?site_id=site-hours-default-range&day_index=0")

        assert response.status_code == 200
        hours = response.json()["hours"]
        assert [h["hour"] for h in hours] == list(range(7, 21))
        assert all(h["status"] == "pending" for h in hours)

    def test_get_emagram_hours_returns_404_for_unknown_site(self, client):
        """Hourly endpoint returns 404 for unknown site id."""
        response = client.get("/api/emagram/hours?site_id=unknown-site&day_index=0")

        assert response.status_code == 404
        assert response.json()["detail"] == "Site not found"

    def test_get_emagram_hours_returns_400_without_coordinates(self, client, db_session):
        """Hourly endpoint returns 400 when site has no coordinates."""
        app_settings.invalidate_cache()

        site = Site(
            id="site-hours-no-coords",
            code="SNC",
            name="No Coordinates Site",
            latitude=None,
            longitude=None,
            elevation_m=500,
        )
        db_session.add(site)
        db_session.commit()

        response = client.get("/api/emagram/hours?site_id=site-hours-no-coords&day_index=0")

        assert response.status_code == 400
        assert response.json()["detail"] == "Site has no coordinates configured"

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
                analysis_date=datetime.utcnow().date(),
                analysis_time=time(12, 0),
                analysis_datetime=datetime.utcnow(),
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
                analysis_date=datetime.utcnow().date(),
                analysis_time=time(12, 0),
                analysis_datetime=datetime.utcnow(),
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
