"""
Paragliding spots search module

This module provides functionality to:
- Fetch spot data from OpenAIP and ParaglidingSpots.com
- Search for spots by city name or GPS coordinates
- Calculate distances between locations
- Sync external data to local database
"""

from .data_fetcher import sync_to_database
from .distance import calculate_bounding_box, haversine_distance
from .geocoding import geocode_city
from .search import get_spot_by_id, get_sync_status, search_by_city, search_by_coordinates

__all__ = [
    "haversine_distance",
    "calculate_bounding_box",
    "geocode_city",
    "search_by_city",
    "search_by_coordinates",
    "get_spot_by_id",
    "get_sync_status",
    "sync_to_database",
]
