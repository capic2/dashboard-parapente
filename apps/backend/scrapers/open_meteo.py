"""Open-Meteo weather API scraper with async support"""

from datetime import datetime, timedelta
from typing import Any

import httpx


def _is_in_france(lat: float, lon: float) -> bool:
    """Check if coordinates fall within metropolitan France bounding box."""
    return 41.3 <= lat <= 51.1 and -5.2 <= lon <= 9.6


async def fetch_open_meteo(lat: float, lon: float, days: int = 2) -> dict[str, Any]:
    """
    Fetch weather from Open-Meteo API (free, no auth required)

    Uses AROME France HD (1.5km resolution) for French locations via the
    Météo-France endpoint, falls back to generic best_match for other locations.

    Args:
        lat: Latitude coordinate
        lon: Longitude coordinate
        days: Number of forecast days (default: 2)

    Returns:
        Dict with success status, data, source, and timestamp
    """
    try:
        use_arome = _is_in_france(lat, lon)

        if use_arome:
            url = "https://api.open-meteo.com/v1/meteofrance"
            hourly_params = "temperature_2m,windspeed_10m,wind_direction_10m,windgusts_10m,precipitation,cloudcover,cape"
            forecast_days = min(days, 2)  # AROME HD limited to 2 days
        else:
            url = "https://api.open-meteo.com/v1/forecast"
            hourly_params = "temperature_2m,windspeed_10m,wind_direction_10m,windgusts_10m,precipitation,cloudcover,cape,lifted_index"
            forecast_days = days

        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": hourly_params,
            "daily": "sunrise,sunset",
            "timezone": "Europe/Paris",
            "forecast_days": forecast_days,
        }

        if use_arome:
            params["models"] = "arome_france_hd"

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

        return {
            "success": True,
            "source": "open-meteo",
            "data": data,
            "timestamp": datetime.now().isoformat(),
        }
    except httpx.HTTPStatusError as e:
        return {
            "success": False,
            "source": "open-meteo",
            "error": f"HTTP {e.response.status_code}: {str(e)}",
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        return {
            "success": False,
            "source": "open-meteo",
            "error": str(e),
            "timestamp": datetime.now().isoformat(),
        }


def extract_hourly_forecast(data: dict[str, Any], day_index: int = 0) -> list[dict[str, Any]]:
    """
    Extract hourly forecast for a specific day

    Args:
        data: Response from fetch_open_meteo (wrapper or raw API response)
        day_index: Which day to extract (0=today, 1=tomorrow)

    Returns:
        List of hourly forecast dicts
    """
    # Handle both wrapper format and raw API response
    raw_data = data.get("data") if isinstance(data, dict) and "data" in data else data
    if not raw_data:
        return []

    hourly = raw_data.get("hourly", {})
    times = hourly.get("time", [])

    if not times:
        return []

    forecasts = []
    start_day = datetime.fromisoformat(times[0]).replace(hour=0, minute=0, second=0)
    target_day = start_day + timedelta(days=day_index)

    for idx, time_str in enumerate(times):
        dt = datetime.fromisoformat(time_str)
        if dt.date() == target_day.date():
            # Safely get values with defaults
            cape_list = hourly.get("cape", [])
            lifted_list = hourly.get("lifted_index", [])

            forecasts.append(
                {
                    "time": time_str,
                    "hour": dt.hour,
                    "temperature": (
                        hourly.get("temperature_2m", [])[idx]
                        if idx < len(hourly.get("temperature_2m", []))
                        else None
                    ),
                    "wind_speed": (
                        hourly.get("windspeed_10m", [])[idx]
                        if idx < len(hourly.get("windspeed_10m", []))
                        else None
                    ),
                    "wind_gust": (
                        hourly.get("windgusts_10m", [])[idx]
                        if idx < len(hourly.get("windgusts_10m", []))
                        else None
                    ),
                    "wind_direction": (
                        hourly.get("wind_direction_10m", [])[idx]
                        if idx < len(hourly.get("wind_direction_10m", []))
                        else None
                    ),
                    "cloud_cover": (
                        hourly.get("cloudcover", [])[idx]
                        if idx < len(hourly.get("cloudcover", []))
                        else None
                    ),
                    "precipitation": (
                        hourly.get("precipitation", [])[idx]
                        if idx < len(hourly.get("precipitation", []))
                        else None
                    ),
                    "cape": cape_list[idx] if idx < len(cape_list) else None,
                    "lifted_index": lifted_list[idx] if idx < len(lifted_list) else None,
                }
            )

    return forecasts
