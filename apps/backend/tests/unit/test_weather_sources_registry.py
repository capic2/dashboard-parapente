import config
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
