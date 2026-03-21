"""
Open-Meteo atmospheric sounding scraper
Fetches model-based atmospheric profiles for any location
Better alternative to Wyoming for French spots
"""

from datetime import datetime
from typing import Any

import httpx

# Pressure levels available from Open-Meteo (hPa)
PRESSURE_LEVELS = [
    1000,
    975,
    950,
    925,
    900,
    850,
    800,
    700,
    600,
    500,
    400,
    300,
    250,
    200,
    150,
    100,
    70,
    50,
    30,
]

# Geopotential height approximation (m) for pressure levels
# These are standard atmosphere approximations
STANDARD_HEIGHTS = {
    1000: 111,
    975: 320,
    950: 540,
    925: 762,
    900: 988,
    850: 1457,
    800: 1949,
    700: 3012,
    600: 4206,
    500: 5574,
    400: 7185,
    300: 9164,
    250: 10363,
    200: 11784,
    150: 13608,
    100: 16180,
    70: 18442,
    50: 20576,
    30: 23849,
}


async def fetch_open_meteo_sounding(
    latitude: float, longitude: float, forecast_hour: int = 0, use_icon: bool = False
) -> dict[str, Any]:
    """
    Fetch atmospheric sounding from Open-Meteo model data

    Args:
        latitude: Location latitude
        longitude: Location longitude
        forecast_hour: Hours from now (0 = current, 12 = +12h, etc.)
        use_icon: Use ICON-D2 model (higher resolution for Europe)

    Returns:
        Dict with sounding data in Wyoming-compatible format
    """

    # Build API parameters for all pressure levels
    temp_params = [f"temperature_{level}hPa" for level in PRESSURE_LEVELS]
    dewpoint_params = [f"dewpoint_{level}hPa" for level in PRESSURE_LEVELS if level >= 200]
    wind_speed_params = [f"windspeed_{level}hPa" for level in PRESSURE_LEVELS]
    wind_dir_params = [f"winddirection_{level}hPa" for level in PRESSURE_LEVELS]

    all_params = temp_params + dewpoint_params + wind_speed_params + wind_dir_params

    # Choose model
    base_url = "https://api.open-meteo.com/v1/forecast"
    if use_icon:
        base_url = "https://api.open-meteo.com/v1/dwd-icon"  # Higher res for Germany/France

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": ",".join(all_params),
        "forecast_days": 1,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(base_url, params=params)
            response.raise_for_status()
            data = response.json()

        # Extract data for requested forecast hour
        hourly = data.get("hourly", {})
        times = hourly.get("time", [])

        if forecast_hour >= len(times):
            return {
                "success": False,
                "source": "open-meteo",
                "error": f"Forecast hour {forecast_hour} not available (max: {len(times)-1})",
            }

        # Build sounding levels
        levels = []
        for pressure in PRESSURE_LEVELS:
            temp_key = f"temperature_{pressure}hPa"
            dewpoint_key = f"dewpoint_{pressure}hPa"
            wind_speed_key = f"windspeed_{pressure}hPa"
            wind_dir_key = f"winddirection_{pressure}hPa"

            # Get values for this hour
            temp = hourly.get(temp_key, [None] * len(times))[forecast_hour]
            dewpoint = (
                hourly.get(dewpoint_key, [None] * len(times))[forecast_hour]
                if pressure >= 200
                else None
            )
            wind_speed = hourly.get(wind_speed_key, [None] * len(times))[forecast_hour]
            wind_dir = hourly.get(wind_dir_key, [None] * len(times))[forecast_hour]

            # Skip if no temperature data
            if temp is None:
                continue

            # Use standard atmosphere height
            height = STANDARD_HEIGHTS.get(pressure, 0)

            # Calculate relative humidity if dewpoint available
            if dewpoint is not None:
                # Magnus formula for RH
                es = 6.112 * (10 ** ((7.5 * temp) / (237.7 + temp)))
                e = 6.112 * (10 ** ((7.5 * dewpoint) / (237.7 + dewpoint)))
                relh = min(100, max(0, (e / es) * 100))
            else:
                dewpoint = temp - 10  # Rough estimate
                relh = 50

            levels.append(
                {
                    "pressure": pressure,
                    "height": height,
                    "temp": temp,
                    "dewpoint": dewpoint,
                    "relh": relh,
                    "wind_dir": wind_dir if wind_dir is not None else 0,
                    "wind_speed": wind_speed if wind_speed is not None else 0,
                }
            )

        # Sort by pressure (descending = surface first)
        levels.sort(key=lambda x: x["pressure"], reverse=True)

        sounding_time = times[forecast_hour]
        dt = datetime.fromisoformat(sounding_time.replace("Z", "+00:00"))

        return {
            "success": True,
            "source": "open-meteo",
            "model": "ICON-D2" if use_icon else "GFS",
            "station_name": f"Model sounding ({latitude:.2f}°N, {longitude:.2f}°E)",
            "station_latitude": latitude,
            "station_longitude": longitude,
            "station_elevation_m": data.get("elevation", 0),
            "sounding_time": dt.strftime("%Hz"),
            "sounding_date": dt.strftime("%Y-%m-%d"),
            "forecast_hour": forecast_hour,
            "data": {
                "levels": levels,
                "station_pressure": 1013.25,  # Standard
            },
            "timestamp": datetime.now().isoformat(),
            "from_cache": False,
        }

    except httpx.HTTPStatusError as e:
        return {
            "success": False,
            "source": "open-meteo",
            "error": f"HTTP {e.response.status_code}: {str(e)}",
        }
    except Exception as e:
        return {
            "success": False,
            "source": "open-meteo",
            "error": f"Error fetching Open-Meteo data: {str(e)}",
        }


async def fetch_sounding_for_spot(
    spot_latitude: float, spot_longitude: float, spot_name: str, forecast_hour: int = 0
) -> dict[str, Any]:
    """
    Fetch sounding specifically for a paragliding spot

    Args:
        spot_latitude: Spot latitude
        spot_longitude: Spot longitude
        spot_name: Spot name (for display)
        forecast_hour: Hours ahead (0=now, 3=+3h, etc.)

    Returns:
        Sounding data ready for emagram generation
    """
    result = await fetch_open_meteo_sounding(
        latitude=spot_latitude,
        longitude=spot_longitude,
        forecast_hour=forecast_hour,
        use_icon=True,  # Use ICON for better resolution in Europe
    )

    if result.get("success"):
        result["station_name"] = f"{spot_name} (model forecast)"

    return result
