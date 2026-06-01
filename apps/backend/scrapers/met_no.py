"""MET Norway Locationforecast scraper."""

from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import httpx

PARIS_TZ = ZoneInfo("Europe/Paris")
USER_AGENT = "dashboard-parapente/0.2.0 https://github.com/capic2/dashboard-parapente"


async def fetch_met_no(lat: float, lon: float, days: int = 7) -> dict[str, Any]:
    """Fetch weather forecast from MET Norway Locationforecast API."""

    try:
        params = {"lat": round(lat, 4), "lon": round(lon, 4)}
        headers = {"User-Agent": USER_AGENT}

        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            response = await client.get(
                "https://api.met.no/weatherapi/locationforecast/2.0/complete",
                params=params,
            )
            response.raise_for_status()
            data = response.json()

        return {
            "success": True,
            "source": "met-no",
            "data": data,
            "timestamp": datetime.now().isoformat(),
            "forecast_days": days,
        }
    except httpx.HTTPStatusError as e:
        return {
            "success": False,
            "source": "met-no",
            "error": f"HTTP {e.response.status_code}: {str(e)}",
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        return {
            "success": False,
            "source": "met-no",
            "error": str(e),
            "timestamp": datetime.now().isoformat(),
        }


def extract_hourly_forecast(data: dict[str, Any], day_index: int = 0) -> list[dict[str, Any]]:
    """Extract hourly forecast values from MET Norway response."""

    raw_data = data.get("data") if isinstance(data, dict) and "data" in data else data
    if not raw_data:
        return []

    timeseries = raw_data.get("properties", {}).get("timeseries", [])
    if not timeseries:
        return []

    first_time = datetime.fromisoformat(timeseries[0]["time"].replace("Z", "+00:00")).astimezone(
        PARIS_TZ
    )
    target_day = first_time.date() + timedelta(days=day_index)
    forecasts: list[dict[str, Any]] = []

    for item in timeseries:
        time_str = item.get("time")
        if not time_str:
            continue

        dt = datetime.fromisoformat(time_str.replace("Z", "+00:00")).astimezone(PARIS_TZ)
        if dt.date() != target_day:
            continue

        instant = item.get("data", {}).get("instant", {}).get("details", {})
        next_hour = item.get("data", {}).get("next_1_hours", {}).get("details", {})

        wind_speed_ms = instant.get("wind_speed")
        gust_ms = instant.get("wind_speed_of_gust")

        forecasts.append(
            {
                "time": time_str,
                "hour": dt.hour,
                "temperature": instant.get("air_temperature"),
                "wind_speed": round(wind_speed_ms * 3.6, 1) if wind_speed_ms is not None else None,
                "wind_gust": round(gust_ms * 3.6, 1) if gust_ms is not None else None,
                "wind_direction": instant.get("wind_from_direction"),
                "cloud_cover": instant.get("cloud_area_fraction"),
                "precipitation": next_hour.get("precipitation_amount"),
                "cape": None,
                "lifted_index": None,
            }
        )

    return forecasts
