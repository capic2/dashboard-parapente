"""
Open-Meteo atmospheric sounding scraper.

Fetches model-based pressure-level profiles and normalizes them for the
Skew-T generator used by the LLM vision pipeline.
"""

from datetime import datetime
from time import monotonic
from typing import Any

import httpx

OPEN_METEO_MODEL_CONFIGS = {
    "arome": {
        "source": "open-meteo-arome",
        "label": "Open-Meteo Meteo-France AROME",
        "base_url": "https://api.open-meteo.com/v1/meteofrance",
        "model": "meteofrance_seamless",
    },
    "icon": {
        "source": "open-meteo-icon",
        "label": "Open-Meteo DWD ICON",
        "base_url": "https://api.open-meteo.com/v1/dwd-icon",
        "model": "icon_seamless",
    },
    "auto": {
        "source": "open-meteo",
        "label": "Open-Meteo Best Match",
        "base_url": "https://api.open-meteo.com/v1/forecast",
        "model": "auto",
    },
}
OPEN_METEO_RATE_LIMIT_COOLDOWN_SECONDS = 15 * 60
_OPEN_METEO_RATE_LIMIT_COOLDOWNS: dict[str, float] = {}

COMMON_PRESSURE_LEVELS = [
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

METEOFRANCE_PRESSURE_LEVELS = [
    1000,
    950,
    925,
    900,
    850,
    800,
    750,
    700,
    650,
    600,
    550,
    500,
    450,
    400,
    350,
    300,
    275,
    250,
    225,
    200,
    175,
    150,
    125,
    100,
    70,
    50,
    30,
]

STANDARD_HEIGHTS = {
    1000: 111,
    975: 320,
    950: 540,
    925: 762,
    900: 988,
    850: 1457,
    800: 1949,
    750: 2500,
    700: 3012,
    650: 3600,
    600: 4206,
    550: 4900,
    500: 5574,
    450: 6300,
    400: 7185,
    350: 8100,
    300: 9164,
    275: 9700,
    250: 10363,
    225: 11000,
    200: 11784,
    175: 12600,
    150: 13608,
    125: 14600,
    100: 16180,
    70: 18442,
    50: 20576,
    30: 23849,
}


def _pressure_levels_for_model(model: str) -> list[int]:
    return METEOFRANCE_PRESSURE_LEVELS if model == "arome" else COMMON_PRESSURE_LEVELS


def _target_hour_index(day_index: int, hour: int | None, forecast_hour: int) -> int:
    if hour is not None:
        return (day_index * 24) + hour
    return forecast_hour


def _open_meteo_cooldown_key(model_key: str, latitude: float, longitude: float) -> str:
    return f"{model_key}:{latitude:.3f}:{longitude:.3f}"


def _get_open_meteo_cooldown_error(cooldown_key: str, source: str) -> dict[str, Any] | None:
    expires_at = _OPEN_METEO_RATE_LIMIT_COOLDOWNS.get(cooldown_key)
    if not expires_at:
        return None

    now = monotonic()
    if expires_at <= now:
        _OPEN_METEO_RATE_LIMIT_COOLDOWNS.pop(cooldown_key, None)
        return None

    remaining_seconds = int(expires_at - now)
    return {
        "success": False,
        "source": source,
        "error": f"Open-Meteo rate limited; cooling down for {remaining_seconds}s",
        "rate_limited": True,
        "retry_after_seconds": remaining_seconds,
    }


def _hourly_value(hourly: dict[str, list[Any]], key: str, index: int) -> Any:
    values = hourly.get(key) or []
    if index < 0 or index >= len(values):
        return None
    return values[index]


def _levels_to_generator_data(levels: list[dict[str, Any]]) -> dict[str, list[Any]]:
    return {
        "pressure_hpa": [level.get("pressure") for level in levels],
        "height_m": [level.get("height") for level in levels],
        "temperature_c": [level.get("temp") for level in levels],
        "dewpoint_c": [level.get("dewpoint") for level in levels],
        "wind_direction_deg": [level.get("wind_dir") for level in levels],
        "wind_speed_knots": [
            level.get("wind_speed") / 1.852 if level.get("wind_speed") is not None else None
            for level in levels
        ],
    }


async def fetch_open_meteo_sounding(
    latitude: float,
    longitude: float,
    forecast_hour: int = 0,
    use_icon: bool = False,
    model: str | None = None,
    day_index: int = 0,
    hour: int | None = None,
) -> dict[str, Any]:
    """
    Fetch atmospheric pressure-level profile from Open-Meteo.

    `forecast_hour` is kept for older callers and is interpreted as the
    absolute index in Open-Meteo's hourly arrays, which start at today's 00Z.
    New callers should pass `day_index` and `hour`.
    """
    model_key = model or ("icon" if use_icon else "auto")
    if model_key not in OPEN_METEO_MODEL_CONFIGS:
        return {"success": False, "source": "open-meteo", "error": f"Unknown model {model_key}"}

    config = OPEN_METEO_MODEL_CONFIGS[model_key]
    cooldown_key = _open_meteo_cooldown_key(model_key, latitude, longitude)
    if cooldown_error := _get_open_meteo_cooldown_error(cooldown_key, config["source"]):
        return cooldown_error

    pressure_levels = _pressure_levels_for_model(model_key)
    if (
        day_index < 0
        or (hour is not None and not 0 <= hour < 24)
        or (hour is None and forecast_hour < 0)
    ):
        return {
            "success": False,
            "source": config["source"],
            "error": (
                "Invalid forecast time: day_index must be >= 0, hour must be 0-23, "
                "and forecast_hour must be >= 0"
            ),
        }
    target_index = _target_hour_index(day_index, hour, forecast_hour)

    temp_params = [f"temperature_{level}hPa" for level in pressure_levels]
    dewpoint_params = [f"dew_point_{level}hPa" for level in pressure_levels]
    wind_speed_params = [f"wind_speed_{level}hPa" for level in pressure_levels]
    wind_dir_params = [f"wind_direction_{level}hPa" for level in pressure_levels]
    height_params = [f"geopotential_height_{level}hPa" for level in pressure_levels]

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": ",".join(
            temp_params + dewpoint_params + wind_speed_params + wind_dir_params + height_params
        ),
        "forecast_days": max(1, (target_index // 24) + 1),
        "wind_speed_unit": "kmh",
    }
    if config["model"] != "auto":
        params["models"] = config["model"]

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(config["base_url"], params=params)
            response.raise_for_status()
            payload = response.json()

        hourly = payload.get("hourly", {})
        times = hourly.get("time", [])
        if target_index >= len(times):
            return {
                "success": False,
                "source": config["source"],
                "error": f"Forecast hour index {target_index} not available (max: {len(times)-1})",
            }

        levels = []
        for pressure in pressure_levels:
            temp = _hourly_value(hourly, f"temperature_{pressure}hPa", target_index)
            dewpoint = _hourly_value(hourly, f"dew_point_{pressure}hPa", target_index)
            wind_speed = _hourly_value(hourly, f"wind_speed_{pressure}hPa", target_index)
            wind_dir = _hourly_value(hourly, f"wind_direction_{pressure}hPa", target_index)
            height = _hourly_value(hourly, f"geopotential_height_{pressure}hPa", target_index)

            if temp is None:
                continue

            if height is None:
                height = STANDARD_HEIGHTS.get(pressure, 0)

            if dewpoint is not None:
                es = 6.112 * (10 ** ((7.5 * temp) / (237.7 + temp)))
                e = 6.112 * (10 ** ((7.5 * dewpoint) / (237.7 + dewpoint)))
                relh = min(100, max(0, (e / es) * 100))
            else:
                dewpoint = temp - 10
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

        levels.sort(key=lambda level: level["pressure"], reverse=True)
        if len(levels) < 5:
            return {
                "success": False,
                "source": config["source"],
                "error": f"Insufficient Open-Meteo pressure levels for {config['label']}",
            }

        sounding_datetime = datetime.fromisoformat(times[target_index].replace("Z", "+00:00"))
        return {
            "success": True,
            "source": config["source"],
            "model": config["label"],
            "external_url": str(response.url),
            "station_name": f"{config['label']} ({latitude:.2f}N, {longitude:.2f}E)",
            "station_latitude": latitude,
            "station_longitude": longitude,
            "station_elevation_m": payload.get("elevation", 0),
            "sounding_time": sounding_datetime.strftime("%Hz"),
            "sounding_date": sounding_datetime.strftime("%Y-%m-%d"),
            "forecast_hour": hour if hour is not None else target_index,
            "forecast_hour_index": target_index,
            "data": {"levels": levels, "station_pressure": 1013.25},
            "generator_data": _levels_to_generator_data(levels),
            "timestamp": datetime.now().isoformat(),
            "from_cache": False,
        }

    except httpx.HTTPStatusError as e:
        retry_after = e.response.headers.get("retry-after")
        retry_after_seconds = None
        if retry_after:
            try:
                retry_after_seconds = max(1, int(retry_after))
            except ValueError:
                retry_after_seconds = None
        if e.response.status_code == 429:
            cooldown_seconds = retry_after_seconds or OPEN_METEO_RATE_LIMIT_COOLDOWN_SECONDS
            _OPEN_METEO_RATE_LIMIT_COOLDOWNS[cooldown_key] = monotonic() + cooldown_seconds
            return {
                "success": False,
                "source": config["source"],
                "error": f"Open-Meteo rate limited (HTTP 429); cooling down for {cooldown_seconds}s",
                "rate_limited": True,
                "retry_after_seconds": cooldown_seconds,
            }
        return {
            "success": False,
            "source": config["source"],
            "error": f"HTTP {e.response.status_code}: {str(e)}",
        }
    except Exception as e:
        return {
            "success": False,
            "source": config["source"],
            "error": f"Error fetching Open-Meteo data: {str(e)}",
        }


async def fetch_sounding_for_spot(
    spot_latitude: float,
    spot_longitude: float,
    spot_name: str,
    forecast_hour: int = 0,
    model: str = "icon",
    day_index: int = 0,
    hour: int | None = None,
) -> dict[str, Any]:
    """Fetch sounding data for a paragliding spot."""
    result = await fetch_open_meteo_sounding(
        latitude=spot_latitude,
        longitude=spot_longitude,
        forecast_hour=forecast_hour,
        model=model,
        day_index=day_index,
        hour=hour,
    )

    if result.get("success"):
        result["station_name"] = f"{spot_name} ({result.get('model', 'Open-Meteo')})"

    return result
