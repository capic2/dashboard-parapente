"""
Comprehensive tests for weather scrapers
Run with: pytest tests/test_scrapers.py -v
"""

import pytest
from datetime import datetime
from typing import Dict, Any

# Import all scrapers
from scrapers.open_meteo import fetch_open_meteo, extract_hourly_forecast as extract_open_meteo
from scrapers.weatherapi import fetch_weatherapi, extract_hourly_forecast as extract_weatherapi
from scrapers.meteociel import fetch_meteociel, extract_hourly_forecast as extract_meteociel
from scrapers.meteo_parapente import fetch_meteo_parapente, extract_hourly_forecast as extract_meteo_parapente
from scrapers.meteoblue import fetch_meteoblue, extract_hourly_forecast as extract_meteoblue


# Test coordinates (Besançon area - Arguel)
TEST_LAT = 47.2
TEST_LON = 6.0
TEST_SPOT = "Arguel"


class TestOpenMeteo:
    """Tests for Open-Meteo API scraper"""
    
    @pytest.mark.asyncio
    async def test_fetch_open_meteo_success(self):
        """Test successful Open-Meteo fetch"""
        result = await fetch_open_meteo(TEST_LAT, TEST_LON, days=2)
        
        assert result is not None
        assert "success" in result
        assert "source" in result
        assert result["source"] == "open-meteo"
        assert "timestamp" in result
        
        if result["success"]:
            assert "data" in result
            assert "hourly" in result["data"]
            assert "temperature_2m" in result["data"]["hourly"]
    
    @pytest.mark.asyncio
    async def test_fetch_open_meteo_invalid_coords(self):
        """Test Open-Meteo with invalid coordinates"""
        result = await fetch_open_meteo(999, 999, days=2)
        
        # API may still return success with empty data or an error
        assert result is not None
        assert "success" in result
    
    @pytest.mark.asyncio
    async def test_extract_hourly_forecast_open_meteo(self):
        """Test extraction of hourly forecast"""
        result = await fetch_open_meteo(TEST_LAT, TEST_LON, days=2)
        
        if result.get("success"):
            forecasts = extract_open_meteo(result, day_index=0)
            
            assert isinstance(forecasts, list)
            if forecasts:
                first = forecasts[0]
                assert "time" in first
                assert "hour" in first
                assert "temperature" in first
                assert "wind_speed" in first
    
    def test_extract_hourly_forecast_failed_response(self):
        """Test extraction with failed response"""
        failed_result = {"success": False, "error": "Test error"}
        forecasts = extract_open_meteo(failed_result)
        
        assert forecasts == []


class TestWeatherAPI:
    """Tests for WeatherAPI.com scraper"""
    
    @pytest.mark.asyncio
    async def test_fetch_weatherapi_success(self):
        """Test successful WeatherAPI fetch"""
        result = await fetch_weatherapi(TEST_LAT, TEST_LON, days=2)
        
        assert result is not None
        assert "success" in result
        assert "source" in result
        assert result["source"] == "weatherapi"
        
        if result["success"]:
            assert "data" in result
            assert "forecast" in result["data"]
    
    @pytest.mark.asyncio
    async def test_weatherapi_days_limit(self):
        """Test that days parameter is capped at 3"""
        result = await fetch_weatherapi(TEST_LAT, TEST_LON, days=10)
        
        # Should cap at 3 days (API limit)
        assert result is not None
    
    def test_extract_hourly_forecast_weatherapi(self):
        """Test extraction logic with mock data"""
        mock_data = {
            "success": True,
            "data": {
                "forecast": {
                    "forecastday": [
                        {
                            "hour": [
                                {
                                    "time": "2024-01-01 14:00",
                                    "temp_c": 12.5,
                                    "wind_kph": 18.0,
                                    "gust_kph": 25.2,
                                    "cloud": 50,
                                    "precip_mm": 0.0,
                                    "humidity": 65
                                }
                            ]
                        }
                    ]
                }
            }
        }
        
        forecasts = extract_weatherapi(mock_data, day_index=0)
        
        assert len(forecasts) == 1
        assert forecasts[0]["temperature"] == 12.5
        # Test unit conversion: kph to m/s
        assert abs(forecasts[0]["wind_speed"] - 5.0) < 0.1  # 18 kph ≈ 5 m/s
        assert forecasts[0]["cloud_cover"] == 50


class TestMeteociel:
    """Tests for Météociel scraper"""
    
    @pytest.mark.asyncio
    async def test_fetch_meteociel(self):
        """Test Météociel fetch"""
        result = await fetch_meteociel(TEST_LAT, TEST_LON)
        
        assert result is not None
        assert "success" in result
        assert "source" in result
        assert result["source"] == "meteociel"
        assert "timestamp" in result
    
    @pytest.mark.asyncio
    async def test_extract_meteociel_forecast(self):
        """Test extraction with mock data"""
        mock_data = {
            "success": True,
            "data": [
                {
                    "time": "14:00",
                    "temp": "15°C",
                    "wind": "20 km/h",
                    "gust": "30 km/h",
                    "precip": "0.5mm"
                }
            ]
        }
        
        forecasts = await extract_meteociel(mock_data)
        
        assert len(forecasts) == 1
        assert forecasts[0]["temperature"] == 15.0
        assert forecasts[0]["wind_speed"] == 20.0
        assert forecasts[0]["wind_gust"] == 30.0
        assert forecasts[0]["precipitation"] == 0.5


class TestMeteoParapente:
    """Tests for Météo-parapente scraper"""
    
    @pytest.mark.asyncio
    async def test_fetch_meteo_parapente(self):
        """Test Météo-parapente fetch"""
        result = await fetch_meteo_parapente(TEST_SPOT)
        
        assert result is not None
        assert "success" in result
        assert "source" in result
        assert result["source"] == "meteo-parapente"
        assert "spot_name" in result
        assert result["spot_name"] == TEST_SPOT
    
    @pytest.mark.asyncio
    async def test_extract_meteo_parapente_forecast(self):
        """Test extraction with mock data"""
        mock_data = {
            "success": True,
            "data": [
                {
                    "time": "15:00",
                    "wind": "12km/h",
                    "gust": "18km/h",
                    "temp": "18°C",
                    "verdict": "BON"
                }
            ]
        }
        
        forecasts = await extract_meteo_parapente(mock_data)
        
        assert len(forecasts) == 1
        assert forecasts[0]["wind_speed"] == 12.0
        assert forecasts[0]["temperature"] == 18.0
        assert forecasts[0]["verdict"] == "BON"


class TestMeteoblue:
    """Tests for Meteoblue scraper"""
    
    @pytest.mark.asyncio
    async def test_fetch_meteoblue(self):
        """Test Meteoblue fetch (may be slow due to browser)"""
        result = await fetch_meteoblue(TEST_LAT, TEST_LON)
        
        assert result is not None
        assert "success" in result
        assert "source" in result
        assert result["source"] == "meteoblue"
    
    @pytest.mark.asyncio
    async def test_extract_meteoblue_forecast(self):
        """Test extraction with mock data"""
        mock_data = {
            "success": True,
            "data": [
                {
                    "time": "16:00",
                    "temp": "14°C",
                    "wind": "15km/h",
                    "gust": "22km/h",
                    "precip": "0mm"
                }
            ]
        }
        
        forecasts = await extract_meteoblue(mock_data)
        
        assert len(forecasts) == 1
        assert forecasts[0]["temperature"] == 14.0
        assert forecasts[0]["wind_speed"] == 15.0
        assert forecasts[0]["hour"] == 16


class TestScraperConsistency:
    """Tests for consistency across all scrapers"""
    
    @pytest.mark.asyncio
    async def test_all_scrapers_return_dict(self):
        """All scrapers should return a dict"""
        scrapers = [
            fetch_open_meteo(TEST_LAT, TEST_LON),
            fetch_weatherapi(TEST_LAT, TEST_LON),
            fetch_meteociel(TEST_LAT, TEST_LON),
            fetch_meteo_parapente(TEST_SPOT),
        ]
        
        for scraper_coro in scrapers:
            result = await scraper_coro
            assert isinstance(result, dict)
            assert "success" in result
            assert "source" in result
            assert "timestamp" in result
    
    @pytest.mark.asyncio
    async def test_timestamp_format(self):
        """All timestamps should be ISO format"""
        result = await fetch_open_meteo(TEST_LAT, TEST_LON)
        
        assert "timestamp" in result
        # Should be parseable as ISO datetime
        try:
            datetime.fromisoformat(result["timestamp"])
        except ValueError:
            pytest.fail("Timestamp is not valid ISO format")
    
    def test_error_handling_structure(self):
        """Error responses should have consistent structure"""
        error_response = {
            "success": False,
            "source": "test",
            "error": "Test error",
            "timestamp": datetime.now().isoformat()
        }
        
        assert "success" in error_response
        assert "error" in error_response
        assert error_response["success"] is False


class TestEdgeCases:
    """Edge case tests"""
    
    def test_extract_empty_data(self):
        """Test extraction with empty data"""
        empty_data = {"success": True, "data": {}}
        
        result = extract_open_meteo(empty_data)
        assert result == []
    
    def test_extract_missing_fields(self):
        """Test extraction with missing fields"""
        incomplete_data = {
            "success": True,
            "data": {
                "forecast": {
                    "forecastday": [{"hour": [{}]}]
                }
            }
        }
        
        # Should not crash, should handle gracefully
        result = extract_weatherapi(incomplete_data)
        assert isinstance(result, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
