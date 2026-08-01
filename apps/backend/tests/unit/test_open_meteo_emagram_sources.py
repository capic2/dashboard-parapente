from datetime import datetime, timedelta

import pytest

from scrapers import emagram_screenshots
from scrapers import open_meteo_sounding


@pytest.fixture(autouse=True)
def clear_open_meteo_state() -> None:
    open_meteo_sounding._OPEN_METEO_RATE_LIMIT_COOLDOWNS.clear()
    open_meteo_sounding._OPEN_METEO_RESPONSE_CACHE.clear()


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
    assert params["timezone"] == "Europe/Paris"
    assert params["forecast_days"] == 3
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
    assert fake_client.requests[0][1]["forecast_days"] == 3


@pytest.mark.asyncio
async def test_fetch_open_meteo_sounding_reuses_site_model_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = _open_meteo_payload_hours(72)
    payload["hourly"]["temperature_1000hPa"] = list(range(72))
    fake_client = _FakeOpenMeteoClient(payload)
    monkeypatch.setattr(
        open_meteo_sounding.httpx,
        "AsyncClient",
        lambda **kwargs: fake_client,
    )

    first = await open_meteo_sounding.fetch_open_meteo_sounding(
        latitude=47.2,
        longitude=6.0,
        model="icon",
        day_index=0,
        hour=12,
    )
    second = await open_meteo_sounding.fetch_open_meteo_sounding(
        latitude=47.2,
        longitude=6.0,
        model="icon",
        day_index=2,
        hour=15,
    )

    assert first["success"] is True
    assert first["from_cache"] is False
    assert second["success"] is True
    assert second["from_cache"] is True
    assert second["forecast_hour_index"] == 63
    assert second["generator_data"]["temperature_c"][0] == 63

    other_site = await open_meteo_sounding.fetch_open_meteo_sounding(
        latitude=46.9,
        longitude=5.8,
        model="icon",
        day_index=0,
        hour=12,
    )

    assert other_site["success"] is True
    assert other_site["from_cache"] is False
    assert len(fake_client.requests) == 2


def test_open_meteo_rate_limit_cooldown_is_global_per_model() -> None:
    first = open_meteo_sounding._open_meteo_cooldown_key("icon", 47.2, 6.0)
    second = open_meteo_sounding._open_meteo_cooldown_key("icon", 46.9, 5.8)

    assert first == second == "icon"


def test_open_meteo_response_cache_prunes_expired_and_lru_entries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(open_meteo_sounding, "OPEN_METEO_RESPONSE_CACHE_MAX_ENTRIES", 2)
    open_meteo_sounding._OPEN_METEO_RESPONSE_CACHE["expired"] = (0, {}, "expired")

    open_meteo_sounding._cache_open_meteo_response("first", {"value": 1}, "first")
    open_meteo_sounding._cache_open_meteo_response("second", {"value": 2}, "second")
    assert open_meteo_sounding._get_cached_open_meteo_response("first") is not None
    open_meteo_sounding._cache_open_meteo_response("third", {"value": 3}, "third")

    assert "expired" not in open_meteo_sounding._OPEN_METEO_RESPONSE_CACHE
    assert "second" not in open_meteo_sounding._OPEN_METEO_RESPONSE_CACHE
    assert list(open_meteo_sounding._OPEN_METEO_RESPONSE_CACHE) == ["first", "third"]


@pytest.mark.parametrize(
    ("timestamp", "expected"),
    [
        ("2026-01-15T12:00", "2026-01-15T11:00:00+00:00"),
        ("2026-07-15T12:00", "2026-07-15T10:00:00+00:00"),
    ],
)
def test_open_meteo_local_timestamp_is_converted_to_utc(timestamp: str, expected: str) -> None:
    assert open_meteo_sounding._open_meteo_timestamp_utc(timestamp).isoformat() == expected


@pytest.mark.asyncio
async def test_open_meteo_uses_valid_cache_during_model_cooldown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = _FakeOpenMeteoClient(_open_meteo_payload_hours(72))
    monkeypatch.setattr(
        open_meteo_sounding.httpx,
        "AsyncClient",
        lambda **kwargs: fake_client,
    )

    first = await open_meteo_sounding.fetch_open_meteo_sounding(
        latitude=47.2, longitude=6.0, model="icon", hour=12
    )
    open_meteo_sounding._OPEN_METEO_RATE_LIMIT_COOLDOWNS["icon"] = (
        open_meteo_sounding.monotonic() + 60
    )
    second = await open_meteo_sounding.fetch_open_meteo_sounding(
        latitude=47.2, longitude=6.0, model="icon", hour=13
    )

    assert first["success"] is True
    assert second["success"] is True
    assert second["from_cache"] is True
    assert len(fake_client.requests) == 1


@pytest.mark.asyncio
async def test_open_meteo_refreshes_cache_for_longer_horizon(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = _FakeOpenMeteoClient(_open_meteo_payload_hours(72))
    monkeypatch.setattr(
        open_meteo_sounding.httpx,
        "AsyncClient",
        lambda **kwargs: fake_client,
    )

    first = await open_meteo_sounding.fetch_open_meteo_sounding(
        latitude=47.2, longitude=6.0, model="icon", day_index=0, hour=12
    )
    fake_client.payload = _open_meteo_payload_hours(96)
    second = await open_meteo_sounding.fetch_open_meteo_sounding(
        latitude=47.2, longitude=6.0, model="icon", day_index=3, hour=12
    )

    assert first["success"] is True
    assert second["success"] is True
    assert second["from_cache"] is False
    assert second["forecast_hour_index"] == 84
    assert len(fake_client.requests) == 2
