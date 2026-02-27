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

logger = logging.getLogger(__name__)

# Strava API endpoints
TOKEN_URL = "https://www.strava.com/oauth/token"
ACTIVITY_URL = "https://www.strava.com/api/v3/activities"

# Token storage (in-memory for now, can be moved to database later)
_access_token = None
_token_expires_at = None
_refresh_token = None

# Environment variables
STRAVA_CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
STRAVA_CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
STRAVA_REFRESH_TOKEN = os.getenv("STRAVA_REFRESH_TOKEN")


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
    
    try:
        logger.info("Refreshing Strava access token...")
        
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
            
            response.raise_for_status()
            data = response.json()
        
        _access_token = data["access_token"]
        _refresh_token = data["refresh_token"]
        _token_expires_at = datetime.fromtimestamp(data["expires_at"])
        
        logger.info(f"✅ Access token refreshed (expires at {_token_expires_at})")
        
        return _access_token
    
    except Exception as e:
        logger.error(f"Failed to refresh token: {e}")
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
        Dict with coordinates, elevation, max_altitude, elevation_gain
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
        
        for trkpt in trackpoints:
            lat = float(trkpt.get("lat"))
            lon = float(trkpt.get("lon"))
            
            # Get elevation
            ele_elem = trkpt.find("gpx:ele", ns) or trkpt.find("ele")
            ele = float(ele_elem.text) if ele_elem is not None else 0
            
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
        
        return {
            "success": True,
            "coordinates": coordinates,
            "elevations": elevations,
            "max_altitude_m": max_altitude,
            "min_altitude_m": min_altitude,
            "elevation_gain_m": int(elevation_gain),
            "num_points": len(coordinates)
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
