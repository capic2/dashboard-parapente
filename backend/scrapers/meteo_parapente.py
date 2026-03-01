"""Météo-parapente scraper using Scrapling + BeautifulSoup"""

from datetime import datetime
from typing import Dict, List, Any
import logging
import re

logger = logging.getLogger(__name__)


async def fetch_meteo_parapente(lat: float, lon: float) -> Dict[str, Any]:
    """Fetch hourly forecast from Météo-parapente"""
    try:
        from scrapling import Scraper
        from bs4 import BeautifulSoup
        
        scraper = Scraper()
        
        # Navigate to forecast page
        url = f"https://www.meteo-parapente.com/forecast/{lat:.2f}/{lon:.2f}"
        
        html = scraper.fetch(url)
        soup = BeautifulSoup(html, 'html.parser')
        
        hourly_data = []
        
        # Look for hourly forecast data in the page
        # Meteo-parapente usually has tables or divs with hourly info
        
        # Try to find forecast tables
        tables = soup.find_all('table')
        
        for table in tables:
            rows = table.find_all('tr')
            
            for row in rows:
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 2:
                    hour_text = cells[0].get_text(strip=True)
                    
                    hour_match = re.search(r'(\d{1,2})', hour_text)
                    if hour_match:
                        hour = int(hour_match.group(1))
                        
                        if 0 <= hour <= 23:
                            # Extract data from other cells
                            wind_text = cells[1].get_text(strip=True) if len(cells) > 1 else ""
                            temp_text = cells[2].get_text(strip=True) if len(cells) > 2 else ""
                            
                            wind_match = re.search(r'(\d+(?:\.\d+)?)', wind_text)
                            temp_match = re.search(r'(-?\d+(?:\.\d+)?)', temp_text)
                            
                            wind_speed = float(wind_match.group(1)) / 3.6 if wind_match else None
                            temperature = float(temp_match.group(1)) if temp_match else None
                            
                            hourly_data.append({
                                "hour": hour,
                                "wind_speed": wind_speed,
                                "temperature": temperature,
                                "wind_gust": None,
                                "wind_direction": None,
                                "precipitation": None,
                                "cloud_cover": None
                            })
        
        # Fill missing hours
        if not hourly_data:
            hourly_data = [{
                "hour": h,
                "wind_speed": None,
                "temperature": None,
                "wind_gust": None,
                "wind_direction": None,
                "precipitation": None,
                "cloud_cover": None
            } for h in range(24)]
        
        return {
            "success": True,
            "source": "meteo_parapente",
            "data": hourly_data,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Meteo-parapente scrape error: {e}")
        return {
            "success": False,
            "source": "meteo_parapente",
            "error": str(e),
            "data": [],
            "timestamp": datetime.now().isoformat()
        }


def extract_hourly_forecast(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Parse scraped data into standard format"""
    if not data.get("success"):
        return []
    return data.get("data", [])
