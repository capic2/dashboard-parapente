from pydantic import BaseModel, validator
from datetime import date, datetime
from typing import Optional, List, Dict, Any, Literal

# Sites
class SiteBase(BaseModel):
    code: Optional[str] = None  # Optional - some sites may not have a code
    name: str
    elevation_m: Optional[int] = None  # Optional - can be populated from linked_spot data
    latitude: float
    longitude: float
    region: Optional[str] = None
    country: Optional[str] = "FR"
    description: Optional[str] = None  # Site description
    usage_type: Optional[Literal['takeoff', 'landing', 'both']] = 'both'  # Site usage type

class SiteCreate(SiteBase):
    pass

class SiteUpdate(BaseModel):
    """Schema for updating site details - all fields optional for PATCH"""
    name: Optional[str] = None
    code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    elevation_m: Optional[int] = None
    description: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    orientation: Optional[str] = None
    camera_angle: Optional[int] = None
    camera_distance: Optional[int] = None
    usage_type: Optional[Literal['takeoff', 'landing', 'both']] = None
    
    @validator('latitude')
    def validate_latitude(cls, v):
        if v is not None and not -90 <= v <= 90:
            raise ValueError('Latitude must be between -90 and 90')
        return v
    
    @validator('longitude')
    def validate_longitude(cls, v):
        if v is not None and not -180 <= v <= 180:
            raise ValueError('Longitude must be between -180 and 180')
        return v
    
    @validator('camera_angle')
    def validate_camera_angle(cls, v):
        if v is not None and not 0 <= v <= 360:
            raise ValueError('Camera angle must be between 0 and 360')
        return v
    
    @validator('camera_distance')
    def validate_camera_distance(cls, v):
        if v is not None and not 50 <= v <= 5000:
            raise ValueError('Camera distance must be between 50 and 5000 meters')
        return v
    
    @validator('orientation')
    def validate_orientation(cls, v):
        if v is not None and v not in ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', '']:
            raise ValueError('Orientation must be one of: N, NE, E, SE, S, SW, W, NW')
        return v

class Site(SiteBase):
    id: str
    rating: Optional[int] = None  # 0-6 rating from official spots
    orientation: Optional[str] = None  # N, NW, W, S, etc.
    camera_angle: Optional[int] = None  # Camera angle in degrees (0-360)
    camera_distance: Optional[int] = 500  # Camera distance from takeoff in meters
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
    departure_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    max_altitude_m: Optional[int] = None
    max_speed_kmh: Optional[float] = None
    distance_km: Optional[float] = None
    elevation_gain_m: Optional[int] = None
    notes: Optional[str] = None

class FlightCreate(FlightBase):
    site_id: Optional[str] = None
    strava_id: Optional[str] = None

class FlightUpdate(BaseModel):
    """Schema for updating flight details - all fields optional for PATCH"""
    name: Optional[str] = None
    title: Optional[str] = None
    site_id: Optional[str] = None
    flight_date: Optional[date] = None
    departure_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    max_altitude_m: Optional[int] = None
    max_speed_kmh: Optional[float] = None
    distance_km: Optional[float] = None
    elevation_gain_m: Optional[int] = None
    notes: Optional[str] = None
    description: Optional[str] = None
    external_url: Optional[str] = None
    
    @validator('duration_minutes', 'max_altitude_m', 'elevation_gain_m')
    def positive_values(cls, v):
        """Validate that numeric values are positive"""
        if v is not None and v < 0:
            raise ValueError('Value must be positive or zero')
        return v
    
    @validator('distance_km', 'max_speed_kmh')
    def positive_floats(cls, v):
        """Validate that float values are positive"""
        if v is not None and v < 0:
            raise ValueError('Value must be positive or zero')
        return v
    
    @validator('flight_date')
    def date_not_future(cls, v):
        """Validate that flight date is not in the future"""
        if v and v > date.today():
            raise ValueError('Flight date cannot be in the future')
        return v

# Site info included in Flight response (for camera orientation)
class SiteInFlight(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    orientation: Optional[str] = None
    camera_angle: Optional[int] = None  # Camera angle in degrees (0-360)
    camera_distance: Optional[int] = 500  # Camera distance in meters
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    elevation_m: Optional[int] = None
    region: Optional[str] = None
    country: Optional[str] = None
    
    class Config:
        from_attributes = True

class Flight(FlightBase):
    id: str
    site_id: Optional[str] = None
    site_name: Optional[str] = None
    name: Optional[str] = None
    strava_id: Optional[str] = None
    gpx_file_path: Optional[str] = None
    external_url: Optional[str] = None
    video_export_job_id: Optional[str] = None
    video_export_status: Optional[str] = None  # "processing", "completed", "failed"
    video_file_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    site: Optional[SiteInFlight] = None  # Include site details with orientation
    
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


# ============================================================================
# Weather Source Configuration Schemas
# ============================================================================

class WeatherSourceConfigBase(BaseModel):
    """Base schema for weather source configuration"""
    source_name: str
    display_name: str
    description: Optional[str] = None
    is_enabled: bool = True
    requires_api_key: bool = False
    api_key: Optional[str] = None
    priority: int = 1
    scraper_type: Literal["api", "playwright", "stealth"]
    base_url: Optional[str] = None
    documentation_url: Optional[str] = None

    @validator('source_name')
    def validate_source_name(cls, v):
        """Source name must be lowercase alphanumeric with hyphens"""
        import re
        if not re.match(r'^[a-z0-9-]+$', v):
            raise ValueError('Source name must contain only lowercase letters, numbers, and hyphens')
        if len(v) < 2 or len(v) > 50:
            raise ValueError('Source name must be between 2 and 50 characters')
        return v

    @validator('api_key')
    def validate_api_key(cls, v, values):
        """If requires_api_key=True, api_key should be provided"""
        if values.get('requires_api_key') and not v:
            raise ValueError('API key is required for this source')
        return v


class WeatherSourceConfigCreate(WeatherSourceConfigBase):
    """Schema for creating a new weather source"""
    pass


class WeatherSourceConfigUpdate(BaseModel):
    """Schema for updating weather source configuration (all fields optional)"""
    display_name: Optional[str] = None
    description: Optional[str] = None
    is_enabled: Optional[bool] = None
    api_key: Optional[str] = None
    priority: Optional[int] = None
    base_url: Optional[str] = None
    documentation_url: Optional[str] = None


class WeatherSourceConfig(WeatherSourceConfigBase):
    """Complete weather source configuration with stats (response schema)"""
    id: str
    
    # Statistics
    last_success_at: Optional[datetime] = None
    last_error_at: Optional[datetime] = None
    last_error_message: Optional[str] = None
    success_count: int = 0
    error_count: int = 0
    success_rate: float  # Calculated via @property in model
    avg_response_time_ms: Optional[int] = None  # Calculated via @property
    
    # Derived status
    api_key_configured: bool  # Via @property
    status: Literal["active", "error", "disabled", "unknown"]  # Via @property
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class WeatherSourceStats(BaseModel):
    """Global statistics for all weather sources"""
    total_sources: int
    active_sources: int
    disabled_sources: int
    sources_with_errors: int
    global_success_rate: float
    global_avg_response_time_ms: Optional[int]


class WeatherSourceTestResult(BaseModel):
    """Result of a weather source test"""
    success: bool
    response_time_ms: int
    error: Optional[str] = None
    sample_data: Optional[Dict[str, Any]] = None  # First data point for verification
    tested_at: datetime
