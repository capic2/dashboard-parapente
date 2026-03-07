from sqlalchemy import Column, String, Integer, Float, DateTime, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

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
    usage_type = Column(String, default="both")  # "takeoff", "landing", "both" - how the site is used
    linked_spot_id = Column(String, ForeignKey("paragliding_spots.id"))  # Link to external spot data
    rating = Column(Integer)  # 0-6 rating from official spots database
    orientation = Column(String)  # N, NW, W, S, etc. - wind direction the site faces
    camera_angle = Column(Integer)  # Camera angle in degrees (0-360) - where to position camera relative to takeoff
    camera_distance = Column(Integer, default=500)  # Distance in meters from takeoff point (default: 500m)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    flights = relationship("Flight", back_populates="site")
    weather_forecasts = relationship("WeatherForecast", back_populates="site")
    linked_spot = relationship("ParaglidingSpot", back_populates="linked_sites")

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
