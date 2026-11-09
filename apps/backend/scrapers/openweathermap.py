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

    items = [
        item for item in items if isinstance(item, dict) and isinstance(item.get("dt_txt"), str)
    ]
    if not items:
        return []
    items.sort(key=lambda item: item["dt_txt"])
    first_dt_txt = items[0]["dt_txt"]

    first_time = datetime.fromisoformat(first_dt_txt).replace(tzinfo=UTC).astimezone(PARIS_TZ)
    target_day = first_time.date() + timedelta(days=day_index)
    forecasts_by_hour: dict[int, dict[str, Any]] = {}

    for item in items:
        time_str = item.get("dt_txt", "")
        if not time_str:
            continue

        dt_utc = datetime.fromisoformat(time_str).replace(tzinfo=UTC)
        dt = dt_utc.astimezone(PARIS_TZ)
        if dt.date() == target_day:
            wind = item.get("wind", {})
            wind_speed_ms = wind.get("speed")
            gust_ms = wind.get("gust")
            hour_record = forecasts_by_hour.setdefault(
                dt.hour,
                {
                    "time": time_str,
                    "hour": dt.hour,
                    "temperature": None,
                    "wind_speed": None,
                    "wind_gust": None,
                    "wind_direction": None,
                    "cloud_cover": None,
                    "precipitation": None,
                    "cape": None,
                    "lifted_index": None,
                },
            )
            accumulated_precipitation = hour_record.get("precipitation")
            # When DST repeats a local hour, sorted UTC points make the later
            # point's weather fields win while retaining prior precipitation.
            hour_record.update(
                {
                    "time": dt.isoformat(),
                    "hour": dt.hour,
                    "temperature": item.get("main", {}).get("temp"),
                    "wind_speed": (
                        round(wind_speed_ms * 3.6, 1) if wind_speed_ms is not None else None
                    ),
                    "wind_gust": round(gust_ms * 3.6, 1) if gust_ms is not None else None,
                    "wind_direction": wind.get("deg"),
                    "cloud_cover": item.get("clouds", {}).get("all"),
                    "precipitation": accumulated_precipitation,
                    "cape": None,
                    "lifted_index": None,
                }
            )

        rain = item.get("rain") or {}
        snow = item.get("snow") or {}
        precipitation_per_hour = ((rain.get("3h") or 0) + (snow.get("3h") or 0)) / 3

        # OpenWeatherMap reports the accumulation over the three hours before
        # each point. Spread it across those hours in UTC so mixed hourly and
        # three-hourly sources use the same units and midnight is handled by
        # the local date of each hour bucket.
        for hours_before in (3, 2, 1):
            bucket_start_utc = dt_utc - timedelta(hours=hours_before)
            bucket_start = bucket_start_utc.astimezone(PARIS_TZ)
            if bucket_start.date() != target_day:
                continue

            hour_record = forecasts_by_hour.setdefault(
                bucket_start.hour,
                {
                    "time": bucket_start.isoformat(),
                    "hour": bucket_start.hour,
                    "temperature": None,
                    "wind_speed": None,
                    "wind_gust": None,
                    "wind_direction": None,
                    "cloud_cover": None,
                    "precipitation": 0.0,
                    "cape": None,
                    "lifted_index": None,
                },
            )
            current_precipitation = hour_record.get("precipitation") or 0.0
            hour_record["precipitation"] = round(current_precipitation + precipitation_per_hour, 2)

    return [forecasts_by_hour[hour] for hour in sorted(forecasts_by_hour)]
