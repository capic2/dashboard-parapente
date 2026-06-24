from datetime import datetime, timedelta

import pytest

from scrapers import emagram_screenshots
from scrapers import open_meteo_sounding


class _FakeOpenMeteoResponse:
    def __init__(self, url: str, payload: dict) -> None:
        self.url = url
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


class _FakeOpenMeteoClient:
    def __init__(self, payload: dict) -> None:
        self.payload = payload
        self.requests: list[tuple[str, dict]] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def get(self, url: str, params: dict) -> _FakeOpenMeteoResponse:
        self.requests.append((url, params))
        return _FakeOpenMeteoResponse(f"{url}?stub=true", self.payload)


def _open_meteo_payload() -> dict:
    hourly = {"time": [f"2026-06-24T{hour:02d}:00" for hour in range(24)]}
    for pressure in open_meteo_sounding.METEOFRANCE_PRESSURE_LEVELS:
        hourly[f"temperature_{pressure}hPa"] = [20 - pressure / 100] * 24
        hourly[f"dew_point_{pressure}hPa"] = [15 - pressure / 120] * 24
        hourly[f"wind_speed_{pressure}hPa"] = [18.52] * 24
        hourly[f"wind_direction_{pressure}hPa"] = [270] * 24
        hourly[f"geopotential_height_{pressure}hPa"] = [
            open_meteo_sounding.STANDARD_HEIGHTS[pressure]
        ] * 24
    return {"elevation": 250, "hourly": hourly}


def _open_meteo_payload_hours(hours: int) -> dict:
    base_time = datetime(2026, 6, 24)
    hourly = {
        "time": [
            (base_time + timedelta(hours=hour)).isoformat(timespec="minutes")
            for hour in range(hours)
        ]
    }
    for pressure in open_meteo_sounding.COMMON_PRESSURE_LEVELS:
        hourly[f"temperature_{pressure}hPa"] = [20 - pressure / 100] * hours
        hourly[f"dew_point_{pressure}hPa"] = [15 - pressure / 120] * hours
        hourly[f"wind_speed_{pressure}hPa"] = [18.52] * hours
        hourly[f"wind_direction_{pressure}hPa"] = [270] * hours
        hourly[f"geopotential_height_{pressure}hPa"] = [
            open_meteo_sounding.STANDARD_HEIGHTS[pressure]
        ] * hours
    return {"elevation": 250, "hourly": hourly}


@pytest.mark.asyncio
async def test_fetch_open_meteo_sounding_normalizes_arome(monkeypatch) -> None:
    fake_client = _FakeOpenMeteoClient(_open_meteo_payload())
    monkeypatch.setattr(
        open_meteo_sounding.httpx,
        "AsyncClient",
        lambda **kwargs: fake_client,
    )

    result = await open_meteo_sounding.fetch_open_meteo_sounding(
        latitude=47.2,
        longitude=6.0,
        model="arome",
        day_index=0,
        hour=12,
    )

    assert result["success"] is True
    assert result["source"] == "open-meteo-arome"
    assert result["forecast_hour"] == 12
    assert result["forecast_hour_index"] == 12
    assert result["generator_data"]["pressure_hpa"][0] == 1000
    assert result["generator_data"]["wind_speed_knots"][0] == pytest.approx(10.0)

    requested_url, params = fake_client.requests[0]
    assert requested_url == "https://api.open-meteo.com/v1/meteofrance"
    assert params["models"] == "meteofrance_seamless"
    assert "dew_point_1000hPa" in params["hourly"]
    assert "geopotential_height_1000hPa" in params["hourly"]


@pytest.mark.asyncio
async def test_fetch_all_emagram_screenshots_includes_open_meteo_sources(monkeypatch) -> None:
    async def fake_meteo_parapente(*args, **kwargs):
        return {"success": True, "source": "meteo-parapente", "image_path": "/tmp/mp.png"}

    async def fake_meteociel(*args, **kwargs):
        return {"success": True, "source": "meteociel", "image_path": "/tmp/mc.png"}

    async def fake_open_meteo(*args, model: str, **kwargs):
        return {
            "success": True,
            "source": f"open-meteo-{model}",
            "image_path": f"/tmp/{model}.png",
        }

    monkeypatch.setattr(emagram_screenshots, "screenshot_meteo_parapente", fake_meteo_parapente)
    monkeypatch.setattr(emagram_screenshots, "screenshot_meteociel_emagram", fake_meteociel)
    monkeypatch.setattr(emagram_screenshots, "generate_open_meteo_emagram_image", fake_open_meteo)

    result = await emagram_screenshots.fetch_all_emagram_screenshots(
        spot_id="arguel",
        latitude=47.2,
        longitude=6.0,
        spot_name="Arguel",
        hour=12,
    )

    sources = {screenshot["source"] for screenshot in result["screenshots"]}
    assert result["success"] is True
    assert result["sources_total"] == 4
    assert result["sources_successful"] == 4
    assert sources == {
        "meteo-parapente",
        "meteociel",
        "open-meteo-arome",
        "open-meteo-icon",
    }


@pytest.mark.asyncio
async def test_fetch_open_meteo_sounding_rejects_negative_indices(monkeypatch) -> None:
    fake_client = _FakeOpenMeteoClient(_open_meteo_payload())
    monkeypatch.setattr(
        open_meteo_sounding.httpx,
        "AsyncClient",
        lambda **kwargs: fake_client,
    )

    result = await open_meteo_sounding.fetch_open_meteo_sounding(
        latitude=47.2,
        longitude=6.0,
        day_index=-1,
        hour=12,
        model="icon",
    )

    assert result["success"] is False
    assert "Invalid forecast time" in result["error"]
    assert fake_client.requests == []


@pytest.mark.asyncio
async def test_fetch_open_meteo_sounding_requests_enough_days_for_absolute_hour(
    monkeypatch,
) -> None:
    fake_client = _FakeOpenMeteoClient(_open_meteo_payload_hours(48))
    monkeypatch.setattr(
        open_meteo_sounding.httpx,
        "AsyncClient",
        lambda **kwargs: fake_client,
    )

    result = await open_meteo_sounding.fetch_open_meteo_sounding(
        latitude=47.2,
        longitude=6.0,
        forecast_hour=30,
        model="icon",
    )

    assert result["success"] is True
    assert fake_client.requests[0][1]["forecast_days"] == 2
