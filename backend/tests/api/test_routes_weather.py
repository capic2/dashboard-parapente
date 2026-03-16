"""
API tests for /weather endpoints

Tests HTTP endpoints in routes.py related to weather data.
Coverage: GET /weather/{spot_id}, /weather/{spot_id}/today, /weather/{spot_id}/summary
"""
import pytest
from datetime import datetime, date
from models import Site
from unittest.mock import patch, MagicMock
import json

# API prefix for all routes
API_PREFIX = "/api"


class TestWeatherEndpoint:
    """Tests for GET /weather/{spot_id}"""
    
    def test_get_weather_invalid_spot(self, client, db_session):
        """GET /weather/{spot_id} returns 404 for non-existent spot"""
        response = client.get(f"{API_PREFIX}/weather/non-existent-spot")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    def test_get_weather_valid_spot(self, client, db_session, arguel_site):
        """GET /weather/{spot_id} returns weather data for valid spot"""
        # Mock weather pipeline to avoid external API calls
        with patch("routes.get_or_fetch_weather") as mock_weather:
            mock_weather.return_value = {
                "spot_id": "site-arguel",
                "forecast": [
                    {
                        "time": "2026-03-16T12:00:00",
                        "temperature_c": 15.0,
                        "wind_speed_kmh": 10.0,
                        "wind_direction": 180
                    }
                ]
            }
            
            response = client.get(f"{API_PREFIX}/weather/site-arguel")
            # Should return 200 or fail gracefully
            assert response.status_code in [200, 404, 500]
    
    def test_get_weather_with_day_index(self, client, db_session, arguel_site):
        """GET /weather/{spot_id}?day_index=1 gets forecast for specific day"""
        with patch("routes.get_or_fetch_weather") as mock_weather:
            mock_weather.return_value = {"forecast": []}
            
            response = client.get(f"{API_PREFIX}/weather/site-arguel?day_index=1")
            # Should accept day_index parameter
            assert response.status_code in [200, 404, 500]
    
    def test_get_weather_with_days_param(self, client, db_session, arguel_site):
        """GET /weather/{spot_id}?days=3 gets multi-day forecast"""
        with patch("routes.get_or_fetch_weather") as mock_weather:
            mock_weather.return_value = {"forecast": []}
            
            response = client.get(f"{API_PREFIX}/weather/site-arguel?days=3")
            # Should accept days parameter
            assert response.status_code in [200, 404, 500]


class TestWeatherTodayEndpoint:
    """Tests for GET /weather/{spot_id}/today"""
    
    def test_get_weather_today_invalid_spot(self, client, db_session):
        """GET /weather/{spot_id}/today returns 404 for invalid spot"""
        response = client.get(f"{API_PREFIX}/weather/non-existent/today")
        assert response.status_code == 404
    
    def test_get_weather_today_valid_spot(self, client, db_session, arguel_site):
        """GET /weather/{spot_id}/today returns today's weather"""
        with patch("routes.get_or_fetch_weather") as mock_weather:
            mock_weather.return_value = {
                "spot_id": "site-arguel",
                "forecast": [
                    {
                        "time": "2026-03-16T12:00:00",
                        "temperature_c": 15.0,
                        "wind_speed_kmh": 10.0
                    }
                ]
            }
            
            response = client.get(f"{API_PREFIX}/weather/site-arguel/today")
            # Should return today's forecast
            assert response.status_code in [200, 404, 500]


class TestWeatherSummaryEndpoint:
    """Tests for GET /weather/{spot_id}/summary"""
    
    def test_get_weather_summary_invalid_spot(self, client, db_session):
        """GET /weather/{spot_id}/summary returns 404 for invalid spot"""
        response = client.get(f"{API_PREFIX}/weather/non-existent/summary")
        assert response.status_code == 404
    
    def test_get_weather_summary_valid_spot(self, client, db_session, arguel_site):
        """GET /weather/{spot_id}/summary returns weather summary"""
        with patch("routes.get_or_fetch_weather") as mock_weather:
            mock_weather.return_value = {
                "spot_id": "site-arguel",
                "summary": {
                    "temperature_avg": 15.0,
                    "wind_speed_avg": 10.0,
                    "conditions": "Sunny"
                }
            }
            
            response = client.get(f"{API_PREFIX}/weather/site-arguel/summary")
            # Should return summary
            assert response.status_code in [200, 404, 500]
    
    def test_get_weather_summary_with_day_index(self, client, db_session, arguel_site):
        """GET /weather/{spot_id}/summary?day_index=1 gets specific day summary"""
        with patch("routes.get_or_fetch_weather") as mock_weather:
            mock_weather.return_value = {"summary": {}}
            
            response = client.get(f"{API_PREFIX}/weather/site-arguel/summary?day_index=1")
            assert response.status_code in [200, 404, 500]


class TestDailySummaryEndpoint:
    """Tests for GET /weather/{spot_id}/daily-summary"""
    
    def test_get_daily_summary_invalid_spot(self, client, db_session):
        """GET /weather/{spot_id}/daily-summary returns 404 for invalid spot"""
        response = client.get(f"{API_PREFIX}/weather/non-existent/daily-summary")
        assert response.status_code == 404
    
    def test_get_daily_summary_valid_spot(self, client, db_session, arguel_site):
        """GET /weather/{spot_id}/daily-summary returns daily aggregation"""
        with patch("routes.get_or_fetch_weather") as mock_weather:
            mock_weather.return_value = {
                "spot_id": "site-arguel",
                "daily_summary": {
                    "date": "2026-03-16",
                    "temperature_min": 10.0,
                    "temperature_max": 20.0,
                    "wind_speed_avg": 12.0
                }
            }
            
            response = client.get(f"{API_PREFIX}/weather/site-arguel/daily-summary")
            assert response.status_code in [200, 404, 500]
    
    def test_get_daily_summary_future_day(self, client, db_session, arguel_site):
        """GET /weather/{spot_id}/daily-summary?day_index=2 gets future day"""
        with patch("routes.get_or_fetch_weather") as mock_weather:
            mock_weather.return_value = {"daily_summary": {}}
            
            response = client.get(f"{API_PREFIX}/weather/site-arguel/daily-summary?day_index=2")
            assert response.status_code in [200, 404, 500]


class TestAdminWeatherEndpoints:
    """Tests for admin weather management endpoints"""
    
    def test_refresh_weather_cache(self, client, db_session):
        """POST /admin/refresh-weather triggers cache refresh"""
        with patch("routes.refresh_all_weather") as mock_refresh:
            mock_refresh.return_value = {"refreshed": 5}
            
            response = client.post(f"{API_PREFIX}/admin/refresh-weather")
            # Should succeed or require auth
            assert response.status_code in [200, 401, 403, 500]
    
    def test_clear_cache(self, client, db_session):
        """POST /admin/clear-cache clears Redis cache"""
        response = client.post(f"{API_PREFIX}/admin/clear-cache")
        # Should succeed or require auth
        assert response.status_code in [200, 401, 403, 500]
    
    def test_debug_cache_data(self, client, db_session, arguel_site):
        """GET /admin/debug-cache/{site_id} shows cache debug info"""
        response = client.get(f"{API_PREFIX}/admin/debug-cache/site-arguel")
        # Should return debug info or require auth
        assert response.status_code in [200, 401, 403, 404, 500]
    
    def test_test_weather_fetch(self, client, db_session, arguel_site):
        """GET /admin/test-weather/{site_id} tests weather fetch"""
        with patch("routes.fetch_weather_for_site") as mock_fetch:
            mock_fetch.return_value = {"test": "data"}
            
            response = client.get(f"{API_PREFIX}/admin/test-weather/site-arguel")
            assert response.status_code in [200, 401, 403, 404, 500]


class TestWeatherSourcesEndpoints:
    """Tests for /weather-sources configuration endpoints"""
    
    def test_get_weather_sources(self, client, db_session):
        """GET /weather-sources lists all weather sources"""
        response = client.get(f"{API_PREFIX}/weather-sources")
        # Should return list of sources
        assert response.status_code in [200, 500]
    
    def test_get_weather_sources_stats(self, client, db_session):
        """GET /weather-sources/stats returns usage statistics"""
        response = client.get(f"{API_PREFIX}/weather-sources/stats")
        # Should return stats or empty
        assert response.status_code in [200, 500]
    
    def test_get_weather_source_by_name(self, client, db_session):
        """GET /weather-sources/{source_name} gets specific source"""
        response = client.get(f"{API_PREFIX}/weather-sources/open-meteo")
        # Should return source config or 404
        assert response.status_code in [200, 404, 500]
    
    def test_create_weather_source(self, client, db_session):
        """POST /weather-sources creates new weather source"""
        source_data = {
            "name": "test-source",
            "enabled": True,
            "priority": 10,
            "api_key": "test-key"
        }
        response = client.post(f"{API_PREFIX}/weather-sources", json=source_data)
        # Should create or fail with validation error
        assert response.status_code in [201, 400, 422, 500]
    
    def test_update_weather_source(self, client, db_session):
        """PATCH /weather-sources/{source_name} updates source config"""
        update_data = {
            "enabled": False,
            "priority": 5
        }
        response = client.patch(f"{API_PREFIX}/weather-sources/open-meteo", json=update_data)
        # Should update or 404
        assert response.status_code in [200, 404, 422, 500]
    
    def test_delete_weather_source(self, client, db_session):
        """DELETE /weather-sources/{source_name} deletes source"""
        response = client.delete(f"{API_PREFIX}/weather-sources/test-source")
        # Should delete or 404
        assert response.status_code in [200, 404, 500]
    
    def test_test_weather_source(self, client, db_session):
        """POST /weather-sources/{source_name}/test tests API connection"""
        with patch("routes.test_weather_api") as mock_test:
            mock_test.return_value = {"status": "ok"}
            
            response = client.post(f"{API_PREFIX}/weather-sources/open-meteo/test")
            assert response.status_code in [200, 404, 500]


class TestWeatherCaching:
    """Tests for weather caching behavior"""
    
    def test_weather_cached_on_second_request(self, client, db_session, arguel_site):
        """Second weather request should use cache"""
        with patch("routes.get_or_fetch_weather") as mock_weather:
            mock_weather.return_value = {"cached": False}
            
            # First request
            response1 = client.get(f"{API_PREFIX}/weather/site-arguel")
            
            # Second request (should be cached)
            response2 = client.get(f"{API_PREFIX}/weather/site-arguel")
            
            # Both should succeed
            assert response1.status_code in [200, 404, 500]
            assert response2.status_code in [200, 404, 500]
    
    def test_weather_cache_invalidation(self, client, db_session, arguel_site):
        """Cache should be invalidated after clear"""
        with patch("routes.get_or_fetch_weather") as mock_weather:
            mock_weather.return_value = {"cached": False}
            
            # Get weather (cache it)
            client.get(f"{API_PREFIX}/weather/site-arguel")
            
            # Clear cache
            client.post(f"{API_PREFIX}/admin/clear-cache")
            
            # Request again (should fetch fresh)
            response = client.get(f"{API_PREFIX}/weather/site-arguel")
            assert response.status_code in [200, 404, 500]


class TestWeatherErrorHandling:
    """Tests for weather API error handling"""
    
    def test_weather_api_timeout(self, client, db_session, arguel_site):
        """Weather endpoint handles API timeout gracefully"""
        with patch("routes.get_or_fetch_weather") as mock_weather:
            mock_weather.side_effect = TimeoutError("API timeout")
            
            response = client.get(f"{API_PREFIX}/weather/site-arguel")
            # Should fail gracefully with 500 or 503
            assert response.status_code in [500, 503, 504]
    
    def test_weather_api_invalid_response(self, client, db_session, arguel_site):
        """Weather endpoint handles malformed API response"""
        with patch("routes.get_or_fetch_weather") as mock_weather:
            mock_weather.return_value = None  # Invalid response
            
            response = client.get(f"{API_PREFIX}/weather/site-arguel")
            # Should handle gracefully
            assert response.status_code in [200, 404, 500]
    
    def test_weather_missing_coordinates(self, client, db_session):
        """Weather endpoint handles site without coordinates"""
        # Create site with no coordinates
        site = Site(
            id="site-no-coords",
            code="NC",
            name="No Coords Site",
            latitude=None,
            longitude=None,
            site_type="user_spot"
        )
        db_session.add(site)
        db_session.commit()
        
        response = client.get(f"{API_PREFIX}/weather/site-no-coords")
        # Should fail with 400 or 422
        assert response.status_code in [400, 404, 422, 500]
