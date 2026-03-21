"""
Search engine for paragliding spots

Provides geographic search functionality by city name or coordinates.
"""

import logging

from sqlalchemy.orm import Session

from models import ParaglidingSpot

from .distance import calculate_bounding_box, haversine_distance
from .geocoding import geocode_city

logger = logging.getLogger(__name__)


def search_by_coordinates(
    db: Session, lat: float, lon: float, radius_km: int = 50, spot_type: str | None = None
) -> dict:
    """
    Search for paragliding spots near given GPS coordinates.

    Uses a two-step approach for performance:
    1. Filter by bounding box (fast SQL query)
    2. Calculate precise haversine distances

    Args:
        db: Database session
        lat: Center latitude
        lon: Center longitude
        radius_km: Search radius in kilometers (default: 50)
        spot_type: Filter by type ("takeoff", "landing", or None for both)

    Returns:
        Dictionary with query info and results:
        {
            "query": {"lat": ..., "lon": ..., "radius_km": ...},
            "total": 19,
            "spots": [...]
        }
    """
    logger.info(f"Searching spots at ({lat}, {lon}) within {radius_km}km, type={spot_type}")

    # Step 1: Calculate bounding box for initial filter
    min_lat, max_lat, min_lon, max_lon = calculate_bounding_box(lat, lon, radius_km)

    # Step 2: Query database with bounding box filter
    query = db.query(ParaglidingSpot).filter(
        ParaglidingSpot.latitude >= min_lat,
        ParaglidingSpot.latitude <= max_lat,
        ParaglidingSpot.longitude >= min_lon,
        ParaglidingSpot.longitude <= max_lon,
    )

    # Apply type filter if specified
    if spot_type:
        query = query.filter(ParaglidingSpot.type == spot_type)

    candidates = query.all()

    logger.debug(f"Bounding box returned {len(candidates)} candidates")

    # Step 3: Calculate precise distances and filter by radius
    results = []
    for spot in candidates:
        distance = haversine_distance(lat, lon, spot.latitude, spot.longitude)

        if distance <= radius_km:
            spot_dict = {
                "id": spot.id,
                "name": spot.name,
                "type": spot.type,
                "latitude": spot.latitude,
                "longitude": spot.longitude,
                "elevation_m": spot.elevation_m,
                "orientation": spot.orientation,
                "rating": spot.rating,
                "country": spot.country,
                "source": spot.source,
                "distance_km": distance,
            }
            results.append(spot_dict)

    # Step 4: Sort by distance (closest first)
    results.sort(key=lambda x: x["distance_km"])

    logger.info(f"✓ Found {len(results)} spots within {radius_km}km")

    return {
        "query": {"latitude": lat, "longitude": lon, "radius_km": radius_km, "type": spot_type},
        "total": len(results),
        "spots": results,
    }


def search_by_city(
    db: Session,
    city_name: str,
    radius_km: int = 50,
    spot_type: str | None = None,
    country: str = "FR",
) -> dict:
    """
    Search for paragliding spots near a city.

    First geocodes the city name to coordinates, then performs coordinate search.

    Args:
        db: Database session
        city_name: Name of the city (e.g., "Besançon", "Arguel")
        radius_km: Search radius in kilometers (default: 50)
        spot_type: Filter by type ("takeoff", "landing", or None)
        country: ISO country code (default: "FR")

    Returns:
        Dictionary with query info and results (same as search_by_coordinates)
        Returns error dict if city not found
    """
    logger.info(f"Searching spots near {city_name}, {country}")

    # Geocode city
    coords = geocode_city(city_name, country)

    if not coords:
        logger.warning(f"City not found: {city_name}, {country}")
        return {
            "query": {
                "city": city_name,
                "country": country,
                "radius_km": radius_km,
                "type": spot_type,
            },
            "error": f"City '{city_name}' not found",
            "total": 0,
            "spots": [],
        }

    lat, lon = coords
    logger.info(f"✓ Geocoded {city_name} → ({lat}, {lon})")

    # Perform coordinate search
    result = search_by_coordinates(db, lat, lon, radius_km, spot_type)

    # Add city name to query metadata
    result["query"]["city"] = city_name
    result["query"]["country"] = country

    return result


def get_spot_by_id(db: Session, spot_id: str) -> dict | None:
    """
    Get full details for a specific spot.

    Args:
        db: Database session
        spot_id: Spot ID (e.g., "openaip_6293a4af...", "pgs_12345", "merged_...")

    Returns:
        Dictionary with full spot details or None if not found
    """
    logger.info(f"Fetching spot: {spot_id}")

    spot = db.query(ParaglidingSpot).filter(ParaglidingSpot.id == spot_id).first()

    if not spot:
        logger.warning(f"Spot not found: {spot_id}")
        return None

    return {
        "id": spot.id,
        "name": spot.name,
        "type": spot.type,
        "latitude": spot.latitude,
        "longitude": spot.longitude,
        "elevation_m": spot.elevation_m,
        "orientation": spot.orientation,
        "rating": spot.rating,
        "country": spot.country,
        "source": spot.source,
        "openaip_id": spot.openaip_id,
        "paraglidingspots_id": spot.paraglidingspots_id,
        "raw_metadata": spot.raw_metadata,
        "last_synced": spot.last_synced.isoformat() if spot.last_synced else None,
        "created_at": spot.created_at.isoformat() if spot.created_at else None,
        "updated_at": spot.updated_at.isoformat() if spot.updated_at else None,
    }


def get_sync_status(db: Session) -> dict:
    """
    Get statistics about the spots database.

    Returns:
        Dictionary with stats and last sync time
    """
    from sqlalchemy import func

    total = db.query(func.count(ParaglidingSpot.id)).scalar()

    # Count by source
    openaip_count = (
        db.query(func.count(ParaglidingSpot.id))
        .filter(ParaglidingSpot.source == "openaip")
        .scalar()
    )

    pgs_count = (
        db.query(func.count(ParaglidingSpot.id))
        .filter(ParaglidingSpot.source == "paraglidingspots")
        .scalar()
    )

    merged_count = (
        db.query(func.count(ParaglidingSpot.id)).filter(ParaglidingSpot.source == "merged").scalar()
    )

    # Count by type
    takeoff_count = (
        db.query(func.count(ParaglidingSpot.id)).filter(ParaglidingSpot.type == "takeoff").scalar()
    )

    landing_count = (
        db.query(func.count(ParaglidingSpot.id)).filter(ParaglidingSpot.type == "landing").scalar()
    )

    # Get last sync time
    last_synced_spot = (
        db.query(ParaglidingSpot).order_by(ParaglidingSpot.last_synced.desc()).first()
    )

    last_sync_time = None
    if last_synced_spot and last_synced_spot.last_synced:
        last_sync_time = last_synced_spot.last_synced.isoformat()

    return {
        "total_spots": total,
        "by_source": {
            "openaip": openaip_count,
            "paraglidingspots": pgs_count,
            "merged": merged_count,
        },
        "by_type": {"takeoff": takeoff_count, "landing": landing_count},
        "last_sync": last_sync_time,
        "database_ready": total > 0,
    }
