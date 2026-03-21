"""
Météociel scraper - Uses geo.api.gouv.fr + HTML parsing
Site: https://www.meteociel.fr
Strategy: Get INSEE code from city name, then parse forecast HTML
"""

import logging
import re
from typing import Any

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Import new architecture if available
try:
    from .base import BaseScraper, ScraperType

    USING_NEW_ARCHITECTURE = True
except ImportError:
    USING_NEW_ARCHITECTURE = False
    logger.warning("New architecture not available, using standalone code")


class MeteocielScraper(BaseScraper):
    """
    Scraper for meteociel.fr using HTML parsing

    Workflow:
    1. Get INSEE code from city name via geo.api.gouv.fr API
    2. Build meteociel URL: /previsions/INSEE_CODE/city-name.htm
    3. Parse HTML tables to extract forecast data
    """

    INSEE_CACHE = {}  # Cache INSEE codes to avoid repeated API calls

    # INSEE code overrides for communes not in API or that have been merged
    # Format: "CityName": "INSEE_CODE"
    SITE_INSEE_OVERRIDE = {
        "Arguel": "25473",  # Arguel (25720) doesn't exist in INSEE API, use Pugey (3.3km away)
    }

    def __init__(self):
        super().__init__(
            source_name="meteociel",
            scraper_type=ScraperType.API,  # We use HTTP but parse HTML
            timeout=20,
        )

    async def _get_insee_code(self, city_name: str) -> str | None:
        """
        Get INSEE code for a French city using geo.api.gouv.fr

        Args:
            city_name: Name of the city (e.g., "Arguel")

        Returns:
            INSEE code (e.g., "25031") or None if not found
        """
        # Check for manual override first (for communes not in API or with special handling)
        if city_name in self.SITE_INSEE_OVERRIDE:
            override_code = self.SITE_INSEE_OVERRIDE[city_name]
            logger.info(f"Using INSEE override for {city_name}: {override_code}")
            return override_code

        # Check cache
        if city_name in self.INSEE_CACHE:
            return self.INSEE_CACHE[city_name]

        try:
            url = "https://geo.api.gouv.fr/communes"
            params = {"nom": city_name, "fields": "nom,code,codesPostaux", "limit": 5}

            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                communes = response.json()

                if communes and len(communes) > 0:
                    # Take the first result
                    # TODO: Could improve by filtering by department if needed
                    insee_code = communes[0]["code"]
                    logger.info(f"Found INSEE code for {city_name}: {insee_code}")

                    # Cache it
                    self.INSEE_CACHE[city_name] = insee_code
                    return insee_code
                else:
                    logger.warning(f"No INSEE code found for city: {city_name}")
                    return None

        except Exception as e:
            logger.error(f"Error fetching INSEE code for {city_name}: {e}")
            return None

    async def _get_nearest_insee_code(self, lat: float, lon: float) -> str | None:
        """
        Get INSEE code for nearest French city using reverse geocoding

        Args:
            lat: Latitude
            lon: Longitude

        Returns:
            INSEE code or None if not in France
        """
        try:
            url = "https://geo.api.gouv.fr/communes"
            params = {"lat": lat, "lon": lon, "fields": "nom,code,codesPostaux", "limit": 1}

            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                communes = response.json()

                if communes and len(communes) > 0:
                    insee_code = communes[0]["code"]
                    city_name = communes[0]["nom"]
                    logger.info(
                        f"Found nearest French city at {lat:.4f},{lon:.4f}: {city_name} (INSEE: {insee_code})"
                    )
                    return insee_code
                else:
                    logger.warning(f"No French city found near coordinates {lat:.4f},{lon:.4f}")
                    return None

        except Exception as e:
            logger.error(f"Error in reverse geocoding for {lat},{lon}: {e}")
            return None

    async def fetch(self, lat: float, lon: float, **kwargs) -> dict[str, Any]:
        """
        Fetch forecast from meteociel

        Args:
            lat: Latitude (not used, we use site_name instead)
            lon: Longitude (not used, we use site_name instead)
            **kwargs: Must include 'site_name' for city lookup

        Returns:
            Standard response dict
        """
        site_name = kwargs.get("site_name")

        if not site_name:
            return self._build_response(
                success=False, error="site_name is required for meteociel scraper"
            )

        try:
            # Step 1: Get INSEE code
            insee_code = await self._get_insee_code(site_name)

            if not insee_code:
                # Graceful degradation: Try to find nearest French city using coordinates
                logger.info(
                    f"No INSEE code found for {site_name}, trying reverse geocoding with coordinates"
                )
                insee_code = await self._get_nearest_insee_code(lat, lon)

                if not insee_code:
                    return self._build_response(
                        success=False,
                        error=f"Meteociel only supports French cities. Could not find INSEE code for {site_name} or nearby location.",
                    )

            # Step 2: Build URL - Using AROME hourly forecasts (1h resolution)
            # Normalize city name: lowercase, remove accents, replace spaces
            import unicodedata

            city_normalized = "".join(
                c
                for c in unicodedata.normalize("NFD", site_name)
                if unicodedata.category(c) != "Mn"
            )
            city_slug = city_normalized.lower().replace(" ", "-").replace("_", "-")
            url = f"https://www.meteociel.fr/previsions-arome-1h/{insee_code}/{city_slug}.htm"

            logger.info(f"Fetching meteociel forecast: {url}")

            # Step 3: Fetch HTML
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                html = response.text

            # Step 4: Parse HTML
            soup = BeautifulSoup(html, "html.parser")

            # Step 5: Extract forecast data
            hourly_data = self._parse_forecast_tables(soup)

            return self._build_response(success=True, data={"hourly": hourly_data})

        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP {e.response.status_code}: {str(e)}"
            logger.error(error_msg)
            return self._build_response(success=False, error=error_msg)

        except Exception as e:
            logger.error(f"Meteociel scrape error: {e}", exc_info=True)
            return self._build_response(success=False, error=str(e))

    def _parse_forecast_tables(self, soup: BeautifulSoup) -> list[dict[str, Any]]:
        """
        Parse meteociel HTML tables to extract hourly forecast

        IMPORTANT: Meteociel uses a unique format where ALL hourly forecasts are stored
        in a SINGLE table row as a continuous sequence of cells (typically 500+ cells).
        Each hour occupies ~10 cells with the pattern:
        [DayMarker?] Hour Temp FeltTemp WindIcon WindMean WindGust Precip Humidity Pressure WeatherIcon

        Args:
            soup: BeautifulSoup object of the page

        Returns:
            List of hourly forecast dicts
        """
        hourly_data = []

        # Find tables
        tables = soup.find_all("table")

        # Find forecast table (contains "Heure" and "Temp" in first few rows)
        for table in tables:
            rows = table.find_all("tr")
            if len(rows) < 2:
                continue

            # Check for forecast table headers
            header_text = " ".join([r.get_text() for r in rows[:3]])
            if "Heure" not in header_text or "Temp" not in header_text:
                continue

            logger.info("Found forecast table")

            # Find the data row (the one with 500+ cells containing all hourly data)
            all_cells = []
            for row in rows[1:]:  # Skip first row (headers)
                cells = row.find_all("td")
                if len(cells) > 100:  # Data row has many cells
                    all_cells = cells
                    logger.info(f"Found data row with {len(all_cells)} cells")
                    break

            if not all_cells:
                continue

            # Parse cells sequentially
            # Skip initial cells until we find the first time pattern "XX:00"
            current_day = None
            i = 0

            # Find start of forecast data (first hour marker)
            while i < len(all_cells):
                cell_text = all_cells[i].get_text(strip=True)
                if re.match(r"\d{1,2}:00", cell_text):
                    # Found first hour - check previous cell for day marker
                    if i > 0:
                        prev_cell = all_cells[i - 1].get_text(strip=True)
                        if re.match(r"[A-Z][a-z]{2}\d{2}", prev_cell):
                            current_day = prev_cell
                            i -= 1  # Start from day marker
                    break
                i += 1

            logger.info(f"Starting parse at cell index {i}")

            # Parse hourly data from cells
            while i < len(all_cells) - 9:  # Need at least 10 cells for complete hour
                try:
                    cell_text = all_cells[i].get_text(strip=True)

                    # Check if current cell is a day marker
                    if re.match(r"[A-Z][a-z]{2}\d{2}", cell_text):
                        current_day = cell_text
                        i += 1
                        if i >= len(all_cells):
                            break
                        cell_text = all_cells[i].get_text(strip=True)

                    # Current cell should be hour (XX:00)
                    hour_match = re.search(r"(\d{1,2}):00", cell_text)
                    if not hour_match:
                        i += 1
                        continue

                    hour = int(hour_match.group(1))

                    # Extract data from next cells
                    # Pattern: [i] Hour, [i+1] Temp, [i+2] FeltTemp, [i+3] WindIcon,
                    #          [i+4] WindMean, [i+5] WindGust, [i+6] Precip,
                    #          [i+7] Humidity, [i+8] Pressure, [i+9] WeatherIcon

                    temp = None
                    wind_speed = None
                    wind_gust = None
                    precipitation = 0.0  # Default to 0.0: "--" means no rain (measurable zero)
                    humidity = None

                    # Temperature (i+1, format: "X °C" or "-X °C")
                    if i + 1 < len(all_cells):
                        temp_text = all_cells[i + 1].get_text(strip=True)
                        # Match temperature with or without degree symbol: "1 °C", "1 C", "1°C"
                        temp_match = re.search(r"(-?\d+)\s*°?\s*C", temp_text)
                        if temp_match:
                            temp = float(temp_match.group(1))

                    # Skip felt temp (i+2)

                    # Wind direction icon (i+3) - extract from image title attribute
                    wind_direction = None
                    if i + 3 < len(all_cells):
                        wind_icon_cell = all_cells[i + 3]
                        # Find image with wind direction in title
                        # Format example: "Sud-Sud-Est : 153 " → extract 153
                        img = wind_icon_cell.find("img")
                        if img:
                            title = img.get("title", "")
                            # Extract degrees from title (format: "Direction : XXX")
                            direction_match = re.search(r":\s*(\d+)", title)
                            if direction_match:
                                wind_direction = float(direction_match.group(1))

                    # Wind speed mean (i+4, km/h - convert to m/s)
                    if i + 4 < len(all_cells):
                        wind_text = all_cells[i + 4].get_text(strip=True)
                        wind_match = re.search(r"(\d+)", wind_text)
                        if wind_match:
                            wind_speed = float(wind_match.group(1)) / 3.6

                    # Wind gust (i+5, km/h - convert to m/s)
                    if i + 5 < len(all_cells):
                        gust_text = all_cells[i + 5].get_text(strip=True)
                        if gust_text and gust_text != "--":
                            gust_match = re.search(r"(\d+)", gust_text)
                            if gust_match:
                                wind_gust = float(gust_match.group(1)) / 3.6

                    # Precipitation (i+6, mm)
                    if i + 6 < len(all_cells):
                        precip_text = all_cells[i + 6].get_text(strip=True)
                        if precip_text and precip_text != "--":
                            precip_match = re.search(r"(\d+(?:\.\d+)?)", precip_text)
                            if precip_match:
                                precipitation = float(precip_match.group(1))

                    # Humidity (i+7, %)
                    if i + 7 < len(all_cells):
                        humidity_text = all_cells[i + 7].get_text(strip=True)
                        humidity_match = re.search(r"(\d+)\s*%", humidity_text)
                        if humidity_match:
                            humidity = float(humidity_match.group(1))

                    # Skip pressure (i+8) and weather icon (i+9)

                    hourly_data.append(
                        {
                            "hour": hour,
                            "temperature": temp,
                            "wind_speed": wind_speed,
                            "wind_gust": wind_gust,
                            "wind_direction": wind_direction,  # Extracted from image title attribute
                            "precipitation": precipitation,
                            "cloud_cover": None,  # Not provided by Meteociel
                            "humidity": humidity,
                            "day_marker": current_day,
                        }
                    )

                    # Move to next hour (10 cells ahead)
                    i += 10

                except Exception as e:
                    logger.warning(f"Error parsing cell group at index {i}: {e}")
                    i += 1
                    continue

            # Stop after processing first valid forecast table
            if hourly_data:
                break

        logger.info(f"Extracted {len(hourly_data)} hourly forecasts from meteociel")

        if len(hourly_data) < 20:
            logger.warning(
                f"Only extracted {len(hourly_data)} hours from Meteociel, expected ~40-50"
            )

        return hourly_data

    def extract_hourly_forecast(
        self, data: dict[str, Any], day_index: int = 0
    ) -> list[dict[str, Any]]:
        """
        Extract hourly forecast for a specific day

        Args:
            data: Response from fetch()
            day_index: Day index (0=today, 1=tomorrow, 2=day after)

        Returns:
            List of hourly forecasts
        """
        if not data.get("success"):
            return []

        api_data = data.get("data", {})
        all_hourly = api_data.get("hourly", [])

        if not all_hourly:
            return []

        # Group by day
        days = {}
        for hour_data in all_hourly:
            day_marker = hour_data.get("day_marker", "Day0")
            if day_marker not in days:
                days[day_marker] = []
            days[day_marker].append(hour_data)

        # Get the requested day
        day_keys = sorted(days.keys())

        if day_index >= len(day_keys):
            logger.warning(f"Day index {day_index} out of range (have {len(day_keys)} days)")
            return []

        day_key = day_keys[day_index]
        return days[day_key]


# ============================================================
# PUBLIC FUNCTIONS (Backward compatible)
# ============================================================


async def fetch_meteociel(
    lat: float, lon: float, site_name: str | None = None, **kwargs
) -> dict[str, Any]:
    """
    Fetch forecast from meteociel.fr

    Args:
        lat: Latitude (not used, kept for compatibility)
        lon: Longitude (not used, kept for compatibility)
        site_name: Site/city name (REQUIRED for meteociel)
        **kwargs: Additional parameters

    Returns:
        Dict with success, source, data, timestamp
    """
    scraper = MeteocielScraper()
    return await scraper.fetch(lat, lon, site_name=site_name, **kwargs)


def extract_hourly_forecast(data: dict[str, Any], day_index: int = 0) -> list[dict[str, Any]]:
    """
    Parse scraped data into standard format (backward compatible)

    Args:
        data: Data dict from fetch_meteociel()
        day_index: Day index (0=today, 1=tomorrow, etc.)

    Returns:
        List of hourly forecast dicts
    """
    scraper = MeteocielScraper()
    return scraper.extract_hourly_forecast(data, day_index)
