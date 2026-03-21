"""
Strava Webhook Handler
- Validate webhook signatures
- Download GPX from Strava
- Parse and store flight data
- Send Telegram notifications

✨ AMÉLIORATION: Utilise les données de l'API Strava directement (pas le GPX parsing)
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
import hmac
import hashlib
import uuid
from datetime import datetime, date
import logging
from pathlib import Path
from typing import Optional

from database import get_db, SessionLocal
from models import Flight, Site
from strava import download_gpx, parse_gpx, get_activity_details
from routes import calculate_max_speed, parse_gpx_file_from_string
from config import STRAVA_VERIFY_TOKEN, STRAVA_CLIENT_SECRET, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("/strava")
async def strava_webhook_verification(
    request: Request,
    hub_mode: str = None,
    hub_verify_token: str = None,
    hub_challenge: str = None
):
    """
    Strava webhook verification (GET request)
    Called by Strava when setting up the webhook
    
    Example: GET /webhooks/strava?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=YYY
    """
    logger.info(f"Webhook verification request: mode={hub_mode}, token={hub_verify_token}")
    
    # Validate
    if hub_mode != "subscribe":
        raise HTTPException(status_code=400, detail="Invalid hub.mode")
    
    if hub_verify_token != STRAVA_VERIFY_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid verify token")
    
    # Return challenge
    return {"hub.challenge": hub_challenge}


@router.post("/strava")
async def strava_webhook_handler(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Strava webhook handler (POST request)
    Called by Strava when an activity is created/updated/deleted
    
    Payload structure:
    {
        "aspect_type": "create",  # or "update", "delete"
        "event_time": 1234567890,
        "object_id": 123456,  # activity ID
        "object_type": "activity",
        "owner_id": 789,
        "subscription_id": 1
    }
    """
    # Read request body
    body = await request.body()
    
    # Validate signature (optional but recommended)
    if STRAVA_CLIENT_SECRET:
        signature = request.headers.get("X-Hub-Signature")
        if signature:
            expected = hmac.new(
                STRAVA_CLIENT_SECRET.encode(),
                body,
                hashlib.sha256
            ).hexdigest()
            
            if signature != f"sha256={expected}":
                logger.warning("Invalid webhook signature")
                raise HTTPException(status_code=403, detail="Invalid signature")
    
    # Parse JSON
    try:
        data = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse webhook payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    logger.info(f"Strava webhook received: {data}")
    
    # Only process activity creations
    if data.get("object_type") != "activity":
        logger.info("Not an activity event, ignoring")
        return {"status": "ok", "message": "Not an activity"}
    
    if data.get("aspect_type") not in ["create", "update"]:
        logger.info(f"Aspect type {data.get('aspect_type')} ignored")
        return {"status": "ok", "message": "Not a create/update event"}
    
    activity_id = str(data.get("object_id"))
    
    # Process activity asynchronously (don't block webhook response)
    import asyncio
    asyncio.create_task(process_strava_activity(activity_id, db=db))
    
    return {"status": "ok", "message": f"Processing activity {activity_id}"}


async def process_strava_activity(activity_id: str, db: Session = None):
    """
    Process a Strava activity using API data directly
    
    ✨ NEW APPROACH:
    - Use Strava API for: distance, elevation, time, location
    - GPX only for: 3D map visualization + departure coordinates
    
    Steps:
    1. Get activity details from Strava API (has ALL metadata!)
    2. Extract location from activity.name or location_city
    3. Parse start_date_local for datetime
    4. Format name: "Lieu JJ-MM HHhMM"
    5. Download GPX only for map + coordinates
    6. Match site_id from coordinates or name
    7. Store in database with API data
    8. Send Telegram notification
    """
    # Use provided db or create new one
    if db is None:
        db = SessionLocal()
        close_db = True
    else:
        close_db = False
    
    try:
        logger.info(f"🪂 Processing Strava activity {activity_id}...")
        
        # Step 1: Get activity details from API
        activity = await get_activity_details(activity_id)
        
        if not activity:
            logger.error(f"❌ Failed to get activity details for {activity_id}")
            return
        
        # Check if it's a paragliding activity
        activity_type = activity.get("type", "")
        if activity_type not in ["Flight", "Workout", "Ride"]:
            logger.info(f"⚠️ Activity {activity_id} is not a flight (type={activity_type}), ignoring")
            return
        
        # Check if activity already exists
        existing = db.query(Flight).filter(Flight.strava_id == activity_id).first()
        
        if existing:
            logger.info(f"📝 Activity {activity_id} already exists, updating...")
        
        # Step 2: Extract data from API (NOT from GPX!)
        
        # Activity name (e.g. "Vol Arguel" or "Afternoon Workout")
        activity_name = activity.get("name", "")
        
        # Location
        location_city = activity.get("location_city", "")
        location_country = activity.get("location_country", "")
        
        # Extract location from name
        location = extract_location_from_name(activity_name, location_city)
        
        # Date/time from API
        start_date_local = activity.get("start_date_local", "")
        if start_date_local:
            # Parse ISO format: "2025-09-27T17:08:00Z"
            dt = datetime.fromisoformat(start_date_local.replace("Z", ""))
            flight_date = dt.date()
            departure_time = dt
        else:
            dt = datetime.now()
            flight_date = dt.date()
            departure_time = None
        
        # Metrics from API
        distance_meters = activity.get("distance", 0)
        distance_km = round(distance_meters / 1000, 2) if distance_meters else None
        
        elapsed_time_seconds = activity.get("elapsed_time", 0)
        duration_minutes = elapsed_time_seconds // 60 if elapsed_time_seconds else None
        
        # Elevation from API
        elevation_gain_m = activity.get("total_elevation_gain")
        if elevation_gain_m is not None:
            elevation_gain_m = int(elevation_gain_m)
        
        # Max altitude from API
        max_altitude_m = activity.get("elev_high")
        if max_altitude_m is not None:
            max_altitude_m = int(max_altitude_m)
        
        # Step 3: Download GPX for 3D map + coordinates
        gpx_file_path = None
        site_id = None
        departure_lat = None
        departure_lon = None
        
        gpx_content = await download_gpx(activity_id)
        
        if gpx_content:
            # Save GPX to file for 3D visualization
            gpx_dir = Path("db/gpx")
            gpx_dir.mkdir(parents=True, exist_ok=True)
            gpx_file_path = f"db/gpx/strava_{activity_id}.gpx"
            
            with open(gpx_file_path, "w") as f:
                f.write(gpx_content)
            
            logger.info(f"✅ Saved GPX to {gpx_file_path}")
            
            # Parse GPX for coordinates and calculate stats
            gpx_data = parse_gpx(gpx_content)
            max_speed_kmh = 0.0  # Default value
            
            if gpx_data.get("success"):
                first_trackpoint = gpx_data.get("first_trackpoint", {})
                departure_lat = first_trackpoint.get("lat")
                departure_lon = first_trackpoint.get("lon")
                
                # Use GPX altitude if API didn't provide it
                if max_altitude_m is None:
                    max_altitude_m = gpx_data.get("max_altitude_m")
                    logger.info(f"Using max_altitude from GPX: {max_altitude_m}m")
                
                # Use GPX elevation gain if API didn't provide it
                if elevation_gain_m is None:
                    elevation_gain_m = gpx_data.get("elevation_gain_m")
                    logger.info(f"Using elevation_gain from GPX: {elevation_gain_m}m")
                
                # Calculate max speed from full GPX coordinates
                try:
                    coordinates = parse_gpx_file_from_string(gpx_content)
                    if coordinates and len(coordinates) > 1:
                        max_speed_kmh = calculate_max_speed(coordinates)
                        logger.info(f"Calculated max_speed from GPX: {max_speed_kmh} km/h")
                except Exception as e:
                    logger.warning(f"Failed to calculate max speed: {e}")
                    max_speed_kmh = 0.0
        else:
            logger.warning(f"⚠️ Could not download GPX for activity {activity_id}")
        
        # Step 4: Try to match site_id
        if departure_lat and departure_lon:
            # Match by coordinates
            site_id = match_site_by_coordinates(db, departure_lat, departure_lon)
            if site_id:
                matched_site = db.query(Site).filter(Site.id == site_id).first()
                if matched_site:
                    location = matched_site.name
        else:
            # Match by name
            site_id = match_site_by_name(db, location, location_city)
            if site_id:
                matched_site = db.query(Site).filter(Site.id == site_id).first()
                if matched_site:
                    location = matched_site.name
        
        # Step 5: Format flight name
        # Format: "Lieu JJ-MM HHhMM" (ex: "Arguel 27-09 17h08")
        flight_name = format_flight_name(location, dt)
        
        # Step 6: Store in database
        if existing:
            # Update existing flight
            existing.name = flight_name
            existing.title = activity_name
            existing.site_id = site_id
            existing.flight_date = flight_date
            existing.departure_time = departure_time
            existing.duration_minutes = duration_minutes
            existing.max_altitude_m = max_altitude_m
            existing.max_speed_kmh = max_speed_kmh
            existing.distance_km = distance_km
            existing.elevation_gain_m = elevation_gain_m
            existing.gpx_file_path = gpx_file_path
            existing.gpx_max_altitude_m = max_altitude_m
            existing.gpx_elevation_gain_m = elevation_gain_m
            existing.updated_at = datetime.now()
            
            logger.info(f"✅ Updated flight {existing.id}: {flight_name}")
            
            flight = existing
        else:
            # Create new flight
            flight = Flight(
                id=str(uuid.uuid4()),
                strava_id=activity_id,
                name=flight_name,
                title=activity_name,
                site_id=site_id,
                flight_date=flight_date,
                departure_time=departure_time,
                duration_minutes=duration_minutes,
                max_altitude_m=max_altitude_m,
                max_speed_kmh=max_speed_kmh,
                distance_km=distance_km,
                elevation_gain_m=elevation_gain_m,
                gpx_file_path=gpx_file_path,
                gpx_max_altitude_m=max_altitude_m,
                gpx_elevation_gain_m=elevation_gain_m,
                external_url=f"https://www.strava.com/activities/{activity_id}",
                created_at=datetime.now()
            )
            
            db.add(flight)
            
            logger.info(f"✅ Created flight {flight.id}: {flight_name}")
        
        db.commit()
        
        # Trigger automatic video export if GPX available
        if gpx_file_path:
            try:
                from video_export_manual import trigger_auto_export
                from config import settings
                frontend_url = f"http://localhost:{settings.PORT}"
                trigger_auto_export(flight.id, db, frontend_url)
            except Exception as e:
                logger.warning(f"Failed to trigger auto video export: {e}")
        db.refresh(flight)
        
        # Step 7: Send Telegram notification
        await send_telegram_notification(flight, is_new=not existing)
        
    except Exception as e:
        logger.error(f"❌ Error processing Strava activity {activity_id}: {e}", exc_info=True)
        db.rollback()
    finally:
        if close_db:
            db.close()


def extract_location_from_name(activity_name: str, location_city: str) -> str:
    """
    Extract location from activity name
    
    Examples:
    - "Vol Arguel" → "Arguel"
    - "Afternoon Workout" → location_city
    - "Morning Flight" → location_city
    
    Args:
        activity_name: Strava activity name
        location_city: City from Strava API
    
    Returns:
        Extracted location name
    """
    if not activity_name:
        return location_city or "Inconnu"
    
    # Remove common prefixes
    name = activity_name.strip()
    
    prefixes = ["Vol ", "Flight ", "Morning ", "Afternoon ", "Evening ", "Workout "]
    for prefix in prefixes:
        if name.startswith(prefix):
            name = name[len(prefix):].strip()
            break
    
    # List of generic words that should not be used as location
    generic_words = ["Workout", "Flight", "Run", "Ride", "Activity", "Exercise"]
    
    # If name is meaningful and not generic, use it; otherwise fall back to city
    if name and len(name) > 2 and name not in generic_words:
        return name
    
    return location_city or "Inconnu"


def match_site_by_name(db: Session, location: str, location_city: str) -> Optional[str]:
    """
    Try to match a site based on location name
    
    Args:
        db: Database session
        location: Extracted location name
        location_city: City from Strava API
    
    Returns:
        Site ID if found, None otherwise
    """
    if not location and not location_city:
        return None
    
    # Try exact match on site name
    site = db.query(Site).filter(
        Site.name.ilike(f"%{location}%")
    ).first()
    
    if site:
        logger.info(f"✅ Matched site by name: {site.name} (ID: {site.id})")
        return site.id
    
    # Try match on city
    if location_city:
        site = db.query(Site).filter(
            Site.name.ilike(f"%{location_city}%")
        ).first()
        
        if site:
            logger.info(f"✅ Matched site by city: {site.name} (ID: {site.id})")
            return site.id
    
    logger.info(f"No site matched for location: {location}")
    return None


def match_site_by_coordinates(db: Session, lat: float, lon: float, threshold_km: float = 5.0) -> Optional[str]:
    """
    Match site by proximity to coordinates
    
    Args:
        db: Database session
        lat: Latitude
        lon: Longitude
        threshold_km: Max distance in km to consider a match
    
    Returns:
        Site ID if found within threshold, None otherwise
    """
    from math import radians, cos, sin, asin, sqrt
    
    def haversine(lat1, lon1, lat2, lon2):
        """Calculate distance between two points on Earth (in km)"""
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        km = 6371 * c
        return km
    
    sites = db.query(Site).filter(
        Site.latitude.isnot(None),
        Site.longitude.isnot(None)
    ).all()
    
    closest_site = None
    min_distance = float('inf')
    
    for site in sites:
        distance = haversine(lat, lon, site.latitude, site.longitude)
        if distance < min_distance:
            min_distance = distance
            closest_site = site
    
    if closest_site and min_distance <= threshold_km:
        logger.info(f"✅ Matched site by coordinates: {closest_site.name} ({min_distance:.2f}km away)")
        return closest_site.id
    
    logger.info(f"No site found within {threshold_km}km of ({lat}, {lon})")
    return None


def format_flight_name(location: str, dt: datetime) -> str:
    """
    Format flight name: "Lieu JJ-MM HHhMM"
    
    Examples:
    - "Arguel 27-09 17h08"
    - "La Côte 15-02 14h32"
    
    Args:
        location: Location name
        dt: Departure datetime
    
    Returns:
        Formatted flight name
    """
    day = dt.strftime("%d-%m")
    time = dt.strftime("%Hh%M")
    
    return f"{location} {day} {time}"


async def send_telegram_notification(flight: Flight, is_new: bool = True):
    """
    Send Telegram notification for a new/updated flight
    
    Args:
        flight: Flight object
        is_new: True if new flight, False if update
    """
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning("Telegram not configured, skipping notification")
        return
    
    try:
        import httpx
        
        # Build message
        action = "🆕 NOUVEAU VOL" if is_new else "📝 VOL MIS À JOUR"
        
        message = f"{action}\n\n"
        message += f"🪂 *{flight.name}*\n"  # Use formatted name!
        message += f"📅 {flight.flight_date.strftime('%d/%m/%Y')}\n"
        
        if flight.duration_minutes:
            hours = flight.duration_minutes // 60
            minutes = flight.duration_minutes % 60
            message += f"⏱️ Durée: {hours}h{minutes:02d}\n"
        
        if flight.max_altitude_m:
            message += f"⛰️ Altitude max: {flight.max_altitude_m}m\n"
        
        if flight.elevation_gain_m:
            message += f"📈 Dénivelé: {flight.elevation_gain_m}m\n"
        
        if flight.distance_km:
            message += f"📏 Distance: {flight.distance_km}km\n"
        
        if flight.external_url:
            message += f"\n🔗 [Voir sur Strava]({flight.external_url})"
        
        # Send via Telegram Bot API
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json={
                    "chat_id": TELEGRAM_CHAT_ID,
                    "text": message,
                    "parse_mode": "Markdown"
                }
            )
            
            response.raise_for_status()
        
        logger.info(f"✅ Telegram notification sent for flight {flight.id}")
    
    except Exception as e:
        logger.error(f"Failed to send Telegram notification: {e}")
