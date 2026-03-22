"""Fonctions utilitaires partagées par les scrapers"""

import re
from typing import Any


def convert_kmh_to_ms(kmh: float) -> float:
    """Convert km/h to m/s"""
    return kmh / 3.6


def convert_ms_to_kmh(ms: float) -> float:
    """Convert m/s to km/h"""
    return ms * 3.6


def parse_wind_speed(text: str) -> float | None:
    """
    Extract wind speed from text (handles various formats)
    Returns speed in m/s

    Examples:
        "15 km/h" → 4.17 (m/s)
        "10 m/s" → 10.0
        "5-10 km/h" → 7.5 (average in m/s)
    """
    # Check range pattern FIRST (before single value)
    range_match = re.search(r"(\d+)-(\d+)\s*(?:km/h|kmh)", text, re.IGNORECASE)
    if range_match:
        avg = (float(range_match.group(1)) + float(range_match.group(2))) / 2
        return convert_kmh_to_ms(avg)

    # Pattern: number with unit km/h
    kmh_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:km/h|kmh)", text, re.IGNORECASE)
    if kmh_match:
        return convert_kmh_to_ms(float(kmh_match.group(1)))

    # Pattern: number with unit m/s
    ms_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:m/s|ms)", text, re.IGNORECASE)
    if ms_match:
        return float(ms_match.group(1))

    # Just a number (assume km/h for meteo sites)
    number_match = re.search(r"(\d+(?:\.\d+)?)", text)
    if number_match:
        return convert_kmh_to_ms(float(number_match.group(1)))

    return None


def parse_temperature(text: str) -> float | None:
    """
    Extract temperature from text

    Examples:
        "15°C" → 15.0
        "-5°" → -5.0
        "20 degrees" → 20.0
    """
    match = re.search(r"(-?\d+(?:\.\d+)?)\s*°?[Cc]?", text)
    if match:
        return float(match.group(1))
    return None


def parse_wind_direction(text: str) -> int | None:
    """
    Extract wind direction from text (in degrees 0-360)

    Examples:
        "270°" → 270
        "N" → 0
        "NE" → 45
        "SW" → 225
    """
    # Numeric degrees
    degree_match = re.search(r"(\d+)\s*°?", text)
    if degree_match:
        deg = int(degree_match.group(1))
        if 0 <= deg <= 360:
            return deg

    # Cardinal directions
    directions = {
        "N": 0,
        "NNE": 22,
        "NE": 45,
        "ENE": 67,
        "E": 90,
        "ESE": 112,
        "SE": 135,
        "SSE": 157,
        "S": 180,
        "SSW": 202,
        "SW": 225,
        "WSW": 247,
        "W": 270,
        "WNW": 292,
        "NW": 315,
        "NNW": 337,
    }

    text_upper = text.upper().strip()

    # Sort by length descending to check longest matches first (avoids "N" matching "NNE")
    for direction in sorted(directions.keys(), key=len, reverse=True):
        if direction in text_upper:
            return directions[direction]

    return None


def find_closest_altitude_row(
    rows: list[tuple[int, Any]], target_altitude: int
) -> tuple[int | None, Any]:
    """
    Find the row with altitude closest to target

    Args:
        rows: List of (altitude, row_element) tuples
        target_altitude: Target altitude in meters

    Returns:
        (selected_altitude, row_element) or (None, None)
    """
    if not rows:
        return None, None

    # Sort by altitude
    rows.sort(key=lambda x: x[0])

    # Find closest
    closest = min(rows, key=lambda x: abs(x[0] - target_altitude))

    return closest


def get_lowest_altitude_row(rows: list[tuple[int, Any]]) -> tuple[int | None, Any]:
    """
    Get the row with the lowest altitude

    Args:
        rows: List of (altitude, row_element) tuples

    Returns:
        (altitude, row_element) or (None, None)
    """
    if not rows:
        return None, None

    # Sort by altitude and take first (lowest)
    rows.sort(key=lambda x: x[0])
    return rows[0]


def get_spot_slug_from_coords(lat: float, lon: float) -> str:
    """
    Map coordinates to meteo-parapente spot slug

    Uses nearest-neighbor search with known spots
    """
    KNOWN_SPOTS = {
        (47.012, 6.789): "arguel",  # Arguel
        (47.015, 6.750): "mont-poupet",  # Mont Poupet
        (47.020, 6.770): "la-cote",  # La Côte
    }

    min_dist = float("inf")
    best_slug = "arguel"  # default

    for (spot_lat, spot_lon), slug in KNOWN_SPOTS.items():
        # Euclidean distance
        dist = ((lat - spot_lat) ** 2 + (lon - spot_lon) ** 2) ** 0.5
        if dist < min_dist:
            min_dist = dist
            best_slug = slug

    return best_slug


def parse_altitude_from_text(text: str) -> int | None:
    """
    Extract altitude in meters from text

    Examples:
        "427m" → 427
        "842 mètres" → 842
        "alt: 1500" → 1500
    """
    patterns = [
        r"(\d+)\s*m(?:ètres)?",
        r"(\d+)\s*m\b",
        r"alt(?:itude)?\s*:\s*(\d+)",
        r"(\d+)\s*(?:m|M)\b",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            alt = int(match.group(1))
            # Sanity check: altitude should be reasonable for paragliding
            if 100 <= alt <= 5000:
                return alt

    return None
