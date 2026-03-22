"""
Geocoding functionality for city name lookups

Uses Nominatim (OpenStreetMap) API for free geocoding.
Includes rate limiting and caching to respect API terms of use.
"""

import logging
import time

import requests

logger = logging.getLogger(__name__)

# In-memory cache for geocoded cities
# Format: {city_name: (lat, lon, timestamp)}
_geocoding_cache: dict[str, tuple[float, float, float]] = {}

# Cache TTL: 7 days (cities don't move!)
CACHE_TTL_SECONDS = 7 * 24 * 60 * 60

# Last request timestamp for rate limiting
_last_request_time = 0.0

# Nominatim requires 1 second between requests
RATE_LIMIT_SECONDS = 1.0


def geocode_city(city_name: str, country: str = "FR") -> tuple[float, float] | None:
    """
    Geocode a city name to latitude/longitude coordinates.

    Uses Nominatim (OpenStreetMap) API with:
    - 1-second rate limiting (required by Nominatim)
    - 7-day in-memory cache
    - User-Agent header (required by Nominatim)

    Args:
        city_name: Name of the city (e.g., "Besançon", "Arguel")
        country: ISO country code (default: "FR" for France)

    Returns:
        Tuple of (latitude, longitude) or None if not found

    Examples:
        >>> geocode_city("Besançon")
        (47.2380222, 6.0243622)

        >>> geocode_city("Arguel")
        (47.1944, 5.9896)

    Note:
        Nominatim Terms of Use: https://operations.osmfoundation.org/policies/nominatim/
        - Max 1 request per second
        - Must provide User-Agent header
        - Free for low-volume usage
    """
    global _last_request_time

    # Normalize cache key (lowercase, strip whitespace)
    cache_key = f"{city_name.lower().strip()}_{country.upper()}"

    # Check cache first
    if cache_key in _geocoding_cache:
        lat, lon, timestamp = _geocoding_cache[cache_key]

        # Check if cache is still valid
        if time.time() - timestamp < CACHE_TTL_SECONDS:
            logger.debug(f"Cache hit for {city_name}, {country}")
            return (lat, lon)
        else:
            # Cache expired, remove it
            del _geocoding_cache[cache_key]
            logger.debug(f"Cache expired for {city_name}, {country}")

    # Rate limiting: ensure 1 second between requests
    time_since_last = time.time() - _last_request_time
    if time_since_last < RATE_LIMIT_SECONDS:
        sleep_time = RATE_LIMIT_SECONDS - time_since_last
        logger.debug(f"Rate limiting: sleeping {sleep_time:.2f}s")
        time.sleep(sleep_time)

    # Make API request
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": city_name,
            "countrycodes": country.lower(),  # Use countrycodes parameter (lowercase ISO code)
            "format": "json",
            "limit": 1,
            "addressdetails": 1,
        }
        headers = {"User-Agent": "DashboardParapente/0.2.0 (paragliding weather dashboard)"}

        logger.info(f"Geocoding: {city_name}, {country}")
        response = requests.get(url, params=params, headers=headers, timeout=10)
        _last_request_time = time.time()

        response.raise_for_status()
        data = response.json()

        if not data or len(data) == 0:
            logger.warning(f"City not found: {city_name}, {country}")
            return None

        # Extract coordinates
        result = data[0]
        lat = float(result["lat"])
        lon = float(result["lon"])

        # Cache the result
        _geocoding_cache[cache_key] = (lat, lon, time.time())

        logger.info(f"✓ Geocoded {city_name} → ({lat}, {lon})")
        return (lat, lon)

    except requests.RequestException as e:
        logger.error(f"Geocoding API error for {city_name}: {e}")
        return None
    except (KeyError, ValueError, IndexError) as e:
        logger.error(f"Failed to parse geocoding response for {city_name}: {e}")
        return None


def clear_geocoding_cache():
    """
    Clear the geocoding cache.
    Useful for testing or if you want to force fresh lookups.
    """
    global _geocoding_cache
    _geocoding_cache = {}
    logger.info("Geocoding cache cleared")


def get_cache_stats() -> dict:
    """
    Get statistics about the geocoding cache.

    Returns:
        Dictionary with cache size and entries
    """
    return {"size": len(_geocoding_cache), "entries": list(_geocoding_cache.keys())}
