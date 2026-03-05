from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Site, Flight, WeatherForecast
from schemas import Site as SiteSchema, SiteCreate, SpotsResponse, WeatherForecast as WeatherForecastSchema, WeatherResponse, FlightUpdate
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
import uuid
import asyncio
import xml.etree.ElementTree as ET
import math
import logging
from typing import List, Dict, Optional, Sequence

logger = logging.getLogger(__name__)

# Import weather_pipeline and para_index
from weather_pipeline import get_normalized_forecast, get_daily_aggregate
from para_index import calculate_para_index, analyze_hourly_slots, format_slots_summary

router = APIRouter(prefix="/api", tags=["api"])

# ============================================================================
# PARAGLIDING SPOTS SEARCH ENDPOINTS (External database)
# ============================================================================

@router.post("/spots/sync")
async def sync_paragliding_spots(
    force: bool = False,
    db: Session = Depends(get_db)
):
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
    from spots import sync_to_database, get_sync_status
    from datetime import datetime, timedelta
    
    # Check if sync is needed
    status = get_sync_status(db)
    
    if not force and status.get('last_sync'):
        # Parse last sync time
        try:
            last_sync = datetime.fromisoformat(status['last_sync'])
            days_since_sync = (datetime.utcnow() - last_sync).days
            
            if days_since_sync < 7:
                return {
                    "success": True,
                    "message": f"Data is recent (synced {days_since_sync} days ago). Use force=true to sync anyway.",
                    "stats": status,
                    "timestamp": datetime.utcnow().isoformat(),
                    "synced": False
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
        "synced": True
    }


@router.get("/spots/geocode")
async def geocode_location(
    query: str,
    country: str = "FR"
):
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
    from spots.geocoding import geocode_city
    import requests
    
    # Use existing geocode_city function
    result = geocode_city(query, country)
    
    if not result:
        raise HTTPException(
            status_code=404, 
            detail=f"Location '{query}' not found"
        )
    
    lat, lon = result
    
    # Get full address details from Nominatim for display
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {
            "lat": lat,
            "lon": lon,
            "format": "json"
        }
        headers = {
            "User-Agent": "DashboardParapente/0.2.0"
        }
        response = requests.get(url, params=params, headers=headers, timeout=5)
        data = response.json()
        display_name = data.get("display_name", query)
    except:
        display_name = query
    
    return {
        "name": query,
        "latitude": lat,
        "longitude": lon,
        "display_name": display_name
    }

@router.get("/spots/search")
async def search_paragliding_spots(
    city: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius_km: int = 50,
    type: Optional[str] = None,
    db: Session = Depends(get_db)
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
            status_code=400,
            detail="Provide either 'city' OR ('lat' AND 'lon'), not both"
        )
    
    if not city and (lat is None or lon is None):
        raise HTTPException(
            status_code=400,
            detail="Must provide either 'city' OR both 'lat' and 'lon'"
        )
    
    # Validate type if provided
    if type and type not in ["takeoff", "landing"]:
        raise HTTPException(
            status_code=400,
            detail="Type must be 'takeoff' or 'landing'"
        )
    
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
    city: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius_km: int = 50,
    type: Optional[str] = None,
    limit: int = 5,
    db: Session = Depends(get_db)
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
            status_code=400,
            detail="Provide either 'city' OR ('lat' AND 'lon'), not both"
        )
    
    if not city and (lat is None or lon is None):
        raise HTTPException(
            status_code=400,
            detail="Must provide either 'city' OR both 'lat' and 'lon'"
        )
    
    if type and type not in ["takeoff", "landing"]:
        raise HTTPException(
            status_code=400,
            detail="Type must be 'takeoff' or 'landing'"
        )
    
    # Perform search
    if city:
        search_result = search_by_city(db, city, radius_km, type)
    else:
        search_result = search_by_coordinates(db, lat, lon, radius_km, type)
    
    # Check for geocoding error
    if "error" in search_result:
        raise HTTPException(status_code=404, detail=search_result["error"])
    
    # Get top N spots
    spots = search_result['spots'][:limit]
    
    # Fetch weather for each spot in parallel
    weather_tasks = []
    for spot in spots:
        weather_tasks.append(
            get_normalized_forecast(
                spot['latitude'],
                spot['longitude'],
                0,  # Today
                site_name=spot['name'],
                elevation_m=spot.get('elevation_m')
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
                    "total_sources": weather_data.get("total_sources", 0)
                }
            }
        else:
            # Weather fetch failed, include spot without weather
            spot_with_weather = {
                **spot,
                "weather": {
                    "error": weather_data.get("error", "Failed to fetch weather")
                }
            }
        
        spots_with_weather.append(spot_with_weather)
    
    return {
        "query": search_result['query'],
        "total_spots_found": search_result['total'],
        "spots_with_weather": spots_with_weather,
        "showing": len(spots_with_weather)
    }


@router.get("/spots/detail/{spot_id}")
async def get_paragliding_spot_detail(
    spot_id: str,
    db: Session = Depends(get_db)
):
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
    spot_id: str,
    day_index: int = 0,
    days: int = 1,
    db: Session = Depends(get_db)
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
    if not spot.get('latitude') or not spot.get('longitude'):
        raise HTTPException(status_code=400, detail="Spot has no coordinates")
    
    # Fetch weather data (same as regular weather endpoint)
    tasks = []
    for d in range(days):
        tasks.append(get_normalized_forecast(
            spot['latitude'],
            spot['longitude'],
            day_index + d,
            site_name=spot['name'],
            elevation_m=spot.get('elevation_m')
        ))
    
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
                "spot_name": spot['name'],
                "error": day_result.get("error", "Failed to fetch weather data"),
                "day_index": day_index,
                "days": days
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
            "model": config.get("model", "unknown")
        }
    
    return {
        "spot_id": spot_id,
        "spot_name": spot['name'],
        "spot_type": spot['type'],
        "spot_orientation": spot.get('orientation'),
        "spot_elevation_m": spot.get('elevation_m'),
        "spot_rating": spot.get('rating'),
        "coordinates": {
            "latitude": spot['latitude'],
            "longitude": spot['longitude']
        },
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
        "sources_metadata": sources_metadata
    }


# ============================================================================
# USER SITES ENDPOINTS (Original - for user-managed custom spots)
# ============================================================================

@router.get("/spots", response_model=SpotsResponse)
def get_spots(db: Session = Depends(get_db)):
    """Get all user-managed paragliding spots"""
    sites = db.query(Site).all()
    return SpotsResponse(sites=sites)

@router.post("/spots")
async def create_site(
    site_data: SiteCreate,
    db: Session = Depends(get_db)
):
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
    existing_site = db.query(Site).filter(
        func.lower(Site.name) == site_data.name.lower()
    ).first()
    
    if existing_site:
        logger.info(f"Site '{site_data.name}' already exists, returning existing site")
        # Return existing site instead of creating duplicate
        return existing_site
    
    # Generate unique code from name
    code_base = site_data.name.lower().replace(' ', '-').replace("'", '').replace('è', 'e').replace('é', 'e').replace('à', 'a')
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
        site_type="user_spot"  # Mark as user-created
    )
    
    try:
        db.add(new_site)
        db.commit()
        db.refresh(new_site)
        logger.info(f"✅ Created new site: {new_site.name} (ID: {new_site.id})")
        return new_site
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create site: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Site creation failed: {str(e)}")

# ============================================================================
# BEST SPOT RECOMMENDATION ENDPOINT
# ============================================================================
# IMPORTANT: This must be BEFORE /spots/{spot_id} to avoid route collision

@router.get("/spots/best")
async def get_best_spot(db: Session = Depends(get_db)):
    """
    Get the best flying spot for today based on Para-Index and wind conditions
    
    This endpoint:
    1. Returns cached result if available (fast response)
    2. Calculates from database if cache miss
    3. Cache is automatically refreshed every hour by scheduler
    
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
        best_spot = await get_best_spot_cached(db)
        
        if not best_spot:
            raise HTTPException(
                status_code=404,
                detail="No forecast data available for today. The scheduler may not have run yet."
            )
        
        return best_spot
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting best spot: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to calculate best spot: {str(e)}")


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
                'id': 'site-arguel',
                'code': 'arguel',
                'name': 'Arguel',
                'latitude': 47.1944,
                'longitude': 5.9896,
                'elevation_m': 462,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 3,
                'orientation': 'NNW',
                'linked_spot_id': 'merged_884e0213d9116315'
            },
            {
                'id': 'site-mont-poupet-nord',
                'code': 'mont-poupet-nord',
                'name': 'Mont Poupet Nord',
                'latitude': 46.9716,
                'longitude': 5.8776,
                'elevation_m': 795,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 4,
                'orientation': 'N',
                'linked_spot_id': 'merged_d370be468747c90a'
            },
            {
                'id': 'site-mont-poupet-nw',
                'code': 'mont-poupet-nw',
                'name': 'Mont Poupet Nord-Ouest',
                'latitude': 46.9701,
                'longitude': 5.8742,
                'elevation_m': 795,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 3,
                'orientation': 'NW',
                'linked_spot_id': 'merged_c30c861b49a65324'
            },
            {
                'id': 'site-mont-poupet-ouest',
                'code': 'mont-poupet-ouest',
                'name': 'Mont Poupet Ouest',
                'latitude': 46.9693,
                'longitude': 5.8747,
                'elevation_m': 795,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 4,
                'orientation': 'W',
                'linked_spot_id': 'merged_359e1153c44c269e'
            },
            {
                'id': 'site-mont-poupet-sud',
                'code': 'mont-poupet-sud',
                'name': 'Mont Poupet Sud',
                'latitude': 46.9691,
                'longitude': 5.8762,
                'elevation_m': 795,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 1,
                'orientation': 'S',
                'linked_spot_id': 'merged_60fbcc6724417e87'
            },
            {
                'id': 'site-la-cote',
                'code': 'la-cote',
                'name': 'La Côte',
                'latitude': 46.9424,
                'longitude': 5.8438,
                'elevation_m': 800,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 2,
                'orientation': 'N',
                'linked_spot_id': 'merged_d3836f8db6c839fa'
            }
        ]
        
        created_sites = []
        now = datetime.utcnow()
        
        for site_data in sites_data:
            # Check if site exists
            existing = db.query(Site).filter(Site.id == site_data['id']).first()
            
            if existing:
                # Update existing site
                for key, value in site_data.items():
                    if key != 'id':
                        setattr(existing, key, value)
                existing.updated_at = now
                logger.info(f"Updated site: {site_data['name']}")
            else:
                # Create new site
                site = Site(
                    **site_data,
                    created_at=now,
                    updated_at=now
                )
                db.add(site)
                logger.info(f"Created site: {site_data['name']}")
            
            created_sites.append(site_data['name'])
        
        db.commit()
        
        # Return count
        total_sites = db.query(Site).count()
        
        return {
            "success": True,
            "message": f"Successfully seeded {len(created_sites)} sites",
            "sites": created_sites,
            "total_sites_in_db": total_sites
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding sites: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to seed sites: {str(e)}")


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
        "stats": stats
    }


# ============================================================================
# Weather endpoints (UPDATED with pipeline + para_index)
# ============================================================================
@router.get("/weather/{spot_id}")
async def get_weather(spot_id: str, day_index: int = 0, days: int = 1, db: Session = Depends(get_db)):
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
        tasks.append(get_normalized_forecast(
            site.latitude,
            site.longitude,
            day_index + d,
            site_name=site.name,
            elevation_m=site.elevation_m
        ))
    
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
                "days": days
            }
    
    # Filter to flyable hours (sunrise to sunset) before calculating para_index
    flyable_consensus = all_consensus
    if sunrise_time and sunset_time:
        try:
            sunrise_hour = int(sunrise_time.split(':')[0])
            sunset_hour = int(sunset_time.split(':')[0])
            flyable_consensus = [h for h in all_consensus if sunrise_hour <= h.get('hour', 0) <= sunset_hour]
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
                "available_fields": config.get("provides", [])
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
        "total_sources": total_sources
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
        elevation_m=site.elevation_m
    )
    
    if not day_result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=day_result.get("error", f"No forecast data available for {site.name}")
        )
    
    # Get consensus data
    consensus_data = day_result.get("consensus", [])
    
    # Filter to flyable hours if sunrise/sunset available
    flyable_consensus = consensus_data
    sunrise_time = day_result.get("sunrise")
    sunset_time = day_result.get("sunset")
    
    if sunrise_time and sunset_time:
        try:
            sunrise_hour = int(sunrise_time.split(':')[0])
            sunset_hour = int(sunset_time.split(':')[0])
            flyable_consensus = [h for h in consensus_data if sunrise_hour <= h.get('hour', 0) <= sunset_hour]
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
async def get_daily_summary(
    spot_id: str, 
    days: int = 7, 
    db: Session = Depends(get_db)
):
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
    # Get the site
    site = db.query(Site).filter(Site.id == spot_id).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Site not found: {spot_id}")
    
    # Default wind limits for paragliding (if not set on site)
    # Standard values: 10-30 km/h (2.8-8.3 m/s)
    min_wind_ms = getattr(site, 'min_wind_ms', 2.8)  # 10 km/h
    max_wind_ms = getattr(site, 'max_wind_ms', 8.3)  # 30 km/h
    optimal_dirs = getattr(site, 'optimal_directions', 'N,NE,E,SE,S,SW,W,NW')  # All directions
    
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
                elevation_m=site.elevation_m
            )
        )
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Format response
    summary_days = []
    for idx, day_result in enumerate(results):
        # Skip failed days
        if isinstance(day_result, Exception):
            logger.warning(f"Day {idx} failed for {spot_id}: {day_result}")
            continue
        
        if day_result:
            summary_days.append({
                "day_index": idx,
                "date": day_result["date"],
                "para_index": day_result["para_index"],
                "verdict": day_result["verdict"],
                "emoji": day_result["emoji"],
                "temp_min": day_result["temp_min"],
                "temp_max": day_result["temp_max"],
                "wind_avg": day_result["wind_avg"],
            })
    
    if not summary_days:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch daily summary for {site.name}"
        )
    
    return {
        "site_id": spot_id,
        "site_name": site.name,
        "days": summary_days
    }

# Flights endpoints
@router.get("/flights")
def get_flights(
    limit: int = 10,
    site_id: Optional[str] = None,
    date_from: Optional[str] = None,  # YYYY-MM-DD
    date_to: Optional[str] = None,
    db: Session = Depends(get_db)
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
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date_from format: {date_from}. Use YYYY-MM-DD")
    if date_to:
        try:
            to_date = datetime.strptime(date_to, "%Y-%m-%d").date()
            query = query.filter(Flight.flight_date <= to_date)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date_to format: {date_to}. Use YYYY-MM-DD")
    
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
            "updated_at": flight.updated_at.isoformat() if flight.updated_at else None
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
            "last_flight_date": None
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
    spot_counts = db.query(
        Site.name,
        func.count(Flight.id).label('count')
    ).join(Flight).group_by(Site.name).order_by(func.count(Flight.id).desc()).first()
    
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
        "last_flight_date": last_flight_date
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
            "max_speed": None
        }
    
    # Filter out None values and find records
    flights_with_duration = [f for f in flights if f.duration_minutes is not None]
    flights_with_altitude = [f for f in flights if f.max_altitude_m is not None]
    flights_with_distance = [f for f in flights if f.distance_km is not None]
    flights_with_speed = [f for f in flights if f.max_speed_kmh is not None and f.max_speed_kmh > 0]
    
    # Find records
    longest = max(flights_with_duration, key=lambda f: f.duration_minutes) if flights_with_duration else None
    highest = max(flights_with_altitude, key=lambda f: f.max_altitude_m) if flights_with_altitude else None
    farthest = max(flights_with_distance, key=lambda f: f.distance_km) if flights_with_distance else None
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
            "site_id": flight.site_id
        }
    
    return {
        "longest_duration": format_record(longest, "duration_minutes"),
        "highest_altitude": format_record(highest, "max_altitude_m"),
        "longest_distance": format_record(farthest, "distance_km"),
        "max_speed": format_record(fastest, "max_speed_kmh")
    }

@router.get("/flights/{flight_id}")
def get_flight(flight_id: str, db: Session = Depends(get_db)):
    """Get a specific flight"""
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    return flight

@router.patch("/flights/{flight_id}")
async def update_flight(
    flight_id: str,
    flight_data: FlightUpdate,
    db: Session = Depends(get_db)
):
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
                status_code=404, 
                detail=f"Site with ID '{flight_data.site_id}' not found"
            )
    
    # 3. Update only provided fields (exclude_unset skips None values)
    update_data = flight_data.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(flight, field, value)
    
    # 4. updated_at is handled automatically by SQLAlchemy
    
    try:
        db.commit()
        db.refresh(flight)
        logger.info(f"✅ Updated flight {flight_id}: {list(update_data.keys())}")
        
        # Return in the format expected by frontend (ApiResponseSchema)
        return {
            "data": flight,
            "status": "success",
            "message": "Flight updated successfully"
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update flight {flight_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")

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
                "flight_duration_seconds": stats["flight_duration_seconds"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse GPX file: {str(e)}")

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
            "file_exists": gpx_path.exists()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse GPX file: {str(e)}")

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
    
    filename = f"{flight.title.replace(' ', '_') if flight.title else 'flight'}_{flight.flight_date}.gpx"
    return FileResponse(
        path=gpx_path,
        media_type="application/gpx+xml",
        filename=filename
    )

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
async def sync_strava_activities(
    request: dict,
    db: Session = Depends(get_db)
):
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
    from strava import get_activities_by_period, download_gpx, save_gpx_file
    
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
                activity_date = datetime.strptime(
                    start_date_local.split("T")[0],
                    "%Y-%m-%d"
                ).date()
                
                # Heure de départ (datetime complet)
                departure_time = None
                if start_date_local:
                    try:
                        departure_time = datetime.fromisoformat(start_date_local.replace("Z", "+00:00"))
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
                    max_altitude_m=int(activity.get("elev_high", 0)) if activity.get("elev_high") else None,
                    distance_km=round(activity.get("distance", 0) / 1000, 2),
                    elevation_gain_m=int(activity.get("total_elevation_gain", 0)) if activity.get("total_elevation_gain") else None,
                    gpx_file_path=gpx_path,
                    external_url=f"https://www.strava.com/activities/{strava_id}",
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                
                db.add(flight)
                imported_flights.append({
                    "id": flight.id,
                    "strava_id": strava_id,
                    "title": flight.title,
                    "date": str(activity_date)
                })
                
                logger.info(f"✅ Imported: {flight.title} (Strava ID: {strava_id})")
            
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
            "flights": imported_flights
        }
    
    except Exception as e:
        logger.error(f"Sync failed: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.post("/flights/{flight_id}/upload-gpx")
async def upload_gpx_to_flight(
    flight_id: str,
    gpx_file: UploadFile = File(...),
    db: Session = Depends(get_db)
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
        
        logger.info(f"✅ Added GPX file to flight {flight_id} (stats unchanged)")
        
        return {
            "success": True,
            "flight_id": flight.id,
            "gpx_file_path": flight.gpx_file_path,
            "message": "GPX file added successfully. Flight stats unchanged."
        }
    
    except Exception as e:
        logger.error(f"Failed to upload GPX to flight {flight_id}: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/flights/create-from-gpx")
async def create_flight_from_gpx(
    gpx_file: UploadFile = File(...),
    site_id: Optional[str] = None,
    db: Session = Depends(get_db)
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
        file_extension = filename.lower().split('.')[-1] if '.' in filename else ''
        
        # Détection automatique du format
        is_igc = file_extension == 'igc' or file_str.strip().startswith(('A', 'H'))
        
        if is_igc:
            print(f"🔍 DEBUG Detected IGC file: {filename}")
            coordinates = parse_igc_file_from_string(file_str)
            file_type = "igc"
        else:
            print(f"🔍 DEBUG Detected GPX file: {filename}")
            coordinates = parse_gpx_file_from_string(file_str)
            file_type = "gpx"
        
        if not coordinates:
            raise HTTPException(status_code=400, detail=f"Invalid {file_type.upper()} file: no trackpoints found")
        
        # 3. Calculer les statistiques
        stats = calculate_gpx_stats(coordinates)
        
        # 4. Déterminer le site si pas fourni
        if not site_id and coordinates:
            # Essayer de matcher le site par coordonnées GPS du premier point
            sites = db.query(Site).all()
            sites_data = [
                {
                    "id": s.id,
                    "name": s.name,
                    "latitude": s.latitude,
                    "longitude": s.longitude
                }
                for s in sites if s.latitude and s.longitude
            ]
            
            first_coord = coordinates[0]
            from strava import match_site_by_coordinates
            site_id = match_site_by_coordinates(
                first_coord["lat"],
                first_coord["lon"],
                sites_data
            )
        
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
                
                print(f"🔍 DEBUG Date/Time - UTC: {departure_datetime_utc}, Local: {departure_time}, Name: {flight_name}")
        
        flight = Flight(
            id=flight_id,
            site_id=site_id,
            name=flight_name,
            title=flight_name,
            flight_date=flight_date,
            departure_time=departure_time,
            duration_minutes=int(stats.get("flight_duration_seconds", 0) / 60) if stats.get("flight_duration_seconds") else None,
            max_altitude_m=stats.get("max_altitude_m"),
            distance_km=stats.get("total_distance_km"),
            elevation_gain_m=stats.get("elevation_gain_m"),
            max_speed_kmh=stats.get("max_speed_kmh", 0),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
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
        
        logger.info(f"✅ Created new flight from {file_type.upper()}: {flight.name} (ID: {flight_id})")
        
        # 8. Retourner le vol créé
        return {
            "success": True,
            "flight_id": flight.id,
            "flight": {
                "id": flight.id,
                "name": flight.name,
                "title": flight.title,
                "flight_date": flight.flight_date.isoformat(),
                "departure_time": flight.departure_time.isoformat() if flight.departure_time else None,
                "duration_minutes": flight.duration_minutes,
                "max_altitude_m": flight.max_altitude_m,
                "distance_km": flight.distance_km,
                "elevation_gain_m": flight.elevation_gain_m,
                "max_speed_kmh": flight.max_speed_kmh,
                "site_id": flight.site_id,
                "gpx_file_path": flight.gpx_file_path
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create flight from GPX: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create flight: {str(e)}")


@router.delete("/flights/{flight_id}")
async def delete_flight(
    flight_id: str,
    db: Session = Depends(get_db)
):
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
        
        logger.info(f"✅ Deleted flight: {flight_title} (ID: {flight_id})")
        
        return {
            "success": True,
            "message": f"Flight '{flight_title}' deleted successfully"
        }
    
    except Exception as e:
        logger.error(f"Failed to delete flight {flight_id}: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


# Alerts endpoints
@router.get("/alerts")
def get_alerts(spot_id: Optional[str] = None, active: bool = False, db: Session = Depends(get_db)):
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
            recent_forecast = db.query(WeatherForecast).filter(
                WeatherForecast.site_id == spot_id,
                WeatherForecast.forecast_date >= date.today()
            ).first()
            
            if recent_forecast:
                # Generate alert based on conditions
                if recent_forecast.para_index and recent_forecast.para_index < 30:
                    alerts.append({
                        "id": str(uuid.uuid4()),
                        "type": "weather",
                        "severity": "warning",
                        "title": "Poor Flying Conditions",
                        "message": f"{site.name}: Para-Index {recent_forecast.para_index}/100 - {recent_forecast.verdict}",
                        "spot_id": spot_id,
                        "created_at": datetime.utcnow().isoformat(),
                        "expires_at": (datetime.utcnow() + timedelta(hours=6)).isoformat()
                    })
                
                if recent_forecast.wind_max_kmh and recent_forecast.wind_max_kmh > 30:
                    alerts.append({
                        "id": str(uuid.uuid4()),
                        "type": "wind",
                        "severity": "danger",
                        "title": "Strong Wind Warning",
                        "message": f"{site.name}: Wind gusts up to {recent_forecast.wind_max_kmh} km/h expected",
                        "spot_id": spot_id,
                        "created_at": datetime.utcnow().isoformat(),
                        "expires_at": (datetime.utcnow() + timedelta(hours=6)).isoformat()
                    })
    
    return alerts

@router.post("/alerts")
def create_alert(alert_data: dict, db: Session = Depends(get_db)):
    """Create a custom alert (future: user-defined alerts)"""
    # For now, just return acknowledgment
    # In production, would store in Alert model
    return {
        "id": str(uuid.uuid4()),
        "status": "created",
        "message": "Alert created successfully"
    }

# Health check
@router.get("/health")
def health_check():
    return {"status": "ok", "message": "Dashboard API healthy"}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def parse_igc_file_from_string(igc_content: str) -> List[Dict]:
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
    for line in igc_content.split('\n'):
        line = line.strip()
        
        # Parse date from HFDTE record
        if line.startswith('HFDTE') or line.startswith('HFDTEDATE'):
            # Format: HFDTEDATE:140825,03 or HFDTE140825
            date_part = line.split(':')[-1] if ':' in line else line[5:]
            date_str = date_part.split(',')[0]  # Remove flight number if present
            
            if len(date_str) >= 6:
                day = int(date_str[0:2])
                month = int(date_str[2:4])
                year = int(date_str[4:6])
                # IGC uses 2-digit year, assume 20XX for years < 50, else 19XX
                year = 2000 + year if year < 50 else 1900 + year
                flight_date = date(year, month, day)
                print(f"🔍 DEBUG IGC - Found date: {flight_date}")
        
        # Parse B-records (GPS fixes)
        elif line.startswith('B') and len(line) >= 35:
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
                if lat_hem == 'S':
                    latitude = -latitude
                
                # Longitude: DDDMMmmmE/W
                lon_deg = int(line[15:18])
                lon_min = int(line[18:20])
                lon_min_dec = int(line[20:23])
                lon_hem = line[23]
                longitude = lon_deg + (lon_min + lon_min_dec / 1000.0) / 60.0
                if lon_hem == 'W':
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
                        hours, minutes, seconds,
                        tzinfo=ZoneInfo("UTC")
                    )
                    timestamp = int(flight_datetime.timestamp() * 1000)
                else:
                    timestamp = 0
                
                coordinates.append({
                    "lat": latitude,
                    "lon": longitude,
                    "elevation": gps_alt,
                    "timestamp": timestamp
                })
                
            except (ValueError, IndexError) as e:
                # Skip malformed B-records
                print(f"⚠️ DEBUG IGC - Skipping malformed B-record: {e}")
                continue
    
    print(f"🔍 DEBUG Parse IGC - Found {len(coordinates)} trackpoints")
    if coordinates:
        print(f"🔍 DEBUG First coord - lat:{coordinates[0]['lat']:.6f}, lon:{coordinates[0]['lon']:.6f}, ele:{coordinates[0]['elevation']}m")
    
    return coordinates


def parse_gpx_file_from_string(gpx_content: str) -> List[Dict]:
    """
    Parse GPX content from string and extract coordinates with timestamps
    Returns list of {lat, lon, elevation, timestamp}
    """
    root = ET.fromstring(gpx_content)
    
    # Handle GPX namespace
    ns = {'gpx': 'http://www.topografix.com/GPX/1/1'}
    
    coordinates = []
    
    # Find all track points - try with namespace first, then without
    trkpts = root.findall('.//gpx:trkpt', ns)
    if not trkpts:
        trkpts = root.findall('.//trkpt')
        ns = {}  # No namespace
    
    print(f"🔍 DEBUG Parse GPX - Found {len(trkpts)} trackpoints")
    
    for trkpt in trkpts:
        lat = float(trkpt.get('lat', 0))
        lon = float(trkpt.get('lon', 0))
        
        # Get elevation - try with namespace first, then without
        ele_elem = trkpt.find('gpx:ele', ns) if ns else None
        if ele_elem is None:
            ele_elem = trkpt.find('ele')
        elevation = float(ele_elem.text) if ele_elem is not None and ele_elem.text else 0
        
        # Get timestamp - try with namespace first, then without
        time_elem = trkpt.find('gpx:time', ns) if ns else None
        if time_elem is None:
            time_elem = trkpt.find('time')
            
        if time_elem is not None and time_elem.text:
            try:
                dt = datetime.fromisoformat(time_elem.text.replace('Z', '+00:00'))
                timestamp = int(dt.timestamp() * 1000)  # milliseconds
            except Exception as e:
                print(f"⚠️ DEBUG Parse time failed: {e}")
                timestamp = 0
        else:
            timestamp = 0
        
        coordinates.append({
            "lat": lat,
            "lon": lon,
            "elevation": elevation,
            "timestamp": timestamp
        })
    
    if coordinates:
        print(f"🔍 DEBUG GPX Parse - ele:{coordinates[0]['elevation']}m, ts:{coordinates[0]['timestamp']}")
        all_zero = all(c["timestamp"] == 0 for c in coordinates)
        print(f"🔍 DEBUG GPX Parse - All timestamps zero: {all_zero}")
    
    return coordinates


def parse_gpx_file(gpx_path: Path) -> List[Dict]:
    """
    Parse GPX or IGC file and extract coordinates with timestamps
    Returns list of {lat, lon, elevation, timestamp}
    
    Automatically detects file format based on extension and content
    """
    # Read file content
    with open(gpx_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # Detect IGC format by extension or content
    is_igc = (
        gpx_path.suffix.lower() == '.igc' or 
        content.strip().startswith(('A', 'H'))  # IGC files start with A or H records
    )
    
    if is_igc:
        # Parse as IGC file
        print(f"🔍 DEBUG - Detected IGC file: {gpx_path.name}")
        return parse_igc_file_from_string(content)
    else:
        # Parse as GPX file (XML)
        print(f"🔍 DEBUG - Detected GPX file: {gpx_path.name}")
        return parse_gpx_file_from_string(content)


def calculate_max_speed(coordinates: List[Dict]) -> float:
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
        if coordinates[i]["timestamp"] == 0 or coordinates[i-1]["timestamp"] == 0:
            continue
        
        # Calculate distance in km
        distance_km = haversine_distance(
            coordinates[i-1]["lat"], coordinates[i-1]["lon"],
            coordinates[i]["lat"], coordinates[i]["lon"]
        )
        
        # Calculate time in hours
        time_ms = coordinates[i]["timestamp"] - coordinates[i-1]["timestamp"]
        time_hours = time_ms / (1000 * 3600)
        
        # Calculate speed (avoid division by zero)
        if time_hours > 0:
            speed_kmh = distance_km / time_hours
            # Filter out unrealistic speeds (>150 km/h for paragliding)
            if speed_kmh < 150:
                max_speed = max(max_speed, speed_kmh)
    
    return round(max_speed, 2)


def calculate_gpx_stats(coordinates: List[Dict]) -> Dict:
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
            "last_trackpoint": None
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
        diff = coordinates[i]["elevation"] - coordinates[i-1]["elevation"]
        if diff > 0:
            elevation_gain += diff
        else:
            elevation_loss += abs(diff)
    
    # Calculate total distance using Haversine formula
    total_distance = 0
    for i in range(1, len(coordinates)):
        dist = haversine_distance(
            coordinates[i-1]["lat"], coordinates[i-1]["lon"],
            coordinates[i]["lat"], coordinates[i]["lon"]
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
            "elevation": coordinates[0]["elevation"]
        }
    
    if coordinates[-1]["timestamp"] > 0:
        last_trackpoint = {
            "time": datetime.fromtimestamp(coordinates[-1]["timestamp"] / 1000),
            "lat": coordinates[-1]["lat"],
            "lon": coordinates[-1]["lon"],
            "elevation": coordinates[-1]["elevation"]
        }
    
    print(f"🔍 DEBUG First trackpoint time: {first_trackpoint['time'] if first_trackpoint else 'None'}")
    print(f"🔍 DEBUG Last trackpoint time: {last_trackpoint['time'] if last_trackpoint else 'None'}")
    
    return {
        "max_altitude_m": round(max_alt),
        "min_altitude_m": round(min_alt),
        "elevation_gain_m": round(elevation_gain),
        "elevation_loss_m": round(elevation_loss),
        "total_distance_km": round(total_distance, 2),
        "flight_duration_seconds": round(duration_seconds),
        "max_speed_kmh": max_speed,
        "first_trackpoint": first_trackpoint,
        "last_trackpoint": last_trackpoint
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
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c
