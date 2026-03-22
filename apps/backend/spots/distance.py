"""
Geographic distance calculations for paragliding spots

Provides haversine distance calculations and bounding box utilities
for efficient geographic searches.
"""

import math


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth
    using the Haversine formula.

    Args:
        lat1: Latitude of first point (decimal degrees)
        lon1: Longitude of first point (decimal degrees)
        lat2: Latitude of second point (decimal degrees)
        lon2: Longitude of second point (decimal degrees)

    Returns:
        Distance in kilometers

    Example:
        >>> haversine_distance(47.24, 6.02, 47.19, 5.99)
        5.92  # Approximate distance in km
    """
    # Earth's radius in kilometers
    R = 6371.0

    # Convert degrees to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    # Differences
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    # Haversine formula
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    distance = R * c
    return round(distance, 2)


def calculate_bounding_box(
    center_lat: float, center_lon: float, radius_km: float
) -> tuple[float, float, float, float]:
    """
    Calculate a bounding box (min/max lat/lon) for a given center point and radius.

    This is used for efficient database queries: first filter by bounding box (fast),
    then calculate precise haversine distances for remaining points.

    Args:
        center_lat: Center latitude (decimal degrees)
        center_lon: Center longitude (decimal degrees)
        radius_km: Search radius in kilometers

    Returns:
        Tuple of (min_lat, max_lat, min_lon, max_lon)

    Note:
        This is an approximation. At latitude 45°:
        - 1° latitude ≈ 111 km
        - 1° longitude ≈ 78 km
    """
    # Approximate conversion (good enough for our purposes)
    # 1 degree of latitude ≈ 111 km everywhere
    # 1 degree of longitude ≈ 111 km * cos(latitude)

    lat_delta = radius_km / 111.0
    lon_delta = radius_km / (111.0 * math.cos(math.radians(center_lat)))

    min_lat = center_lat - lat_delta
    max_lat = center_lat + lat_delta
    min_lon = center_lon - lon_delta
    max_lon = center_lon + lon_delta

    return (min_lat, max_lat, min_lon, max_lon)


def filter_by_distance(spots: list, center_lat: float, center_lon: float, radius_km: float) -> list:
    """
    Filter spots by distance from a center point and add distance field.

    Args:
        spots: List of spot dictionaries (must have 'latitude' and 'longitude')
        center_lat: Center latitude
        center_lon: Center longitude
        radius_km: Maximum distance in kilometers

    Returns:
        Filtered list of spots with 'distance_km' field added, sorted by distance
    """
    results = []

    for spot in spots:
        distance = haversine_distance(center_lat, center_lon, spot["latitude"], spot["longitude"])

        if distance <= radius_km:
            spot_with_distance = spot.copy()
            spot_with_distance["distance_km"] = distance
            results.append(spot_with_distance)

    # Sort by distance (closest first)
    results.sort(key=lambda x: x["distance_km"])

    return results
