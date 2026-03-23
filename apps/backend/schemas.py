from datetime import date, datetime, time
from typing import Any, Literal

from pydantic import BaseModel, validator


# Sites
class SiteBase(BaseModel):
    code: str | None = None  # Optional - some sites may not have a code
    name: str
    elevation_m: int | None = None  # Optional - can be populated from linked_spot data
    latitude: float
    longitude: float
    region: str | None = None
    country: str | None = "FR"
    description: str | None = None  # Site description
    usage_type: Literal["takeoff", "landing", "both"] | None = "both"  # Site usage type


class SiteCreate(SiteBase):
    pass


class SiteUpdate(BaseModel):
    """Schema for updating site details - all fields optional for PATCH"""

    name: str | None = None
    code: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    elevation_m: int | None = None
    description: str | None = None
    region: str | None = None
    country: str | None = None
    orientation: str | None = None
    camera_angle: int | None = None
    camera_distance: int | None = None
    usage_type: Literal["takeoff", "landing", "both"] | None = None

    @validator("latitude")
    def validate_latitude(cls, v):
        if v is not None and not -90 <= v <= 90:
            raise ValueError("Latitude must be between -90 and 90")
        return v

    @validator("longitude")
    def validate_longitude(cls, v):
        if v is not None and not -180 <= v <= 180:
            raise ValueError("Longitude must be between -180 and 180")
        return v

    @validator("camera_angle")
    def validate_camera_angle(cls, v):
        if v is not None and not 0 <= v <= 360:
            raise ValueError("Camera angle must be between 0 and 360")
        return v

    @validator("camera_distance")
    def validate_camera_distance(cls, v):
        if v is not None and not 50 <= v <= 5000:
            raise ValueError("Camera distance must be between 50 and 5000 meters")
        return v

    @validator("orientation")
    def validate_orientation(cls, v):
        if v is not None and v not in ["N", "NE", "E", "SE", "S", "SW", "W", "NW", ""]:
            raise ValueError("Orientation must be one of: N, NE, E, SE, S, SW, W, NW")
        return v


class Site(SiteBase):
    id: str
    rating: int | None = None  # 0-6 rating from official spots
    orientation: str | None = None  # N, NW, W, S, etc.
    camera_angle: int | None = None  # Camera angle in degrees (0-360)
    camera_distance: int | None = 500  # Camera distance from takeoff in meters
    linked_spot_id: str | None = None  # Link to paragliding_spots table
    flight_count: int | None = 0  # Number of flights at this site
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


# Flights
class FlightBase(BaseModel):
    title: str | None = None
    description: str | None = None
    flight_date: date
    departure_time: datetime | None = None
    duration_minutes: int | None = None
    max_altitude_m: int | None = None
    max_speed_kmh: float | None = None
    distance_km: float | None = None
    elevation_gain_m: int | None = None
    notes: str | None = None


class FlightCreate(FlightBase):
    site_id: str | None = None
    strava_id: str | None = None


class FlightUpdate(BaseModel):
    """Schema for updating flight details - all fields optional for PATCH"""

    name: str | None = None
    title: str | None = None
    site_id: str | None = None
    flight_date: date | None = None
    departure_time: datetime | None = None
    duration_minutes: int | None = None
    max_altitude_m: int | None = None
    max_speed_kmh: float | None = None
    distance_km: float | None = None
    elevation_gain_m: int | None = None
    notes: str | None = None
    description: str | None = None
    external_url: str | None = None

    @validator("duration_minutes", "max_altitude_m", "elevation_gain_m")
    def positive_values(cls, v):
        """Validate that numeric values are positive"""
        if v is not None and v < 0:
            raise ValueError("Value must be positive or zero")
        return v

    @validator("distance_km", "max_speed_kmh")
    def positive_floats(cls, v):
        """Validate that float values are positive"""
        if v is not None and v < 0:
            raise ValueError("Value must be positive or zero")
        return v

    @validator("flight_date")
    def date_not_future(cls, v):
        """Validate that flight date is not in the future"""
        if v and v > date.today():
            raise ValueError("Flight date cannot be in the future")
        return v


# Site info included in Flight response (for camera orientation)
class SiteInFlight(BaseModel):
    id: str
    name: str
    code: str | None = None
    orientation: str | None = None
    camera_angle: int | None = None  # Camera angle in degrees (0-360)
    camera_distance: int | None = 500  # Camera distance in meters
    latitude: float | None = None
    longitude: float | None = None
    elevation_m: int | None = None
    region: str | None = None
    country: str | None = None

    class Config:
        from_attributes = True


class Flight(FlightBase):
    id: str
    site_id: str | None = None
    site_name: str | None = None
    name: str | None = None
    strava_id: str | None = None
    gpx_file_path: str | None = None
    external_url: str | None = None
    video_export_job_id: str | None = None
    video_export_status: str | None = None  # "processing", "completed", "failed"
    video_file_path: str | None = None
    created_at: datetime
    updated_at: datetime
    site: SiteInFlight | None = None  # Include site details with orientation

    class Config:
        from_attributes = True


# Weather
class WeatherForecastBase(BaseModel):
    forecast_date: date
    para_index: int | None = None
    wind_avg_kmh: float | None = None
    wind_max_kmh: float | None = None
    temperature_avg_c: float | None = None
    verdict: str | None = None
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
    sites: list[Site]


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
    elevation_m: int | None = None
    orientation: str | None = None
    rating: int | None = None
    country: str = "FR"
    source: str  # "openaip", "paraglidingspots", "merged"

    class Config:
        from_attributes = True


class ParaglidingSpotDetail(ParaglidingSpotBase):
    """Full spot details including metadata"""

    openaip_id: str | None = None
    paraglidingspots_id: int | None = None
    raw_metadata: str | None = None
    last_synced: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ParaglidingSpotSearchResult(ParaglidingSpotBase):
    """Spot with distance information (for search results)"""

    distance_km: float | None = None


class SpotSearchResponse(BaseModel):
    """Response for spot search queries"""

    query: dict[str, Any]
    total: int
    spots: list[ParaglidingSpotSearchResult]


class SyncSpotsResponse(BaseModel):
    """Response for sync operation"""

    success: bool
    stats: dict[str, int]
    message: str
    timestamp: datetime


# ============================================================================
# Weather Source Configuration Schemas
# ============================================================================


class WeatherSourceConfigBase(BaseModel):
    """Base schema for weather source configuration"""

    source_name: str
    display_name: str
    description: str | None = None
    is_enabled: bool = True
    requires_api_key: bool = False
    api_key: str | None = None
    priority: int = 1
    scraper_type: Literal["api", "playwright", "stealth"]
    base_url: str | None = None
    documentation_url: str | None = None

    @validator("source_name")
    def validate_source_name(cls, v):
        """Source name must be lowercase alphanumeric with hyphens"""
        import re

        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError(
                "Source name must contain only lowercase letters, numbers, and hyphens"
            )
        if len(v) < 2 or len(v) > 50:
            raise ValueError("Source name must be between 2 and 50 characters")
        return v

    @validator("api_key")
    def validate_api_key(cls, v, values):
        """Warn if requires_api_key=True but api_key is missing (don't block serialization)"""
        # Don't raise - allow response serialization even if key is missing in DB
        return v


class WeatherSourceConfigCreate(WeatherSourceConfigBase):
    """Schema for creating a new weather source"""

    pass


class WeatherSourceConfigUpdate(BaseModel):
    """Schema for updating weather source configuration (all fields optional)"""

    display_name: str | None = None
    description: str | None = None
    is_enabled: bool | None = None
    api_key: str | None = None
    priority: int | None = None
    base_url: str | None = None
    documentation_url: str | None = None


class WeatherSourceConfig(WeatherSourceConfigBase):
    """Complete weather source configuration with stats (response schema)"""

    id: str

    # Statistics
    last_success_at: datetime | None = None
    last_error_at: datetime | None = None
    last_error_message: str | None = None
    success_count: int = 0
    error_count: int = 0
    success_rate: float  # Calculated via @property in model
    avg_response_time_ms: int | None = None  # Calculated via @property

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
    global_avg_response_time_ms: int | None


class WeatherSourceTestResult(BaseModel):
    """Result of a weather source test"""

    success: bool
    response_time_ms: int
    error: str | None = None
    sample_data: dict[str, Any] | None = None  # First data point for verification
    tested_at: datetime


# Emagram Analysis Schemas
class EmagramAnalysisBase(BaseModel):
    """Base schema for emagram analysis"""

    analysis_date: date
    analysis_time: time
    station_code: str
    station_name: str
    station_latitude: float
    station_longitude: float
    distance_km: float
    data_source: str = "wyoming"
    sounding_time: str  # "00Z" or "12Z"
    analysis_method: str  # "llm_vision" or "classic_calculation"

    # Optional AI analysis results
    plafond_thermique_m: int | None = None
    force_thermique_ms: float | None = None
    cape_jkg: float | None = None
    stabilite_atmospherique: str | None = None
    cisaillement_vent: str | None = None
    heure_debut_thermiques: time | None = None
    heure_fin_thermiques: time | None = None
    heures_volables_total: float | None = None
    risque_orage: str | None = None
    score_volabilite: int | None = None

    resume_conditions: str | None = None
    conseils_vol: str | None = None
    alertes_securite: str | None = None  # JSON string

    # Classic meteorology fallback
    lcl_m: int | None = None
    lfc_m: int | None = None
    el_m: int | None = None
    lifted_index: float | None = None
    k_index: float | None = None
    total_totals: float | None = None
    showalter_index: float | None = None
    wind_shear_0_3km_ms: float | None = None
    wind_shear_0_6km_ms: float | None = None


class EmagramAnalysisCreate(EmagramAnalysisBase):
    """Schema for creating new emagram analysis"""

    llm_provider: str | None = None
    llm_model: str | None = None
    llm_tokens_used: int | None = None
    llm_cost_usd: float | None = None
    skewt_image_path: str | None = None
    raw_sounding_data: str | None = None
    ai_raw_response: str | None = None
    analysis_status: str = "completed"
    error_message: str | None = None


class EmagramAnalysis(EmagramAnalysisBase):
    """Complete emagram analysis response schema"""

    id: str
    analysis_datetime: datetime

    # LLM metadata
    llm_provider: str | None = None
    llm_model: str | None = None
    llm_tokens_used: int | None = None
    llm_cost_usd: float | None = None

    # Storage paths
    skewt_image_path: str | None = None
    raw_sounding_data: str | None = None
    ai_raw_response: str | None = None

    # Status
    analysis_status: str
    error_message: str | None = None

    # Computed properties
    is_from_llm: bool
    has_thermal_data: bool
    flyable_hours_formatted: str | None = None

    # Multi-source support (for Gemini multi-emagram analysis)
    external_source_urls: str | None = None  # JSON: {"meteo-parapente": "url", ...}
    screenshot_paths: str | None = None  # JSON: {"meteo-parapente": "/path/to/screenshot.png", ...}
    sources_count: int | None = None  # Number of sources analyzed
    sources_agreement: str | None = None  # "high", "medium", "low"

    # Timestamps
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EmagramAnalysisListItem(BaseModel):
    """Lightweight schema for listing multiple analyses"""

    id: str
    analysis_date: date
    analysis_time: time
    station_code: str
    station_name: str
    distance_km: float
    score_volabilite: int | None = None
    plafond_thermique_m: int | None = None
    force_thermique_ms: float | None = None
    heures_volables_total: float | None = None
    analysis_method: str
    analysis_status: str
    created_at: datetime

    class Config:
        from_attributes = True


class EmagramTriggerRequest(BaseModel):
    """Request schema for manually triggering emagram analysis"""

    user_latitude: float
    user_longitude: float
    force_refresh: bool = False  # Force new analysis even if recent one exists

    @validator("user_latitude")
    def validate_latitude(cls, v):
        if not -90 <= v <= 90:
            raise ValueError("Latitude must be between -90 and 90")
        return v

    @validator("user_longitude")
    def validate_longitude(cls, v):
        if not -180 <= v <= 180:
            raise ValueError("Longitude must be between -180 and 180")
        return v
