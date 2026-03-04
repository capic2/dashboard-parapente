"""
Strava API Integration
- Token refresh (every 4 hours)
- GPX download
- GPX parsing
"""

import httpx
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import logging
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file early (before reading env vars)
load_dotenv(override=False)

logger = logging.getLogger(__name__)

# Strava API endpoints
TOKEN_URL = "https://www.strava.com/oauth/token"
ACTIVITY_URL = "https://www.strava.com/api/v3/activities"

# Token storage (in-memory for now, can be moved to database later)
_access_token = None
_token_expires_at = None
_refresh_token = None

# Environment variables (loaded after load_dotenv())
STRAVA_CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
STRAVA_CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
STRAVA_REFRESH_TOKEN = os.getenv("STRAVA_REFRESH_TOKEN")

# Log configuration at module load
if STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET and STRAVA_REFRESH_TOKEN:
    logger.info(f"✅ Strava credentials loaded (Client ID: {STRAVA_CLIENT_ID})")
else:
    logger.warning(f"⚠️ Strava credentials incomplete: CLIENT_ID={bool(STRAVA_CLIENT_ID)}, CLIENT_SECRET={bool(STRAVA_CLIENT_SECRET)}, REFRESH_TOKEN={bool(STRAVA_REFRESH_TOKEN)}")


async def refresh_access_token() -> Optional[str]:
    """
    Refresh Strava access token
    Based on logic from /home/capic/.openclaw/scripts/refresh-strava-token-daytime.js
    
    Returns:
        New access token or None on error
    """
    global _access_token, _token_expires_at, _refresh_token
    
    # Check if token is still valid (with 5 min buffer)
    if _access_token and _token_expires_at:
        if datetime.now() < _token_expires_at - timedelta(minutes=5):
            logger.info("Access token still valid")
            return _access_token
    
    # Refresh token
    if not STRAVA_REFRESH_TOKEN:
        logger.error("STRAVA_REFRESH_TOKEN not set in environment")
        return None
    
    if not STRAVA_CLIENT_ID or not STRAVA_CLIENT_SECRET:
        logger.error(f"Missing Strava credentials: CLIENT_ID={STRAVA_CLIENT_ID}, CLIENT_SECRET={'***' if STRAVA_CLIENT_SECRET else None}")
        return None
    
    try:
        logger.info("Refreshing Strava access token...")
        logger.debug(f"Using CLIENT_ID: {STRAVA_CLIENT_ID}")
        logger.debug(f"Using REFRESH_TOKEN: {STRAVA_REFRESH_TOKEN[:10]}...")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                TOKEN_URL,
                data={
                    "client_id": STRAVA_CLIENT_ID,
                    "client_secret": STRAVA_CLIENT_SECRET,
                    "grant_type": "refresh_token",
                    "refresh_token": _refresh_token or STRAVA_REFRESH_TOKEN
                }
            )
            
            logger.debug(f"Strava API response status: {response.status_code}")
            response.raise_for_status()
            data = response.json()
        
        _access_token = data["access_token"]
        _refresh_token = data["refresh_token"]
        _token_expires_at = datetime.fromtimestamp(data["expires_at"])
        
        logger.info(f"✅ Access token refreshed (expires at {_token_expires_at})")
        
        return _access_token
    
    except httpx.HTTPStatusError as e:
        logger.error(f"Strava API error (HTTP {e.response.status_code}): {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"Failed to refresh token: {type(e).__name__}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None


async def get_access_token() -> Optional[str]:
    """
    Get valid access token (refresh if needed)
    
    Returns:
        Valid access token or None
    """
    return await refresh_access_token()


async def download_gpx(activity_id: str) -> Optional[str]:
    """
    Download GPX file from Strava
    
    Args:
        activity_id: Strava activity ID
    
    Returns:
        GPX content (XML string) or None on error
    """
    token = await get_access_token()
    
    if not token:
        logger.error("Cannot download GPX: no access token")
        return None
    
    try:
        url = f"{ACTIVITY_URL}/{activity_id}/streams"
        params = {
            "keys": "latlng,altitude,time",
            "key_by_type": "true"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                url,
                params=params,
                headers={"Authorization": f"Bearer {token}"}
            )
            
            response.raise_for_status()
            streams = response.json()
        
        # Convert streams to GPX format
        gpx_content = streams_to_gpx(streams, activity_id)
        
        logger.info(f"✅ Downloaded GPX for activity {activity_id}")
        
        return gpx_content
    
    except Exception as e:
        logger.error(f"Failed to download GPX for activity {activity_id}: {e}")
        return None


def streams_to_gpx(streams: Dict[str, Any], activity_id: str) -> str:
    """
    Convert Strava streams to GPX format
    
    Args:
        streams: Strava streams data
        activity_id: Activity ID
    
    Returns:
        GPX XML string
    """
    latlng = streams.get("latlng", {}).get("data", [])
    altitude = streams.get("altitude", {}).get("data", [])
    time_data = streams.get("time", {}).get("data", [])
    
    # Create GPX XML
    gpx = ET.Element("gpx", {
        "version": "1.1",
        "creator": "Dashboard Parapente",
        "xmlns": "http://www.topografix.com/GPX/1/1"
    })
    
    trk = ET.SubElement(gpx, "trk")
    ET.SubElement(trk, "name").text = f"Strava Activity {activity_id}"
    
    trkseg = ET.SubElement(trk, "trkseg")
    
    # Add trackpoints
    for i in range(len(latlng)):
        lat, lon = latlng[i]
        ele = altitude[i] if i < len(altitude) else 0
        
        trkpt = ET.SubElement(trkseg, "trkpt", {
            "lat": str(lat),
            "lon": str(lon)
        })
        
        ET.SubElement(trkpt, "ele").text = str(ele)
        
        if i < len(time_data):
            # Convert seconds to ISO timestamp
            timestamp = datetime.utcnow() + timedelta(seconds=time_data[i])
            ET.SubElement(trkpt, "time").text = timestamp.isoformat() + "Z"
    
    # Convert to string
    return ET.tostring(gpx, encoding="unicode")


def parse_gpx(gpx_content: str) -> Dict[str, Any]:
    """
    Parse GPX file and extract flight data
    
    Args:
        gpx_content: GPX XML string
    
    Returns:
        Dict with coordinates, elevation, max_altitude, elevation_gain, first_trackpoint
    """
    try:
        root = ET.fromstring(gpx_content)
        
        # Namespace handling
        ns = {"gpx": "http://www.topografix.com/GPX/1/1"}
        
        # Extract trackpoints
        trackpoints = root.findall(".//gpx:trkpt", ns)
        
        if not trackpoints:
            # Try without namespace
            trackpoints = root.findall(".//trkpt")
        
        coordinates = []
        elevations = []
        first_time = None
        first_lat = None
        first_lon = None
        first_ele = None
        
        for i, trkpt in enumerate(trackpoints):
            lat = float(trkpt.get("lat"))
            lon = float(trkpt.get("lon"))
            
            # Get elevation - try with namespace first, then without, then from attribute
            ele_elem = trkpt.find("gpx:ele", ns)
            if ele_elem is None:
                ele_elem = trkpt.find("ele")
            if ele_elem is None:
                # Try as direct child without namespace
                for child in trkpt:
                    if child.tag.endswith("ele"):
                        ele_elem = child
                        break
            
            ele = float(ele_elem.text) if ele_elem is not None and ele_elem.text else 0
            
            # Get time from first trackpoint
            if i == 0:
                time_elem = trkpt.find("gpx:time", ns)
                if time_elem is None:
                    time_elem = trkpt.find("time")
                if time_elem is None:
                    # Try as direct child without namespace
                    for child in trkpt:
                        if child.tag.endswith("time"):
                            time_elem = child
                            break
                
                if time_elem is not None and time_elem.text:
                    first_time = time_elem.text
                first_lat = lat
                first_lon = lon
                first_ele = ele
            
            coordinates.append({"lat": lat, "lon": lon})
            elevations.append(ele)
        
        if not elevations:
            return {
                "success": False,
                "error": "No elevation data in GPX"
            }
        
        # Calculate statistics
        max_altitude = int(max(elevations))
        min_altitude = int(min(elevations))
        
        # Calculate elevation gain (sum of positive differences)
        elevation_gain = 0
        for i in range(1, len(elevations)):
            diff = elevations[i] - elevations[i - 1]
            if diff > 0:
                elevation_gain += diff
        
        # Parse first trackpoint time (ISO format with timezone)
        departure_time = None
        if first_time:
            try:
                # Parse ISO datetime (e.g., "2024-02-27T16:08:00Z" or "2024-02-27T16:08:00+01:00")
                if first_time.endswith("Z"):
                    departure_time = datetime.fromisoformat(first_time.replace("Z", "+00:00"))
                else:
                    departure_time = datetime.fromisoformat(first_time)
            except Exception as e:
                logger.warning(f"Failed to parse GPX time '{first_time}': {e}")
        
        return {
            "success": True,
            "coordinates": coordinates,
            "elevations": elevations,
            "max_altitude_m": max_altitude,
            "min_altitude_m": min_altitude,
            "elevation_gain_m": int(elevation_gain),
            "num_points": len(coordinates),
            "first_trackpoint": {
                "lat": first_lat,
                "lon": first_lon,
                "elevation": first_ele,
                "time": departure_time  # datetime object or None
            }
        }
    
    except Exception as e:
        logger.error(f"Failed to parse GPX: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def get_activity_details(activity_id: str) -> Optional[Dict[str, Any]]:
    """
    Get activity details from Strava API
    
    Args:
        activity_id: Strava activity ID
    
    Returns:
        Activity details dict or None
    """
    token = await get_access_token()
    
    if not token:
        logger.error("Cannot get activity details: no access token")
        return None
    
    try:
        url = f"{ACTIVITY_URL}/{activity_id}"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {token}"}
            )
            
            response.raise_for_status()
            activity = response.json()
        
        logger.info(f"✅ Got activity details for {activity_id}")
        
        return activity
    
    except Exception as e:
        logger.error(f"Failed to get activity details for {activity_id}: {e}")
        return None


async def get_activities_by_period(
    date_from: str,
    date_to: str,
    activity_type: str = "Workout",
    per_page: int = 50
) -> List[Dict[str, Any]]:
    """
    Récupère toutes les activités Strava pour une période donnée
    
    Args:
        date_from: Date début au format YYYY-MM-DD
        date_to: Date fin au format YYYY-MM-DD
        activity_type: Type d'activité (default: Workout - pour les vols parapente)
        per_page: Nombre d'activités par page (max 200)
    
    Returns:
        Liste d'activités Strava filtrées par type
        
    Raises:
        Exception si échec API
    """
    token = await get_access_token()
    
    if not token:
        logger.error("Cannot get activities: no access token")
        raise Exception("No Strava access token available")
    
    try:
        # Convertir dates en timestamps Unix
        from_dt = datetime.strptime(date_from, "%Y-%m-%d")
        to_dt = datetime.strptime(date_to, "%Y-%m-%d")
        
        after_timestamp = int(from_dt.timestamp())
        before_timestamp = int(to_dt.timestamp())
        
        # API Strava: GET /athlete/activities
        url = "https://www.strava.com/api/v3/athlete/activities"
        
        all_activities = []
        page = 1
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {token}"},
                    params={
                        "after": after_timestamp,
                        "before": before_timestamp,
                        "per_page": per_page,
                        "page": page
                    }
                )
                
                response.raise_for_status()
                activities = response.json()
                
                # Si pas de résultats, fin de pagination
                if not activities:
                    break
                
                logger.debug(f"Page {page}: Retrieved {len(activities)} activities")
                
                # Filtrer par type d'activité
                filtered = [
                    act for act in activities 
                    if act.get("type") == activity_type or 
                       act.get("sport_type") == activity_type
                ]
                
                logger.debug(f"Page {page}: {len(filtered)} activities match type '{activity_type}'")
                
                # Log les types d'activités trouvées (pour debug)
                if len(filtered) == 0 and len(activities) > 0:
                    activity_types = set(act.get("type") or act.get("sport_type") for act in activities)
                    logger.debug(f"Activity types found on page {page}: {activity_types}")
                
                all_activities.extend(filtered)
                
                # Si moins de per_page résultats, c'est la dernière page
                if len(activities) < per_page:
                    break
                
                page += 1
        
        logger.info(f"✅ Retrieved {len(all_activities)} '{activity_type}' activities from {date_from} to {date_to}")
        
        return all_activities
    
    except Exception as e:
        logger.error(f"Failed to get activities by period: {e}")
        raise


def save_gpx_file(gpx_content: str, activity_id: str) -> Optional[str]:
    """
    Save GPX content to file system
    
    Args:
        gpx_content: GPX XML string
        activity_id: Strava activity ID
    
    Returns:
        File path (relative to backend root) or None on error
    """
    try:
        # Create GPX directory if needed
        gpx_dir = Path(__file__).parent / "db" / "gpx"
        gpx_dir.mkdir(parents=True, exist_ok=True)
        
        # Save file
        file_name = f"strava_{activity_id}.gpx"
        file_path = gpx_dir / file_name
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(gpx_content)
        
        # Return relative path from backend root
        relative_path = f"db/gpx/{file_name}"
        
        logger.info(f"✅ Saved GPX to {relative_path}")
        
        return relative_path
    
    except Exception as e:
        logger.error(f"Failed to save GPX file for activity {activity_id}: {e}")
        return None


def match_site_by_coordinates(lat: float, lon: float, sites: List[Dict[str, Any]]) -> Optional[str]:
    """
    Match a site based on GPS coordinates (using simple distance calculation)
    
    Args:
        lat: Latitude of departure point
        lon: Longitude of departure point
        sites: List of site dicts with id, latitude, longitude, name
    
    Returns:
        Site ID of closest site (within 5km) or None
    """
    import math
    
    def haversine_distance(lat1, lon1, lat2, lon2):
        """Calculate distance in km between two GPS coordinates"""
        R = 6371  # Earth radius in km
        
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    # Find closest site
    closest_site = None
    min_distance = float('inf')
    
    for site in sites:
        if not site.get("latitude") or not site.get("longitude"):
            continue
        
        distance = haversine_distance(
            lat, lon,
            site["latitude"], site["longitude"]
        )
        
        if distance < min_distance:
            min_distance = distance
            closest_site = site
    
    # Only match if within 5km (paragliding sites are usually close to departure)
    if closest_site and min_distance <= 5.0:
        logger.info(f"✅ Matched site '{closest_site['name']}' (distance: {min_distance:.2f}km)")
        return closest_site["id"]
    else:
        logger.warning(f"No site match found (closest: {min_distance:.2f}km)")
        return None
