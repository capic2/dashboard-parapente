"""Météo-parapente.com scraper with async support"""

import httpx
from bs4 import BeautifulSoup
from datetime import datetime
from typing import Dict, List, Any


async def fetch_meteo_parapente(spot_name: str) -> Dict[str, Any]:
    """
    Fetch from Météo-parapente (French paragliding weather portal)
    
    Args:
        spot_name: Name of the paragliding spot (e.g., "Arguel", "Chamonix")
    
    Returns:
        Dict with success status, data, source, and timestamp
    """
    try:
        # Météo-parapente uses spot names in URL (lowercase, spaces as hyphens)
        spot_slug = spot_name.lower().replace(' ', '-').replace('_', '-')
        url = f"https://www.meteo-parapente.com/forecast/{spot_slug}"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        async with httpx.AsyncClient(timeout=15.0, headers=headers, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
        
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
            "success": bool(forecasts),
            "source": "meteo-parapente",
            "data": forecasts,
            "spot_name": spot_name,
            "timestamp": datetime.now().isoformat()
        }
    except httpx.HTTPStatusError as e:
        return {
            "success": False,
            "source": "meteo-parapente",
            "error": f"HTTP {e.response.status_code}: {str(e)}",
            "spot_name": spot_name,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "source": "meteo-parapente",
            "error": str(e),
            "spot_name": spot_name,
            "timestamp": datetime.now().isoformat()
        }


async def extract_hourly_forecast(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Parse Météo-parapente hourly data
    
    Args:
        data: Raw response from fetch_meteo_parapente
    
    Returns:
        List of parsed hourly forecasts
    """
    if not data.get("success"):
        return []
    
    forecasts = []
    for item in data.get("data", []):
        try:
            # Parse wind speed
            wind_str = item.get("wind", "0").replace("km/h", "").strip()
            wind_speed = float(wind_str) if wind_str else 0.0
            
            # Parse gust
            gust_str = item.get("gust", "0").replace("km/h", "").strip()
            wind_gust = float(gust_str) if gust_str else 0.0
            
            # Parse temperature
            temp_str = item.get("temp", "0").replace("°C", "").replace("°", "").strip()
            temperature = float(temp_str) if temp_str else 0.0
            
            forecasts.append({
                "time": item.get("time", ""),
                "wind_speed": wind_speed,
                "wind_gust": wind_gust,
                "temperature": temperature,
                "verdict": item.get("verdict", ""),
            })
        except (ValueError, AttributeError):
            continue
    
    return forecasts
