from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List

# Sites
class SiteBase(BaseModel):
    code: str
    name: str
    elevation_m: int
    latitude: float
    longitude: float
    region: Optional[str] = None
    country: str = "FR"

class SiteCreate(SiteBase):
    pass

class Site(SiteBase):
    id: str
    created_at: datetime
    updated_at: datetime
    
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
