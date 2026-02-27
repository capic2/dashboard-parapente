"""
Strava Webhook Handler
- Validate webhook signatures
- Download GPX from Strava
- Parse and store flight data
- Send Telegram notifications
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
import hmac
import hashlib
import uuid
from datetime import datetime, date
import logging
import os

from database import get_db, SessionLocal
from models import Flight, Site
from strava import download_gpx, parse_gpx, get_activity_details

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Strava webhook verification token
STRAVA_VERIFY_TOKEN = os.getenv("STRAVA_VERIFY_TOKEN", "PARAPENTE_2025")
STRAVA_CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET", "")

# Telegram notification settings
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "721260037")  # Vincent's ID


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
    asyncio.create_task(process_strava_activity(activity_id))
    
    return {"status": "ok", "message": f"Processing activity {activity_id}"}


async def process_strava_activity(activity_id: str):
    """
    Process a Strava activity in the background
    
    Steps:
    1. Get activity details from Strava API
    2. Download GPX
    3. Parse GPX
    4. Store in database
    5. Send Telegram notification
    """
    db = SessionLocal()
    
    try:
        logger.info(f"Processing Strava activity {activity_id}...")
        
        # Step 1: Get activity details
        activity = await get_activity_details(activity_id)
        
        if not activity:
            logger.error(f"Failed to get activity details for {activity_id}")
            return
        
        # Check if it's a paragliding activity
        activity_type = activity.get("type", "")
        if activity_type not in ["Flight", "Workout", "Ride"]:  # Strava sometimes uses these
            logger.info(f"Activity {activity_id} is not a flight (type={activity_type}), ignoring")
            return
        
        # Check if activity already exists
        existing = db.query(Flight).filter(Flight.strava_id == activity_id).first()
        
        if existing:
            logger.info(f"Activity {activity_id} already exists, updating...")
        
        # Step 2: Download GPX
        gpx_content = await download_gpx(activity_id)
        
        if not gpx_content:
            logger.error(f"Failed to download GPX for activity {activity_id}")
            return
        
        # Step 3: Parse GPX
        gpx_data = parse_gpx(gpx_content)
        
        if not gpx_data.get("success"):
            logger.error(f"Failed to parse GPX for activity {activity_id}: {gpx_data.get('error')}")
            return
        
        # Extract data
        max_altitude = gpx_data.get("max_altitude_m")
        elevation_gain = gpx_data.get("elevation_gain_m")
        
        # Get activity metadata
        title = activity.get("name", f"Vol du {datetime.now().strftime('%Y-%m-%d')}")
        start_date = activity.get("start_date_local", "")
        
        if start_date:
            flight_date = datetime.fromisoformat(start_date.replace("Z", "")).date()
        else:
            flight_date = date.today()
        
        duration_seconds = activity.get("elapsed_time", 0)
        duration_minutes = duration_seconds // 60 if duration_seconds else None
        
        distance_meters = activity.get("distance", 0)
        distance_km = round(distance_meters / 1000, 2) if distance_meters else None
        
        # Step 4: Store in database
        if existing:
            # Update existing flight
            existing.title = title
            existing.flight_date = flight_date
            existing.duration_minutes = duration_minutes
            existing.max_altitude_m = max_altitude
            existing.distance_km = distance_km
            existing.elevation_gain_m = elevation_gain
            existing.gpx_max_altitude_m = max_altitude
            existing.gpx_elevation_gain_m = elevation_gain
            existing.updated_at = datetime.now()
            
            logger.info(f"✅ Updated flight {existing.id} from Strava activity {activity_id}")
            
            flight = existing
        else:
            # Create new flight
            flight = Flight(
                id=str(uuid.uuid4()),
                strava_id=activity_id,
                title=title,
                flight_date=flight_date,
                duration_minutes=duration_minutes,
                max_altitude_m=max_altitude,
                distance_km=distance_km,
                elevation_gain_m=elevation_gain,
                gpx_max_altitude_m=max_altitude,
                gpx_elevation_gain_m=elevation_gain,
                external_url=f"https://www.strava.com/activities/{activity_id}",
                created_at=datetime.now()
            )
            
            db.add(flight)
            
            logger.info(f"✅ Created flight {flight.id} from Strava activity {activity_id}")
        
        db.commit()
        db.refresh(flight)
        
        # Step 5: Send Telegram notification
        await send_telegram_notification(flight, is_new=not existing)
        
    except Exception as e:
        logger.error(f"Error processing Strava activity {activity_id}: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


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
        message += f"🪂 *{flight.title}*\n"
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
