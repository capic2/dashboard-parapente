"""
Live tests for WeatherAPI scraper
"""
import pytest
from scrapers.weatherapi import fetch_weatherapi
from config import WEATHERAPI_KEY

ARGUEL_LAT = 47.2
ARGUEL_LON = 6.0

@pytest.mark.asyncio
@pytest.mark.xfail(reason="API key may be missing or API down", strict=False)
@pytest.mark.skipif(not WEATHERAPI_KEY, reason="WEATHERAPI_KEY not configured")
async def test_fetch_weatherapi_success():
    result = await fetch_weatherapi(ARGUEL_LAT, ARGUEL_LON, days=2)
    assert "success" in result
    assert "source" in result
    assert result["source"] == "weatherapi"
    if result["success"]:
        assert "data" in result
        assert "forecast" in result["data"]

@pytest.mark.asyncio
@pytest.mark.skipif(not WEATHERAPI_KEY, reason="WEATHERAPI_KEY not configured")
async def test_fetch_weatherapi_timeout():
    import time
    start = time.time()
    result = await fetch_weatherapi(ARGUEL_LAT, ARGUEL_LON, days=1)
    duration = time.time() - start
    assert duration < 15.0
    assert "success" in result
