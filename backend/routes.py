from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Site, Flight, WeatherForecast
from schemas import Site as SiteSchema, SpotsResponse, WeatherForecast as WeatherForecastSchema, WeatherResponse
from datetime import date, datetime, timedelta
from pathlib import Path
import uuid
import asyncio
import xml.etree.ElementTree as ET
import math
from typing import List, Dict, Optional

# Import weather_pipeline and para_index
from weather_pipeline import get_normalized_forecast
from para_index import calculate_para_index, analyze_hourly_slots, format_slots_summary

router = APIRouter(prefix="/api", tags=["api"])

# Sites endpoints
@router.get("/spots", response_model=SpotsResponse)
def get_spots(db: Session = Depends(get_db)):
    """Get all paragliding spots"""
    sites = db.query(Site).all()
    return SpotsResponse(sites=sites)

@router.get("/spots/{spot_id}", response_model=SiteSchema)
def get_spot(spot_id: str, db: Session = Depends(get_db)):
    """Get a specific spot"""
    site = db.query(Site).filter(Site.id == spot_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Spot not found")
    return site

# Weather endpoints (UPDATED with pipeline + para_index)
@router.get("/weather/{spot_id}")
async def get_weather(spot_id: str, day_index: int = 0, db: Session = Depends(get_db)):
    """
    Get weather forecast for a spot (LIVE from all sources)
    Now returns normalized data + para_index
    
    Args:
        spot_id: Site ID
        day_index: 0=today, 1=tomorrow (default: 0)
    """
    site = db.query(Site).filter(Site.id == spot_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Spot not found")
    
    # Fetch live normalized forecast
    consensus = await get_normalized_forecast(site.latitude, site.longitude, day_index)
    
    if not consensus.get("success"):
        return {
            "site_id": spot_id,
            "site_name": site.name,
            "error": consensus.get("error", "Failed to fetch weather data"),
            "day_index": day_index
        }
    
    # Calculate para_index
    consensus_hours = consensus.get("consensus", [])
    para_result = calculate_para_index(consensus_hours)
    
    # Analyze hourly slots
    slots = analyze_hourly_slots(consensus_hours)
    slots_summary = format_slots_summary(slots)
    
    return {
        "site_id": spot_id,
        "site_name": site.name,
        "day_index": day_index,
        "consensus": consensus_hours,
        "para_index": para_result["para_index"],
        "verdict": para_result["verdict"],
        "emoji": para_result["emoji"],
        "explanation": para_result["explanation"],
        "metrics": para_result["metrics"],
        "slots": slots,
        "slots_summary": slots_summary,
        "total_sources": consensus.get("total_sources", 0)
    }

@router.get("/weather/{spot_id}/today")
async def get_weather_today(spot_id: str, db: Session = Depends(get_db)):
    """Get today's weather forecast (day_index=0)"""
    return await get_weather(spot_id, day_index=0, db=db)

# Flights endpoints
@router.get("/flights")
def get_flights(limit: int = 10, db: Session = Depends(get_db)):
    """Get recent flights"""
    flights = db.query(Flight).order_by(Flight.flight_date.desc()).limit(limit).all()
    return {"flights": flights}

@router.get("/flights/stats")
def get_flight_stats(db: Session = Depends(get_db)):
    """Get aggregate flight statistics"""
    flights = db.query(Flight).all()
    
    if not flights:
        return {
            "total_flights": 0,
            "total_hours": 0,
            "total_distance": 0,
            "avg_duration": 0,
            "favorite_spot": None,
            "last_flight_date": None
        }
    
    total_flights = len(flights)
    total_minutes = sum(f.duration_minutes or 0 for f in flights)
    total_hours = round(total_minutes / 60, 1)
    total_distance = sum(f.distance_km or 0 for f in flights)
    avg_duration = round(total_minutes / total_flights, 1) if total_flights > 0 else 0
    
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
        "total_distance": round(total_distance, 1),
        "avg_duration": avg_duration,
        "favorite_spot": favorite_spot,
        "last_flight_date": last_flight_date
    }

@router.get("/flights/{flight_id}")
def get_flight(flight_id: str, db: Session = Depends(get_db)):
    """Get a specific flight"""
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    return flight

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
        coordinates = parse_gpx_file(gpx_path)
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

def parse_gpx_file(gpx_path: Path) -> List[Dict]:
    """
    Parse GPX file and extract coordinates with timestamps
    Returns list of {lat, lon, elevation, timestamp}
    """
    tree = ET.parse(gpx_path)
    root = tree.getroot()
    
    # Handle GPX namespace
    ns = {'gpx': 'http://www.topografix.com/GPX/1/1'}
    if not root.tag.endswith('gpx'):
        # Try without namespace
        ns = {}
    
    coordinates = []
    
    # Find all track points
    for trkpt in root.findall('.//gpx:trkpt', ns) or root.findall('.//trkpt'):
        lat = float(trkpt.get('lat', 0))
        lon = float(trkpt.get('lon', 0))
        
        # Get elevation
        ele_elem = trkpt.find('gpx:ele', ns) or trkpt.find('ele')
        elevation = float(ele_elem.text) if ele_elem is not None and ele_elem.text else 0
        
        # Get timestamp
        time_elem = trkpt.find('gpx:time', ns) or trkpt.find('time')
        if time_elem is not None and time_elem.text:
            try:
                dt = datetime.fromisoformat(time_elem.text.replace('Z', '+00:00'))
                timestamp = int(dt.timestamp() * 1000)  # milliseconds
            except:
                timestamp = 0
        else:
            timestamp = 0
        
        coordinates.append({
            "lat": lat,
            "lon": lon,
            "elevation": elevation,
            "timestamp": timestamp
        })
    
    return coordinates


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
            "flight_duration_seconds": 0
        }
    
    elevations = [c["elevation"] for c in coordinates]
    max_alt = max(elevations)
    min_alt = min(elevations)
    
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
    
    return {
        "max_altitude_m": round(max_alt),
        "min_altitude_m": round(min_alt),
        "elevation_gain_m": round(elevation_gain),
        "elevation_loss_m": round(elevation_loss),
        "total_distance_km": round(total_distance, 2),
        "flight_duration_seconds": round(duration_seconds)
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
