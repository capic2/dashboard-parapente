"""WeatherAPI.com scraper with proper async support"""

import httpx
import os
from datetime import datetime
from typing import Dict, List, Optional

# Load from environment, fallback to provided key
WEATHERAPI_KEY = os.getenv("WEATHERAPI_KEY", "***REMOVED***")


async def fetch_weatherapi(lat: float, lon: float, days: int = 2) -> Dict[str, any]:
    """
    Fetch weather forecast from WeatherAPI.com
    
    Args:
        lat: Latitude coordinate
        lon: Longitude coordinate
        days: Number of forecast days (1-3)
    
    Returns:
        Dict with success status, data, source, and timestamp
    """
    try:
        url = "https://api.weatherapi.com/v1/forecast.json"
        params = {
            "key": WEATHERAPI_KEY,
            "q": f"{lat},{lon}",
            "days": min(days, 3),  # API limit is 3 days
            "aqi": "no",
            "alerts": "no"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
        
        return {
            "success": True,
            "source": "weatherapi",
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
    except httpx.HTTPStatusError as e:
        return {
            "success": False,
            "source": "weatherapi",
            "error": f"HTTP {e.response.status_code}: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "source": "weatherapi",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


def extract_hourly_forecast(data: Dict[str, any], day_index: int = 0) -> List[Dict[str, any]]:
    """
    Extract hourly forecast for a specific day
    
    Args:
        data: Response from fetch_weatherapi (wrapper or raw API response)
        day_index: Which day to extract (0=today, 1=tomorrow)
    
    Returns:
        List of hourly forecast dicts
    """
    # Handle both wrapper format and raw API response
    raw_data = data.get("data") if isinstance(data, dict) and "data" in data else data
    if not raw_data:
        return []
    
    forecast_days = raw_data.get("forecast", {}).get("forecastday", [])
    if day_index >= len(forecast_days):
        return []
    
    day_data = forecast_days[day_index]
    hours = day_data.get("hour", [])
    
    forecasts = []
    for hour_data in hours:
        time_str = hour_data.get("time", "")
        hour = int(time_str.split()[1].split(":")[0]) if " " in time_str else 0
        
        wind_kph = hour_data.get("wind_kph")
        gust_kph = hour_data.get("gust_kph")
        
        forecasts.append({
            "time": time_str,
            "hour": hour,
            "temperature": hour_data.get("temp_c"),
            "wind_speed": float(wind_kph) / 3.6 if wind_kph is not None else None,  # kph to m/s
            "wind_gust": float(gust_kph) / 3.6 if gust_kph is not None else None,  # kph to m/s
            "cloud_cover": hour_data.get("cloud"),
            "precipitation": hour_data.get("precip_mm") or 0,
            "humidity": hour_data.get("humidity"),
        })
    
    return forecasts
