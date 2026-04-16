from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    """Application user for authentication"""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(320), unique=True, nullable=False, index=True)
    hashed_password = Column(String(1024), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=func.now())


class AppSetting(Base):
    """Key-value store for application settings configurable from the UI"""

    __tablename__ = "app_settings"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ParaglidingSpot(Base):
    """
    External paragliding sites from OpenAIP and ParaglidingSpots.com
    This is a comprehensive database of all known paragliding sites in France
    """

    __tablename__ = "paragliding_spots"

    id = Column(String, primary_key=True)  # Format: openaip_{hash} or pgs_{id} or merged_{hash}
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # "takeoff", "landing", or "both"
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    elevation_m = Column(Integer)
    orientation = Column(String)  # N, NNW, SE, etc.
    rating = Column(Integer)  # 0-6 from ParaglidingSpots
    country = Column(String, default="FR", index=True)
    source = Column(String, nullable=False)  # "openaip", "paraglidingspots", or "merged"
    openaip_id = Column(String, unique=True)
    paraglidingspots_id = Column(Integer, unique=True)
    raw_metadata = Column(Text)  # JSON string with original data
    last_synced = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to sites that link to this spot
    linked_sites = relationship("Site", back_populates="linked_spot")


class Site(Base):
    """
    User-managed sites (custom spots or favorites)
    Can be linked to external ParaglidingSpot for enhanced data
    """

    __tablename__ = "sites"

    id = Column(String, primary_key=True)
    code = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    elevation_m = Column(Integer)
    latitude = Column(Float)
    longitude = Column(Float)
    description = Column(Text)
    region = Column(String)
    country = Column(String, default="FR")
    site_type = Column(String, default="user_spot")  # "user_spot", "official_spot", "custom"
    usage_type = Column(
        String, default="both"
    )  # "takeoff", "landing", "both" - how the site is used
    linked_spot_id = Column(
        String, ForeignKey("paragliding_spots.id")
    )  # Link to external spot data
    rating = Column(Integer)  # 0-6 rating from official spots database
    orientation = Column(String)  # N, NW, W, S, etc. - wind direction the site faces
    camera_angle = Column(
        Integer
    )  # Camera angle in degrees (0-360) - where to position camera relative to takeoff
    camera_distance = Column(
        Integer, default=500
    )  # Distance in meters from takeoff point (default: 500m)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    flights = relationship("Flight", back_populates="site")
    weather_forecasts = relationship("WeatherForecast", back_populates="site")
    linked_spot = relationship("ParaglidingSpot", back_populates="linked_sites")
    landing_associations = relationship(
        "SiteLandingAssociation",
        foreign_keys="SiteLandingAssociation.takeoff_site_id",
        back_populates="takeoff_site",
        cascade="all, delete-orphan",
    )


class SiteLandingAssociation(Base):
    """Junction table linking a takeoff site to its landing sites"""

    __tablename__ = "site_landing_associations"

    id = Column(String, primary_key=True)
    takeoff_site_id = Column(String, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    landing_site_id = Column(String, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    is_primary = Column(Boolean, default=False)
    distance_km = Column(Float)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    takeoff_site = relationship(
        "Site", foreign_keys=[takeoff_site_id], back_populates="landing_associations"
    )
    landing_site = relationship("Site", foreign_keys=[landing_site_id])


class Flight(Base):
    __tablename__ = "flights"

    id = Column(String, primary_key=True)
    strava_id = Column(String, unique=True, nullable=True)
    site_id = Column(String, ForeignKey("sites.id"), nullable=True)
    name = Column(String)  # Format: "Lieu JJ-MM HHhMM"
    title = Column(String)  # Legacy field
    description = Column(Text)
    flight_date = Column(Date, nullable=False)
    departure_time = Column(DateTime, nullable=True)  # Datetime du premier trackpoint GPX
    duration_minutes = Column(Integer)
    max_altitude_m = Column(Integer)
    max_speed_kmh = Column(Float)
    distance_km = Column(Float)
    elevation_gain_m = Column(Integer)
    notes = Column(Text)
    gpx_file_path = Column(String)
    gpx_max_altitude_m = Column(Integer)
    gpx_elevation_gain_m = Column(Integer)
    external_url = Column(String)
    # Video export fields
    video_export_job_id = Column(String, nullable=True)  # Background job ID for video conversion
    video_export_status = Column(String, nullable=True)  # "processing", "completed", "failed"
    video_file_path = Column(String, nullable=True)  # Path to generated MP4 file
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    site = relationship("Site", back_populates="flights")
    export_jobs = relationship(
        "VideoExportJob",
        back_populates="flight",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="VideoExportJob.created_at",
    )


class VideoExportJob(Base):
    __tablename__ = "video_export_jobs"

    id = Column(String, primary_key=True)
    flight_id = Column(
        String,
        ForeignKey("flights.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String, nullable=False, index=True)
    mode = Column(String, default="manual")
    quality = Column(String, default="1080p")
    fps = Column(Integer, default=15)
    speed = Column(Integer, default=1)
    progress = Column(Integer, default=0)
    message = Column(Text)
    frontend_url = Column(String)
    video_path = Column(String)
    total_frames = Column(Integer)
    error = Column(Text)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    flight = relationship("Flight", back_populates="export_jobs")


class WeatherForecast(Base):
    __tablename__ = "weather_forecasts"

    id = Column(String, primary_key=True)
    site_id = Column(String, ForeignKey("sites.id"), nullable=False)
    forecast_date = Column(Date, nullable=False)
    para_index = Column(Integer)
    wind_avg_kmh = Column(Float)
    wind_max_kmh = Column(Float)
    temperature_avg_c = Column(Float)
    temperature_min_c = Column(Float)
    temperature_max_c = Column(Float)
    precipitation_mm = Column(Float)
    cloud_cover_percent = Column(Integer)
    verdict = Column(String)  # BON, MOYEN, LIMITE, MAUVAIS
    flyable_slots = Column(Text)  # JSON string of time slots
    source = Column(String)  # open-meteo, weatherapi, etc
    created_at = Column(DateTime, default=datetime.utcnow)

    site = relationship("Site", back_populates="weather_forecasts")


class WeatherSourceConfig(Base):
    """Configuration and statistics for weather data sources"""

    __tablename__ = "weather_source_config"

    # Identification
    id = Column(String, primary_key=True)
    source_name = Column(
        String, unique=True, nullable=False, index=True
    )  # "open-meteo", "weatherapi", etc.
    display_name = Column(String, nullable=False)  # "Open-Meteo", "WeatherAPI.com", etc.
    description = Column(Text, nullable=True)  # Description for UI

    # Configuration
    is_enabled = Column(Boolean, default=True, nullable=False)
    requires_api_key = Column(Boolean, default=False, nullable=False)
    api_key = Column(String, nullable=True)  # TODO: Encrypt in production
    priority = Column(Integer, default=1, nullable=False)  # For future weighted consensus

    # Type and metadata
    scraper_type = Column(String, nullable=False)  # "api", "playwright", "stealth"
    base_url = Column(String, nullable=True)  # Base URL for the source
    documentation_url = Column(String, nullable=True)  # Link to API docs

    # Statistics (rolling 30 days window)
    last_success_at = Column(DateTime, nullable=True)
    last_error_at = Column(DateTime, nullable=True)
    last_error_message = Column(Text, nullable=True)
    success_count = Column(Integer, default=0, nullable=False)
    error_count = Column(Integer, default=0, nullable=False)
    total_response_time_ms = Column(BigInteger, default=0, nullable=False)  # For avg calculation

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    @property
    def success_rate(self) -> float:
        """Success rate as percentage (0-100)"""
        total = self.success_count + self.error_count
        if total == 0:
            return 0.0
        return round((self.success_count / total) * 100, 2)

    @property
    def avg_response_time_ms(self) -> int | None:
        """Average response time in milliseconds"""
        if self.success_count == 0:
            return None
        return int(self.total_response_time_ms / self.success_count)

    @property
    def api_key_configured(self) -> bool:
        """Check if API key is configured (if required)"""
        if not self.requires_api_key:
            return True  # No key needed
        return bool(self.api_key)

    @property
    def status(self) -> str:
        """Current source status: active, error, disabled, unknown"""
        if not self.is_enabled:
            return "disabled"
        if not self.api_key_configured:
            return "error"  # Missing required API key
        if self.last_success_at is None and self.last_error_at is None:
            return "unknown"  # Never tested
        if self.last_error_at and (
            not self.last_success_at or self.last_error_at > self.last_success_at
        ):
            return "error"  # Last attempt failed
        return "active"  # All good


class StravaTokenLog(Base):
    """Log of Strava token refresh attempts"""

    __tablename__ = "strava_token_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    success = Column(Boolean, nullable=False)
    message = Column(String, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    refresh_mode = Column(String(32), nullable=True)


class EmagramFeedback(Base):
    """Pilot feedback on emagram analysis accuracy"""

    __tablename__ = "emagram_feedback"

    id = Column(String, primary_key=True)
    emagram_analysis_id = Column(String, ForeignKey("emagram_analysis.id"), nullable=False)
    pilot_name = Column(String, nullable=True)
    feedback_date = Column(Date, nullable=False, index=True)
    flight_took_place = Column(Boolean, nullable=False)

    # Actual conditions
    actual_plafond_m = Column(Integer, nullable=True)
    actual_force_ms = Column(Float, nullable=True)
    actual_thermal_quality = Column(String, nullable=True)
    actual_hours_start = Column(Time, nullable=True)
    actual_hours_end = Column(Time, nullable=True)
    actual_risk_level = Column(String, nullable=True)

    # Accuracy ratings (1-5)
    accuracy_plafond = Column(Integer, nullable=True)
    accuracy_force = Column(Integer, nullable=True)
    accuracy_hours = Column(Integer, nullable=True)
    accuracy_overall = Column(Integer, nullable=True)

    # Comments
    comments = Column(Text, nullable=True)
    would_recommend = Column(Boolean, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class EmagramAnalysis(Base):
    """AI-powered emagram (sounding) analysis for thermal forecasting"""

    __tablename__ = "emagram_analysis"

    # Primary Key
    id = Column(String, primary_key=True)

    # Metadata
    analysis_date = Column(Date, nullable=False, index=True)
    analysis_time = Column(Time, nullable=False)
    analysis_datetime = Column(DateTime, nullable=False, index=True)
    forecast_date = Column(Date, nullable=True, index=True)  # The date this forecast is about
    station_code = Column(String, nullable=False, index=True)  # e.g., "07481" (Lyon)
    station_name = Column(String, nullable=False)
    station_latitude = Column(Float, nullable=False)
    station_longitude = Column(Float, nullable=False)
    distance_km = Column(Float, nullable=False)  # Distance from user location

    # Data Source
    data_source = Column(String, nullable=False, default="wyoming")  # "wyoming", "meteociel", etc.
    sounding_time = Column(String, nullable=False)  # "00Z" or "12Z"
    llm_provider = Column(String, nullable=True)  # "anthropic", "openai", "google"
    llm_model = Column(String, nullable=True)  # "claude-3.5-sonnet", "gpt-4-vision", etc.
    llm_tokens_used = Column(Integer, nullable=True)
    llm_cost_usd = Column(Float, nullable=True)
    analysis_method = Column(String, nullable=False)  # "llm_vision" or "classic_calculation"

    # AI Analysis Results (Paragliding-specific metrics)
    plafond_thermique_m = Column(Integer, nullable=True)  # Thermal ceiling in meters
    force_thermique_ms = Column(Float, nullable=True)  # Thermal strength in m/s
    cape_jkg = Column(Float, nullable=True)  # Convective Available Potential Energy
    stabilite_atmospherique = Column(String, nullable=True)  # "stable", "instable", "très instable"
    cisaillement_vent = Column(String, nullable=True)  # "faible", "modéré", "fort"
    heure_debut_thermiques = Column(Time, nullable=True)
    heure_fin_thermiques = Column(Time, nullable=True)
    heures_volables_total = Column(Float, nullable=True)  # Total flyable hours
    risque_orage = Column(String, nullable=True)  # "nul", "faible", "modéré", "élevé"
    score_volabilite = Column(Integer, nullable=True)  # 0-100 flyability score

    # AI Textual Output
    resume_conditions = Column(Text, nullable=True)  # Summary of conditions
    conseils_vol = Column(Text, nullable=True)  # Flight recommendations
    alertes_securite = Column(Text, nullable=True)  # JSON array of safety alerts

    # Classic Meteorology Fallback (computed values)
    lcl_m = Column(Integer, nullable=True)  # Lifting Condensation Level
    lfc_m = Column(Integer, nullable=True)  # Level of Free Convection
    el_m = Column(Integer, nullable=True)  # Equilibrium Level
    lifted_index = Column(Float, nullable=True)  # Stability index
    k_index = Column(Float, nullable=True)  # Thunderstorm potential
    total_totals = Column(Float, nullable=True)  # Thunderstorm index
    showalter_index = Column(Float, nullable=True)  # Stability index
    wind_shear_0_3km_ms = Column(Float, nullable=True)  # Wind shear 0-3km
    wind_shear_0_6km_ms = Column(Float, nullable=True)  # Wind shear 0-6km

    # Raw Data Storage
    skewt_image_path = Column(String, nullable=True)  # Path to generated Skew-T diagram
    raw_sounding_data = Column(Text, nullable=True)  # Original radiosonde data (TEXT:LIST format)
    ai_raw_response = Column(Text, nullable=True)  # Raw JSON response from LLM

    # Multi-Source Emagram Fields (for screenshot-based analysis)
    external_source_urls = Column(
        Text, nullable=True
    )  # JSON: {"meteo-parapente": "url", "topmeteo": "url", ...}
    screenshot_paths = Column(
        Text, nullable=True
    )  # JSON: {"meteo-parapente": "/tmp/...", "topmeteo": "/tmp/...", ...}
    sources_count = Column(
        Integer, nullable=True
    )  # Number of sources successfully analyzed (e.g., 3)
    sources_agreement = Column(
        String, nullable=True
    )  # "high", "medium", "low" - consensus level between sources
    sources_errors = Column(
        Text, nullable=True
    )  # JSON: {"meteo-parapente": "timeout after 30s", ...}

    # Hourly forecast
    forecast_hour = Column(
        Integer, nullable=True, index=True
    )  # 0-23, specific hour of the forecast

    # Status
    analysis_status = Column(
        String, nullable=False, default="completed", index=True
    )  # "completed", "failed", "partial"
    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    @property
    def is_from_llm(self) -> bool:
        """Check if analysis was done using LLM vision"""
        return self.analysis_method == "llm_vision" and self.llm_provider is not None

    @property
    def has_thermal_data(self) -> bool:
        """Check if thermal forecasting data is available"""
        return self.plafond_thermique_m is not None or self.force_thermique_ms is not None

    @property
    def flyable_hours_formatted(self) -> str | None:
        """Format flyable hours as 'HH:MM - HH:MM'"""
        if self.heure_debut_thermiques and self.heure_fin_thermiques:
            return f"{self.heure_debut_thermiques.strftime('%H:%M')} - {self.heure_fin_thermiques.strftime('%H:%M')}"
        return None
