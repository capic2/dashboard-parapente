from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List, Dict, Any

# Sites
class SiteBase(BaseModel):
    code: Optional[str] = None  # Optional - some sites may not have a code
    name: str
    elevation_m: Optional[int] = None  # Optional - can be populated from linked_spot data
    latitude: float
    longitude: float
    region: Optional[str] = None
    country: Optional[str] = "FR"

class SiteCreate(SiteBase):
    pass

class Site(SiteBase):
    id: str
    rating: Optional[int] = None  # 0-6 rating from official spots
    orientation: Optional[str] = None  # N, NW, W, S, etc.
    linked_spot_id: Optional[str] = None  # Link to paragliding_spots table
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Flights
class FlightBase(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    flight_date: date
    duration_minutes: Optional[int] = None
    max_altitude_m: Optional[int] = None
    max_speed_kmh: Optional[float] = None
    distance_km: Optional[float] = None
    elevation_gain_m: Optional[int] = None
    notes: Optional[str] = None

class FlightCreate(FlightBase):
    site_id: Optional[str] = None
    strava_id: Optional[str] = None

class Flight(FlightBase):
    id: str
    site_id: Optional[str] = None
    external_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Weather
class WeatherForecastBase(BaseModel):
    forecast_date: date
    para_index: Optional[int] = None
    wind_avg_kmh: Optional[float] = None
    wind_max_kmh: Optional[float] = None
    temperature_avg_c: Optional[float] = None
    verdict: Optional[str] = None
    source: str

class WeatherForecastCreate(WeatherForecastBase):
    site_id: str

class WeatherForecast(WeatherForecastBase):
    id: str
    site_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# API Responses
class SpotsResponse(BaseModel):
    sites: List[Site]

class WeatherResponse(BaseModel):
    site_id: str
    site_name: str
    forecast: WeatherForecast
    
class HealthResponse(BaseModel):
    status: str
    message: str

# Paragliding Spots (external data from OpenAIP + ParaglidingSpots)
class ParaglidingSpotBase(BaseModel):
    id: str
    name: str
    type: str  # "takeoff", "landing", "both"
    latitude: float
    longitude: float
    elevation_m: Optional[int] = None
    orientation: Optional[str] = None
    rating: Optional[int] = None
    country: str = "FR"
    source: str  # "openaip", "paraglidingspots", "merged"
    
    class Config:
        from_attributes = True

class ParaglidingSpotDetail(ParaglidingSpotBase):
    """Full spot details including metadata"""
    openaip_id: Optional[str] = None
    paraglidingspots_id: Optional[int] = None
    raw_metadata: Optional[str] = None
    last_synced: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ParaglidingSpotSearchResult(ParaglidingSpotBase):
    """Spot with distance information (for search results)"""
    distance_km: Optional[float] = None

class SpotSearchResponse(BaseModel):
    """Response for spot search queries"""
    query: Dict[str, Any]
    total: int
    spots: List[ParaglidingSpotSearchResult]

class SyncSpotsResponse(BaseModel):
    """Response for sync operation"""
    success: bool
    stats: Dict[str, int]
    message: str
    timestamp: datetime
