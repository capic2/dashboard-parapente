"""OpenWeatherMap forecast scraper."""

from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from config import OPENWEATHERMAP_API_KEY

PARIS_TZ = ZoneInfo("Europe/Paris")


async def fetch_openweathermap(
    lat: float,
    lon: float,
    days: int = 5,
    api_key: str | None = None,
) -> dict[str, Any]:
    """Fetch 5-day/3-hour forecast from OpenWeatherMap."""

    resolved_api_key = api_key or OPENWEATHERMAP_API_KEY
    if not resolved_api_key:
        return {
            "success": False,
            "source": "openweathermap",
            "error": "BACKEND_OPENWEATHERMAP_API_KEY is not configured",
            "timestamp": datetime.now().isoformat(),
        }

    try:
        forecast_days = max(1, days)
        params = {
            "lat": lat,
            "lon": lon,
            "appid": resolved_api_key,
            "units": "metric",
            "cnt": min(forecast_days * 8, 40),
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params=params,
            )
            response.raise_for_status()
            data = response.json()

        return {
            "success": True,
            "source": "openweathermap",
            "data": data,
            "timestamp": datetime.now().isoformat(),
        }
    except httpx.HTTPStatusError as e:
        return {
            "success": False,
            "source": "openweathermap",
            "status_code": e.response.status_code,
            "error": f"HTTP {e.response.status_code}: OpenWeatherMap request failed",
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        return {
            "success": False,
            "source": "openweathermap",
            "error": str(e),
            "timestamp": datetime.now().isoformat(),
        }


def extract_hourly_forecast(data: dict[str, Any], day_index: int = 0) -> list[dict[str, Any]]:
    """Extract available 3-hour forecast points from OpenWeatherMap response."""

    raw_data = data.get("data") if isinstance(data, dict) and "data" in data else data
    if not raw_data:
        return []

    items = raw_data.get("list", [])
    if not items:
        return []

    first_dt_txt = next(
        (
            item.get("dt_txt")
            for item in items
            if isinstance(item, dict) and isinstance(item.get("dt_txt"), str)
        ),
        None,
    )
    if not first_dt_txt:
        return []

    first_time = datetime.fromisoformat(first_dt_txt).replace(tzinfo=UTC).astimezone(PARIS_TZ)
    target_day = first_time.date() + timedelta(days=day_index)
    forecasts: list[dict[str, Any]] = []

    for item in items:
        time_str = item.get("dt_txt", "")
        if not time_str:
            continue

        dt = datetime.fromisoformat(time_str).replace(tzinfo=UTC).astimezone(PARIS_TZ)
        if dt.date() != target_day:
            continue

        wind = item.get("wind", {})
        wind_speed_ms = wind.get("speed")
        gust_ms = wind.get("gust")
        rain = item.get("rain", {})
        snow = item.get("snow", {})
        precipitation_3h = (rain.get("3h") or 0) + (snow.get("3h") or 0)

        forecasts.append(
            {
                "time": time_str,
                "hour": dt.hour,
                "temperature": item.get("main", {}).get("temp"),
                "wind_speed": round(wind_speed_ms * 3.6, 1) if wind_speed_ms is not None else None,
                "wind_gust": round(gust_ms * 3.6, 1) if gust_ms is not None else None,
                "wind_direction": wind.get("deg"),
                "cloud_cover": item.get("clouds", {}).get("all"),
                "precipitation": round(precipitation_3h / 3, 2),
                "cape": None,
                "lifted_index": None,
            }
        )

    return forecasts
