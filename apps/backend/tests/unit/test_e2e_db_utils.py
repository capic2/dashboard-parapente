"""Unit tests for E2E database bootstrap helpers."""

from models import WeatherSourceConfig

from e2e_db_utils import disable_slow_weather_sources


def test_disable_slow_weather_sources_keeps_only_open_meteo_enabled(db_session):
    db_session.add_all(
        [
            WeatherSourceConfig(
                id="open-meteo",
                source_name="open-meteo",
                display_name="Open-Meteo",
                scraper_type="api",
                is_enabled=True,
            ),
            WeatherSourceConfig(
                id="meteoblue",
                source_name="meteoblue",
                display_name="Meteoblue",
                scraper_type="api",
                is_enabled=True,
            ),
            WeatherSourceConfig(
                id="meteo-parapente",
                source_name="meteo-parapente",
                display_name="Meteo-Parapente",
                scraper_type="playwright",
                is_enabled=True,
            ),
        ]
    )
    db_session.commit()

    disable_slow_weather_sources(db_session)

    rows = {
        row.source_name: row.is_enabled
        for row in db_session.query(WeatherSourceConfig).order_by(WeatherSourceConfig.source_name)
    }

    assert rows == {
        "meteo-parapente": False,
        "meteoblue": False,
        "open-meteo": True,
    }
