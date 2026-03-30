"""
Météo-parapente scraper using REST API
Site: https://meteo-parapente.com
API: https://data0.meteo-parapente.com/data.php

IMPORTANT: Ce scraper utilise l'API REST directe (pas de Playwright nécessaire!)
"""

import logging
import math
from datetime import datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)

# Import de la nouvelle architecture si disponible
try:
    from .base import APIScraper

    USING_NEW_ARCHITECTURE = True
except ImportError:
    USING_NEW_ARCHITECTURE = False
    logger.warning("Nouvelle architecture non disponible, utilisation du code standalone")


def calculate_wind_speed_from_components(u: float, v: float) -> float:
    """
    Calculate wind speed from U and V components

    Args:
        u: U component (east-west) in m/s
        v: V component (north-south) in m/s

    Returns:
        Wind speed in m/s
    """
    return math.sqrt(u**2 + v**2)


def calculate_wind_direction_from_components(u: float, v: float) -> int:
    """
    Calculate wind direction from U and V components

    Args:
        u: U component (east-west) in m/s
        v: V component (north-south) in m/s

    Returns:
        Wind direction in degrees (0-360)
    """
    # atan2(u, v) gives direction WHERE wind goes TO in radians
    # Add 180° to convert to meteorological convention (where wind comes FROM)
    direction = math.degrees(math.atan2(u, v)) + 180
    # Normalize to 0-360
    direction = direction % 360
    return int(direction)


if USING_NEW_ARCHITECTURE:
    # ============================================================
    # NOUVELLE IMPLÉMENTATION (API REST)
    # ============================================================

    class MeteoParapenteScraper(APIScraper):
        """
        Scraper pour meteo-parapente.com via API REST

        APIs utilisées:
        - Autocomplete: https://api-search.meteo-parapente.com/v1/autocomplete
        - Status: https://data0.meteo-parapente.com/status.php
        - Data: https://data0.meteo-parapente.com/data.php

        Params data.php:
        - run: Model run (format: YYYYMMDDHH)
        - location: Lat,Lon
        - date: Date (format: YYYYMMDD)
        - plot: windgram
        """

        AUTOCOMPLETE_URL = "https://api-search.meteo-parapente.com/v1/autocomplete"
        STATUS_URL = "https://data0.meteo-parapente.com/status.php"

        def __init__(self):
            super().__init__(
                source_name="meteo_parapente",
                base_url="https://data0.meteo-parapente.com/data.php",
                timeout=15,
            )

        async def _search_location(self, site_name: str, lat_hint: float, lon_hint: float) -> tuple:
            """
            Search for precise coordinates using autocomplete API

            Args:
                site_name: Name of the site to search
                lat_hint: Approximate latitude (for search focus)
                lon_hint: Approximate longitude (for search focus)

            Returns:
                Tuple (lat, lon) with precise coordinates, or (None, None) if not found
            """
            try:
                params = {
                    "text": site_name,
                    "focus.point.lat": int(lat_hint),
                    "focus.point.lon": int(lon_hint),
                }

                async with self._get_client() as client:
                    response = await client.get(self.AUTOCOMPLETE_URL, params=params)
                    response.raise_for_status()
                    data = response.json()

                    if data.get("features"):
                        # Take first result
                        coords = data["features"][0]["geometry"]["coordinates"]
                        # GeoJSON format is [lon, lat], we return (lat, lon)
                        return coords[1], coords[0]

                    logger.warning(f"No results found for site '{site_name}'")
                    return None, None

            except Exception as e:
                logger.error(f"Error searching location '{site_name}': {e}")
                return None, None

        async def _get_latest_run(self) -> str:
            """
            Get the latest available model run from status API

            Returns:
                Model run string (format: YYYYMMDDHH) or default value
            """
            try:
                async with self._get_client() as client:
                    response = await client.get(self.STATUS_URL)
                    response.raise_for_status()
                    data = response.json()

                    # Status API returns: {"france": [{run: "2026022818", status: "complete"}, ...]}
                    france_runs = data.get("france", [])

                    if not france_runs:
                        logger.warning("No france runs in status API")
                        raise ValueError("No france runs")

                    # Find the latest complete run (not private)
                    complete_runs = [
                        r
                        for r in france_runs
                        if r.get("status") == "complete" and not r.get("private", False)
                    ]

                    if not complete_runs:
                        logger.warning("No complete non-private runs found")
                        raise ValueError("No complete runs")

                    # Sort by run date (descending) and take the first one
                    latest_run = sorted(complete_runs, key=lambda x: x["run"], reverse=True)[0]
                    run_str = latest_run["run"]

                    logger.info(
                        f"Using model run: {run_str} (updated: {latest_run.get('update', 'unknown')})"
                    )
                    return run_str

            except Exception as e:
                logger.warning(f"Error fetching status: {e}, using fallback")
                # Fallback: yesterday 18:00
                run_date = datetime.now() - timedelta(days=1)
                return run_date.strftime("%Y%m%d18")

        async def _build_params(self, lat: float, lon: float, **kwargs) -> dict[str, Any]:
            """
            Build API request parameters

            Note: This method is now async to support fetching latest run from status API
            """

            # Get site_name if provided to search for precise coordinates
            site_name = kwargs.get("site_name")
            final_lat, final_lon = lat, lon

            if site_name:
                # Search for precise coordinates via autocomplete
                precise_lat, precise_lon = await self._search_location(site_name, lat, lon)
                if precise_lat and precise_lon:
                    logger.info(
                        f"Using precise coordinates for {site_name}: {precise_lat:.4f}, {precise_lon:.4f}"
                    )
                    final_lat, final_lon = precise_lat, precise_lon
                else:
                    logger.warning(
                        f"Could not find precise coordinates for {site_name}, using provided: {lat:.4f}, {lon:.4f}"
                    )

            # Get date parameter (default to today)
            # Note: meteo-parapente API only returns 1 day per request
            # The pipeline will call this multiple times for multiple days
            date_str = kwargs.get("date")
            if not date_str:
                # Default to today
                date_obj = datetime.now()
                date_str = date_obj.strftime("%Y%m%d")

            # Model run (use latest available from status API)
            # Format: YYYYMMDDHH
            run_str = kwargs.get("run")
            if not run_str:
                # Fetch latest available run from status API
                run_str = await self._get_latest_run()

            return {
                "run": run_str,
                "location": f"{final_lat:.4f},{final_lon:.4f}",
                "date": date_str,
                "plot": "sounding",  # Changed from "windgram" to get temperature data (tc field)
            }

        def extract_hourly_forecast(
            self, data: dict[str, Any], day_index: int = 0
        ) -> list[dict[str, Any]]:
            """
            Extract hourly forecast from API response

            Args:
                data: Response from fetch()
                day_index: Day index (0=today) - not used for this API

            Returns:
                List of hourly forecasts
            """

            if not data.get("success"):
                return []

            api_data = data.get("data", {})
            hourly_data_dict = api_data.get("data", {})

            if not hourly_data_dict:
                logger.warning("No hourly data in API response")
                return []

            hourly_forecasts = []

            # Parse each hour
            for hour_str, hour_data in sorted(hourly_data_dict.items()):
                try:
                    # Parse hour (format: "04:00", "05:00", etc.)
                    hour = int(hour_str.split(":")[0])

                    # Get altitude levels and wind components
                    altitudes = hour_data.get("z", [])  # Altitudes in meters
                    u_components = hour_data.get("umet", [])  # U wind component (m/s)
                    v_components = hour_data.get("vmet", [])  # V wind component (m/s)
                    temps = hour_data.get(
                        "tc", []
                    )  # Temperature (°C) - using "tc" from sounding plot

                    if not altitudes or not u_components or not v_components:
                        continue

                    # Use surface level (index 0) for forecast
                    # TODO: Could add elevation_m parameter to select altitude level
                    closest_idx = 0  # Surface level

                    # Get data at that altitude
                    u = (
                        u_components[closest_idx]
                        if closest_idx < len(u_components)
                        else u_components[0]
                    )
                    v = (
                        v_components[closest_idx]
                        if closest_idx < len(v_components)
                        else v_components[0]
                    )
                    temp = temps[closest_idx] if temps and closest_idx < len(temps) else None

                    # Calculate wind speed and direction
                    wind_speed = calculate_wind_speed_from_components(u, v)
                    wind_direction = calculate_wind_direction_from_components(u, v)

                    hourly_forecasts.append(
                        {
                            "hour": hour,
                            "wind_speed": wind_speed,
                            "wind_direction": wind_direction,
                            "wind_gust": None,  # Not available in this API
                            "temperature": temp,
                            "precipitation": None,  # Not available
                            "cloud_cover": None,  # Not available
                            "altitude_used": altitudes[closest_idx],
                        }
                    )

                except Exception as e:
                    logger.warning(f"Error parsing hour {hour_str}: {e}")
                    continue

            logger.info(
                f"Extracted {len(hourly_forecasts)} hourly forecasts from meteo-parapente API"
            )
            return hourly_forecasts


# ============================================================
# FONCTIONS PUBLIQUES (Backward compatible)
# ============================================================


async def fetch_meteo_parapente(
    lat: float,
    lon: float,
    site_name: str = None,  # Pas utilisé avec l'API (optionnel)
    elevation_m: int = None,  # Utilisé pour sélectionner l'altitude
    days: int = 1,  # Note: API retourne 1 jour à la fois
    date: str = None,  # Format YYYYMMDD
    run: str = None,  # Format YYYYMMDDHH
) -> dict[str, Any]:
    """
    Fetch forecast from meteo-parapente.com API

    Args:
        lat: Latitude
        lon: Longitude
        site_name: Site name (not used by API, kept for compatibility)
        elevation_m: Elevation in meters (used to select altitude level)
        days: Number of days (API returns 1 day per call)
        date: Date string YYYYMMDD (default: today)
        run: Model run YYYYMMDDHH (default: latest)

    Returns:
        Dict with success, source, data, timestamp
    """

    if USING_NEW_ARCHITECTURE:
        scraper = MeteoParapenteScraper()
        return await scraper.fetch(
            lat,
            lon,
            elevation_m=elevation_m or 500,
            date=date,
            run=run,
            site_name=site_name,  # Forward site_name for coordinate refinement
        )
    else:
        # Standalone fallback (sans architecture)
        import httpx

        try:
            # Build params
            if not date:
                date = datetime.now().strftime("%Y%m%d")
            if not run:
                run_date = datetime.now() - timedelta(hours=12)
                run = run_date.strftime("%Y%m%d18")

            params = {
                "run": run,
                "location": f"{lat:.4f},{lon:.4f}",
                "date": date,
                "plot": "windgram",
            }

            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.get(
                    "https://data0.meteo-parapente.com/data.php", params=params
                )
                response.raise_for_status()
                api_data = response.json()

            return {
                "success": True,
                "source": "meteo_parapente",
                "data": api_data,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            logger.error(f"Meteo-parapente API error: {e}")
            return {
                "success": False,
                "source": "meteo_parapente",
                "error": str(e),
                "data": {},
                "timestamp": datetime.now().isoformat(),
            }


def extract_hourly_forecast(data: dict[str, Any], day_index: int = 0) -> list[dict[str, Any]]:
    """
    Extract hourly forecast (backward compatible)

    Args:
        data: Data dict from fetch_meteo_parapente()
        day_index: Day index (not used, API returns 1 day)

    Returns:
        List of hourly forecast dicts
    """
    if USING_NEW_ARCHITECTURE:
        scraper = MeteoParapenteScraper()
        return scraper.extract_hourly_forecast(data, day_index)
    else:
        # Fallback simple
        if not data.get("success"):
            return []

        # Extract data (simplified version)
        api_data = data.get("data", {})
        hourly_dict = api_data.get("data", {})

        hourly_forecasts = []
        for hour_str in sorted(hourly_dict.keys()):
            try:
                hour = int(hour_str.split(":")[0])
                hour_data = hourly_dict[hour_str]

                # Get surface level data
                u = hour_data.get("umet", [0])[0]
                v = hour_data.get("vmet", [0])[0]

                wind_speed = calculate_wind_speed_from_components(u, v)
                wind_direction = calculate_wind_direction_from_components(u, v)

                hourly_forecasts.append(
                    {
                        "hour": hour,
                        "wind_speed": wind_speed,
                        "wind_direction": wind_direction,
                        "wind_gust": None,
                        "temperature": None,
                        "precipitation": None,
                        "cloud_cover": None,
                    }
                )
            except Exception:
                continue

        return hourly_forecasts
