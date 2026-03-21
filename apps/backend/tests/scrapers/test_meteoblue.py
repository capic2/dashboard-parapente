"""
Live tests for Meteoblue scraper
"""
import pytest
from scrapers.meteoblue import fetch_meteoblue
from config import METEOBLUE_API_KEY

ARGUEL_LAT = 47.2
ARGUEL_LON = 6.0

@pytest.mark.asyncio
@pytest.mark.xfail(reason="API key may be missing or API down", strict=False)
@pytest.mark.skipif(not METEOBLUE_API_KEY, reason="METEOBLUE_API_KEY not configured")
async def test_fetch_meteoblue_success():
    result = await fetch_meteoblue(ARGUEL_LAT, ARGUEL_LON)
    assert "success" in result
    assert "source" in result
    assert result["source"] == "meteoblue"
    if result["success"]:
        assert "data" in result

@pytest.mark.asyncio
@pytest.mark.skipif(not METEOBLUE_API_KEY, reason="METEOBLUE_API_KEY not configured")
async def test_fetch_meteoblue_timeout():
    import time
    start = time.time()
    result = await fetch_meteoblue(ARGUEL_LAT, ARGUEL_LON)
    duration = time.time() - start
    assert duration < 20.0
    assert "success" in result
