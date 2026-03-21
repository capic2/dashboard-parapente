"""
Live tests for Meteo-Parapente scraper
"""
import pytest
from scrapers.meteo_parapente import fetch_meteo_parapente

ARGUEL_LAT = 47.2
ARGUEL_LON = 6.0

@pytest.mark.asyncio
@pytest.mark.xfail(reason="Website may be down or HTML changed", strict=False)
async def test_fetch_meteo_parapente_success():
    result = await fetch_meteo_parapente(ARGUEL_LAT, ARGUEL_LON)
    assert "success" in result
    assert "source" in result
    assert result["source"] == "meteo-parapente"

@pytest.mark.asyncio
async def test_fetch_meteo_parapente_timeout():
    import time
    start = time.time()
    result = await fetch_meteo_parapente(ARGUEL_LAT, ARGUEL_LON)
    duration = time.time() - start
    assert duration < 30.0
    assert "success" in result
