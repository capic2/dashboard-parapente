"""
Meteoblue scraper using httpx + BeautifulSoup (simple web scraping)
Site: https://www.meteoblue.com
Scraping approach: Extract data from forecast table HTML
"""

import re
import httpx
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging
from bs4 import BeautifulSoup

from .base import BaseScraper, ScraperType

logger = logging.getLogger(__name__)


class MeteoblueScraper(BaseScraper):
    """
    Meteoblue scraper using httpx + BeautifulSoup
    
    Architecture:
    - Extends BaseScraper base class
    - Uses httpx to fetch HTML
    - Uses BeautifulSoup to parse forecast tables
    - Simpler approach than Playwright/Scrapling
    
    Data provided:
    - Temperature (°C)
    - Wind speed (m/s converted from displayed km/h)
    - Wind direction (degrees from compass or image)
    - Precipitation (mm)
    - Cloud cover (%) - from text or inferred from picto
    - Relative humidity (%)
    
    Forecast range: 7 days (hourly)
    """
    
    # City code cache
    CITY_CODE_CACHE = {}
    
    # City code overrides for known locations
    CITY_CODE_OVERRIDE = {
        "arguel": "3036982",
        "ornans": "2989580",
    }
    
    # Compass direction to degrees
    DIRECTION_MAP = {
        "N": 0, "NNE": 22, "NE": 45, "ENE": 67,
        "E": 90, "ESE": 112, "SE": 135, "SSE": 157,
        "S": 180, "SSW": 202, "SW": 225, "WSW": 247,
        "W": 270, "WNW": 292, "NW": 315, "NNW": 337,
    }
    
    def __init__(self, timeout: int = 30):
        """
        Initialize Meteoblue scraper
        
        Args:
            timeout: Request timeout in seconds
        """
        super().__init__(
            source_name="meteoblue",
            scraper_type=ScraperType.API,  # Using HTTP
            timeout=timeout
        )
        self.base_url = "https://www.meteoblue.com"
    
    def _get_city_code(self, city_name: str) -> Optional[str]:
        """Get Meteoblue city code"""
        city_key = city_name.lower()
        
        if city_key in self.CITY_CODE_OVERRIDE:
            return self.CITY_CODE_OVERRIDE[city_key]
        
        if city_key in self.CITY_CODE_CACHE:
            return self.CITY_CODE_CACHE[city_key]
        
        return None
    
    async def fetch(self, lat: float, lon: float, **kwargs) -> Dict[str, Any]:
        """
        Fetch Meteoblue forecast
        
        Args:
            lat: Latitude
            lon: Longitude
            **kwargs: city_name, etc.
        
        Returns:
            Response dict with success and data
        """
        city_name = kwargs.get("city_name", "location")
        
        # Get city code
        city_code = self._get_city_code(city_name)
        
        if not city_code:
            self.logger.warning(f"No city code for {city_name}, using Arguel fallback")
            city_code = "3036982"
            city_name = "arguel"
        
        # Build URL - use "week" view for table data
        url = f"{self.base_url}/fr/meteo/semaine/{city_name}_france_{city_code}"
        
        self.logger.info(f"Fetching Meteoblue: {url}")
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, follow_redirects=True)
                response.raise_for_status()
                
                html = response.text
                
                # Parse HTML to extract forecast data
                hourly_data = self._parse_html(html)
                
                self.logger.info(f"Meteoblue: Extracted {len(hourly_data)} hours")
                
                return self._build_response(success=True, data=hourly_data)
                
        except Exception as e:
            self.logger.error(f"Meteoblue fetch error: {e}", exc_info=True)
            return self._build_response(success=False, error=str(e))
    
    def _parse_html(self, html: str) -> List[Dict[str, Any]]:
        """
        Parse Meteoblue HTML to extract hourly forecasts
        
        Args:
            html: Page HTML content
        
        Returns:
            List of hourly forecast dictionaries
        """
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Find the hourly view table
            hourly_table = soup.find('table', class_='picto hourly-view')
            
            if not hourly_table:
                self.logger.warning("No hourly forecast table found")
                return []
            
            # Find all rows
            rows = hourly_table.find_all('tr')
            
            # Parse times row (has <time datetime="..."> tags)
            times_row = hourly_table.find('tr', class_='times')
            if not times_row:
                self.logger.warning("No times row found")
                return []
            
            # Extract timestamps from <time> tags
            time_elements = times_row.find_all('time')
            timestamps = []
            for time_elem in time_elements:
                dt_str = time_elem.get('datetime')
                if dt_str:
                    timestamps.append(datetime.fromisoformat(dt_str.replace('Z', '+00:00')))
            
            if not timestamps:
                self.logger.warning("No timestamps found")
                return []
            
            self.logger.info(f"Found {len(timestamps)} time slots")
            
            # Initialize data structure
            hourly_data = []
            for dt in timestamps:
                hourly_data.append({
                    'datetime': dt.isoformat(),
                    'temperature': None,
                    'wind_speed': None,
                    'wind_direction': None,
                    'precipitation': 0.0,
                    'clouds': None,
                    'humidity': None,
                    'picto': None,
                })
            
            # Parse icons row (for picto and cloud inference)
            icons_row = hourly_table.find('tr', class_='icons')
            if icons_row:
                icon_cells = icons_row.find_all('td')
                for i, cell in enumerate(icon_cells):
                    if i >= len(hourly_data):
                        break
                    img = cell.find('img')
                    if img and img.get('src'):
                        picto_url = img.get('src')
                        hourly_data[i]['picto'] = picto_url
                        hourly_data[i]['clouds'] = self._infer_clouds_from_picto(picto_url)
            
            # Parse temperatures row
            temp_row = hourly_table.find('tr', class_='temperatures')
            if temp_row:
                temp_cells = temp_row.find_all('td')
                for i, cell in enumerate(temp_cells):
                    if i >= len(hourly_data):
                        break
                    temp_text = cell.get_text(strip=True)
                    temp_match = re.search(r'(-?\d+)', temp_text)
                    if temp_match:
                        hourly_data[i]['temperature'] = int(temp_match.group(1))
            
            # Parse wind speeds row
            wind_row = hourly_table.find('tr', class_='windspeeds')
            if wind_row:
                wind_cells = wind_row.find_all('td')
                for i, cell in enumerate(wind_cells):
                    if i >= len(hourly_data):
                        break
                    wind_text = cell.get_text(strip=True)
                    wind_match = re.search(r'(\d+)', wind_text)
                    if wind_match:
                        wind_kmh = int(wind_match.group(1))
                        hourly_data[i]['wind_speed'] = round(wind_kmh / 3.6, 1)  # km/h to m/s
                    
                    # Try to extract wind direction from div class (format: "glyph winddir SE")
                    wind_dir_div = cell.find('div', class_='winddir')
                    if wind_dir_div:
                        classes = wind_dir_div.get('class', [])
                        for cls in classes:
                            if cls != 'glyph' and cls != 'winddir':
                                # This is the direction (e.g., "SE", "N", "W")
                                direction = self._parse_direction(cls)
                                if direction is not None:
                                    hourly_data[i]['wind_direction'] = direction
                                    break
            
            # Parse precipitation row
            precip_row = hourly_table.find('tr', class_='precips')
            if precip_row:
                precip_cells = precip_row.find_all('td')
                for i, cell in enumerate(precip_cells):
                    if i >= len(hourly_data):
                        break
                    precip_text = cell.get_text(strip=True)
                    
                    if precip_text in ['-', '--', '']:
                        hourly_data[i]['precipitation'] = 0.0
                    else:
                        precip_match = re.search(r'([\d.]+)', precip_text)
                        if precip_match:
                            hourly_data[i]['precipitation'] = float(precip_match.group(1))
            
            # Note: Meteoblue hourly table doesn't have humidity in the free version
            # We keep humidity as None
            
            self.logger.info(f"Parsed {len(hourly_data)} hours successfully")
            return hourly_data
            
        except Exception as e:
            self.logger.error(f"Error parsing Meteoblue HTML: {e}", exc_info=True)
            return []
    
    def _parse_direction(self, text: str) -> Optional[int]:
        """
        Parse wind direction from text
        
        Args:
            text: Direction text (e.g., "Nord", "NE", "South-West")
        
        Returns:
            Direction in degrees (0-359) or None
        """
        if not text:
            return None
        
        text = text.upper()
        
        # Try direct mapping
        for key, value in self.DIRECTION_MAP.items():
            if key in text:
                return value
        
        # Try French directions
        french_map = {
            "NORD": 0, "EST": 90, "SUD": 180, "OUEST": 270,
        }
        
        for key, value in french_map.items():
            if key in text:
                return value
        
        return None
    
    def _infer_clouds_from_picto(self, picto_url: str) -> Optional[int]:
        """
        Infer cloud cover from weather icon URL
        
        Args:
            picto_url: URL to weather icon
        
        Returns:
            Cloud cover percentage (0-100) or None
        """
        try:
            # Extract picto code (e.g., "01" from "01_day.svg")
            picto_match = re.search(r'/(\d{2})_', picto_url)
            if not picto_match:
                return None
            
            picto_code = int(picto_match.group(1))
            
            # Meteoblue picto codes (approximation):
            # 01 = clear (0%)
            # 02 = few clouds (25%)
            # 03 = partly cloudy (50%)
            # 04 = cloudy (75%)
            # 05+ = overcast or weather (85%+)
            
            if picto_code == 1:
                return 0
            elif picto_code == 2:
                return 25
            elif picto_code == 3:
                return 50
            elif picto_code == 4:
                return 75
            elif picto_code >= 5:
                return 85
            else:
                return None
                
        except Exception:
            return None
    
    def extract_hourly_forecast(
        self,
        data: Dict[str, Any],
        day_index: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Extract hourly forecast for a specific day
        
        Args:
            data: Response from fetch() method
            day_index: Day index (0=today, 1=tomorrow, etc.)
        
        Returns:
            List of hourly forecasts for the specified day
        """
        if not data.get("success"):
            return []
        
        all_hours = data.get("data", [])
        
        # Filter by day
        target_date = datetime.now().date() + timedelta(days=day_index)
        
        day_hours = []
        for hour in all_hours:
            try:
                hour_dt = datetime.fromisoformat(hour["datetime"])
                if hour_dt.date() == target_date:
                    # Add 'hour' field and rename 'clouds' to 'cloud_cover' for pipeline compatibility
                    hour_copy = hour.copy()
                    hour_copy["hour"] = hour_dt.hour
                    if "clouds" in hour_copy:
                        hour_copy["cloud_cover"] = hour_copy.pop("clouds")
                    day_hours.append(hour_copy)
            except Exception:
                continue
        
        return day_hours


# Standalone functions for compatibility

async def fetch_meteoblue(lat: float, lon: float, city_name: str = "location") -> Dict[str, Any]:
    """Fetch Meteoblue forecast (standalone function)"""
    scraper = MeteoblueScraper()
    return await scraper.fetch(lat, lon, city_name=city_name)


def extract_meteoblue_hourly(data: Dict[str, Any], day_index: int = 0) -> List[Dict[str, Any]]:
    """Extract hourly forecast for specific day (standalone function)"""
    scraper = MeteoblueScraper()
    return scraper.extract_hourly_forecast(data, day_index)


# Alias for pipeline compatibility
extract_hourly_forecast = extract_meteoblue_hourly
