"""Central registry for forecast weather sources."""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import config
from scrapers.met_no import extract_hourly_forecast as extract_met_no
from scrapers.met_no import fetch_met_no
from scrapers.meteo_parapente import extract_hourly_forecast as extract_mp
from scrapers.meteo_parapente import fetch_meteo_parapente
from scrapers.meteoblue import extract_hourly_forecast as extract_mb
from scrapers.meteoblue import fetch_meteoblue
from scrapers.meteociel import extract_hourly_forecast as extract_mc
from scrapers.meteociel import fetch_meteociel
from scrapers.open_meteo import extract_hourly_forecast as extract_om
from scrapers.open_meteo import fetch_open_meteo
from scrapers.open_meteo import fetch_open_meteo_gfs
from scrapers.open_meteo import fetch_open_meteo_icon
from scrapers.openweathermap import extract_hourly_forecast as extract_owm
from scrapers.openweathermap import fetch_openweathermap
from scrapers.weatherapi import extract_hourly_forecast as extract_wa
from scrapers.weatherapi import fetch_weatherapi

FetchFunction = Callable[..., Awaitable[dict[str, Any]]]
ExtractFunction = Callable[[dict[str, Any], int], list[dict[str, Any]]]


@dataclass(frozen=True)
class WeatherSourceDefinition:
    source_name: str
    display_name: str
    description: str
    is_enabled: bool
    requires_api_key: bool
    api_key: str | None
    priority: int
    scraper_type: str
    base_url: str | None
    documentation_url: str | None
    fetch: FetchFunction
    extract: ExtractFunction

    def seed_data(self) -> dict[str, Any]:
        return {
            "source_name": self.source_name,
            "display_name": self.display_name,
            "description": self.description,
            "is_enabled": self.is_enabled,
            "requires_api_key": self.requires_api_key,
            "api_key": self.api_key,
            "priority": self.priority,
            "scraper_type": self.scraper_type,
            "base_url": self.base_url,
            "documentation_url": self.documentation_url,
        }


async def fetch_open_meteo_default(lat: float, lon: float, **_: Any) -> dict[str, Any]:
    return await fetch_open_meteo(lat, lon, days=7)


async def fetch_open_meteo_icon_default(lat: float, lon: float, **_: Any) -> dict[str, Any]:
    return await fetch_open_meteo_icon(lat, lon, days=7)


async def fetch_open_meteo_gfs_default(lat: float, lon: float, **_: Any) -> dict[str, Any]:
    return await fetch_open_meteo_gfs(lat, lon, days=7)


async def fetch_weatherapi_default(lat: float, lon: float, **_: Any) -> dict[str, Any]:
    return await fetch_weatherapi(lat, lon)


async def fetch_meteo_parapente_default(
    lat: float,
    lon: float,
    *,
    site_name: str | None = None,
    elevation_m: int | None = None,
    **_: Any,
) -> dict[str, Any]:
    return await fetch_meteo_parapente(
        lat,
        lon,
        site_name=site_name,
        elevation_m=elevation_m,
        days=1,
    )


async def fetch_meteociel_default(
    lat: float,
    lon: float,
    *,
    site_name: str | None = None,
    **_: Any,
) -> dict[str, Any]:
    return await fetch_meteociel(lat, lon, site_name=site_name)


async def fetch_meteoblue_default(
    lat: float,
    lon: float,
    *,
    site_name: str | None = None,
    **_: Any,
) -> dict[str, Any]:
    return await fetch_meteoblue(lat, lon, city_name=site_name)


async def fetch_met_no_default(lat: float, lon: float, **_: Any) -> dict[str, Any]:
    return await fetch_met_no(lat, lon, days=7)


async def fetch_openweathermap_default(lat: float, lon: float, **_: Any) -> dict[str, Any]:
    return await fetch_openweathermap(lat, lon, days=5)


WEATHER_SOURCE_DEFINITIONS: tuple[WeatherSourceDefinition, ...] = (
    WeatherSourceDefinition(
        source_name="open-meteo",
        display_name="Open-Meteo AROME",
        description="API météo open-source gratuite. Utilise AROME France HD en France et best_match ailleurs.",
        is_enabled=True,
        requires_api_key=False,
        api_key=None,
        priority=10,
        scraper_type="api",
        base_url="https://api.open-meteo.com/v1/forecast",
        documentation_url="https://open-meteo.com/en/docs",
        fetch=fetch_open_meteo_default,
        extract=extract_om,
    ),
    WeatherSourceDefinition(
        source_name="open-meteo-icon",
        display_name="Open-Meteo ICON",
        description="Modèle ICON exposé séparément via Open-Meteo pour une comparaison traçable des modèles.",
        is_enabled=True,
        requires_api_key=False,
        api_key=None,
        priority=9,
        scraper_type="api",
        base_url="https://api.open-meteo.com/v1/forecast",
        documentation_url="https://open-meteo.com/en/docs",
        fetch=fetch_open_meteo_icon_default,
        extract=extract_om,
    ),
    WeatherSourceDefinition(
        source_name="open-meteo-gfs",
        display_name="Open-Meteo GFS",
        description="Modèle GFS exposé séparément via Open-Meteo pour une comparaison traçable des modèles.",
        is_enabled=True,
        requires_api_key=False,
        api_key=None,
        priority=8,
        scraper_type="api",
        base_url="https://api.open-meteo.com/v1/forecast",
        documentation_url="https://open-meteo.com/en/docs",
        fetch=fetch_open_meteo_gfs_default,
        extract=extract_om,
    ),
    WeatherSourceDefinition(
        source_name="weatherapi",
        display_name="WeatherAPI.com",
        description="API météo mondiale avec données détaillées. Clé API requise.",
        is_enabled=bool(config.WEATHERAPI_KEY),
        requires_api_key=True,
        api_key=config.WEATHERAPI_KEY,
        priority=7,
        scraper_type="api",
        base_url="https://api.weatherapi.com/v1/forecast.json",
        documentation_url="https://www.weatherapi.com/docs/",
        fetch=fetch_weatherapi_default,
        extract=extract_wa,
    ),
    WeatherSourceDefinition(
        source_name="met-no",
        display_name="MET Norway",
        description="Prévisions MET Norway Locationforecast, gratuites et sans clé API.",
        is_enabled=True,
        requires_api_key=False,
        api_key=None,
        priority=6,
        scraper_type="api",
        base_url="https://api.met.no/weatherapi/locationforecast/2.0/complete",
        documentation_url="https://api.met.no/weatherapi/locationforecast/2.0/documentation",
        fetch=fetch_met_no_default,
        extract=extract_met_no,
    ),
    WeatherSourceDefinition(
        source_name="meteo-parapente",
        display_name="Météo Parapente",
        description="Prévisions spécialisées parapente avec thermiques et conditions de vol.",
        is_enabled=True,
        requires_api_key=False,
        api_key=None,
        priority=5,
        scraper_type="playwright",
        base_url="https://meteo-parapente.com",
        documentation_url=None,
        fetch=fetch_meteo_parapente_default,
        extract=extract_mp,
    ),
    WeatherSourceDefinition(
        source_name="meteociel",
        display_name="Météociel",
        description="Prévisions AROME haute résolution pour la France. Scraping de données HTML.",
        is_enabled=True,
        requires_api_key=False,
        api_key=None,
        priority=4,
        scraper_type="playwright",
        base_url="https://www.meteociel.fr",
        documentation_url=None,
        fetch=fetch_meteociel_default,
        extract=extract_mc,
    ),
    WeatherSourceDefinition(
        source_name="meteoblue",
        display_name="Meteoblue",
        description="Prévisions météo professionnelles avec modèles multiples. API key optionnelle.",
        is_enabled=True,
        requires_api_key=False,
        api_key=config.METEOBLUE_API_KEY,
        priority=3,
        scraper_type="stealth",
        base_url="https://www.meteoblue.com",
        documentation_url="https://docs.meteoblue.com/",
        fetch=fetch_meteoblue_default,
        extract=extract_mb,
    ),
    WeatherSourceDefinition(
        source_name="openweathermap",
        display_name="OpenWeatherMap",
        description="Prévisions 5 jours par pas de 3 heures. Clé API requise.",
        is_enabled=bool(config.OPENWEATHERMAP_API_KEY),
        requires_api_key=True,
        api_key=config.OPENWEATHERMAP_API_KEY,
        priority=2,
        scraper_type="api",
        base_url="https://api.openweathermap.org/data/2.5/forecast",
        documentation_url="https://openweathermap.org/forecast5",
        fetch=fetch_openweathermap_default,
        extract=extract_owm,
    ),
)

WEATHER_SOURCE_REGISTRY = {source.source_name: source for source in WEATHER_SOURCE_DEFINITIONS}
SYSTEM_WEATHER_SOURCE_NAMES = tuple(WEATHER_SOURCE_REGISTRY.keys())


def get_weather_source_definition(source_name: str) -> WeatherSourceDefinition | None:
    return WEATHER_SOURCE_REGISTRY.get(source_name)


def default_weather_source_rows() -> list[dict[str, Any]]:
    return [source.seed_data() for source in WEATHER_SOURCE_DEFINITIONS]
