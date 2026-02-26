from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Site, Flight, WeatherForecast
from schemas import Site as SiteSchema, SpotsResponse, WeatherForecast as WeatherForecastSchema, WeatherResponse
from datetime import date
import uuid

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

# Weather endpoints
@router.get("/weather/{spot_id}")
def get_weather(spot_id: str, forecast_date: date = None, db: Session = Depends(get_db)):
    """Get weather forecast for a spot"""
    site = db.query(Site).filter(Site.id == spot_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Spot not found")
    
    query = db.query(WeatherForecast).filter(WeatherForecast.site_id == spot_id)
    if forecast_date:
        query = query.filter(WeatherForecast.forecast_date == forecast_date)
    
    forecasts = query.all()
    
    if not forecasts:
        return {
            "site_id": spot_id,
            "site_name": site.name,
            "message": "No forecast data available yet"
        }
    
    return {
        "site_id": spot_id,
        "site_name": site.name,
        "forecasts": forecasts
    }

@router.get("/weather/{spot_id}/today")
def get_weather_today(spot_id: str, db: Session = Depends(get_db)):
    """Get today's weather forecast"""
    from datetime import date
    return get_weather(spot_id, date.today(), db)

# Flights endpoints
@router.get("/flights")
def get_flights(limit: int = 10, db: Session = Depends(get_db)):
    """Get recent flights"""
    flights = db.query(Flight).order_by(Flight.flight_date.desc()).limit(limit).all()
    return {"flights": flights}

@router.get("/flights/{flight_id}")
def get_flight(flight_id: str, db: Session = Depends(get_db)):
    """Get a specific flight"""
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    return flight

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

# Health check
@router.get("/health")
def health_check():
    return {"status": "ok", "message": "Dashboard API healthy"}
