"""Configuration centralisée pour tous les scrapers"""

from typing import Dict, List
from enum import Enum


class SourceStatus(Enum):
    """Status d'une source de données"""
    ACTIVE = "active"
    DISABLED = "disabled"
    MAINTENANCE = "maintenance"


# Configuration des sources
SOURCES_CONFIG = {
    "open-meteo": {
        "status": SourceStatus.ACTIVE,
        "base_url": "https://api.open-meteo.com/v1/forecast",
        "timeout": 10,
        "max_retries": 3,
        "temporal_resolution": "1h",
        "coverage": "24h/day",
        "forecast_range": "7 days",
        "model": "ICON/GFS",
        "provides": ["temperature", "wind_speed", "wind_direction", "wind_gust", 
                     "precipitation", "cloud_cover", "cape", "lifted_index"]
    },
    "weatherapi": {
        "status": SourceStatus.ACTIVE,
        "base_url": "http://api.weatherapi.com/v1/forecast.json",
        "timeout": 10,
        "max_retries": 3,
        "requires_auth": True,
        "env_var": "WEATHERAPI_KEY",
        "temporal_resolution": "1h",
        "coverage": "24h/day",
        "forecast_range": "3 days",
        "model": "Proprietary",
        "provides": ["temperature", "wind_speed", "wind_gust", 
                     "precipitation", "cloud_cover", "humidity"]
    },
    "meteo-parapente": {
        "status": SourceStatus.ACTIVE,  # ✓ Repaired! Now uses REST API
        "base_url": "https://data0.meteo-parapente.com/data.php",
        "autocomplete_url": "https://api-search.meteo-parapente.com/v1/autocomplete",
        "status_url": "https://data0.meteo-parapente.com/status.php",
        "timeout": 15,
        "max_retries": 2,
        "requires_js": False,  # Uses REST API, not browser automation
        "temporal_resolution": "30min",
        "coverage": "04:00-21:00",
        "forecast_range": "1-2 days",
        "model": "AROME (Météo-France)",
        "provides": ["temperature", "wind_speed", "wind_direction"]
    },
    "meteociel": {
        "status": SourceStatus.ACTIVE,  # ✓ Repaired! Now uses AROME hourly forecasts
        "base_url": "https://www.meteociel.fr/previsions-arome-1h/",
        "geocoding_api": "https://geo.api.gouv.fr/communes",
        "timeout": 20,
        "max_retries": 2,
        "requires_site_name": True,  # Requires site_name parameter
        "temporal_resolution": "1h",
        "coverage": "24h/day (~48h forecast)",
        "forecast_range": "2 days",
        "model": "AROME 1.3km (Météo-France)",
        "provides": ["temperature", "wind_speed", "wind_gust", "precipitation", "humidity", "pressure"],
        "note": "Requires major French cities with AROME coverage"
    },
    "meteoblue": {
        "status": SourceStatus.ACTIVE,
        "enabled": True,
        "base_url": "https://www.meteoblue.com",
        "requires_api_key": False,
        "free_tier_limit": None,
        "temporal_resolution": "1h",
        "coverage": "24h/day",
        "forecast_range": "7 days (168 hours)",
        "model": "Meteoblue (multi-model ensemble)",
        "provides": ["temperature", "wind_speed", "wind_direction", "precipitation", "cloud_cover"],
        "note": "Web scraping with Playwright (activates 1h toggle for 24h data)"
    }
}


def get_active_sources() -> List[str]:
    """Get list of active sources"""
    return [
        name for name, config in SOURCES_CONFIG.items()
        if config["status"] == SourceStatus.ACTIVE
    ]


def get_source_config(source_name: str) -> Dict:
    """Get configuration for a specific source"""
    return SOURCES_CONFIG.get(source_name, {})


def is_source_active(source_name: str) -> bool:
    """Check if a source is active"""
    config = get_source_config(source_name)
    return config.get("status") == SourceStatus.ACTIVE
