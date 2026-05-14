"""
Live tests for Meteociel scraper
"""

import pytest

from scrapers import meteociel
from scrapers.meteociel import MeteocielScraper, fetch_meteociel

ARGUEL_LAT = 47.2
ARGUEL_LON = 6.0


@pytest.mark.asyncio
@pytest.mark.xfail(reason="Website may be down or HTML changed", strict=False)
async def test_fetch_meteociel_success():
    result = await fetch_meteociel(ARGUEL_LAT, ARGUEL_LON)
    assert "success" in result
    assert "source" in result
    assert result["source"] == "meteociel"


@pytest.mark.asyncio
async def test_fetch_meteociel_timeout():
    import time

    start = time.time()
    result = await fetch_meteociel(ARGUEL_LAT, ARGUEL_LON)
    duration = time.time() - start
    assert duration < 30.0
    assert "success" in result


@pytest.mark.asyncio
async def test_fetch_meteociel_uses_nearest_city_slug_after_reverse_geocoding(monkeypatch):
    requested_urls = []

    async def fake_get_insee_code(self, city_name):
        return None

    async def fake_get_nearest_commune(self, lat, lon):
        return "25056", "Besançon"

    def fake_parse_forecast_tables(self, soup):
        return [{"hour": 12, "temperature": 20.0}]

    class FakeResponse:
        text = "<html></html>"

        def raise_for_status(self):
            return None

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def get(self, url):
            requested_urls.append(url)
            return FakeResponse()

    monkeypatch.setattr(MeteocielScraper, "_get_insee_code", fake_get_insee_code)
    monkeypatch.setattr(MeteocielScraper, "_get_nearest_commune", fake_get_nearest_commune)
    monkeypatch.setattr(MeteocielScraper, "_parse_forecast_tables", fake_parse_forecast_tables)
    monkeypatch.setattr(meteociel.httpx, "AsyncClient", FakeAsyncClient)

    result = await fetch_meteociel(47.24, 6.02, site_name="Test Site")

    assert result["success"] is True
    assert requested_urls == ["https://www.meteociel.fr/previsions-arome-1h/25056/besancon.htm"]
