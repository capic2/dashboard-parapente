"""
Live tests for Open-Meteo scraper
"""

import pytest

import scrapers.open_meteo as open_meteo

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


@pytest.mark.asyncio
async def test_fetch_open_meteo_icon_uses_icon_model(monkeypatch):
    calls: list[dict[str, object]] = []

    async def fake_fetch_open_meteo_model(**kwargs):
        calls.append(kwargs)
        return {"success": True, "source": kwargs["source"]}

    monkeypatch.setattr(open_meteo, "_fetch_open_meteo_model", fake_fetch_open_meteo_model)

    result = await open_meteo.fetch_open_meteo_icon(ARGUEL_LAT, ARGUEL_LON, days=4)

    assert result == {"success": True, "source": "open-meteo-icon"}
    assert calls == [
        {
            "lat": ARGUEL_LAT,
            "lon": ARGUEL_LON,
            "days": 4,
            "model": "icon_seamless",
            "source": "open-meteo-icon",
        }
    ]


@pytest.mark.asyncio
async def test_fetch_open_meteo_gfs_uses_gfs_model(monkeypatch):
    calls: list[dict[str, object]] = []

    async def fake_fetch_open_meteo_model(**kwargs):
        calls.append(kwargs)
        return {"success": True, "source": kwargs["source"]}

    monkeypatch.setattr(open_meteo, "_fetch_open_meteo_model", fake_fetch_open_meteo_model)

    result = await open_meteo.fetch_open_meteo_gfs(ARGUEL_LAT, ARGUEL_LON)

    assert result == {"success": True, "source": "open-meteo-gfs"}
    assert calls == [
        {
            "lat": ARGUEL_LAT,
            "lon": ARGUEL_LON,
            "days": 7,
            "model": "gfs_seamless",
            "source": "open-meteo-gfs",
        }
    ]
