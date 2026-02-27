"""WeatherAPI.com scraper"""

import requests
from datetime import datetime
from typing import Dict, List

WEATHERAPI_KEY = "${WEATHERAPI_KEY}"

async def fetch_weatherapi(lat: float, lon: float, days: int = 2) -> Dict:
    """Fetch weather from WeatherAPI.com"""
    try:
        url = f"https://api.weatherapi.com/v1/forecast.json"
        params = {
            "key": WEATHERAPI_KEY,
            "q": f"{lat},{lon}",
            "days": days,
            "aqi": "no",
            "alerts": "no"
        }
        
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        return {
            "success": True,
            "source": "weatherapi",
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "source": "weatherapi",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

def extract_hourly_forecast(data: Dict, day_index: int = 0) -> List[Dict]:
    """Extract hourly forecast for a specific day"""
    if not data.get("success"):
        return []
    
    forecast_days = data["data"].get("forecast", {}).get("forecastday", [])
    if day_index >= len(forecast_days):
        return []
    
    day_data = forecast_days[day_index]
    hours = day_data.get("hour", [])
    
    forecasts = []
    for hour_data in hours:
        forecasts.append({
            "time": hour_data["time"],
            "hour": int(hour_data["time"].split(":")[0]),
            "temperature": hour_data["temp_c"],
            "wind_speed": hour_data["wind_kph"] * 0.278,  # Convert to m/s, then to km/h equivalent
            "wind_gust": hour_data["gust_kph"] * 0.278,
            "cloud_cover": hour_data["cloud"],
            "precipitation": hour_data.get("precip_mm", 0),
            "humidity": hour_data.get("humidity", 0),
        })
    
    return forecasts
