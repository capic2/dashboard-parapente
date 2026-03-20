"""
Live tests for Open-Meteo scraper
"""
import pytest
from scrapers.open_meteo import fetch_open_meteo

ARGUEL_LAT = 47.2
ARGUEL_LON = 6.0

@pytest.mark.asyncio
@pytest.mark.xfail(reason="API may be down", strict=False)
async def test_fetch_open_meteo_success():
    result = await fetch_open_meteo(ARGUEL_LAT, ARGUEL_LON, days=2)
    assert "success" in result
    assert "source" in result
    assert result["source"] == "open-meteo"
    if result["success"]:
        assert "data" in result
        assert "hourly" in result["data"]

@pytest.mark.asyncio
async def test_fetch_open_meteo_timeout():
    import time
    start = time.time()
    result = await fetch_open_meteo(ARGUEL_LAT, ARGUEL_LON, days=1)
    duration = time.time() - start
    assert duration < 15.0
    assert "success" in result
