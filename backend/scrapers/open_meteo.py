"""Open-Meteo weather API scraper"""

import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional

async def fetch_open_meteo(lat: float, lon: float, days: int = 2) -> Dict:
    """Fetch weather from Open-Meteo API (free, no auth)"""
    try:
        url = f"https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "temperature_2m,windspeed_10m,wind_direction_10m,windgusts_10m,precipitation,cloudcover,cape,lifted_index",
            "daily": "sunrise,sunset",
            "timezone": "Europe/Paris",
            "forecast_days": days
        }
        
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        return {
            "success": True,
            "source": "open-meteo",
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "source": "open-meteo",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

def extract_hourly_forecast(data: Dict, day_index: int = 0) -> List[Dict]:
    """Extract hourly forecast for a specific day"""
    if not data.get("success"):
        return []
    
    hourly = data["data"].get("hourly", {})
    times = hourly.get("time", [])
    
    forecasts = []
    start_day = datetime.fromisoformat(times[0]).replace(hour=0, minute=0, second=0)
    target_day = start_day + timedelta(days=day_index)
    
    for idx, time_str in enumerate(times):
        dt = datetime.fromisoformat(time_str)
        if dt.date() == target_day.date():
            forecasts.append({
                "time": time_str,
                "hour": dt.hour,
                "temperature": hourly["temperature_2m"][idx],
                "wind_speed": hourly["windspeed_10m"][idx],
                "wind_gust": hourly["windgusts_10m"][idx],
                "cloud_cover": hourly["cloudcover"][idx],
                "precipitation": hourly["precipitation"][idx],
                "cape": hourly.get("cape", [None])[idx] if idx < len(hourly.get("cape", [])) else None,
                "lifted_index": hourly.get("lifted_index", [None])[idx] if idx < len(hourly.get("lifted_index", [])) else None,
            })
    
    return forecasts
