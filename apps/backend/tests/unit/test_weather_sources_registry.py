import config
import pytest
import weather_sources
from weather_sources import SYSTEM_WEATHER_SOURCE_NAMES, WEATHER_SOURCE_REGISTRY


def test_registry_contains_new_forecast_sources():
    assert "open-meteo-icon" in WEATHER_SOURCE_REGISTRY
    assert "open-meteo-gfs" in WEATHER_SOURCE_REGISTRY
    assert "met-no" in WEATHER_SOURCE_REGISTRY
    assert "openweathermap" in WEATHER_SOURCE_REGISTRY
    assert "met-no" in SYSTEM_WEATHER_SOURCE_NAMES


def test_openweathermap_enablement_follows_api_key_configuration():
    source = WEATHER_SOURCE_REGISTRY["openweathermap"]

    assert source.requires_api_key is True
    assert source.is_enabled is bool(config.OPENWEATHERMAP_API_KEY)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("wrapper_name", "fetch_name"),
    [
        ("fetch_open_meteo_default", "fetch_open_meteo"),
        ("fetch_open_meteo_icon_default", "fetch_open_meteo_icon"),
        ("fetch_open_meteo_gfs_default", "fetch_open_meteo_gfs"),
    ],
)
async def test_open_meteo_wrapper_requests_only_days_needed_for_day(
    monkeypatch: pytest.MonkeyPatch, wrapper_name: str, fetch_name: str
) -> None:
    calls: list[tuple[float, float, int]] = []

    async def fake_fetch_open_meteo(lat: float, lon: float, days: int) -> dict[str, bool]:
        calls.append((lat, lon, days))
        return {"success": True}

    monkeypatch.setattr(weather_sources, fetch_name, fake_fetch_open_meteo)

    await getattr(weather_sources, wrapper_name)(47.2, 6.0, day_index=2)

    assert calls == [(47.2, 6.0, 3)]


@pytest.mark.asyncio
async def test_meteo_parapente_wrapper_requests_target_day(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, object]] = []

    class FixedDateTime:
        @classmethod
        def now(cls) -> object:
            from datetime import datetime

            return datetime(2026, 7, 4, 12, 0, 0)

    async def fake_fetch_meteo_parapente(*args: object, **kwargs: object) -> dict[str, bool]:
        calls.append(kwargs)
        return {"success": True}

    monkeypatch.setattr(weather_sources, "datetime", FixedDateTime)
    monkeypatch.setattr(weather_sources, "fetch_meteo_parapente", fake_fetch_meteo_parapente)

    await weather_sources.fetch_meteo_parapente_default(
        47.2,
        6.0,
        day_index=2,
        site_name="Arguel",
        elevation_m=500,
    )

    assert calls[0]["date"] == "20260706"


@pytest.mark.asyncio
async def test_meteoblue_wrapper_uses_location_fallback_without_site_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[float, float, str, int]] = []

    async def fake_fetch_meteoblue(
        lat: float, lon: float, city_name: str, day_index: int
    ) -> dict[str, bool]:
        calls.append((lat, lon, city_name, day_index))
        return {"success": True}

    monkeypatch.setattr(weather_sources, "fetch_meteoblue", fake_fetch_meteoblue)

    await weather_sources.fetch_meteoblue_default(47.2, 6.0, site_name=None)

    assert calls == [(47.2, 6.0, "location", 0)]


@pytest.mark.asyncio
async def test_openweathermap_wrapper_forwards_database_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[float, float, int, str | None]] = []

    async def fake_fetch_openweathermap(
        lat: float, lon: float, days: int, api_key: str | None
    ) -> dict[str, bool]:
        calls.append((lat, lon, days, api_key))
        return {"success": True}

    monkeypatch.setattr(weather_sources, "fetch_openweathermap", fake_fetch_openweathermap)

    await weather_sources.fetch_openweathermap_default(47.2, 6.0, api_key="database-key")

    assert calls == [(47.2, 6.0, 5, "database-key")]
