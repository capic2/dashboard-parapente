import asyncio
import logging
import math
import os
import uuid
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import redis
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import (
    EmagramAnalysis,
    Flight,
    Site,
    SiteLandingAssociation,
    WeatherForecast,
    WeatherSourceConfig,
)
from para_index import analyze_hourly_slots, calculate_para_index, format_slots_summary
from schemas import EmagramAnalysis as EmagramAnalysisSchema
from schemas import (
    EmagramAnalysisListItem,
    EmagramTriggerRequest,
    FlightUpdate,
)
from schemas import Site as SiteSchema
from schemas import (
    LandingAssociation as LandingAssociationSchema,
    LandingAssociationCreate,
    LandingAssociationUpdate,
    SiteCreate,
    SiteUpdate,
    SpotsResponse,
)
from schemas import WeatherSourceConfig as WeatherSourceConfigSchema
from schemas import (
    WeatherSourceConfigCreate,
    WeatherSourceConfigUpdate,
    WeatherSourceStats,
    WeatherSourceTestResult,
)
from video_export import get_export_status as get_export_status_stream
from video_export import list_exports as list_exports_stream
from video_export import start_video_export_background
from video_export_manual import cancel_video_export as cancel_video_export_manual
from video_export_manual import get_export_status as get_export_status_manual
from video_export_manual import list_exports as list_exports_manual
from video_export_manual import start_video_export_manual
from weather_pipeline import get_daily_aggregate, get_normalized_forecast

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["api"])

# ============================================================================
# PARAGLIDING SPOTS SEARCH ENDPOINTS (External database)
# ============================================================================


@router.post("/spots/sync")
async def sync_paragliding_spots(force: bool = False, db: Session = Depends(get_db)):
    """
    Sync paragliding spots from OpenAIP and ParaglidingSpots.com

    Args:
        force: If true, sync even if data is recent (default: false)

    Returns:
        Sync statistics and status

    Example:
        POST /api/spots/sync
        POST /api/spots/sync?force=true
    """
    from datetime import datetime

    from spots import get_sync_status, sync_to_database

    # Check if sync is needed
    status = get_sync_status(db)

    if not force and status.get("last_sync"):
        # Parse last sync time
        try:
            last_sync = datetime.fromisoformat(status["last_sync"])
            days_since_sync = (datetime.utcnow() - last_sync).days

            if days_since_sync < 7:
                return {
                    "success": True,
                    "message": f"Data is recent (synced {days_since_sync} days ago). Use force=true to sync anyway.",
                    "stats": status,
                    "timestamp": datetime.utcnow().isoformat(),
                    "synced": False,
                }
        except (ValueError, TypeError):
            pass

    # Perform sync
    logger.info("Starting paragliding spots sync...")
    stats = sync_to_database(db)

    if "error" in stats:
        raise HTTPException(status_code=500, detail=f"Sync failed: {stats['error']}")

    return {
        "success": True,
        "message": f"Synced {stats['total']} spots ({stats['added']} new, {stats['updated']} updated)",
        "stats": stats,
        "timestamp": datetime.utcnow().isoformat(),
        "synced": True,
    }


@router.get("/spots/geocode")
async def geocode_location(query: str, country: str = "FR"):
    """
    Geocode a location name to coordinates

    Uses Nominatim (OpenStreetMap) API with rate limiting and caching

    Args:
        query: Location name (city, village, address)
        country: ISO country code (default: FR)

    Returns:
        {
            "name": str,
            "latitude": float,
            "longitude": float,
            "display_name": str  # Full address from Nominatim
        }

    Raises:
        404: Location not found
        500: Geocoding API error
    """
    import requests

    from spots.geocoding import geocode_city

    # Use existing geocode_city function
    result = geocode_city(query, country)

    if not result:
        raise HTTPException(status_code=404, detail=f"Location '{query}' not found")

    lat, lon = result

    # Get full address details from Nominatim for display
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {"lat": lat, "lon": lon, "format": "json"}
        headers = {"User-Agent": "DashboardParapente/0.2.0"}
        response = requests.get(url, params=params, headers=headers, timeout=5)
        data = response.json()
        display_name = data.get("display_name", query)
    except Exception:
        display_name = query

    return {"name": query, "latitude": lat, "longitude": lon, "display_name": display_name}


@router.get("/spots/search")
async def search_paragliding_spots(
    city: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius_km: int = 50,
    type: str | None = None,
    db: Session = Depends(get_db),
):
    """
    Search for paragliding spots by city or coordinates.

    Must provide either 'city' OR both 'lat' and 'lon'.

    Args:
        city: City name (e.g., "Besançon")
        lat: Latitude (decimal degrees)
        lon: Longitude (decimal degrees)
        radius_km: Search radius in kilometers (default: 50)
        type: Filter by spot type: "takeoff", "landing", or omit for both

    Returns:
        List of spots with distances, sorted by proximity

    Examples:
        GET /api/spots/search?city=Besançon&radius_km=50
        GET /api/spots/search?lat=47.24&lon=6.02&radius_km=30&type=takeoff
    """
    from spots import search_by_city, search_by_coordinates

    # Validate parameters
    if city and (lat is not None or lon is not None):
        raise HTTPException(
            status_code=400, detail="Provide either 'city' OR ('lat' AND 'lon'), not both"
        )

    if not city and (lat is None or lon is None):
        raise HTTPException(
            status_code=400, detail="Must provide either 'city' OR both 'lat' and 'lon'"
        )

    # Validate type if provided
    if type and type not in ["takeoff", "landing"]:
        raise HTTPException(status_code=400, detail="Type must be 'takeoff' or 'landing'")

    # Perform search
    if city:
        result = search_by_city(db, city, radius_km, type)
    else:
        result = search_by_coordinates(db, lat, lon, radius_km, type)

    # Check for geocoding error
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@router.get("/spots/status")
async def get_spots_sync_status(db: Session = Depends(get_db)):
    """
    Get paragliding spots database status and statistics.

    Returns:
        Statistics about synced spots and last sync time

    Example:
        GET /api/spots/status
    """
    from spots import get_sync_status

    return get_sync_status(db)


@router.get("/spots/search-with-weather")
async def search_spots_with_weather(
    city: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius_km: int = 50,
    type: str | None = None,
    limit: int = 5,
    db: Session = Depends(get_db),
):
    """
    Search for paragliding spots AND get weather for each result.

    This is the ULTIMATE endpoint: find spots near you and immediately see
    which ones have good conditions!

    Args:
        city: City name (e.g., "Besançon")
        lat: Latitude (decimal degrees)
        lon: Longitude (decimal degrees)
        radius_km: Search radius in kilometers (default: 50)
        type: Filter by spot type: "takeoff", "landing", or omit for both
        limit: Max number of spots to return with weather (default: 5, max: 10)

    Returns:
        List of spots with their weather forecasts and para-index

    Example:
        GET /api/spots/search-with-weather?city=Besançon&limit=3
        GET /api/spots/search-with-weather?lat=47.24&lon=6.02&radius_km=30&type=takeoff
    """
    from spots import search_by_city, search_by_coordinates

    # Validate limit
    if limit > 10:
        limit = 10
    elif limit < 1:
        limit = 1

    # Validate parameters (same as regular search)
    if city and (lat is not None or lon is not None):
        raise HTTPException(
            status_code=400, detail="Provide either 'city' OR ('lat' AND 'lon'), not both"
        )

    if not city and (lat is None or lon is None):
        raise HTTPException(
            status_code=400, detail="Must provide either 'city' OR both 'lat' and 'lon'"
        )

    if type and type not in ["takeoff", "landing"]:
        raise HTTPException(status_code=400, detail="Type must be 'takeoff' or 'landing'")

    # Perform search
    if city:
        search_result = search_by_city(db, city, radius_km, type)
    else:
        search_result = search_by_coordinates(db, lat, lon, radius_km, type)

    # Check for geocoding error
    if "error" in search_result:
        raise HTTPException(status_code=404, detail=search_result["error"])

    # Get top N spots
    spots = search_result["spots"][:limit]

    # Fetch weather for each spot in parallel
    weather_tasks = []
    for spot in spots:
        weather_tasks.append(
            get_normalized_forecast(
                spot["latitude"],
                spot["longitude"],
                0,  # Today
                site_name=spot["name"],
                elevation_m=spot.get("elevation_m"),
            )
        )

    weather_results = await asyncio.gather(*weather_tasks)

    # Combine spots with weather
    spots_with_weather = []
    for i, spot in enumerate(spots):
        weather_data = weather_results[i]

        if weather_data.get("success"):
            consensus = weather_data.get("consensus", [])
            para_result = calculate_para_index(consensus)
            slots = analyze_hourly_slots(consensus)

            spot_with_weather = {
                **spot,  # All spot data (name, type, coords, etc.)
                "weather": {
                    "para_index": para_result.get("para_index"),
                    "verdict": para_result.get("verdict"),
                    "reasons": para_result.get("reasons"),
                    "flyable_slots": slots,
                    "sunrise": weather_data.get("sunrise"),
                    "sunset": weather_data.get("sunset"),
                    "total_sources": weather_data.get("total_sources", 0),
                },
            }
        else:
            # Weather fetch failed, include spot without weather
            spot_with_weather = {
                **spot,
                "weather": {"error": weather_data.get("error", "Failed to fetch weather")},
            }

        spots_with_weather.append(spot_with_weather)

    return {
        "query": search_result["query"],
        "total_spots_found": search_result["total"],
        "spots_with_weather": spots_with_weather,
        "showing": len(spots_with_weather),
    }


@router.get("/spots/detail/{spot_id}")
async def get_paragliding_spot_detail(spot_id: str, db: Session = Depends(get_db)):
    """
    Get full details for a specific paragliding spot.

    Args:
        spot_id: Spot ID (e.g., "openaip_...", "pgs_...", "merged_...")

    Returns:
        Full spot details including metadata

    Example:
        GET /api/spots/detail/openaip_6293a4af1234567
    """
    from spots import get_spot_by_id

    spot = get_spot_by_id(db, spot_id)

    if not spot:
        raise HTTPException(status_code=404, detail=f"Spot not found: {spot_id}")

    return spot


@router.get("/spots/weather/{spot_id}")
async def get_spot_weather(
    spot_id: str, day_index: int = 0, days: int = 1, db: Session = Depends(get_db)
):
    """
    Get weather forecast for ANY paragliding spot (from spots database).

    This endpoint allows you to get weather for any spot found via search,
    not just your saved sites.

    Args:
        spot_id: Paragliding spot ID (e.g., "merged_884e0213d9116315")
        day_index: 0=today, 1=tomorrow (default: 0)
        days: Number of days to return (default: 1)

    Returns:
        Full weather forecast with para-index, consensus data, etc.

    Example:
        GET /api/spots/weather/merged_884e0213d9116315?days=3
    """
    from spots import get_spot_by_id

    # Get spot from paragliding_spots table
    spot = get_spot_by_id(db, spot_id)

    if not spot:
        raise HTTPException(status_code=404, detail=f"Spot not found: {spot_id}")

    # Check if we have coordinates
    if not spot.get("latitude") or not spot.get("longitude"):
        raise HTTPException(status_code=400, detail="Spot has no coordinates")

    # Fetch weather data (same as regular weather endpoint)
    tasks = []
    for d in range(days):
        tasks.append(
            get_normalized_forecast(
                spot["latitude"],
                spot["longitude"],
                day_index + d,
                site_name=spot["name"],
                elevation_m=spot.get("elevation_m"),
            )
        )

    results = await asyncio.gather(*tasks)

    # Combine all days into single response
    all_consensus = []
    total_sources = 0
    sunrise_time = None
    sunset_time = None

    for day_result in results:
        if day_result.get("success"):
            all_consensus.extend(day_result.get("consensus", []))
            total_sources = max(total_sources, day_result.get("total_sources", 0))

            if not sunrise_time and day_result.get("sunrise"):
                sunrise_time = day_result.get("sunrise")
                sunset_time = day_result.get("sunset")
        else:
            return {
                "spot_id": spot_id,
                "spot_name": spot["name"],
                "error": day_result.get("error", "Failed to fetch weather data"),
                "day_index": day_index,
                "days": days,
            }

    # Calculate para_index
    para_result = calculate_para_index(all_consensus)

    # Analyze hourly slots
    slots = analyze_hourly_slots(all_consensus)
    slots_summary = format_slots_summary(slots)

    # Build sources metadata
    from scrapers.config import get_source_config

    sources_metadata = {}
    for source_name in ["open-meteo", "weatherapi", "meteo-parapente", "meteociel", "meteoblue"]:
        config = get_source_config(source_name)
        sources_metadata[source_name] = {
            "name": config.get("name", source_name),
            "temporal_resolution": config.get("temporal_resolution", "unknown"),
            "coverage": config.get("coverage", "unknown"),
            "forecast_range": config.get("forecast_range", "unknown"),
            "model": config.get("model", "unknown"),
        }

    return {
        "spot_id": spot_id,
        "spot_name": spot["name"],
        "spot_type": spot["type"],
        "spot_orientation": spot.get("orientation"),
        "spot_elevation_m": spot.get("elevation_m"),
        "spot_rating": spot.get("rating"),
        "coordinates": {"latitude": spot["latitude"], "longitude": spot["longitude"]},
        "day_index": day_index,
        "days": days,
        "consensus": all_consensus,
        "para_index": para_result.get("para_index"),
        "verdict": para_result.get("verdict"),
        "reasons": para_result.get("reasons"),
        "flyable_slots": slots,
        "slots_summary": slots_summary,
        "total_sources": total_sources,
        "sunrise": sunrise_time,
        "sunset": sunset_time,
        "sources_metadata": sources_metadata,
    }


# ============================================================================
# USER SITES ENDPOINTS (Original - for user-managed custom spots)
# ============================================================================


@router.get("/spots", response_model=SpotsResponse)
def get_spots(db: Session = Depends(get_db)):
    """Get all user-managed paragliding spots with flight counts"""
    from sqlalchemy import func

    from models import Flight

    # Query sites with flight count
    sites_with_counts = (
        db.query(Site, func.count(Flight.id).label("flight_count"))
        .outerjoin(Flight, Site.id == Flight.site_id)
        .group_by(Site.id)
        .all()
    )

    # Add flight_count to each site object
    sites = []
    for site, flight_count in sites_with_counts:
        site.flight_count = flight_count
        sites.append(site)

    return SpotsResponse(sites=sites)


@router.post("/spots")
async def create_site(site_data: SiteCreate, db: Session = Depends(get_db)):
    """
    Create a new custom site

    Args:
        site_data: Site information (name, latitude, longitude required)

    Returns:
        Created site object

    Raises:
        409: Site with same name already exists (returns existing site)
        422: Validation error (missing required fields)
    """
    # Check if site with same name already exists
    existing_site = db.query(Site).filter(func.lower(Site.name) == site_data.name.lower()).first()

    if existing_site:
        logger.info(f"Site '{site_data.name}' already exists, returning existing site")
        # Return existing site instead of creating duplicate
        return existing_site

    # Generate unique code from name
    code_base = (
        site_data.name.lower()
        .replace(" ", "-")
        .replace("'", "")
        .replace("è", "e")
        .replace("é", "e")
        .replace("à", "a")
    )
    code = code_base[:20]  # Limit to 20 chars

    # Ensure code is unique
    counter = 1
    original_code = code
    while db.query(Site).filter(Site.code == code).first():
        code = f"{original_code}-{counter}"
        counter += 1

    # Create new site
    new_site = Site(
        id=str(uuid.uuid4()),
        code=code,
        name=site_data.name,
        latitude=site_data.latitude,
        longitude=site_data.longitude,
        elevation_m=site_data.elevation_m,
        region=site_data.region,
        country=site_data.country or "FR",
        site_type="user_spot",  # Mark as user-created
    )

    try:
        db.add(new_site)
        db.commit()
        db.refresh(new_site)
        logger.info(f" Created new site: {new_site.name} (ID: {new_site.id})")
        return new_site
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create site: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Site creation failed: {str(e)}") from e


@router.patch("/sites/{site_id}/orientation")
def update_site_orientation(site_id: str, orientation: str, db: Session = Depends(get_db)):
    """
    Update site orientation (direction the pilot faces at takeoff)

    Args:
        site_id: Site ID
        orientation: Compass direction (N, NE, E, SE, S, SW, W, NW, or intermediate)

    Returns:
        Updated site information

    Valid orientations:
        N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW
    """
    VALID_ORIENTATIONS = [
        "N",
        "NNE",
        "NE",
        "ENE",
        "E",
        "ESE",
        "SE",
        "SSE",
        "S",
        "SSW",
        "SW",
        "WSW",
        "W",
        "WNW",
        "NW",
        "NNW",
    ]

    orientation_upper = orientation.upper().strip()

    if orientation_upper not in VALID_ORIENTATIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid orientation '{orientation}'. Must be one of: {', '.join(VALID_ORIENTATIONS)}",
        )

    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    old_orientation = site.orientation
    site.orientation = orientation_upper
    site.updated_at = datetime.utcnow()

    try:
        db.commit()
        db.refresh(site)
        logger.info(
            f" Updated orientation for site '{site.name}': {old_orientation} → {orientation_upper}"
        )

        return {
            "success": True,
            "site_id": site.id,
            "name": site.name,
            "orientation": site.orientation,
            "message": f"Orientation updated to {orientation_upper}",
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update site orientation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}") from e


@router.patch("/sites/{site_id}/camera")
def update_site_camera(
    site_id: str,
    angle: int | None = None,
    distance: int | None = None,
    db: Session = Depends(get_db),
):
    """
    Update site camera position settings for 3D visualization

    Args:
        site_id: Site ID
        angle: Camera angle in degrees (0-360) - where to position camera relative to takeoff
        distance: Camera distance from takeoff in meters (default: 500)

    Returns:
        Updated site camera settings

    Examples:
        - angle=0: Camera at North, looking South
        - angle=90: Camera at East, looking West
        - angle=180: Camera at South, looking North
    """
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    # Validate and update angle if provided
    if angle is not None:
        if angle < 0 or angle > 360:
            raise HTTPException(status_code=400, detail="Angle must be between 0 and 360 degrees")
        site.camera_angle = angle

    # Validate and update distance if provided
    if distance is not None:
        if distance < 50 or distance > 5000:
            raise HTTPException(
                status_code=400, detail="Distance must be between 50 and 5000 meters"
            )
        site.camera_distance = distance

    site.updated_at = datetime.utcnow()

    try:
        db.commit()
        db.refresh(site)
        logger.info(
            f" Updated camera settings for site '{site.name}': angle={site.camera_angle}°, distance={site.camera_distance}m"
        )

        return {
            "success": True,
            "site_id": site.id,
            "name": site.name,
            "camera_angle": site.camera_angle,
            "camera_distance": site.camera_distance,
            "message": "Camera settings updated successfully",
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update site camera settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}") from e


@router.patch("/sites/{site_id}")
def update_site(site_id: str, site_data: SiteUpdate, db: Session = Depends(get_db)):
    """
    Update site details

    Args:
        site_id: Site ID to update
        site_data: Site fields to update (all optional)

    Returns:
        Updated site object

    Raises:
        404: Site not found
        400: Validation error (e.g., duplicate code)
    """
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    update_data = site_data.dict(exclude_unset=True)

    # If code is being changed, check uniqueness
    if "code" in update_data and update_data["code"] != site.code:
        existing = db.query(Site).filter(Site.code == update_data["code"]).first()
        if existing:
            raise HTTPException(
                status_code=400, detail=f"Site with code '{update_data['code']}' already exists"
            )

    # Apply updates
    for field, value in update_data.items():
        setattr(site, field, value)

    site.updated_at = datetime.utcnow()

    try:
        db.commit()
        db.refresh(site)
        logger.info(f"Updated site '{site.name}' (ID: {site_id}): {list(update_data.keys())}")
        return site
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update site {site_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}") from e


@router.delete("/sites/{site_id}")
def delete_site(site_id: str, db: Session = Depends(get_db)):
    """
    Delete a site

    Args:
        site_id: Site ID to delete

    Returns:
        Success message

    Raises:
        404: Site not found
        400: Site has associated flights (cannot delete)
    """
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    # Check for associated flights
    flight_count = db.query(Flight).filter(Flight.site_id == site_id).count()

    if flight_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete site '{site.name}': {flight_count} flight(s) are linked to this site. "
            f"Please reassign or unlink these flights before deleting the site.",
        )

    try:
        site_name = site.name
        db.delete(site)
        db.commit()
        logger.info(f"Deleted site '{site_name}' (ID: {site_id})")

        return {
            "success": True,
            "message": f"Site '{site_name}' deleted successfully",
            "site_id": site_id,
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete site {site_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Deletion failed: {str(e)}") from e


# ============================================================================
# LANDING ASSOCIATIONS ENDPOINTS
# ============================================================================


@router.get("/sites/{site_id}/landings")
def get_landing_associations(site_id: str, db: Session = Depends(get_db)):
    """List all landing sites associated with a takeoff site"""
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    associations = (
        db.query(SiteLandingAssociation)
        .filter(SiteLandingAssociation.takeoff_site_id == site_id)
        .all()
    )

    result = []
    for assoc in associations:
        landing_site = db.query(Site).filter(Site.id == assoc.landing_site_id).first()
        assoc_data = LandingAssociationSchema.model_validate(assoc)
        if landing_site:
            assoc_data.landing_site = SiteSchema.model_validate(landing_site)
        result.append(assoc_data)

    return result


@router.post("/sites/{site_id}/landings", status_code=201)
def create_landing_association(
    site_id: str, data: LandingAssociationCreate, db: Session = Depends(get_db)
):
    """Associate a landing site with a takeoff site"""
    from spots.distance import haversine_distance

    from sqlalchemy.exc import IntegrityError

    takeoff = db.query(Site).filter(Site.id == site_id).first()
    if not takeoff:
        raise HTTPException(status_code=404, detail="Takeoff site not found")

    if data.landing_site_id == site_id:
        raise HTTPException(status_code=400, detail="A site cannot be its own landing")

    landing = db.query(Site).filter(Site.id == data.landing_site_id).first()
    if not landing:
        raise HTTPException(status_code=404, detail="Landing site not found")

    if None in (takeoff.latitude, takeoff.longitude, landing.latitude, landing.longitude):
        raise HTTPException(
            status_code=400,
            detail="Both takeoff and landing sites must have coordinates",
        )

    existing = (
        db.query(SiteLandingAssociation)
        .filter(
            SiteLandingAssociation.takeoff_site_id == site_id,
            SiteLandingAssociation.landing_site_id == data.landing_site_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="This landing association already exists")

    distance = haversine_distance(
        takeoff.latitude, takeoff.longitude, landing.latitude, landing.longitude
    )

    if data.is_primary:
        db.query(SiteLandingAssociation).filter(
            SiteLandingAssociation.takeoff_site_id == site_id,
            SiteLandingAssociation.is_primary.is_(True),
        ).update({"is_primary": False})

    assoc = SiteLandingAssociation(
        id=str(uuid.uuid4()),
        takeoff_site_id=site_id,
        landing_site_id=data.landing_site_id,
        is_primary=data.is_primary,
        distance_km=distance,
        notes=data.notes,
    )
    db.add(assoc)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="This landing association already exists"
        ) from None
    db.refresh(assoc)

    logger.info(f"Created landing association: {takeoff.name} -> {landing.name} ({distance} km)")

    result = LandingAssociationSchema.model_validate(assoc)
    result.landing_site = SiteSchema.model_validate(landing)
    return result


@router.patch("/sites/{site_id}/landings/{assoc_id}")
def update_landing_association(
    site_id: str,
    assoc_id: str,
    data: LandingAssociationUpdate,
    db: Session = Depends(get_db),
):
    """Update a landing association (is_primary, notes)"""
    assoc = (
        db.query(SiteLandingAssociation)
        .filter(
            SiteLandingAssociation.id == assoc_id,
            SiteLandingAssociation.takeoff_site_id == site_id,
        )
        .first()
    )
    if not assoc:
        raise HTTPException(status_code=404, detail="Landing association not found")

    if data.is_primary is True:
        db.query(SiteLandingAssociation).filter(
            SiteLandingAssociation.takeoff_site_id == site_id,
            SiteLandingAssociation.is_primary.is_(True),
            SiteLandingAssociation.id != assoc_id,
        ).update({"is_primary": False})
        assoc.is_primary = True
    elif data.is_primary is False:
        assoc.is_primary = False

    if data.notes is not None:
        assoc.notes = data.notes

    db.commit()
    db.refresh(assoc)

    landing = db.query(Site).filter(Site.id == assoc.landing_site_id).first()
    result = LandingAssociationSchema.model_validate(assoc)
    if landing:
        result.landing_site = SiteSchema.model_validate(landing)
    return result


@router.delete("/sites/{site_id}/landings/{assoc_id}")
def delete_landing_association(site_id: str, assoc_id: str, db: Session = Depends(get_db)):
    """Remove a landing association"""
    assoc = (
        db.query(SiteLandingAssociation)
        .filter(
            SiteLandingAssociation.id == assoc_id,
            SiteLandingAssociation.takeoff_site_id == site_id,
        )
        .first()
    )
    if not assoc:
        raise HTTPException(status_code=404, detail="Landing association not found")

    db.delete(assoc)
    db.commit()
    logger.info(f"Deleted landing association {assoc_id}")
    return {"success": True, "message": "Landing association deleted"}


@router.get("/sites/{site_id}/landings/weather")
async def get_landing_associations_weather(
    site_id: str, day_index: int = 0, db: Session = Depends(get_db)
):
    """Get weather for all landing sites associated with a takeoff"""
    from para_index import calculate_hourly_para_index, get_hourly_verdict, get_thermal_strength

    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    associations = (
        db.query(SiteLandingAssociation)
        .filter(SiteLandingAssociation.takeoff_site_id == site_id)
        .limit(10)
        .all()
    )

    if not associations:
        return []

    landing_sites = {}
    for assoc in associations:
        landing = db.query(Site).filter(Site.id == assoc.landing_site_id).first()
        if landing:
            landing_sites[assoc.id] = (assoc, landing)

    tasks = []
    assoc_ids = []
    for assoc_id, (_assoc, landing) in landing_sites.items():
        tasks.append(
            get_normalized_forecast(
                landing.latitude,
                landing.longitude,
                day_index,
                site_name=landing.name,
                elevation_m=landing.elevation_m,
            )
        )
        assoc_ids.append(assoc_id)

    results = await asyncio.gather(*tasks)

    weather_data = []
    for assoc_id, day_result in zip(assoc_ids, results, strict=True):
        assoc, landing = landing_sites[assoc_id]
        entry = {
            "landing_site_id": landing.id,
            "landing_site_name": landing.name,
            "distance_km": assoc.distance_km,
            "is_primary": assoc.is_primary,
        }

        if day_result.get("success"):
            consensus = day_result.get("consensus", [])
            sunrise_time = day_result.get("sunrise")
            sunset_time = day_result.get("sunset")

            for hour in consensus:
                hour["para_index"] = calculate_hourly_para_index(hour)
                hour["verdict"] = get_hourly_verdict(hour["para_index"])
                cape = hour.get("cape")
                li = hour.get("lifted_index")
                hour["thermal_strength"] = get_thermal_strength(cape, li)

            # Filter to flyable hours (sunrise to sunset) like the main weather endpoint
            flyable_consensus = consensus
            if sunrise_time and sunset_time:
                try:
                    sunrise_hour = int(sunrise_time.split(":")[0])
                    sunset_hour = int(sunset_time.split(":")[0])
                    flyable_consensus = [
                        h for h in consensus if sunrise_hour <= h.get("hour", 0) <= sunset_hour
                    ]
                except (ValueError, IndexError):
                    pass

            para_result = calculate_para_index(flyable_consensus)
            entry["weather"] = {
                "consensus": consensus,
                "para_index": para_result["para_index"],
                "verdict": para_result["verdict"],
                "emoji": para_result["emoji"],
                "sunrise": sunrise_time,
                "sunset": sunset_time,
            }
        else:
            entry["weather"] = {"error": day_result.get("error", "Failed to fetch weather")}

        weather_data.append(entry)

    return weather_data


# ============================================================================
# BEST SPOT RECOMMENDATION ENDPOINT
# ============================================================================
# IMPORTANT: This must be BEFORE /spots/{spot_id} to avoid route collision


@router.get("/spots/best")
async def get_best_spot(
    day_index: int = Query(
        default=0, ge=0, le=6, description="Day index (0=today, 1=tomorrow, ..., 6=in 6 days)"
    ),
    db: Session = Depends(get_db),
):
    """
    Get the best flying spot for a specific day based on Para-Index and wind conditions

    This endpoint:
    1. Returns cached result if available (fast response)
    2. Calculates from database if cache miss
    3. Cache for day 0 (today) is automatically refreshed every hour by scheduler
    4. Other days (1-6) are calculated on-demand and cached for 60 minutes

    Args:
        day_index: Day index (0-6) where 0 is today, 1 is tomorrow, etc.

    Returns:
        Best spot with score, Para-Index, wind conditions, and reasoning

    Example response:
        {
            "site": {
                "id": "site-arguel",
                "code": "arguel",
                "name": "Arguel",
                "latitude": 47.2369,
                "longitude": 6.0636,
                "orientation": "W",
                "rating": 4
            },
            "paraIndex": 75,
            "windDirection": "W",
            "windSpeed": 15.0,
            "windFavorability": "good",
            "score": 75.0,
            "reason": "Excellentes conditions (Para-Index 75), vent favorable W 15km/h",
            "verdict": "BON"
        }
    """
    from best_spot import get_best_spot_cached

    try:
        best_spot = await get_best_spot_cached(db, day_index)

        if not best_spot:
            raise HTTPException(
                status_code=404,
                detail=f"No forecast data available for day {day_index}. The scheduler may not have run yet or weather data is unavailable.",
            )

        return best_spot

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting best spot: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to calculate best spot: {str(e)}"
        ) from e


@router.get("/spots/{spot_id}", response_model=SiteSchema)
def get_spot(spot_id: str, db: Session = Depends(get_db)):
    """Get a specific user-managed spot"""
    site = db.query(Site).filter(Site.id == spot_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Spot not found")
    return site


# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================


@router.post("/admin/seed-sites")
async def seed_sites_endpoint(db: Session = Depends(get_db)):
    """
    Admin endpoint: Seed database with default sites

    Creates or updates the 6 default flying sites:
    - Arguel
    - Mont Poupet Nord, Nord-Ouest, Ouest, Sud
    - La Côte

    Returns:
        Success status and list of created sites
    """
    from datetime import datetime

    try:
        # Define the 6 sites with precise coordinates
        sites_data = [
            {
                "id": "site-arguel",
                "code": "arguel",
                "name": "Arguel",
                "latitude": 47.1944,
                "longitude": 5.9896,
                "elevation_m": 462,
                "region": "Besançon",
                "country": "FR",
                "rating": 3,
                "orientation": "NNW",
                "linked_spot_id": "merged_884e0213d9116315",
            },
            {
                "id": "site-mont-poupet-nord",
                "code": "mont-poupet-nord",
                "name": "Mont Poupet Nord",
                "latitude": 46.9716,
                "longitude": 5.8776,
                "elevation_m": 795,
                "region": "Besançon",
                "country": "FR",
                "rating": 4,
                "orientation": "N",
                "linked_spot_id": "merged_d370be468747c90a",
            },
            {
                "id": "site-mont-poupet-nw",
                "code": "mont-poupet-nw",
                "name": "Mont Poupet Nord-Ouest",
                "latitude": 46.9701,
                "longitude": 5.8742,
                "elevation_m": 795,
                "region": "Besançon",
                "country": "FR",
                "rating": 3,
                "orientation": "NW",
                "linked_spot_id": "merged_c30c861b49a65324",
            },
            {
                "id": "site-mont-poupet-ouest",
                "code": "mont-poupet-ouest",
                "name": "Mont Poupet Ouest",
                "latitude": 46.9693,
                "longitude": 5.8747,
                "elevation_m": 795,
                "region": "Besançon",
                "country": "FR",
                "rating": 4,
                "orientation": "W",
                "linked_spot_id": "merged_359e1153c44c269e",
            },
            {
                "id": "site-mont-poupet-sud",
                "code": "mont-poupet-sud",
                "name": "Mont Poupet Sud",
                "latitude": 46.9691,
                "longitude": 5.8762,
                "elevation_m": 795,
                "region": "Besançon",
                "country": "FR",
                "rating": 1,
                "orientation": "S",
                "linked_spot_id": "merged_60fbcc6724417e87",
            },
            {
                "id": "site-la-cote",
                "code": "la-cote",
                "name": "La Côte",
                "latitude": 46.9424,
                "longitude": 5.8438,
                "elevation_m": 800,
                "region": "Besançon",
                "country": "FR",
                "rating": 2,
                "orientation": "N",
                "linked_spot_id": "merged_d3836f8db6c839fa",
            },
        ]

        created_sites = []
        now = datetime.utcnow()

        for site_data in sites_data:
            # Check if site exists
            existing = db.query(Site).filter(Site.id == site_data["id"]).first()

            if existing:
                # Update existing site
                for key, value in site_data.items():
                    if key != "id":
                        setattr(existing, key, value)
                existing.updated_at = now
                logger.info(f"Updated site: {site_data['name']}")
            else:
                # Create new site
                site = Site(**site_data, created_at=now, updated_at=now)
                db.add(site)
                logger.info(f"Created site: {site_data['name']}")

            created_sites.append(site_data["name"])

        db.commit()

        # Return count
        total_sites = db.query(Site).count()

        return {
            "success": True,
            "message": f"Successfully seeded {len(created_sites)} sites",
            "sites": created_sites,
            "total_sites_in_db": total_sites,
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding sites: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to seed sites: {str(e)}") from e


@router.post("/admin/refresh-weather")
async def refresh_weather_cache():
    """
    Admin endpoint: Manually trigger weather data fetch for all sites

    This is useful when:
    - Application just started and cache is empty
    - Scheduler failed due to connection issues
    - Need immediate fresh data

    Returns:
        Status of the weather fetch operation

    Example:
        POST /api/admin/refresh-weather
    """
    from scheduler import scheduled_weather_fetch

    try:
        logger.info("🔄 Manual weather refresh triggered...")
        await scheduled_weather_fetch()

        return {
            "success": True,
            "message": "Weather data refresh completed successfully",
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error during manual weather refresh: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Weather refresh failed: {str(e)}") from e


@router.post("/admin/clear-cache")
async def clear_redis_cache():
    """
    Admin endpoint: Clear all Redis cache

    Useful when:
    - Cache contains invalid/stale data
    - Need to force fresh fetch from all sources
    - Debugging cache issues

    Returns:
        Number of keys cleared
    """
    from cache import get_redis

    try:
        redis_client = await get_redis()

        # Get all weather-related keys
        weather_keys = await redis_client.keys("weather:*")
        best_spot_keys = await redis_client.keys("best_spot:*")
        all_keys = weather_keys + best_spot_keys

        if all_keys:
            deleted = await redis_client.delete(*all_keys)
            logger.info(f"🗑️ Cleared {deleted} cache keys")

            return {
                "success": True,
                "keys_deleted": deleted,
                "message": f"Successfully cleared {deleted} cache entries",
            }
        else:
            return {"success": True, "keys_deleted": 0, "message": "No cache entries to clear"}

    except Exception as e:
        logger.error(f"Error clearing cache: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}") from e


@router.get("/admin/debug-cache/{site_id}")
async def debug_cache_data(site_id: str, day_index: int = 0, db: Session = Depends(get_db)):
    """
    Admin endpoint: Show RAW cache data for debugging
    """
    import hashlib

    from cache import get_redis

    try:
        site = db.query(Site).filter(Site.id == site_id).first()
        if not site:
            raise HTTPException(status_code=404, detail=f"Site not found: {site_id}")

        # Calculate cache key the same way weather_pipeline does
        cache_key_base = f"{site.latitude},{site.longitude},{day_index}"
        cache_key = f"weather:forecast:{hashlib.md5(cache_key_base.encode()).hexdigest()[:8]}"

        redis_client = await get_redis()
        cached_data = await redis_client.get(cache_key)

        if cached_data:
            import json

            data = json.loads(cached_data)
            return {
                "cache_key": cache_key,
                "found": True,
                "success": data.get("success"),
                "error": data.get("error"),
                "consensus_count": len(data.get("consensus", [])),
                "sources_count": len(data.get("sources", {})),
                "sample_hour": data.get("consensus", [{}])[0] if data.get("consensus") else None,
                "raw_keys": list(data.keys()),
            }
        else:
            return {"cache_key": cache_key, "found": False}
    except Exception as e:
        logger.error(f"Error debugging cache: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/admin/test-weather/{site_id}")
async def test_weather_fetch(site_id: str, db: Session = Depends(get_db)):
    """
    Admin endpoint: Test weather fetching for a specific site with detailed diagnostics

    Returns detailed information about what's working and what's failing
    """
    from weather_pipeline import get_normalized_forecast

    try:
        # Get site info
        site = db.query(Site).filter(Site.id == site_id).first()
        if not site:
            raise HTTPException(status_code=404, detail=f"Site not found: {site_id}")

        logger.info(f"🧪 Testing weather fetch for {site.name} ({site.latitude}, {site.longitude})")

        # Try fetching day 0
        result = await get_normalized_forecast(
            lat=site.latitude,
            lon=site.longitude,
            day_index=0,
            site_name=site.name,
            elevation_m=site.elevation_m,
        )

        # Analyze the result
        diagnostics = {
            "site": {
                "id": site_id,
                "name": site.name,
                "lat": site.latitude,
                "lon": site.longitude,
                "elevation": site.elevation_m,
            },
            "fetch_result": {
                "success": result.get("success", False),
                "error": result.get("error"),
                "sources": result.get("sources", {}),
                "consensus_hours": len(result.get("consensus", [])),
                "timestamp": result.get("timestamp"),
            },
            "sources_status": {},
        }

        # Check each source
        sources = result.get("sources", {})
        for source_name, source_data in sources.items():
            if isinstance(source_data, dict):
                diagnostics["sources_status"][source_name] = {
                    "success": source_data.get("success", False),
                    "error": source_data.get("error"),
                    "hourly_count": (
                        len(source_data.get("hourly", [])) if "hourly" in source_data else 0
                    ),
                }

        return diagnostics

    except Exception as e:
        logger.error(f"Error in test-weather: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/admin/sites/link-to-spots")
async def link_user_sites_to_spots(db: Session = Depends(get_db)):
    """
    Admin endpoint: Link existing user sites to external paragliding spots.

    This will:
    - Find matching paragliding spots within 500m of each user site
    - Link the site to the external spot for enhanced data
    - Update site coordinates to precise GPS coordinates
    - Update elevation from external data

    Returns:
        Statistics about linked sites

    Example:
        POST /api/admin/sites/link-to-spots
    """
    from spots.site_updater import link_sites_to_spots

    logger.info("Admin: Linking user sites to paragliding spots...")
    stats = link_sites_to_spots(db)

    if "error" in stats:
        raise HTTPException(status_code=500, detail=f"Linking failed: {stats['error']}")

    return {
        "success": True,
        "message": f"Linked {stats['linked']} of {stats['total_sites']} sites",
        "stats": stats,
    }


# ============================================================================
# Weather endpoints (UPDATED with pipeline + para_index)
# ============================================================================
@router.get("/weather/{spot_id}")
async def get_weather(
    spot_id: str, day_index: int = 0, days: int = 1, db: Session = Depends(get_db)
):
    """
    Get weather forecast for a spot (LIVE from all sources)
    Now returns normalized data + para_index + sunrise/sunset

    Args:
        spot_id: Site ID (e.g., 'site-arguel')
        day_index: 0=today, 1=tomorrow (default: 0)
        days: Number of days to return (default: 1, backward compatible)
    """
    site = db.query(Site).filter(Site.id == spot_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Spot not found")

    # Fetch N days of data in parallel
    tasks = []
    for d in range(days):
        tasks.append(
            get_normalized_forecast(
                site.latitude,
                site.longitude,
                day_index + d,
                site_name=site.name,
                elevation_m=site.elevation_m,
                db=db,
            )
        )

    results = await asyncio.gather(*tasks)

    # Combine all days into single response
    all_consensus = []
    total_sources = 0
    sunrise_time = None
    sunset_time = None

    for day_result in results:
        if day_result.get("success"):
            all_consensus.extend(day_result.get("consensus", []))
            total_sources = max(total_sources, day_result.get("total_sources", 0))

            # Extract sunrise/sunset from first day only
            if not sunrise_time and day_result.get("sunrise"):
                sunrise_time = day_result.get("sunrise")
                sunset_time = day_result.get("sunset")
        else:
            # If any day fails, return error
            return {
                "site_id": spot_id,
                "site_name": site.name,
                "error": day_result.get("error", "Failed to fetch weather data"),
                "day_index": day_index,
                "days": days,
            }

    # Enrich each hour with para_index and thermal_strength
    from para_index import calculate_hourly_para_index, get_hourly_verdict, get_thermal_strength

    for hour in all_consensus:
        # Calculate individual para-index for this hour
        hour["para_index"] = calculate_hourly_para_index(hour)
        hour["verdict"] = get_hourly_verdict(hour["para_index"])

        # Calculate thermal strength based on CAPE and Lifted Index
        cape = hour.get("cape")
        li = hour.get("lifted_index")
        hour["thermal_strength"] = get_thermal_strength(cape, li)

    # Filter to flyable hours (sunrise to sunset) before calculating para_index
    flyable_consensus = all_consensus
    if sunrise_time and sunset_time:
        try:
            sunrise_hour = int(sunrise_time.split(":")[0])
            sunset_hour = int(sunset_time.split(":")[0])
            flyable_consensus = [
                h for h in all_consensus if sunrise_hour <= h.get("hour", 0) <= sunset_hour
            ]
        except (ValueError, IndexError):
            pass  # Keep all hours if parsing fails

    # Calculate para_index (using only flyable hours)
    para_result = calculate_para_index(flyable_consensus)

    # Analyze hourly slots (also only flyable hours)
    slots = analyze_hourly_slots(flyable_consensus)
    slots_summary = format_slots_summary(slots)

    # Build sources metadata
    from scrapers.config import get_source_config

    sources_metadata = {}
    for source_name in ["open-meteo", "weatherapi", "meteo-parapente", "meteociel", "meteoblue"]:
        config = get_source_config(source_name)
        if config and config.get("status").value == "active":
            sources_metadata[source_name] = {
                "temporal_resolution": config.get("temporal_resolution", "unknown"),
                "coverage": config.get("coverage", "unknown"),
                "forecast_range": config.get("forecast_range", "unknown"),
                "model": config.get("model", "unknown"),
                "available_fields": config.get("provides", []),
            }

    return {
        "site_id": spot_id,
        "site_name": site.name,
        "day_index": day_index,
        "days": days,
        "sunrise": sunrise_time,
        "sunset": sunset_time,
        "sources_metadata": sources_metadata,  # ← New field with source metadata
        "consensus": all_consensus,
        "para_index": para_result["para_index"],
        "verdict": para_result["verdict"],
        "emoji": para_result["emoji"],
        "explanation": para_result["explanation"],
        "metrics": para_result["metrics"],
        "slots": slots,
        "slots_summary": slots_summary,
        "total_sources": total_sources,
    }


@router.get("/weather/{spot_id}/today")
async def get_weather_today(spot_id: str, db: Session = Depends(get_db)):
    """Get today's weather forecast (day_index=0)"""
    return await get_weather(spot_id, day_index=0, db=db)


@router.get("/weather/{spot_id}/summary")
async def get_weather_summary(spot_id: str, day_index: int = 0, db: Session = Depends(get_db)):
    """
    Get lightweight weather summary for a site (optimized for site selector).
    Returns only essential data: para_index, verdict, wind_avg.

    This endpoint is much faster than the full forecast endpoint as it:
    - Returns minimal data (no hourly details, no consensus breakdown)
    - Useful for site selector buttons to show quick status
    """
    # Get the site
    site = db.query(Site).filter(Site.id == spot_id).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Site not found: {spot_id}")

    # Get forecast data using same pipeline as full endpoint
    day_result = await get_normalized_forecast(
        site.latitude,
        site.longitude,
        day_index,
        site_name=site.name,
        elevation_m=site.elevation_m,
        db=db,
    )

    if not day_result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=day_result.get("error", f"No forecast data available for {site.name}"),
        )

    # Get consensus data
    consensus_data = day_result.get("consensus", [])

    # Filter to flyable hours if sunrise/sunset available
    flyable_consensus = consensus_data
    sunrise_time = day_result.get("sunrise")
    sunset_time = day_result.get("sunset")

    if sunrise_time and sunset_time:
        try:
            sunrise_hour = int(sunrise_time.split(":")[0])
            sunset_hour = int(sunset_time.split(":")[0])
            flyable_consensus = [
                h for h in consensus_data if sunrise_hour <= h.get("hour", 0) <= sunset_hour
            ]
        except (ValueError, IndexError):
            pass  # Keep all hours if parsing fails

    # Calculate para_index (using only flyable hours)
    para_result = calculate_para_index(flyable_consensus)

    # Calculate average wind speed for the day (simplified metric)
    wind_speeds = [h.get("wind_speed") for h in consensus_data if h.get("wind_speed") is not None]
    wind_avg = round(sum(wind_speeds) / len(wind_speeds), 1) if wind_speeds else 0

    # Return lightweight summary
    return {
        "site_id": spot_id,
        "site_name": site.name,
        "day_index": day_index,
        "para_index": para_result["para_index"],
        "verdict": para_result["verdict"],
        "emoji": para_result["emoji"],
        "wind_avg": wind_avg,
    }


@router.get("/weather/{spot_id}/daily-summary")
async def get_daily_summary(spot_id: str, days: int = 7, db: Session = Depends(get_db)):
    """
    Get multi-day summary WITHOUT hourly details (MUCH FASTER).

    This endpoint is optimized for displaying 7-day forecast cards:
    - Fetches all sources in parallel
    - Returns ONLY daily aggregates (para_index, verdict, temps, wind_avg)
    - Skips hourly consensus calculation → 2-3x faster than full forecast
    - Used by Forecast7Day component for quick card display

    Args:
        spot_id: Site ID (e.g., 'site-arguel')
        days: Number of days to return (default: 7)

    Returns:
        {
            "site_id": "site-arguel",
            "site_name": "Arguel",
            "days": [
                {
                    "day_index": 0,
                    "date": "2026-03-02",
                    "para_index": 75,
                    "verdict": "BON",
                    "emoji": "🟢",
                    "temp_min": 8,
                    "temp_max": 15,
                    "wind_avg": 18.5
                },
                ...
            ]
        }
    """
    try:
        # Get the site
        site = db.query(Site).filter(Site.id == spot_id).first()
        if not site:
            raise HTTPException(status_code=404, detail=f"Site not found: {spot_id}")

        # Default wind limits for paragliding (if not set on site)
        # Standard values: 10-30 km/h (2.8-8.3 m/s)
        min_wind_ms = getattr(site, "min_wind_ms", 2.8)  # 10 km/h
        max_wind_ms = getattr(site, "max_wind_ms", 8.3)  # 30 km/h
        optimal_dirs = getattr(site, "optimal_directions", "N,NE,E,SE,S,SW,W,NW")  # All directions

        # Fetch all days in parallel
        # Use ALL 5 sources (including Meteoblue) for full consistency with /weather endpoint
        # This ensures para_index on 7-day cards EXACTLY matches the hourly view
        # Note: Meteoblue adds 5-10s per day, but consistency is worth it

        tasks = []
        for day_idx in range(days):
            tasks.append(
                get_daily_aggregate(
                    site.latitude,
                    site.longitude,
                    day_idx,
                    min_wind_ms,
                    max_wind_ms,
                    optimal_dirs,
                    sources=None,  # Use all 5 sources (default: open-meteo, weatherapi, meteo-parapente, meteociel, meteoblue)
                    site_name=site.name,
                    elevation_m=site.elevation_m,
                )
            )

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Format response
        summary_days = []
        for idx, day_result in enumerate(results):
            # Skip failed days
            if isinstance(day_result, Exception):
                logger.error(f"Day {idx} failed for {spot_id}: {day_result}", exc_info=day_result)
                continue

            if day_result is None:
                logger.warning(f"Day {idx} returned None for {spot_id} (no data available)")
                continue

            if day_result:
                summary_days.append(
                    {
                        "day_index": idx,
                        "date": day_result["date"],
                        "para_index": day_result["para_index"],
                        "verdict": day_result["verdict"],
                        "emoji": day_result["emoji"],
                        "temp_min": day_result["temp_min"],
                        "temp_max": day_result["temp_max"],
                        "wind_avg": day_result["wind_avg"],
                    }
                )

        if not summary_days:
            raise HTTPException(
                status_code=500, detail=f"Failed to fetch daily summary for {site.name}"
            )

        return {"site_id": spot_id, "site_name": site.name, "days": summary_days}

    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        logger.error(f"Unexpected error in daily_summary for {spot_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") from e


# Flights endpoints
@router.get("/flights")
def get_flights(
    limit: int = 10,
    site_id: str | None = None,
    date_from: str | None = None,  # YYYY-MM-DD
    date_to: str | None = None,
    db: Session = Depends(get_db),
):
    """
    Get flights with optional filters

    Args:
        limit: Maximum number of flights to return
        site_id: Filter by site ID
        date_from: Filter flights from this date (inclusive, format: YYYY-MM-DD)
        date_to: Filter flights until this date (inclusive, format: YYYY-MM-DD)
    """
    query = db.query(Flight)

    # Apply filters
    if site_id:
        query = query.filter(Flight.site_id == site_id)
    if date_from:
        try:
            from_date = datetime.strptime(date_from, "%Y-%m-%d").date()
            query = query.filter(Flight.flight_date >= from_date)
        except ValueError as e:
            raise HTTPException(
                status_code=400, detail=f"Invalid date_from format: {date_from}. Use YYYY-MM-DD"
            ) from e
    if date_to:
        try:
            to_date = datetime.strptime(date_to, "%Y-%m-%d").date()
            query = query.filter(Flight.flight_date <= to_date)
        except ValueError as e:
            raise HTTPException(
                status_code=400, detail=f"Invalid date_to format: {date_to}. Use YYYY-MM-DD"
            ) from e

    flights = query.order_by(Flight.flight_date.desc()).limit(limit).all()

    # Convert to dict (user_id removed - not needed for single-user app)
    flights_data = []
    for flight in flights:
        flight_dict = {
            "id": flight.id,
            "strava_id": flight.strava_id,
            "site_id": flight.site_id,
            "site_name": flight.site.name if flight.site else None,
            "name": flight.name,
            "title": flight.title,
            "description": flight.description,
            "flight_date": flight.flight_date.isoformat() if flight.flight_date else None,
            "departure_time": flight.departure_time.isoformat() if flight.departure_time else None,
            "duration_minutes": flight.duration_minutes,
            "max_altitude_m": flight.max_altitude_m,
            "max_speed_kmh": flight.max_speed_kmh,
            "distance_km": flight.distance_km,
            "elevation_gain_m": flight.elevation_gain_m,
            "notes": flight.notes,
            "gpx_file_path": flight.gpx_file_path,
            "external_url": flight.external_url,
            "created_at": flight.created_at.isoformat() if flight.created_at else None,
            "updated_at": flight.updated_at.isoformat() if flight.updated_at else None,
        }
        flights_data.append(flight_dict)

    return {"flights": flights_data}


@router.get("/flights/stats")
def get_flight_stats(db: Session = Depends(get_db)):
    """Get aggregate flight statistics"""
    flights = db.query(Flight).all()

    if not flights:
        return {
            "total_flights": 0,
            "total_hours": 0,
            "total_duration_minutes": 0,
            "total_distance": 0,
            "total_distance_km": 0,
            "total_elevation_gain_m": 0,
            "avg_duration": 0,
            "avg_duration_minutes": 0,
            "avg_distance_km": 0,
            "max_altitude_m": 0,
            "favorite_spot": None,
            "favorite_site": None,
            "last_flight_date": None,
        }

    # Calculate totals
    total_flights = len(flights)
    total_minutes = sum(f.duration_minutes or 0 for f in flights)
    total_hours = round(total_minutes / 60, 1)
    total_distance = sum(f.distance_km or 0 for f in flights)
    total_elevation_gain = sum(f.elevation_gain_m or 0 for f in flights)

    # Calculate averages
    avg_duration = round(total_minutes / total_flights, 1) if total_flights > 0 else 0
    avg_distance = round(total_distance / total_flights, 1) if total_flights > 0 else 0

    # Find max altitude across all flights
    max_altitude = max((f.max_altitude_m or 0 for f in flights), default=0)

    # Find most common spot
    spot_counts = (
        db.query(Site.name, func.count(Flight.id).label("count"))
        .join(Flight)
        .group_by(Site.name)
        .order_by(func.count(Flight.id).desc())
        .first()
    )

    favorite_spot = spot_counts[0] if spot_counts else None

    # Get last flight date
    last_flight = db.query(Flight).order_by(Flight.flight_date.desc()).first()
    last_flight_date = last_flight.flight_date.isoformat() if last_flight else None

    return {
        "total_flights": total_flights,
        "total_hours": total_hours,
        "total_duration_minutes": total_minutes,
        "total_distance": round(total_distance, 1),
        "total_distance_km": round(total_distance, 1),  # Same as total_distance
        "total_elevation_gain_m": total_elevation_gain,
        "avg_duration": avg_duration,
        "avg_duration_minutes": avg_duration,  # Same as avg_duration
        "avg_distance_km": avg_distance,
        "max_altitude_m": max_altitude,
        "favorite_spot": favorite_spot,
        "favorite_site": None,  # TODO: Return full Site object if needed
        "last_flight_date": last_flight_date,
    }


@router.get("/flights/records")
def get_flight_records(db: Session = Depends(get_db)):
    """
    Get personal flight records (longest duration, highest altitude, longest distance, max speed)

    Returns:
        {
            "longest_duration": { "value": 120, "flight_id": "...", "date": "2025-11-15", "site_name": "Annecy" },
            "highest_altitude": { ... },
            "longest_distance": { ... },
            "max_speed": { ... }
        }
    """
    flights = db.query(Flight).all()

    if not flights:
        return {
            "longest_duration": None,
            "highest_altitude": None,
            "longest_distance": None,
            "max_speed": None,
        }

    # Filter out None values and find records
    flights_with_duration = [f for f in flights if f.duration_minutes is not None]
    flights_with_altitude = [f for f in flights if f.max_altitude_m is not None]
    flights_with_distance = [f for f in flights if f.distance_km is not None]
    flights_with_speed = [f for f in flights if f.max_speed_kmh is not None and f.max_speed_kmh > 0]

    # Find records
    longest = (
        max(flights_with_duration, key=lambda f: f.duration_minutes)
        if flights_with_duration
        else None
    )
    highest = (
        max(flights_with_altitude, key=lambda f: f.max_altitude_m)
        if flights_with_altitude
        else None
    )
    farthest = (
        max(flights_with_distance, key=lambda f: f.distance_km) if flights_with_distance else None
    )
    fastest = max(flights_with_speed, key=lambda f: f.max_speed_kmh) if flights_with_speed else None

    def format_record(flight, value_key):
        """Helper to format a record entry"""
        if not flight:
            return None
        return {
            "value": getattr(flight, value_key),
            "flight_id": flight.id,
            "flight_name": flight.name or flight.title,
            "date": flight.flight_date.isoformat() if flight.flight_date else None,
            "site_name": flight.site.name if flight.site else None,
            "site_id": flight.site_id,
        }

    return {
        "longest_duration": format_record(longest, "duration_minutes"),
        "highest_altitude": format_record(highest, "max_altitude_m"),
        "longest_distance": format_record(farthest, "distance_km"),
        "max_speed": format_record(fastest, "max_speed_kmh"),
    }


@router.get("/flights/{flight_id}")
def get_flight(flight_id: str, db: Session = Depends(get_db)):
    """Get a specific flight with site details including orientation"""
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    # Build response with flight data
    flight_dict = {
        "id": flight.id,
        "name": flight.name,
        "title": flight.title,
        "site_id": flight.site_id,
        "strava_id": flight.strava_id,
        "description": flight.description,
        "flight_date": flight.flight_date.isoformat() if flight.flight_date else None,
        "departure_time": flight.departure_time.isoformat() if flight.departure_time else None,
        "duration_minutes": flight.duration_minutes,
        "max_altitude_m": flight.max_altitude_m,
        "max_speed_kmh": flight.max_speed_kmh,
        "distance_km": flight.distance_km,
        "elevation_gain_m": flight.elevation_gain_m,
        "notes": flight.notes,
        "gpx_file_path": flight.gpx_file_path,
        "gpx_max_altitude_m": flight.gpx_max_altitude_m,
        "gpx_elevation_gain_m": flight.gpx_elevation_gain_m,
        "external_url": flight.external_url,
        "video_export_job_id": flight.video_export_job_id,
        "video_export_status": flight.video_export_status,
        "video_file_path": flight.video_file_path,
        "created_at": flight.created_at.isoformat() if flight.created_at else None,
        "updated_at": flight.updated_at.isoformat() if flight.updated_at else None,
    }

    # Include site details with orientation
    if flight.site_id:
        site = db.query(Site).filter(Site.id == flight.site_id).first()
        if site:
            flight_dict["site"] = {
                "id": site.id,
                "name": site.name,
                "code": site.code,
                "orientation": site.orientation,
                "camera_angle": site.camera_angle,
                "camera_distance": site.camera_distance,
                "latitude": site.latitude,
                "longitude": site.longitude,
                "elevation_m": site.elevation_m,
                "region": site.region,
                "country": site.country,
            }

    return flight_dict


@router.patch("/flights/{flight_id}")
async def update_flight(flight_id: str, flight_data: FlightUpdate, db: Session = Depends(get_db)):
    """
    Update flight details

    Args:
        flight_id: ID of the flight to update
        flight_data: Flight fields to update (all optional)

    Returns:
        Updated flight object

    Raises:
        404: Flight not found
        404: Site not found (if site_id provided and doesn't exist)
        422: Validation error
    """
    # 1. Verify flight exists
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    # 2. If site_id is being updated, verify it exists
    if flight_data.site_id is not None:
        site = db.query(Site).filter(Site.id == flight_data.site_id).first()
        if not site:
            raise HTTPException(
                status_code=404, detail=f"Site with ID '{flight_data.site_id}' not found"
            )

    # 3. Update only provided fields (exclude_unset skips None values)
    update_data = flight_data.dict(exclude_unset=True)

    for field, value in update_data.items():
        setattr(flight, field, value)

    # 4. updated_at is handled automatically by SQLAlchemy

    try:
        db.commit()
        db.refresh(flight)
        logger.info(f" Updated flight {flight_id}: {list(update_data.keys())}")

        # Return in the format expected by frontend (ApiResponseSchema)
        return {"data": flight, "status": "success", "message": "Flight updated successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update flight {flight_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}") from e


@router.get("/flights/{flight_id}/gpx-data")
def get_flight_gpx_data(flight_id: str, db: Session = Depends(get_db)):
    """
    Get parsed GPX data for a flight (coordinates + elevation profile)
    Returns JSON with coordinates array for Cesium rendering
    """
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    if not flight.gpx_file_path:
        raise HTTPException(status_code=404, detail="No GPX file available for this flight")

    gpx_path = Path(flight.gpx_file_path)
    if not gpx_path.exists():
        raise HTTPException(status_code=404, detail="GPX file not found on disk")

    # Parse GPX file
    try:
        print(f"🔍 DEBUG API - Parsing GPX for flight {flight_id}: {gpx_path}")
        coordinates = parse_gpx_file(gpx_path)
        print(f"🔍 DEBUG API - Parsed {len(coordinates)} coordinates")
        if coordinates:
            print(f"🔍 DEBUG API - First timestamp: {coordinates[0]['timestamp']}")
            print(f"🔍 DEBUG API - Last timestamp: {coordinates[-1]['timestamp']}")

        stats = calculate_gpx_stats(coordinates)

        return {
            "data": {
                "coordinates": coordinates,
                "max_altitude_m": stats["max_altitude_m"],
                "min_altitude_m": stats["min_altitude_m"],
                "elevation_gain_m": stats["elevation_gain_m"],
                "elevation_loss_m": stats["elevation_loss_m"],
                "total_distance_km": stats["total_distance_km"],
                "flight_duration_seconds": stats["flight_duration_seconds"],
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse GPX file: {str(e)}") from e


@router.get("/flights/{flight_id}/gpx-data/debug")
def get_flight_gpx_data_debug(flight_id: str, db: Session = Depends(get_db)):
    """
    DEBUG endpoint to verify GPX parsing is working correctly
    Returns first 5 coordinates with full details
    """
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    if not flight.gpx_file_path:
        raise HTTPException(status_code=404, detail="No GPX file available for this flight")

    gpx_path = Path(flight.gpx_file_path)
    if not gpx_path.exists():
        raise HTTPException(status_code=404, detail="GPX file not found on disk")

    try:
        coordinates = parse_gpx_file(gpx_path)

        return {
            "total_coordinates": len(coordinates),
            "first_5": coordinates[:5] if len(coordinates) >= 5 else coordinates,
            "all_timestamps_zero": all(c["timestamp"] == 0 for c in coordinates),
            "file_path": str(gpx_path),
            "file_exists": gpx_path.exists(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse GPX file: {str(e)}") from e


@router.get("/flights/{flight_id}/gpx")
def download_flight_gpx(flight_id: str, db: Session = Depends(get_db)):
    """Download GPX file for a flight"""
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    if not flight.gpx_file_path:
        raise HTTPException(status_code=404, detail="No GPX file available for this flight")

    gpx_path = Path(flight.gpx_file_path)
    if not gpx_path.exists():
        raise HTTPException(status_code=404, detail="GPX file not found on disk")

    filename = (
        f"{flight.title.replace(' ', '_') if flight.title else 'flight'}_{flight.flight_date}.gpx"
    )
    return FileResponse(path=gpx_path, media_type="application/gpx+xml", filename=filename)


@router.post("/flights")
def create_flight(flight_data: dict, db: Session = Depends(get_db)):
    """Create a new flight (from Strava webhook)"""
    flight = Flight(
        id=str(uuid.uuid4()),
        strava_id=flight_data.get("strava_id"),
        site_id=flight_data.get("site_id"),
        title=flight_data.get("title"),
        flight_date=flight_data.get("flight_date"),
        duration_minutes=flight_data.get("duration_minutes"),
        max_altitude_m=flight_data.get("max_altitude_m"),
        distance_km=flight_data.get("distance_km"),
    )
    db.add(flight)
    db.commit()
    db.refresh(flight)
    return flight


@router.post("/flights/sync-strava")
async def sync_strava_activities(request: dict, db: Session = Depends(get_db)):
    """
    Synchronise manuellement les vols Strava pour une période donnée

    Body:
        date_from: Date début (format: YYYY-MM-DD)
        date_to: Date fin (format: YYYY-MM-DD)

    Returns:
        {
            "success": true,
            "imported": 5,
            "skipped": 2,
            "failed": 0,
            "flights": [...]
        }
    """
    from strava import download_gpx, get_activities_by_period, save_gpx_file

    date_from = request.get("date_from")
    date_to = request.get("date_to")

    if not date_from or not date_to:
        raise HTTPException(status_code=400, detail="date_from and date_to are required")

    try:
        # 1. Récupérer activités Strava
        logger.info(f"Fetching Strava activities from {date_from} to {date_to}")
        activities = await get_activities_by_period(date_from, date_to)

        imported_flights = []
        skipped_count = 0
        failed_count = 0

        # 2. Pour chaque activité
        for activity in activities:
            strava_id = str(activity["id"])

            # 3. Vérifier si existe déjà (doublon)
            existing = db.query(Flight).filter(Flight.strava_id == strava_id).first()
            if existing:
                logger.info(f"Skipping duplicate: Strava ID {strava_id}")
                skipped_count += 1
                continue

            try:
                # 4. Télécharger GPX
                gpx_content = await download_gpx(strava_id)

                gpx_path = None
                if gpx_content:
                    # 5. Sauvegarder GPX
                    gpx_path = save_gpx_file(gpx_content, strava_id)

                    if not gpx_path:
                        logger.warning(f"Failed to save GPX for activity {strava_id}")
                else:
                    logger.warning(f"No GPX available for activity {strava_id}")

                # 6. Extraire données de l'activité Strava
                start_date_local = activity.get("start_date_local", "")

                # Date du vol (YYYY-MM-DD)
                activity_date = datetime.strptime(start_date_local.split("T")[0], "%Y-%m-%d").date()

                # Heure de départ (datetime complet)
                departure_time = None
                if start_date_local:
                    try:
                        departure_time = datetime.fromisoformat(
                            start_date_local.replace("Z", "+00:00")
                        )
                    except Exception as e:
                        logger.warning(f"Failed to parse departure_time for {strava_id}: {e}")

                # 7. Créer Flight
                flight = Flight(
                    id=str(uuid.uuid4()),
                    strava_id=strava_id,
                    title=activity.get("name", f"Vol {activity_date}"),
                    name=activity.get("name", f"Vol {activity_date}"),
                    flight_date=activity_date,
                    departure_time=departure_time,
                    duration_minutes=int(activity.get("moving_time", 0) / 60),
                    max_altitude_m=(
                        int(activity.get("elev_high", 0)) if activity.get("elev_high") else None
                    ),
                    distance_km=round(activity.get("distance", 0) / 1000, 2),
                    elevation_gain_m=(
                        int(activity.get("total_elevation_gain", 0))
                        if activity.get("total_elevation_gain")
                        else None
                    ),
                    gpx_file_path=gpx_path,
                    external_url=f"https://www.strava.com/activities/{strava_id}",
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )

                db.add(flight)
                imported_flights.append(
                    {
                        "id": flight.id,
                        "strava_id": strava_id,
                        "title": flight.title,
                        "date": str(activity_date),
                    }
                )

                logger.info(f" Imported: {flight.title} (Strava ID: {strava_id})")

            except Exception as e:
                logger.error(f"Failed to import activity {strava_id}: {e}")
                failed_count += 1

        # 8. Commit en base
        db.commit()

        return {
            "success": True,
            "imported": len(imported_flights),
            "skipped": skipped_count,
            "failed": failed_count,
            "flights": imported_flights,
        }

    except Exception as e:
        logger.error(f"Sync failed: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}") from e


@router.post("/flights/{flight_id}/upload-gpx")
async def upload_gpx_to_flight(
    flight_id: str, gpx_file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """
    Upload un fichier GPX pour un vol existant
    Sauvegarde le fichier pour visualisation Cesium (ne modifie PAS les stats)
    """
    # 1. Vérifier que le vol existe
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    try:
        # 2. Lire contenu GPX
        gpx_content = await gpx_file.read()
        gpx_str = gpx_content.decode("utf-8")

        # 3. Sauvegarder fichier
        gpx_dir = Path(__file__).parent / "db" / "gpx"
        gpx_dir.mkdir(parents=True, exist_ok=True)

        # Utiliser strava_id si disponible, sinon flight_id
        if flight.strava_id:
            file_name = f"strava_{flight.strava_id}.gpx"
        else:
            file_name = f"manual_{flight_id}.gpx"

        file_path = gpx_dir / file_name

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(gpx_str)

        # 4. Mettre à jour SEULEMENT le chemin du fichier (pas les stats!)
        flight.gpx_file_path = f"db/gpx/{file_name}"
        flight.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(flight)

        logger.info(f" Added GPX file to flight {flight_id} (stats unchanged)")

        # 5. Trigger automatic video export
        try:
            from config import settings
            from video_export_manual import trigger_auto_export

            frontend_url = f"http://localhost:{settings.PORT}"
            trigger_auto_export(flight_id, db, frontend_url)
        except Exception as e:
            logger.warning(f"Failed to trigger auto video export: {e}")

        return {
            "success": True,
            "flight_id": flight.id,
            "gpx_file_path": flight.gpx_file_path,
            "message": "GPX file added successfully. Flight stats unchanged.",
        }

    except Exception as e:
        logger.error(f"Failed to upload GPX to flight {flight_id}: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}") from e


@router.post("/flights/create-from-gpx")
async def create_flight_from_gpx(
    gpx_file: UploadFile = File(...), site_id: str | None = None, db: Session = Depends(get_db)
):
    """
    Créer un nouveau vol depuis un fichier GPX ou IGC

    Args:
        gpx_file: Fichier GPX ou IGC à uploader
        site_id: ID du site (optionnel, peut être détecté automatiquement)

    Returns:
        {
            "success": true,
            "flight_id": "...",
            "flight": {...}
        }
    """
    try:
        # 1. Lire le fichier
        file_content = await gpx_file.read()
        file_str = file_content.decode("utf-8")

        # 2. Détecter le type de fichier et parser
        filename = gpx_file.filename or ""
        file_extension = filename.lower().split(".")[-1] if "." in filename else ""

        # Détection automatique du format
        is_igc = file_extension == "igc" or file_str.strip().startswith(("A", "H"))

        if is_igc:
            print(f"🔍 DEBUG Detected IGC file: {filename}")
            coordinates = parse_igc_file_from_string(file_str)
            file_type = "igc"
        else:
            print(f"🔍 DEBUG Detected GPX file: {filename}")
            coordinates = parse_gpx_file_from_string(file_str)
            file_type = "gpx"

        if not coordinates:
            raise HTTPException(
                status_code=400, detail=f"Invalid {file_type.upper()} file: no trackpoints found"
            )

        # 3. Calculer les statistiques
        stats = calculate_gpx_stats(coordinates)

        # 4. Déterminer le site si pas fourni
        if not site_id and coordinates:
            # Essayer de matcher le site par coordonnées GPS du premier point
            sites = db.query(Site).all()
            sites_data = [
                {"id": s.id, "name": s.name, "latitude": s.latitude, "longitude": s.longitude}
                for s in sites
                if s.latitude and s.longitude
            ]

            first_coord = coordinates[0]
            from strava import match_site_by_coordinates

            site_id = match_site_by_coordinates(first_coord["lat"], first_coord["lon"], sites_data)

        # 5. Créer le vol
        flight_id = str(uuid.uuid4())

        # Extraire la date et heure depuis le GPX (premier trackpoint)
        flight_date = date.today()  # Default
        departure_time = None
        flight_name = f"Vol du {flight_date.strftime('%d/%m/%Y')}"  # Default

        if stats.get("first_trackpoint") and stats["first_trackpoint"].get("time"):
            # Le timestamp du GPX est en UTC, on le convertit en heure locale française
            departure_datetime_utc = stats["first_trackpoint"]["time"]
            if isinstance(departure_datetime_utc, datetime):
                # Convertir UTC -> Europe/Paris (UTC+1 ou UTC+2 selon DST)
                paris_tz = ZoneInfo("Europe/Paris")
                if departure_datetime_utc.tzinfo is None:
                    # Si le datetime est naive (sans timezone), on suppose UTC
                    departure_datetime_utc = departure_datetime_utc.replace(tzinfo=ZoneInfo("UTC"))

                departure_time = departure_datetime_utc.astimezone(paris_tz)
                flight_date = departure_time.date()

                # Nom du vol avec date ET heure
                flight_name = f"Vol du {flight_date.strftime('%d/%m/%Y')} à {departure_time.strftime('%H:%M')}"

                print(
                    f"🔍 DEBUG Date/Time - UTC: {departure_datetime_utc}, Local: {departure_time}, Name: {flight_name}"
                )

        flight = Flight(
            id=flight_id,
            site_id=site_id,
            name=flight_name,
            title=flight_name,
            flight_date=flight_date,
            departure_time=departure_time,
            duration_minutes=(
                int(stats.get("flight_duration_seconds", 0) / 60)
                if stats.get("flight_duration_seconds")
                else None
            ),
            max_altitude_m=stats.get("max_altitude_m"),
            distance_km=stats.get("total_distance_km"),
            elevation_gain_m=stats.get("elevation_gain_m"),
            max_speed_kmh=stats.get("max_speed_kmh", 0),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        # 6. Sauvegarder le fichier (GPX ou IGC)
        gpx_dir = Path(__file__).parent / "db" / "gpx"
        gpx_dir.mkdir(parents=True, exist_ok=True)

        file_name = f"manual_{flight_id}.{file_type}"
        file_path = gpx_dir / file_name

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(file_str)

        flight.gpx_file_path = f"db/gpx/{file_name}"

        # 7. Enregistrer en base
        db.add(flight)
        db.commit()
        db.refresh(flight)

        logger.info(
            f" Created new flight from {file_type.upper()}: {flight.name} (ID: {flight_id})"
        )

        # 8. Trigger automatic video export
        try:
            from config import settings
            from video_export_manual import trigger_auto_export

            frontend_url = f"http://localhost:{settings.PORT}"
            trigger_auto_export(flight_id, db, frontend_url)
        except Exception as e:
            logger.warning(f"Failed to trigger auto video export: {e}")

        # 9. Retourner le vol créé
        return {
            "success": True,
            "flight_id": flight.id,
            "flight": {
                "id": flight.id,
                "name": flight.name,
                "title": flight.title,
                "flight_date": flight.flight_date.isoformat(),
                "departure_time": (
                    flight.departure_time.isoformat() if flight.departure_time else None
                ),
                "duration_minutes": flight.duration_minutes,
                "max_altitude_m": flight.max_altitude_m,
                "distance_km": flight.distance_km,
                "elevation_gain_m": flight.elevation_gain_m,
                "max_speed_kmh": flight.max_speed_kmh,
                "site_id": flight.site_id,
                "gpx_file_path": flight.gpx_file_path,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create flight from GPX: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create flight: {str(e)}") from e


@router.delete("/flights/{flight_id}")
async def delete_flight(flight_id: str, db: Session = Depends(get_db)):
    """
    Supprimer un vol

    Args:
        flight_id: ID du vol à supprimer

    Returns:
        {"success": true, "message": "Flight deleted"}
    """
    # 1. Vérifier que le vol existe
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    try:
        # 2. Supprimer le fichier GPX si présent
        if flight.gpx_file_path:
            gpx_path = Path(__file__).parent / flight.gpx_file_path
            if gpx_path.exists():
                gpx_path.unlink()
                logger.info(f"Deleted GPX file: {flight.gpx_file_path}")

        # 3. Supprimer le vol de la base
        flight_title = flight.title
        db.delete(flight)
        db.commit()

        logger.info(f" Deleted flight: {flight_title} (ID: {flight_id})")

        return {"success": True, "message": f"Flight '{flight_title}' deleted successfully"}

    except Exception as e:
        logger.error(f"Failed to delete flight {flight_id}: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}") from e


# Alerts endpoints
@router.get("/alerts")
def get_alerts(spot_id: str | None = None, active: bool = False, db: Session = Depends(get_db)):
    """
    Get alerts (weather warnings, wind alerts, etc.)
    For now, returns calculated alerts based on current weather conditions
    """
    alerts = []

    # If spot_id specified, check that spot's conditions
    if spot_id:
        site = db.query(Site).filter(Site.id == spot_id).first()
        if site:
            # Check recent forecasts for this site
            recent_forecast = (
                db.query(WeatherForecast)
                .filter(
                    WeatherForecast.site_id == spot_id,
                    WeatherForecast.forecast_date >= date.today(),
                )
                .first()
            )

            if recent_forecast:
                # Generate alert based on conditions
                if recent_forecast.para_index and recent_forecast.para_index < 30:
                    alerts.append(
                        {
                            "id": str(uuid.uuid4()),
                            "type": "weather",
                            "severity": "warning",
                            "title": "Poor Flying Conditions",
                            "message": f"{site.name}: Para-Index {recent_forecast.para_index}/100 - {recent_forecast.verdict}",
                            "spot_id": spot_id,
                            "created_at": datetime.utcnow().isoformat(),
                            "expires_at": (datetime.utcnow() + timedelta(hours=6)).isoformat(),
                        }
                    )

                if recent_forecast.wind_max_kmh and recent_forecast.wind_max_kmh > 30:
                    alerts.append(
                        {
                            "id": str(uuid.uuid4()),
                            "type": "wind",
                            "severity": "danger",
                            "title": "Strong Wind Warning",
                            "message": f"{site.name}: Wind gusts up to {recent_forecast.wind_max_kmh} km/h expected",
                            "spot_id": spot_id,
                            "created_at": datetime.utcnow().isoformat(),
                            "expires_at": (datetime.utcnow() + timedelta(hours=6)).isoformat(),
                        }
                    )

    return alerts


@router.post("/alerts")
def create_alert(alert_data: dict, db: Session = Depends(get_db)):
    """Create a custom alert (future: user-defined alerts)"""
    # For now, just return acknowledgment
    # In production, would store in Alert model
    return {"id": str(uuid.uuid4()), "status": "created", "message": "Alert created successfully"}


# Health check
@router.get("/health")
def health_check():
    return {"status": "ok", "message": "Dashboard API healthy"}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def parse_igc_file_from_string(igc_content: str) -> list[dict]:
    """
    Parse IGC content from string and extract coordinates with timestamps
    Returns list of {lat, lon, elevation, timestamp}

    IGC Format (B-records):
    B1708554657050N00551183EA000000035044
    B = record type
    170855 = time (HHMMSS UTC)
    4657050N = latitude (DDMMmmmN/S)
    00551183E = longitude (DDDMMmmmE/W)
    A = validity (A=3D fix, V=2D fix)
    00000 = pressure altitude (meters)
    00035 = GPS altitude (meters)
    044 = optional extensions

    HFDTE = Date header: HFDTEDATE:DDMMYY,FF
    """
    coordinates = []
    flight_date = None

    # Parse header to get date
    for line in igc_content.split("\n"):
        line = line.strip()

        # Parse date from HFDTE record
        if line.startswith("HFDTE") or line.startswith("HFDTEDATE"):
            # Format: HFDTEDATE:140825,03 or HFDTE140825
            date_part = line.split(":")[-1] if ":" in line else line[5:]
            date_str = date_part.split(",")[0]  # Remove flight number if present

            if len(date_str) >= 6:
                day = int(date_str[0:2])
                month = int(date_str[2:4])
                year = int(date_str[4:6])
                # IGC uses 2-digit year, assume 20XX for years < 50, else 19XX
                year = 2000 + year if year < 50 else 1900 + year
                flight_date = date(year, month, day)
                print(f"🔍 DEBUG IGC - Found date: {flight_date}")

        # Parse B-records (GPS fixes)
        elif line.startswith("B") and len(line) >= 35:
            try:
                # Time: HHMMSS
                time_str = line[1:7]
                hours = int(time_str[0:2])
                minutes = int(time_str[2:4])
                seconds = int(time_str[4:6])

                # Latitude: DDMMmmmN/S
                lat_deg = int(line[7:9])
                lat_min = int(line[9:11])
                lat_min_dec = int(line[11:14])
                lat_hem = line[14]
                latitude = lat_deg + (lat_min + lat_min_dec / 1000.0) / 60.0
                if lat_hem == "S":
                    latitude = -latitude

                # Longitude: DDDMMmmmE/W
                lon_deg = int(line[15:18])
                lon_min = int(line[18:20])
                lon_min_dec = int(line[20:23])
                lon_hem = line[23]
                longitude = lon_deg + (lon_min + lon_min_dec / 1000.0) / 60.0
                if lon_hem == "W":
                    longitude = -longitude

                # Validity (A=3D, V=2D) - position 24
                # validity = line[24]

                # Altitude: pressure altitude (25-29) and GPS altitude (30-34)
                # Use GPS altitude as primary
                gps_alt = int(line[30:35])

                # Create timestamp from date + time
                if flight_date:
                    flight_datetime = datetime(
                        flight_date.year,
                        flight_date.month,
                        flight_date.day,
                        hours,
                        minutes,
                        seconds,
                        tzinfo=ZoneInfo("UTC"),
                    )
                    timestamp = int(flight_datetime.timestamp() * 1000)
                else:
                    timestamp = 0

                coordinates.append(
                    {
                        "lat": latitude,
                        "lon": longitude,
                        "elevation": gps_alt,
                        "timestamp": timestamp,
                    }
                )

            except (ValueError, IndexError) as e:
                # Skip malformed B-records
                print(f"⚠️ DEBUG IGC - Skipping malformed B-record: {e}")
                continue

    print(f"🔍 DEBUG Parse IGC - Found {len(coordinates)} trackpoints")
    if coordinates:
        print(
            f"🔍 DEBUG First coord - lat:{coordinates[0]['lat']:.6f}, lon:{coordinates[0]['lon']:.6f}, ele:{coordinates[0]['elevation']}m"
        )

    return coordinates


def parse_gpx_file_from_string(gpx_content: str) -> list[dict]:
    """
    Parse GPX content from string and extract coordinates with timestamps
    Returns list of {lat, lon, elevation, timestamp}
    """
    root = ET.fromstring(gpx_content)

    # Handle GPX namespace
    ns = {"gpx": "http://www.topografix.com/GPX/1/1"}

    coordinates = []

    # Find all track points - try with namespace first, then without
    trkpts = root.findall(".//gpx:trkpt", ns)
    if not trkpts:
        trkpts = root.findall(".//trkpt")
        ns = {}  # No namespace

    print(f"🔍 DEBUG Parse GPX - Found {len(trkpts)} trackpoints")

    for trkpt in trkpts:
        lat = float(trkpt.get("lat", 0))
        lon = float(trkpt.get("lon", 0))

        # Get elevation - try with namespace first, then without
        ele_elem = trkpt.find("gpx:ele", ns) if ns else None
        if ele_elem is None:
            ele_elem = trkpt.find("ele")
        elevation = float(ele_elem.text) if ele_elem is not None and ele_elem.text else 0

        # Get timestamp - try with namespace first, then without
        time_elem = trkpt.find("gpx:time", ns) if ns else None
        if time_elem is None:
            time_elem = trkpt.find("time")

        if time_elem is not None and time_elem.text:
            try:
                dt = datetime.fromisoformat(time_elem.text.replace("Z", "+00:00"))
                timestamp = int(dt.timestamp() * 1000)  # milliseconds
            except Exception as e:
                print(f"⚠️ DEBUG Parse time failed: {e}")
                timestamp = 0
        else:
            timestamp = 0

        coordinates.append({"lat": lat, "lon": lon, "elevation": elevation, "timestamp": timestamp})

    if coordinates:
        print(
            f"🔍 DEBUG GPX Parse - ele:{coordinates[0]['elevation']}m, ts:{coordinates[0]['timestamp']}"
        )
        all_zero = all(c["timestamp"] == 0 for c in coordinates)
        print(f"🔍 DEBUG GPX Parse - All timestamps zero: {all_zero}")

    return coordinates


def parse_gpx_file(gpx_path: Path) -> list[dict]:
    """
    Parse GPX or IGC file and extract coordinates with timestamps
    Returns list of {lat, lon, elevation, timestamp}

    Automatically detects file format based on extension and content
    """
    # Read file content
    with open(gpx_path, encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Detect IGC format by extension or content
    is_igc = gpx_path.suffix.lower() == ".igc" or content.strip().startswith(
        ("A", "H")
    )  # IGC files start with A or H records

    if is_igc:
        # Parse as IGC file
        print(f"🔍 DEBUG - Detected IGC file: {gpx_path.name}")
        return parse_igc_file_from_string(content)
    else:
        # Parse as GPX file (XML)
        print(f"🔍 DEBUG - Detected GPX file: {gpx_path.name}")
        return parse_gpx_file_from_string(content)


def calculate_max_speed(coordinates: list[dict]) -> float:
    """
    Calculate maximum speed in km/h from GPX coordinates

    Args:
        coordinates: List of dicts with keys: lat, lon, timestamp

    Returns:
        Maximum speed in km/h
    """
    if len(coordinates) < 2:
        return 0.0

    max_speed = 0.0

    for i in range(1, len(coordinates)):
        # Skip if no valid timestamps
        if coordinates[i]["timestamp"] == 0 or coordinates[i - 1]["timestamp"] == 0:
            continue

        # Calculate distance in km
        distance_km = haversine_distance(
            coordinates[i - 1]["lat"],
            coordinates[i - 1]["lon"],
            coordinates[i]["lat"],
            coordinates[i]["lon"],
        )

        # Calculate time in hours
        time_ms = coordinates[i]["timestamp"] - coordinates[i - 1]["timestamp"]
        time_hours = time_ms / (1000 * 3600)

        # Calculate speed (avoid division by zero)
        if time_hours > 0:
            speed_kmh = distance_km / time_hours
            # Filter out unrealistic speeds (>150 km/h for paragliding)
            if speed_kmh < 150:
                max_speed = max(max_speed, speed_kmh)

    return round(max_speed, 2)


def calculate_gpx_stats(coordinates: list[dict]) -> dict:
    """
    Calculate statistics from GPX coordinates
    """
    if not coordinates:
        return {
            "max_altitude_m": 0,
            "min_altitude_m": 0,
            "elevation_gain_m": 0,
            "elevation_loss_m": 0,
            "total_distance_km": 0,
            "flight_duration_seconds": 0,
            "max_speed_kmh": 0,
            "first_trackpoint": None,
            "last_trackpoint": None,
        }

    elevations = [c["elevation"] for c in coordinates]
    max_alt = max(elevations)
    min_alt = min(elevations)

    # Debug logging for altitude
    print(f"🔍 DEBUG Altitude - Points: {len(coordinates)}, Min: {min_alt}m, Max: {max_alt}m")
    print(f"🔍 DEBUG First point elevation: {coordinates[0]['elevation']}m")
    print(f"🔍 DEBUG Last point elevation: {coordinates[-1]['elevation']}m")

    # Calculate elevation gain/loss
    elevation_gain = 0
    elevation_loss = 0
    for i in range(1, len(coordinates)):
        diff = coordinates[i]["elevation"] - coordinates[i - 1]["elevation"]
        if diff > 0:
            elevation_gain += diff
        else:
            elevation_loss += abs(diff)

    # Calculate total distance using Haversine formula
    total_distance = 0
    for i in range(1, len(coordinates)):
        dist = haversine_distance(
            coordinates[i - 1]["lat"],
            coordinates[i - 1]["lon"],
            coordinates[i]["lat"],
            coordinates[i]["lon"],
        )
        total_distance += dist

    # Calculate duration
    if coordinates[0]["timestamp"] > 0 and coordinates[-1]["timestamp"] > 0:
        duration_ms = coordinates[-1]["timestamp"] - coordinates[0]["timestamp"]
        duration_seconds = duration_ms / 1000
    else:
        # Estimate: assume 30 km/h average speed
        duration_seconds = (total_distance / 30) * 3600 if total_distance > 0 else 0

    # Calculate max speed
    max_speed = calculate_max_speed(coordinates)

    # Extract first and last trackpoints with datetime objects
    first_trackpoint = None
    last_trackpoint = None

    if coordinates[0]["timestamp"] > 0:
        first_trackpoint = {
            "time": datetime.fromtimestamp(coordinates[0]["timestamp"] / 1000),
            "lat": coordinates[0]["lat"],
            "lon": coordinates[0]["lon"],
            "elevation": coordinates[0]["elevation"],
        }

    if coordinates[-1]["timestamp"] > 0:
        last_trackpoint = {
            "time": datetime.fromtimestamp(coordinates[-1]["timestamp"] / 1000),
            "lat": coordinates[-1]["lat"],
            "lon": coordinates[-1]["lon"],
            "elevation": coordinates[-1]["elevation"],
        }

    print(
        f"🔍 DEBUG First trackpoint time: {first_trackpoint['time'] if first_trackpoint else 'None'}"
    )
    print(
        f"🔍 DEBUG Last trackpoint time: {last_trackpoint['time'] if last_trackpoint else 'None'}"
    )

    return {
        "max_altitude_m": round(max_alt),
        "min_altitude_m": round(min_alt),
        "elevation_gain_m": round(elevation_gain),
        "elevation_loss_m": round(elevation_loss),
        "total_distance_km": round(total_distance, 2),
        "flight_duration_seconds": round(duration_seconds),
        "max_speed_kmh": max_speed,
        "first_trackpoint": first_trackpoint,
        "last_trackpoint": last_trackpoint,
    }


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two coordinates in kilometers
    Using Haversine formula
    """
    R = 6371  # Earth radius in kilometers

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


# ========================================
# VIDEO EXPORT ENDPOINTS
# ========================================


@router.post("/flights/{flight_id}/export-video")
def start_flight_video_export(
    flight_id: str,
    quality: str = "1080p",
    fps: int = 15,
    speed: int = 1,
    mode: str = "manual",  # "manual" (Cesium manual render) or "stream" (MediaRecorder)
    db: Session = Depends(get_db),
):
    """
    Start video export in background

    Modes:
    - manual: Cesium manual render (frame-by-frame, perfect quality, slow ~90min)
    - stream: MediaRecorder (realtime capture, fast ~8min, may stutter)

    Returns job_id to track progress
    """
    logger.info(f"🎥 Video export requested: flight_id={flight_id}, mode={mode}")

    # Verify flight exists
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        logger.error(f"❌ Flight not found in DB: {flight_id}")
        raise HTTPException(status_code=404, detail="Flight not found")

    logger.info(f" Flight found: {flight.title} (date: {flight.flight_date})")

    # Determine frontend URL
    # In production, frontend is served on same server (port 8001)
    # In development, frontend is on Vite dev server (port 5173)
    frontend_url = os.getenv("FRONTEND_URL")
    if not frontend_url:
        # Auto-detect: check if static dir exists (production) or use dev server
        static_dir = Path(__file__).parent / "static"
        if static_dir.exists() and (static_dir / "index.html").exists():
            frontend_url = "http://localhost:8001"  # Production: same server
        else:
            frontend_url = "http://localhost:5173"  # Development: Vite dev server

    # Start export with selected mode
    if mode == "manual":
        logger.info("Using Cesium Manual Render (slow but perfect quality)")
        job_id = start_video_export_manual(
            flight_id=flight_id, quality=quality, fps=fps, speed=speed, frontend_url=frontend_url
        )
        export_method = "manual render"
    else:  # stream mode
        logger.info("Using MediaRecorder stream (fast but may stutter)")
        job_id = start_video_export_background(
            flight_id=flight_id, quality=quality, fps=fps, speed=speed, frontend_url=frontend_url
        )
        export_method = "stream"

    return {
        "job_id": job_id,
        "message": f"Video export started ({export_method})",
        "mode": mode,
        "status_url": f"/exports/{job_id}/status",
    }


@router.post("/flights/{flight_id}/generate-video")
def generate_flight_video(flight_id: str, db: Session = Depends(get_db)):
    """
    Generate video for a flight (simple endpoint with optimal defaults)
    Used for flights that don't have a video yet.

    Uses optimal settings: 1080p, 15 FPS, Manual Render
    """
    logger.info(f"🎥 Manual video generation requested: flight_id={flight_id}")

    # Verify flight exists and has GPX
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    if not flight.gpx_file_path:
        raise HTTPException(status_code=400, detail="Flight has no GPX file")

    # Check if video already exists or is processing
    if flight.video_export_status == "completed":
        raise HTTPException(status_code=400, detail="Video already exists")

    if flight.video_export_status == "processing":
        raise HTTPException(status_code=400, detail="Video conversion already in progress")

    # Determine frontend URL
    from config import API_PORT

    frontend_url = f"http://localhost:{API_PORT}"

    # Start conversion with optimal settings
    job_id = start_video_export_manual(
        flight_id=flight_id,
        quality="1080p",
        fps=15,
        speed=1,
        frontend_url=frontend_url,
        update_db=True,
    )

    logger.info(f" Video generation started: job_id={job_id}")

    return {
        "job_id": job_id,
        "message": "Video generation started (Manual Render, ~60-90 min)",
        "status_url": f"/api/exports/{job_id}/status",
    }


@router.get("/exports/{job_id}/status")
def get_video_export_status(job_id: str):
    """
    Get status of video export job (works for both manual and stream modes)
    """
    # Try manual render first, then stream
    status = get_export_status_manual(job_id)
    if not status:
        status = get_export_status_stream(job_id)

    if not status:
        raise HTTPException(status_code=404, detail="Export job not found")

    return status


@router.delete("/exports/{job_id}/cancel")
def cancel_video_export(job_id: str):
    """
    Cancel an ongoing video export job
    """
    # Try to cancel manual render job
    success = cancel_video_export_manual(job_id)

    if not success:
        raise HTTPException(
            status_code=400,
            detail="Export job not found or cannot be cancelled (may already be completed)",
        )

    return {"message": "Export cancelled successfully", "job_id": job_id}


@router.get("/exports/{job_id}/download")
def download_exported_video(job_id: str):
    """
    Download exported video
    """
    # Try manual render first, then stream
    status = get_export_status_manual(job_id)
    if not status:
        status = get_export_status_stream(job_id)

    if not status:
        raise HTTPException(status_code=404, detail="Export job not found")

    if status["status"] != "completed":
        raise HTTPException(status_code=400, detail="Video not ready yet")

    video_path = status.get("video_path")
    if not video_path or not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video file not found")

    filename = os.path.basename(video_path)
    return FileResponse(path=video_path, media_type="video/mp4", filename=filename)


@router.get("/flights/{flight_id}/exports")
def list_flight_exports(flight_id: str, db: Session = Depends(get_db)):
    """
    List all exports for a flight
    """
    # Verify flight exists
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    # Combine exports from both manual and stream modes
    manual_exports = list_exports_manual(flight_id=flight_id)
    stream_exports = list_exports_stream(flight_id=flight_id)
    exports = manual_exports + stream_exports
    return {"exports": exports}


# ============================================================================
# WEATHER SOURCE CONFIGURATION ENDPOINTS
# ============================================================================


@router.get("/weather-sources", response_model=list[WeatherSourceConfigSchema])
def get_weather_sources(enabled_only: bool = False, db: Session = Depends(get_db)):
    """
    Get all configured weather sources

    Args:
        enabled_only: If True, return only enabled sources

    Returns:
        List of WeatherSourceConfig with stats
    """
    query = db.query(WeatherSourceConfig)

    if enabled_only:
        query = query.filter(WeatherSourceConfig.is_enabled)

    sources = query.order_by(WeatherSourceConfig.priority.desc()).all()

    logger.info(f"Retrieved {len(sources)} weather sources (enabled_only={enabled_only})")
    return sources


@router.get("/weather-sources/stats", response_model=WeatherSourceStats)
def get_weather_sources_stats(db: Session = Depends(get_db)):
    """
    Get global statistics for all weather sources

    Returns:
        WeatherSourceStats with aggregations
    """
    sources = db.query(WeatherSourceConfig).all()

    total = len(sources)
    active = sum(1 for s in sources if s.is_enabled)
    disabled = total - active
    with_errors = sum(1 for s in sources if s.status == "error")

    # Calculate global success rate
    total_success = sum(s.success_count for s in sources)
    total_errors = sum(s.error_count for s in sources)
    total_requests = total_success + total_errors
    global_success_rate = (total_success / total_requests * 100) if total_requests > 0 else 0.0

    # Calculate global average response time (only sources with data)
    response_times = [s.avg_response_time_ms for s in sources if s.avg_response_time_ms is not None]
    global_avg_time = int(sum(response_times) / len(response_times)) if response_times else None

    return WeatherSourceStats(
        total_sources=total,
        active_sources=active,
        disabled_sources=disabled,
        sources_with_errors=with_errors,
        global_success_rate=round(global_success_rate, 2),
        global_avg_response_time_ms=global_avg_time,
    )


@router.get("/weather-sources/{source_name}", response_model=WeatherSourceConfigSchema)
def get_weather_source(source_name: str, db: Session = Depends(get_db)):
    """
    Get a specific weather source by name

    Args:
        source_name: Source name (e.g., "open-meteo")

    Returns:
        WeatherSourceConfig

    Raises:
        404: Source not found
    """
    source = (
        db.query(WeatherSourceConfig).filter(WeatherSourceConfig.source_name == source_name).first()
    )

    if not source:
        raise HTTPException(status_code=404, detail=f"Weather source '{source_name}' not found")

    return source


@router.post("/weather-sources", response_model=WeatherSourceConfigSchema, status_code=201)
def create_weather_source(source_data: WeatherSourceConfigCreate, db: Session = Depends(get_db)):
    """
    Create a new weather source

    Args:
        source_data: Source configuration

    Returns:
        Created WeatherSourceConfig

    Raises:
        400: Source with this name already exists
        422: Validation error (missing API key if required, etc.)
    """
    # Check source_name uniqueness
    existing = (
        db.query(WeatherSourceConfig)
        .filter(WeatherSourceConfig.source_name == source_data.source_name)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400, detail=f"Weather source '{source_data.source_name}' already exists"
        )

    # Create source
    new_source = WeatherSourceConfig(id=str(uuid.uuid4()), **source_data.dict())

    db.add(new_source)
    db.commit()
    db.refresh(new_source)

    logger.info(f"Created new weather source: {new_source.display_name} ({new_source.source_name})")
    return new_source


@router.patch("/weather-sources/{source_name}", response_model=WeatherSourceConfigSchema)
def update_weather_source(
    source_name: str, source_data: WeatherSourceConfigUpdate, db: Session = Depends(get_db)
):
    """
    Update weather source configuration

    Args:
        source_name: Source name
        source_data: Fields to update

    Returns:
        Updated WeatherSourceConfig

    Raises:
        404: Source not found
        400: Validation error (e.g., trying to disable last active source)
    """
    source = (
        db.query(WeatherSourceConfig).filter(WeatherSourceConfig.source_name == source_name).first()
    )

    if not source:
        raise HTTPException(status_code=404, detail=f"Weather source '{source_name}' not found")

    # Validation: At least 1 source must remain active
    if source_data.is_enabled is False:
        active_count = db.query(WeatherSourceConfig).filter(WeatherSourceConfig.is_enabled).count()

        if active_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot disable the last active weather source. At least one source must remain enabled.",
            )

    # Apply updates
    update_data = source_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(source, field, value)

    source.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(source)

    logger.info(f"Updated weather source '{source_name}': {list(update_data.keys())}")
    return source


@router.delete("/weather-sources/{source_name}", status_code=200)
def delete_weather_source(source_name: str, db: Session = Depends(get_db)):
    """
    Delete a weather source

    Args:
        source_name: Source name to delete

    Returns:
        { "success": true, "message": "..." }

    Raises:
        404: Source not found
        400: Cannot delete system source (default 5 sources)
        400: Cannot delete last source
    """
    source = (
        db.query(WeatherSourceConfig).filter(WeatherSourceConfig.source_name == source_name).first()
    )

    if not source:
        raise HTTPException(status_code=404, detail=f"Weather source '{source_name}' not found")

    # Protection: Cannot delete system sources
    SYSTEM_SOURCES = ["open-meteo", "weatherapi", "meteo-parapente", "meteociel", "meteoblue"]
    if source_name in SYSTEM_SOURCES:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete system weather source '{source_name}'. You can disable it instead.",
        )

    # Validation: At least 1 source must remain
    total_count = db.query(WeatherSourceConfig).count()
    if total_count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last weather source.")

    db.delete(source)
    db.commit()

    logger.info(f"Deleted weather source: {source_name}")
    return {"success": True, "message": f"Weather source '{source_name}' deleted successfully"}


@router.post("/weather-sources/{source_name}/test", response_model=WeatherSourceTestResult)
async def test_weather_source(
    source_name: str,
    lat: float = Query(..., ge=-90, le=90, description="Test latitude"),
    lon: float = Query(..., ge=-180, le=180, description="Test longitude"),
    db: Session = Depends(get_db),
):
    """
    Test a weather source in real-time

    Args:
        source_name: Source name to test
        lat: Test latitude (default: known site coordinates)
        lon: Test longitude

    Returns:
        WeatherSourceTestResult with success/failure, response time, sample data

    Raises:
        404: Source not found
        400: No fetch function available for this source
    """
    source = (
        db.query(WeatherSourceConfig).filter(WeatherSourceConfig.source_name == source_name).first()
    )

    if not source:
        raise HTTPException(status_code=404, detail=f"Weather source '{source_name}' not found")

    # Import fetch functions
    from scrapers.meteo_parapente import fetch_meteo_parapente
    from scrapers.meteoblue import fetch_meteoblue
    from scrapers.meteociel import fetch_meteociel
    from scrapers.open_meteo import fetch_open_meteo
    from scrapers.weatherapi import fetch_weatherapi

    # Map source_name to fetch function
    fetch_functions = {
        "open-meteo": fetch_open_meteo,
        "weatherapi": fetch_weatherapi,
        "meteo-parapente": fetch_meteo_parapente,
        "meteociel": fetch_meteociel,
        "meteoblue": fetch_meteoblue,
    }

    fetch_func = fetch_functions.get(source_name)
    if not fetch_func:
        raise HTTPException(
            status_code=400, detail=f"No fetch function available for source '{source_name}'"
        )

    # Execute test
    import time

    start_time = time.time()

    try:
        # Call fetch with appropriate parameters per source
        if source_name == "meteo-parapente":
            result = await fetch_func(lat, lon, site_name="Test Site", elevation_m=1000)
        elif source_name == "meteociel":
            result = await fetch_func(lat, lon, site_name="Test Site")
        elif source_name == "meteoblue":
            result = await fetch_func(lat, lon, city_name="Test City")
        else:
            result = await fetch_func(lat, lon)

        response_time_ms = int((time.time() - start_time) * 1000)

        if result["success"]:
            # Extract sample data (first hourly point)
            sample_data = None
            if result.get("data"):
                data = result["data"]
                if isinstance(data, dict):
                    # For structured APIs (open-meteo, weatherapi)
                    if "hourly" in data:
                        hourly = data["hourly"]
                        if isinstance(hourly, dict):
                            # Take first element of each array
                            sample_data = {
                                key: (val[0] if isinstance(val, list) and len(val) > 0 else val)
                                for key, val in list(hourly.items())[:5]  # First 5 fields
                            }
                    elif "forecast" in data:
                        # WeatherAPI structure
                        sample_data = {"preview": "Forecast data available"}

                elif isinstance(data, list) and len(data) > 0:
                    # For scrapers returning list (meteo-parapente, etc.)
                    sample_data = data[0] if data else None

            return WeatherSourceTestResult(
                success=True,
                response_time_ms=response_time_ms,
                error=None,
                sample_data=sample_data,
                tested_at=datetime.utcnow(),
            )
        else:
            return WeatherSourceTestResult(
                success=False,
                response_time_ms=response_time_ms,
                error=result.get("error", "Unknown error"),
                sample_data=None,
                tested_at=datetime.utcnow(),
            )

    except Exception as e:
        response_time_ms = int((time.time() - start_time) * 1000)
        logger.error(f"Test failed for source '{source_name}': {e}")

        return WeatherSourceTestResult(
            success=False,
            response_time_ms=response_time_ms,
            error=str(e),
            sample_data=None,
            tested_at=datetime.utcnow(),
        )


# ============================================================================
# EMAGRAM (SOUNDING) ANALYSIS ENDPOINTS
# ============================================================================


@router.get("/emagram/latest", response_model=EmagramAnalysisSchema | None, tags=["Emagram"])
async def get_latest_emagram(
    site_id: str | None = Query(None, description="Site ID (preferred over lat/lon)"),
    user_lat: float | None = Query(None, description="User latitude"),
    user_lon: float | None = Query(None, description="User longitude"),
    day_index: int = Query(0, description="Day index (0=today, 1=tomorrow, ...)"),
    max_distance_km: float = Query(200, description="Maximum station distance in km"),
    db: Session = Depends(get_db),
):
    """
    Get most recent emagram analysis for a site or location.

    Supports two modes:
    - By site_id: looks up analyses for that specific site
    - By lat/lon: finds closest analysis within max_distance_km

    Args:
        site_id: Site ID to get emagram for (preferred)
        user_lat: User latitude (fallback if no site_id)
        user_lon: User longitude (fallback if no site_id)
        day_index: Day offset (0=today, 1=tomorrow, etc.)
        max_distance_km: Maximum acceptable station distance (default: 200km)
    """
    try:
        # Determine target coordinates
        if site_id:
            site = db.query(Site).filter(Site.id == site_id).first()
            if not site:
                raise HTTPException(status_code=404, detail="Site not found")
            target_lat, target_lon = site.latitude, site.longitude
        elif user_lat is not None and user_lon is not None:
            target_lat, target_lon = user_lat, user_lon
        else:
            raise HTTPException(
                status_code=400, detail="Either site_id or user_lat/user_lon required"
            )

        if target_lat is None or target_lon is None:
            return None

        # Time window based on day_index
        target_date = (datetime.utcnow() + timedelta(days=day_index)).date()
        window_start = datetime.combine(target_date, datetime.min.time()) - timedelta(hours=12)
        window_end = datetime.combine(target_date, datetime.min.time()) + timedelta(hours=36)

        recent_analyses = (
            db.query(EmagramAnalysis)
            .filter(
                EmagramAnalysis.analysis_datetime >= window_start,
                EmagramAnalysis.analysis_datetime <= window_end,
                EmagramAnalysis.analysis_status == "completed",
            )
            .order_by(EmagramAnalysis.analysis_datetime.desc())
            .all()
        )

        if not recent_analyses:
            return None

        # If site_id provided, prefer analyses for that exact site
        if site_id:
            for analysis in recent_analyses:
                if analysis.station_code == site_id:
                    return analysis

        # Fallback: filter by distance and find closest
        from scrapers.wyoming import haversine_distance

        closest_analysis = None
        min_distance = float("inf")

        for analysis in recent_analyses:
            if analysis.station_latitude is None or analysis.station_longitude is None:
                continue
            dist = haversine_distance(
                target_lat, target_lon, analysis.station_latitude, analysis.station_longitude
            )

            if dist <= max_distance_km and dist < min_distance:
                min_distance = dist
                closest_analysis = analysis

        return closest_analysis

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get latest emagram: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/emagram/history", response_model=list[EmagramAnalysisListItem], tags=["Emagram"])
async def get_emagram_history(
    user_lat: float = Query(..., description="User latitude"),
    user_lon: float = Query(..., description="User longitude"),
    days: int = Query(7, ge=1, le=30, description="Number of days of history"),
    max_distance_km: float = Query(200, description="Maximum station distance in km"),
    db: Session = Depends(get_db),
):
    """
    Get historical emagram analyses for user location

    Args:
        user_lat: User latitude
        user_lon: User longitude
        days: Number of days to look back (1-30, default: 7)
        max_distance_km: Maximum acceptable station distance

    Returns:
        List of emagram analyses, sorted by date descending

    Example:
        GET /api/emagram/history?user_lat=45.76&user_lon=4.84&days=7
    """
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        analyses = (
            db.query(EmagramAnalysis)
            .filter(
                EmagramAnalysis.analysis_datetime >= cutoff_date,
                EmagramAnalysis.analysis_status == "completed",
            )
            .order_by(EmagramAnalysis.analysis_datetime.desc())
            .all()
        )

        # Filter by distance
        from scrapers.wyoming import haversine_distance

        filtered_analyses = []
        for analysis in analyses:
            dist = haversine_distance(
                user_lat, user_lon, analysis.station_latitude, analysis.station_longitude
            )
            if dist <= max_distance_km:
                filtered_analyses.append(analysis)

        return filtered_analyses

    except Exception as e:
        logger.error(f"Failed to get emagram history: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/emagram/export/csv")
async def export_emagram_csv(
    user_lat: float = Query(..., description="User latitude"),
    user_lon: float = Query(..., description="User longitude"),
    days: int = Query(30, ge=1, le=90, description="Number of days"),
    db: Session = Depends(get_db),
):
    """
    Export emagram analyses to CSV

    Args:
        user_lat: User latitude
        user_lon: User longitude
        days: Number of days to export (1-90, default: 30)

    Returns:
        CSV file download
    """
    try:
        import csv
        from io import StringIO

        from fastapi.responses import StreamingResponse

        cutoff_date = datetime.utcnow() - timedelta(days=days)

        analyses = (
            db.query(EmagramAnalysis)
            .filter(
                EmagramAnalysis.analysis_datetime >= cutoff_date,
                EmagramAnalysis.analysis_status == "completed",
            )
            .order_by(EmagramAnalysis.analysis_datetime.desc())
            .all()
        )

        # Filter by distance
        from scrapers.wyoming import haversine_distance

        output = StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow(
            [
                "Date",
                "Heure",
                "Station",
                "Distance (km)",
                "Score",
                "Plafond (m)",
                "Force (m/s)",
                "CAPE (J/kg)",
                "Stabilité",
                "Cisaillement",
                "Risque Orage",
                "Heures Début",
                "Heures Fin",
                "Total Heures",
                "LCL (m)",
                "LFC (m)",
                "Lifted Index",
                "Méthode",
                "LLM Provider",
            ]
        )

        # Data
        for analysis in analyses:
            dist = haversine_distance(
                user_lat, user_lon, analysis.station_latitude, analysis.station_longitude
            )

            if dist > 200:  # Skip distant stations
                continue

            writer.writerow(
                [
                    analysis.analysis_date.strftime("%Y-%m-%d"),
                    analysis.analysis_time.strftime("%H:%M"),
                    analysis.station_name,
                    round(dist, 1),
                    analysis.score_volabilite or "",
                    analysis.plafond_thermique_m or "",
                    round(analysis.force_thermique_ms, 1) if analysis.force_thermique_ms else "",
                    round(analysis.cape_jkg, 0) if analysis.cape_jkg else "",
                    analysis.stabilite_atmospherique or "",
                    analysis.cisaillement_vent or "",
                    analysis.risque_orage or "",
                    (
                        analysis.heure_debut_thermiques.strftime("%H:%M")
                        if analysis.heure_debut_thermiques
                        else ""
                    ),
                    (
                        analysis.heure_fin_thermiques.strftime("%H:%M")
                        if analysis.heure_fin_thermiques
                        else ""
                    ),
                    analysis.heures_volables_total or "",
                    analysis.lcl_m or "",
                    analysis.lfc_m or "",
                    round(analysis.lifted_index, 1) if analysis.lifted_index else "",
                    analysis.analysis_method,
                    analysis.llm_provider or "",
                ]
            )

        output.seek(0)

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=emagram_export_{datetime.now().strftime('%Y%m%d')}.csv"
            },
        )

    except Exception as e:
        logger.error(f"Failed to export CSV: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/emagram/analyze", response_model=EmagramAnalysisSchema, tags=["Emagram"])
async def trigger_emagram_analysis(
    request: EmagramTriggerRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)
):
    """
    Trigger multi-source emagram analysis for closest spot

    This endpoint finds the closest paragliding spot to the given coordinates
    and generates a complete multi-source emagram analysis using:
    - Screenshots from Meteo-Parapente, TopMeteo, and Windy
    - AI analysis with Google Gemini Vision

    Args:
        request: EmagramTriggerRequest with user coordinates

    Returns:
        Complete emagram analysis with multi-source data

    Example:
        POST /api/emagram/analyze
        {
          "user_latitude": 47.1944,
          "user_longitude": 5.9896,
          "force_refresh": false
        }
    """
    try:
        from emagram_multi_source import (
            generate_multi_source_emagram_for_spot,
        )

        # Step 1: Find target site
        if request.site_id:
            closest_site = db.query(Site).filter(Site.id == request.site_id).first()
            if not closest_site:
                raise HTTPException(status_code=404, detail="Site not found")
            logger.info(f"Using site directly: {closest_site.name} ({closest_site.id})")
        elif request.user_latitude is not None and request.user_longitude is not None:
            logger.info(
                f"Finding closest site to ({request.user_latitude}, {request.user_longitude})"
            )
            from spots.distance import haversine_distance as hav_dist

            sites = (
                db.query(Site).filter(Site.latitude.isnot(None), Site.longitude.isnot(None)).all()
            )
            if not sites:
                raise HTTPException(
                    status_code=404,
                    detail="No paragliding sites found in database.",
                )

            closest_site = None
            min_distance = float("inf")
            for site in sites:
                distance = hav_dist(
                    request.user_latitude, request.user_longitude, site.latitude, site.longitude
                )
                if distance < min_distance:
                    min_distance = distance
                    closest_site = site

            logger.info(
                f"Closest site: {closest_site.name} ({closest_site.id}) at {min_distance:.1f}km"
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Either site_id or user_latitude/user_longitude required",
            )

        # Step 2: Check for recent analysis (unless force_refresh)
        if not request.force_refresh:
            cutoff_time = datetime.utcnow() - timedelta(hours=3)

            existing = (
                db.query(EmagramAnalysis)
                .filter(
                    EmagramAnalysis.station_code == closest_site.id,
                    EmagramAnalysis.analysis_datetime >= cutoff_time,
                    EmagramAnalysis.analysis_status == "completed",
                )
                .order_by(EmagramAnalysis.analysis_datetime.desc())
                .first()
            )

            if existing:
                logger.info(
                    f"Returning cached multi-source emagram from {existing.analysis_datetime}"
                )
                return existing

        # Step 3: Generate new multi-source analysis
        logger.info(f"Generating multi-source emagram for {closest_site.name}...")

        result = await generate_multi_source_emagram_for_spot(
            site_id=closest_site.id, db=db, force_refresh=request.force_refresh
        )

        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate emagram: {result.get('error', 'Unknown error')}",
            )

        # Fetch the saved analysis from database
        analysis = (
            db.query(EmagramAnalysis).filter(EmagramAnalysis.id == result["analysis_id"]).first()
        )

        if not analysis:
            raise HTTPException(
                status_code=500, detail="Analysis completed but not found in database"
            )

        logger.info(f"Multi-source emagram complete: {analysis.id}")

        return analysis

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to trigger emagram analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


# ============================================================================
# MULTI-SOURCE EMAGRAM ENDPOINTS
# ============================================================================


@router.get("/emagram/spot/{site_id}/latest", tags=["Emagram"])
async def get_latest_emagram_for_spot(site_id: str, db: Session = Depends(get_db)):
    """
    Get latest multi-source emagram analysis for a specific spot

    Returns analysis from last 3 hours if available

    Example:
        GET /api/emagram/spot/arguel/latest

    Returns:
        {
            "success": True,
            "analysis_id": "uuid",
            "spot_name": "Arguel",
            "last_update": "2024-03-07T20:15:00",
            "external_links": [
                {"source": "meteo-parapente", "url": "https://..."},
                {"source": "topmeteo", "url": "https://..."},
                {"source": "windy", "url": "https://..."}
            ],
            "analysis": {
                "plafond_thermique_m": 2800,
                "force_thermique_ms": 2.5,
                "score_volabilite": 75,
                ...
            },
            "sources_count": 3,
            "sources_agreement": "high",
            "next_update": "2024-03-07T23:15:00"
        }
    """
    from datetime import timedelta

    from emagram_multi_source import emagram_analysis_to_dict

    # Find most recent analysis for this site (within 3 hours)
    cutoff_time = datetime.utcnow() - timedelta(hours=3)

    emagram = (
        db.query(EmagramAnalysis)
        .filter(
            EmagramAnalysis.station_code == site_id,
            EmagramAnalysis.analysis_datetime >= cutoff_time,
            EmagramAnalysis.analysis_status == "completed",
        )
        .order_by(EmagramAnalysis.analysis_datetime.desc())
        .first()
    )

    if not emagram:
        raise HTTPException(
            status_code=404,
            detail=f"No recent emagram analysis found for spot {site_id}. Try refreshing.",
        )

    return emagram_analysis_to_dict(emagram)


@router.post("/emagram/spot/{site_id}/refresh", tags=["Emagram"])
async def refresh_emagram_for_spot(
    site_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)
):
    """
    Trigger immediate refresh of multi-source emagram for a spot

    Runs in background to avoid timeout

    Example:
        POST /api/emagram/spot/arguel/refresh

    Returns:
        {
            "status": "refreshing",
            "message": "Emagram refresh started for Arguel",
            "estimated_time_seconds": 30
        }
    """
    from emagram_multi_source import generate_multi_source_emagram_for_spot

    # Verify site exists
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Site {site_id} not found")

    # Add background task
    background_tasks.add_task(
        generate_multi_source_emagram_for_spot, site_id=site_id, db=db, force_refresh=True
    )

    logger.info(f"🔄 Emagram refresh triggered for {site.name}")

    return {
        "status": "refreshing",
        "message": f"Emagram refresh started for {site.name}",
        "spot_id": site_id,
        "estimated_time_seconds": 30,
    }


@router.get("/emagram/spots/all", tags=["Emagram"])
async def get_all_spots_latest_emagrammes(db: Session = Depends(get_db)):
    """
    Get latest emagram analysis for all spots

    Useful for overview/dashboard

    Returns:
        {
            "spots": [
                {
                    "spot_id": "arguel",
                    "spot_name": "Arguel",
                    "last_update": "2024-03-07T20:15:00",
                    "score_volabilite": 75,
                    "sources_agreement": "high"
                },
                ...
            ],
            "total_spots": 6,
            "updated_count": 5
        }
    """
    from datetime import timedelta

    cutoff_time = datetime.utcnow() - timedelta(hours=3)

    # Get all sites with recent emagram
    sites = db.query(Site).all()

    spots_data = []
    for site in sites:
        emagram = (
            db.query(EmagramAnalysis)
            .filter(
                EmagramAnalysis.station_code == site.id,
                EmagramAnalysis.analysis_datetime >= cutoff_time,
                EmagramAnalysis.analysis_status == "completed",
            )
            .order_by(EmagramAnalysis.analysis_datetime.desc())
            .first()
        )

        if emagram:
            spots_data.append(
                {
                    "spot_id": site.id,
                    "spot_name": site.name,
                    "last_update": emagram.analysis_datetime.isoformat(),
                    "score_volabilite": emagram.score_volabilite,
                    "plafond_thermique_m": emagram.plafond_thermique_m,
                    "force_thermique_ms": emagram.force_thermique_ms,
                    "sources_agreement": emagram.sources_agreement,
                    "sources_count": emagram.sources_count,
                }
            )

    return {"spots": spots_data, "total_spots": len(sites), "updated_count": len(spots_data)}


@router.get("/emagram/screenshot/{analysis_id}/{source}", tags=["Emagram"])
async def get_emagram_screenshot(analysis_id: str, source: str, db: Session = Depends(get_db)):
    """
    Serve emagram screenshot image file

    Args:
        analysis_id: EmagramAnalysis ID
        source: Screenshot source name (meteo-parapente, topmeteo, windy)

    Returns:
        PNG image file

    Example:
        GET /api/emagram/screenshot/abc123.../meteo-parapente
    """
    import json
    from pathlib import Path

    # Find the analysis record
    emagram = db.query(EmagramAnalysis).filter(EmagramAnalysis.id == analysis_id).first()

    if not emagram:
        raise HTTPException(status_code=404, detail=f"Emagram analysis {analysis_id} not found")

    if not emagram.screenshot_paths:
        raise HTTPException(status_code=404, detail="No screenshots available for this analysis")

    # Parse screenshot paths JSON
    try:
        screenshot_paths = json.loads(emagram.screenshot_paths)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail="Invalid screenshot paths data") from e

    # Get the requested screenshot path
    image_path = screenshot_paths.get(source)

    if not image_path:
        available_sources = list(screenshot_paths.keys())
        raise HTTPException(
            status_code=404,
            detail=f"Screenshot source '{source}' not found. Available: {available_sources}",
        )

    # Check if file exists
    image_file = Path(image_path)
    if not image_file.exists():
        raise HTTPException(status_code=404, detail=f"Screenshot file not found: {image_path}")

    # Serve the image
    return FileResponse(
        path=str(image_file),
        media_type="image/png",
        filename=f"emagram_{source}_{analysis_id[:8]}.png",
    )


# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================


@router.post("/admin/clear-emagram-cache")
async def clear_emagram_cache(db: Session = Depends(get_db)):
    """
    Clear all emagram cache (database + Redis)
    Use this to fix stuck/old analyses

    Note: This is different from /admin/clear-cache which only clears Redis.
    This endpoint also deletes emagram analyses from the database.
    """
    try:
        # 1. Delete all emagram analyses from database
        deleted_count = db.query(EmagramAnalysis).delete()
        db.commit()

        # 2. Clear Redis cache
        try:
            r = redis.Redis(host="redis", port=6379, decode_responses=True)
            r.flushall()
            redis_cleared = True
        except Exception as redis_error:
            logger.warning(f"Redis clear failed (non-critical): {redis_error}")
            redis_cleared = False

        return {
            "success": True,
            "database_deleted": deleted_count,
            "redis_cleared": redis_cleared,
            "message": f"Cleared {deleted_count} emagram analyses and Redis cache",
        }
    except Exception as e:
        logger.error(f"Clear cache failed: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/admin/debug/gemini")
async def debug_gemini_api():
    """
    Test Gemini API configuration and connectivity
    """
    try:
        import google.generativeai as genai
    except ImportError:
        return {
            "success": False,
            "error": "google-generativeai package not installed (optional dependency)",
            "error_type": "ImportError",
            "message": "Install with: pip install google-generativeai",
        }

    try:
        from config import GEMINI_MODEL, GOOGLE_API_KEY

        # Create local aliases for the success response
        api_key = GOOGLE_API_KEY
        model_name = GEMINI_MODEL

        if not api_key:
            return {"success": False, "error": "BACKEND_GOOGLE_API_KEY not set in environment"}

        # Configure and test
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)

        # Simple test prompt
        response = model.generate_content('Say hello in JSON format: {"message": "..."}')

        return {
            "success": True,
            "api_key_set": True,
            "api_key_preview": f"{api_key[:10]}...{api_key[-4:]}",
            "model_name": model_name,
            "test_response": response.text,
            "message": "Gemini API is working!",
        }

    except Exception as e:
        logger.error(f"Gemini debug test failed: {e}", exc_info=True)
        return {"success": False, "error": str(e), "error_type": type(e).__name__}
