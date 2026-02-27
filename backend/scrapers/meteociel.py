"""Météociel.fr scraper"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime
from typing import Dict, List

async def fetch_meteociel(lat: float, lon: float) -> Dict:
    """Fetch from Météociel (French weather site with wind data)"""
    try:
        url = f"https://www.meteociel.fr/prevmet/point.php?lon={lon}&lat={lat}"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = 'iso-8859-1'
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract hourly table
        forecasts = []
        table = soup.find('table', class_='prev')
        
        if table:
            rows = table.find_all('tr')[1:]  # Skip header
            for row in rows[:24]:  # Get 24 hours
                cells = row.find_all('td')
                if len(cells) >= 5:
                    forecasts.append({
                        "time": cells[0].get_text(strip=True),
                        "temp": cells[1].get_text(strip=True),
                        "wind": cells[2].get_text(strip=True),
                        "gust": cells[3].get_text(strip=True),
                        "precip": cells[4].get_text(strip=True),
                    })
        
        return {
            "success": True if forecasts else False,
            "source": "meteociel",
            "data": forecasts,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "source": "meteociel",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

async def extract_hourly_forecast(data: Dict) -> List[Dict]:
    """Parse Météociel data"""
    if not data.get("success"):
        return []
    
    forecasts = []
    for item in data.get("data", []):
        try:
            forecasts.append({
                "time": item.get("time", ""),
                "temperature": float(item.get("temp", "0").replace("°C", "").strip()),
                "wind_speed": float(item.get("wind", "0").split()[0]),
                "wind_gust": float(item.get("gust", "0").split()[0]),
                "precipitation": float(item.get("precip", "0").replace("mm", "").strip()),
            })
        except (ValueError, AttributeError, IndexError):
            continue
    
    return forecasts
