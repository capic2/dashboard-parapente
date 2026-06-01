import uuid

from models import WeatherSourceConfig


def test_seed_weather_sources_adds_missing_sources_and_updates_api_keys(db_session, monkeypatch):
    import main

    existing_weatherapi = WeatherSourceConfig(
        id=str(uuid.uuid4()),
        source_name="weatherapi",
        display_name="WeatherAPI.com",
        description="Existing source",
        is_enabled=False,
        requires_api_key=True,
        api_key="old-key",
        priority=9,
        scraper_type="api",
        base_url="https://www.weatherapi.com/",
        documentation_url="https://www.weatherapi.com/docs/",
    )
    db_session.add(existing_weatherapi)
    db_session.commit()

    class TestSessionLocal:
        def __call__(self):
            return db_session

    monkeypatch.setattr(main, "SessionLocal", TestSessionLocal())

    assert main.seed_weather_sources() is True

    weatherapi = (
        db_session.query(WeatherSourceConfig)
        .filter(WeatherSourceConfig.source_name == "weatherapi")
        .one()
    )
    met_no = (
        db_session.query(WeatherSourceConfig)
        .filter(WeatherSourceConfig.source_name == "met-no")
        .one()
    )

    assert weatherapi.api_key == "test_weather_key"
    assert weatherapi.is_enabled is False
    assert met_no.is_enabled is True
