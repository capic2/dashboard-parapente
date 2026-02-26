from sqlalchemy import Column, String, Integer, Float, DateTime, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Site(Base):
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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    flights = relationship("Flight", back_populates="site")
    weather_forecasts = relationship("WeatherForecast", back_populates="site")

class Flight(Base):
    __tablename__ = "flights"
    
    id = Column(String, primary_key=True)
    strava_id = Column(String, unique=True, nullable=True)
    site_id = Column(String, ForeignKey("sites.id"), nullable=True)
    title = Column(String)
    description = Column(Text)
    flight_date = Column(Date, nullable=False)
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
