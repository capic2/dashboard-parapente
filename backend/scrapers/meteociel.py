"""Météociel.fr scraper with async support"""

import httpx
from bs4 import BeautifulSoup
from datetime import datetime
from typing import Dict, List, Any


async def fetch_meteociel(lat: float, lon: float) -> Dict[str, Any]:
    """
    Fetch from Météociel (French weather site with detailed wind data)
    
    Args:
        lat: Latitude coordinate
        lon: Longitude coordinate
    
    Returns:
        Dict with success status, data, source, and timestamp
    """
    try:
        url = f"https://www.meteociel.fr/prevmet/point.php?lon={lon}&lat={lat}"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
            response = await client.get(url)
            response.raise_for_status()
            
        # Meteociel uses ISO-8859-1 encoding
        soup = BeautifulSoup(response.content.decode('iso-8859-1'), 'html.parser')
        
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
            "success": bool(forecasts),
            "source": "meteociel",
            "data": forecasts,
            "timestamp": datetime.now().isoformat()
        }
    except httpx.HTTPStatusError as e:
        return {
            "success": False,
            "source": "meteociel",
            "error": f"HTTP {e.response.status_code}: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "source": "meteociel",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


async def extract_hourly_forecast(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Parse Météociel hourly data
    
    Args:
        data: Raw response from fetch_meteociel
    
    Returns:
        List of parsed hourly forecasts
    """
    if not data.get("success"):
        return []
    
    forecasts = []
    for item in data.get("data", []):
        try:
            # Parse temperature (e.g., "12°C" -> 12.0)
            temp_str = item.get("temp", "0").replace("°C", "").replace("°", "").strip()
            temperature = float(temp_str) if temp_str else 0.0
            
            # Parse wind (e.g., "15 km/h" -> 15.0)
            wind_str = item.get("wind", "0").split()[0]
            wind_speed = float(wind_str) if wind_str else 0.0
            
            # Parse gust
            gust_str = item.get("gust", "0").split()[0]
            wind_gust = float(gust_str) if gust_str else 0.0
            
            # Parse precipitation
            precip_str = item.get("precip", "0").replace("mm", "").strip()
            precipitation = float(precip_str) if precip_str else 0.0
            
            forecasts.append({
                "time": item.get("time", ""),
                "temperature": temperature,
                "wind_speed": wind_speed,
                "wind_gust": wind_gust,
                "precipitation": precipitation,
            })
        except (ValueError, AttributeError, IndexError):
            continue
    
    return forecasts
