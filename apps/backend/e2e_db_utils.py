from sqlalchemy.orm import Session

from models import WeatherSourceConfig


def disable_slow_weather_sources(db: Session) -> None:
    """Keep E2E deterministic by enabling only the fastest weather source."""

    sources = db.query(WeatherSourceConfig).all()
    for source in sources:
        source.is_enabled = source.source_name == "open-meteo"
    db.commit()
