"""Météo-parapente.com scraper"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime
from typing import Dict, List

async def fetch_meteo_parapente(spot_name: str) -> Dict:
    """Fetch from Météo-parapente (French paragliding weather portal)"""
    try:
        # Météo-parapente uses spot names in URL
        url = f"https://www.meteo-parapente.com/forecast/{spot_name.lower().replace(' ', '-')}"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = 'utf-8'
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract forecast data (site structure varies, parse key metrics)
        forecasts = []
        forecast_rows = soup.find_all('tr', class_='forecast-row')
        
        for row in forecast_rows:
            cells = row.find_all('td')
            if len(cells) >= 5:
                forecasts.append({
                    "time": cells[0].get_text(strip=True),
                    "wind": cells[1].get_text(strip=True),
                    "gust": cells[2].get_text(strip=True),
                    "temp": cells[3].get_text(strip=True),
                    "verdict": cells[4].get_text(strip=True),
                })
        
        return {
            "success": True if forecasts else False,
            "source": "meteo-parapente",
            "data": forecasts,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "source": "meteo-parapente",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

async def extract_hourly_forecast(data: Dict) -> List[Dict]:
    """Parse Météo-parapente data"""
    if not data.get("success"):
        return []
    
    forecasts = []
    for item in data.get("data", []):
        try:
            forecasts.append({
                "time": item.get("time", ""),
                "wind_speed": float(item.get("wind", "0").replace("km/h", "").strip()),
                "wind_gust": float(item.get("gust", "0").replace("km/h", "").strip()),
                "temperature": float(item.get("temp", "0").replace("°C", "").strip()),
                "verdict": item.get("verdict", ""),
            })
        except (ValueError, AttributeError):
            continue
    
    return forecasts
