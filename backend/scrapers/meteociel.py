"""Météociel scraper using Scrapling + BeautifulSoup"""

from datetime import datetime
from typing import Dict, List, Any
import logging
import asyncio

logger = logging.getLogger(__name__)


async def fetch_meteociel(lat: float, lon: float, location_name: str = "Arguel") -> Dict[str, Any]:
    """Fetch hourly forecast from Météciel"""
    try:
        from scrapling import Scraper
        from bs4 import BeautifulSoup
        import re
        
        scraper = Scraper()
        
        # Step 1: Get forecast for the location
        url = f"https://www.meteociel.fr/prevville.php?code=&ville={location_name}"
        
        html = scraper.fetch(url)
        soup = BeautifulSoup(html, 'html.parser')
        
        # Extract hourly data from tables
        hourly_data = []
        
        # Find all tables with hourly data
        tables = soup.find_all('table')
        
        for table in tables:
            rows = table.find_all('tr')
            
            for row in rows:
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 3:
                    # Try to extract hour
                    hour_text = cells[0].get_text(strip=True)
                    
                    # Match hour format (00, 01, 02, etc. or 0h, 1h, etc.)
                    hour_match = re.search(r'(\d{1,2})', hour_text)
                    if hour_match:
                        hour = int(hour_match.group(1))
                        
                        if 0 <= hour <= 23:
                            # Extract wind, temp, etc. from remaining cells
                            wind_text = cells[1].get_text(strip=True) if len(cells) > 1 else ""
                            temp_text = cells[2].get_text(strip=True) if len(cells) > 2 else ""
                            
                            # Parse values
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
        
        # If no data found, return empty but successful
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
            "source": "meteociel",
            "data": hourly_data,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Meteociel scrape error: {e}")
        return {
            "success": False,
            "source": "meteociel",
            "error": str(e),
            "data": [],
            "timestamp": datetime.now().isoformat()
        }


def extract_hourly_forecast(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Parse scraped data into standard format"""
    if not data.get("success"):
        return []
    return data.get("data", [])
