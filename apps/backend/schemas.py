from datetime import date, datetime, time
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator, validator

VALID_SITE_ORIENTATIONS = {
    "",
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
}


class GoproOverlayDependencies(BaseModel):
    gopro_dashboard: bool
    ffmpeg: bool
    ffprobe: bool


class GoproOverlayLayout(BaseModel):
    id: str
    label: str
    filename: str
    width: int | None = None
    height: int | None = None
    exists: bool
    recommended: bool


class GoproOverlayLayoutsResponse(BaseModel):
    layouts: list[GoproOverlayLayout]


class GoproOverlayProbeResponse(GoproOverlayLayoutsResponse):
    width: int | None = None
    height: int | None = None


class GoproOverlayJob(BaseModel):
    job_id: str
    status: Literal["queued", "preparing", "running", "completed", "failed", "cancelled"]
    progress: int
    message: str
    error: str | None = None
    gpx_path: str | None = None
    layout_id: str
    layout_label: str
    output_filename: str
    video_width: int | None = None
    video_height: int | None = None
    gpx_offset: float = 0.0
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
    log_tail: list[str] = Field(default_factory=list)
    job_token: str | None = None


class GoproOverlayCancelResponse(BaseModel):
    job_id: str
    message: str


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
    orientation: str | None = None

    @validator("orientation")
    def validate_orientation(cls, v):
        if v is None:
            return v
        orientation = v.strip().upper()
        if orientation not in VALID_SITE_ORIENTATIONS:
            raise ValueError(
                "Orientation must be one of: "
                "N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW"
            )
        return orientation


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
    camera_close_zoom_percent: int | None = None
    camera_transition_percent: int | None = None
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

    @validator("camera_close_zoom_percent")
    def validate_camera_close_zoom_percent(cls, v):
        if v is not None and not 30 <= v <= 100:
            raise ValueError("Camera close zoom percent must be between 30 and 100")
        return v

    @validator("camera_transition_percent")
    def validate_camera_transition_percent(cls, v):
        if v is not None and not 1 <= v <= 40:
            raise ValueError("Camera transition percent must be between 1 and 40")
        return v

    @validator("orientation")
    def validate_orientation(cls, v):
        if v is None:
            return v
        orientation = v.strip().upper()
        if orientation not in VALID_SITE_ORIENTATIONS:
            raise ValueError(
                "Orientation must be one of: "
                "N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW"
            )
        return orientation


class Site(SiteBase):
    id: str
    rating: int | None = None  # 0-6 rating from official spots
    orientation: str | None = None  # N, NW, W, S, etc.
    camera_angle: int | None = None  # Camera angle in degrees (0-360)
    camera_distance: int | None = 500  # Camera distance from takeoff in meters
    camera_close_zoom_percent: int | None = 75
    camera_transition_percent: int | None = 12
    linked_spot_id: str | None = None  # Link to paragliding_spots table
    flight_count: int | None = 0  # Number of flights at this site
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class AzbaConstraint(BaseModel):
    id: str
    name: str
    valid_from: str | None = None
    valid_to: str | None = None
    floor: str | None = None
    ceiling: str | None = None
    geometry: dict[str, Any] | None = None
    distance_km: float | None = None


class AzbaAirspaceResponse(BaseModel):
    site_id: str
    site_name: str
    status: Literal["clear", "blocking", "unknown"]
    source: str
    source_url: str
    retrieved_at: str
    valid_from: str
    valid_to: str
    radius_km: float
    latest_azba_date: str | None = None
    constraints: list[AzbaConstraint]
    message: str | None = None


# Landing Associations
class LandingAssociationCreate(BaseModel):
    landing_site_id: str
    is_primary: bool = False
    notes: str | None = None


class LandingAssociationUpdate(BaseModel):
    is_primary: bool | None = None
    notes: str | None = None


class LandingAssociation(BaseModel):
    id: str
    takeoff_site_id: str
    landing_site_id: str
    is_primary: bool = False
    distance_km: float | None = None
    notes: str | None = None
    landing_site: Site | None = None
    created_at: datetime | None = None

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
    name: str | None = None
    site_id: str | None = None

    @validator("duration_minutes", "max_altitude_m", "elevation_gain_m")
    def positive_values(cls, value):
        if value is not None and value < 0:
            raise ValueError("Value must be positive or zero")
        return value

    @validator("distance_km", "max_speed_kmh")
    def positive_floats(cls, value):
        if value is not None and value < 0:
            raise ValueError("Value must be positive or zero")
        return value

    @validator("flight_date")
    def date_not_future(cls, value):
        if value > date.today():
            raise ValueError("Flight date cannot be in the future")
        return value


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
    external_provider: str | None = None
    external_activity_id: str | None = None
    gpx_file_path: str | None = None
    external_url: str | None = None
    video_export_job_id: str | None = None
    video_export_status: str | None = None  # "processing", "completed", "failed"
    video_export_progress: int | None = None
    video_file_path: str | None = None
    video_file_exists: bool = False
    gopro_camera_file_exists: bool = False
    gopro_overlay_job_id: str | None = None
    gopro_overlay_status: str | None = None
    gopro_overlay_progress: int | None = None
    gopro_overlay_file_path: str | None = None
    gopro_overlay_file_exists: bool = False
    created_at: datetime
    updated_at: datetime
    site: SiteInFlight | None = None  # Include site details with orientation

    @model_validator(mode="after")
    def validate_external_identity(self) -> "Flight":
        if self.external_provider is not None and not self.external_provider.strip():
            raise ValueError("external_provider must not be blank")
        if self.external_activity_id is not None and not self.external_activity_id.strip():
            raise ValueError("external_activity_id must not be blank")
        if bool(self.external_provider) != bool(self.external_activity_id):
            raise ValueError(
                "external_provider and external_activity_id must both be provided or omitted"
            )
        return self

    class Config:
        from_attributes = True


class IntervalsSyncRequest(BaseModel):
    date_from: date
    date_to: date

    @model_validator(mode="after")
    def validate_date_range(self) -> "IntervalsSyncRequest":
        if self.date_from > self.date_to:
            raise ValueError("date_from must be on or before date_to")
        return self


class IntervalsActivityPreview(BaseModel):
    id: str
    name: str
    start_date_local: datetime
    type: str
    source: str
    file_type: str


class IntervalsPreviewResponse(BaseModel):
    activities: list[IntervalsActivityPreview]
    activity_types: list[str]


class ExternalFlightSummary(BaseModel):
    id: str
    external_provider: str
    external_activity_id: str
    name: str
    date: date


class ExternalImportResult(BaseModel):
    success: bool = True
    imported: int
    updated: int
    skipped: int
    failed: int
    flights: list[ExternalFlightSummary]


class IntervalsStatus(BaseModel):
    configured: bool
    enabled: bool
    automatic_sync_ready: bool
    awaiting_activity_type: bool
    interval_minutes: int
    lookback_days: int
    activity_types: list[str]


class FlightRecord(BaseModel):
    value: int | float
    flight_id: str
    flight_name: str
    flight_date: str | None = None
    site_name: str | None = None
    site_id: str | None = None
    departure_time: str | None = None
    partial: bool = False


class TakeoffUsageRecord(BaseModel):
    value: int
    site_id: str
    site_name: str
    partial: bool = False


class MonthActivityRecord(BaseModel):
    value: int
    month: str
    partial: bool = False


class FlightRecordsResponse(BaseModel):
    longest_duration: FlightRecord | None = None
    highest_altitude: FlightRecord | None = None
    longest_distance: FlightRecord | None = None
    max_speed: FlightRecord | None = None
    takeoff_elevation_gain: FlightRecord | None = None
    earliest_takeoff: FlightRecord | None = None
    latest_takeoff: FlightRecord | None = None
    most_used_takeoff: TakeoffUsageRecord | None = None
    most_active_month: MonthActivityRecord | None = None


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


class LocationSuggestion(BaseModel):
    id: str
    name: str
    display_name: str
    latitude: float
    longitude: float
    country: str = "FR"


class LocationSearchResponse(BaseModel):
    query: str
    locations: list[LocationSuggestion]


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


class NearbyFlightOptionsResponse(BaseModel):
    city_option: LocationSuggestion
    radius_km: int
    limit: int
    takeoffs: list[ParaglidingSpotSearchResult]
    landings: list[ParaglidingSpotSearchResult]


FlightDecisionLevel = Literal["favorable", "vigilance", "limite", "deconseille", "unavailable"]
FlightDecisionRiskSeverity = Literal["info", "vigilance", "limiting", "blocking"]
FlightDecisionObjective = Literal["tranquille", "progression", "thermique"]


class FlightDecisionDiagnostic(BaseModel):
    code: str
    severity: FlightDecisionRiskSeverity
    translation_key: str
    params: dict[str, Any] = {}


class FlightDecisionSite(BaseModel):
    id: str
    name: str
    usage_type: str | None = None
    orientation: str | None = None


class FlightDecisionSummary(BaseModel):
    level: FlightDecisionLevel
    translation_key: str
    score_objectif: int
    title_key: str
    message_key: str
    message_params: dict[str, Any]
    main_risk_code: str | None = None
    has_recommended_window: bool


class FlightDecisionWindow(BaseModel):
    start_hour: int
    end_hour: int
    level: FlightDecisionLevel
    translation_key: str
    score_objectif: int
    min_score_objectif: int
    hours: list[int]
    main_risk_codes: list[str]
    summary_key: str
    summary_params: dict[str, Any]


class FlightDecisionWind(BaseModel):
    speed_kmh: float | None = None
    gust_kmh: float | None = None
    direction_deg: float | None = None
    direction_label: str | None = None


class FlightDecisionWindDecollage(BaseModel):
    status: str
    translation_key: str
    angle_deviation_deg: int | None = None
    selected_orientation: str | None = None
    severity: FlightDecisionRiskSeverity


class FlightDecisionThermal(BaseModel):
    strength: str
    cape: float | None = None
    lifted_index: float | None = None
    objective_effect: str
    translation_key: str


class FlightDecisionHourConfidence(BaseModel):
    level: str
    score: int
    source_count: int


class FlightDecisionHour(BaseModel):
    hour: int
    is_past: bool
    level: FlightDecisionLevel
    translation_key: str
    score_objectif: int
    para_index: int
    risks: list[FlightDecisionDiagnostic]
    wind: FlightDecisionWind
    wind_decollage: FlightDecisionWindDecollage
    thermal: FlightDecisionThermal
    confidence: FlightDecisionHourConfidence


class FlightDecisionFreshness(BaseModel):
    cached_at: str | None = None
    age_minutes: int | None = None
    status: str


class FlightDecisionConfidence(BaseModel):
    level: str
    score: int
    translation_key: str
    source_count: int
    expected_source_count: int
    freshness: FlightDecisionFreshness
    diagnostics: list[FlightDecisionDiagnostic]


class FlightDecisionLanding(BaseModel):
    site_id: str
    name: str
    distance_km: float | None = None
    is_primary: bool
    level: FlightDecisionLevel
    score_objectif: int | None = None
    risks: list[FlightDecisionDiagnostic]


class FlightDecisionLandingSafety(BaseModel):
    status: Literal["evaluated", "not_configured", "unavailable"]
    level: FlightDecisionLevel
    translation_key: str
    summary_key: str
    summary_params: dict[str, Any]
    landings: list[FlightDecisionLanding]


class FlightDecisionLiveWind(BaseModel):
    status: Literal["not_evaluated", "unavailable", "evaluated", "stale"]
    influences_confidence: bool
    stations: list[dict[str, Any]]
    diagnostics: list[FlightDecisionDiagnostic]


class FlightDecisionResponse(BaseModel):
    site: FlightDecisionSite
    objective: FlightDecisionObjective
    timezone: str
    day_index: int
    summary: FlightDecisionSummary
    best_window: FlightDecisionWindow | None = None
    least_unfavorable_window: FlightDecisionWindow | None = None
    hourly: list[FlightDecisionHour]
    risks: list[FlightDecisionDiagnostic]
    confidence: FlightDecisionConfidence
    landing_safety: FlightDecisionLandingSafety
    live_wind: FlightDecisionLiveWind
    alternatives: list[dict[str, Any]]
    cached_at: str | None = None


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
    forecast_date: date | None = None
    forecast_hour: int | None = None
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
    sources_errors: str | None = None  # JSON: {"meteo-parapente": "timeout", ...}

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
    forecast_hour: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class EmagramTriggerRequest(BaseModel):
    """Request schema for manually triggering emagram analysis"""

    site_id: str | None = None
    user_latitude: float | None = None
    user_longitude: float | None = None
    force_refresh: bool = False
    day_index: int = 0
    hour: int | None = None
    locale: str | None = None

    @validator("user_latitude")
    def validate_latitude(cls, v):
        if v is not None and not -90 <= v <= 90:
            raise ValueError("Latitude must be between -90 and 90")
        return v

    @validator("user_longitude")
    def validate_longitude(cls, v):
        if v is not None and not -180 <= v <= 180:
            raise ValueError("Longitude must be between -180 and 180")
        return v

    @validator("locale")
    def validate_locale(cls, v):
        if v is None:
            return v
        normalized = v.lower().split("-", maxsplit=1)[0]
        if normalized not in {"fr", "en"}:
            raise ValueError("Locale must be 'fr' or 'en'")
        return normalized


class VideoExportTempCleanupError(BaseModel):
    path: str
    error: str


class VideoExportTempCleanupResponse(BaseModel):
    files_deleted: int
    dirs_deleted: int
    bytes_deleted: int
    paths_deleted: list[str]
    errors: list[VideoExportTempCleanupError]
