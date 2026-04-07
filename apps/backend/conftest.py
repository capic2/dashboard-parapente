"""
pytest configuration and fixtures
"""

import os
import sys
from pathlib import Path

import pytest

# Set testing mode before importing config
os.environ["TESTING"] = "true"
os.environ["BACKEND_USE_FAKE_REDIS"] = "true"

# Set dummy API keys for tests
os.environ["BACKEND_WEATHERAPI_KEY"] = "test_weather_key"
os.environ["BACKEND_METEOBLUE_API_KEY"] = "test_meteoblue_key"
os.environ["BACKEND_GOOGLE_API_KEY"] = "test_google_key"
os.environ["BACKEND_STRAVA_CLIENT_ID"] = "test_strava_client"
os.environ["BACKEND_STRAVA_CLIENT_SECRET"] = "test_strava_secret"

# Add backend dir to Python path
sys.path.insert(0, str(Path(__file__).parent))

import tempfile

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app

# IMPORTANT: Import all models BEFORE importing main.app
# This ensures all tables are registered with SQLAlchemy Base.metadata
# before Base.metadata.create_all() is called in the test_db fixture
from auth import get_current_user
from models import (
    Flight,
    Site,
    User,
)

# Fake authenticated user for tests
_test_user = User(id=1, email="test@local", hashed_password="", is_active=True)


def _override_get_current_user():
    return _test_user


# Use temporary file SQLite for tests
@pytest.fixture(scope="function")
def test_db():
    """Create a test database (temporary SQLite file)"""
    import os

    # Create temporary DB file
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    # Connect to temp DB
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user
    yield SessionLocal

    # Cleanup
    app.dependency_overrides.clear()
    engine.dispose()

    # Remove temp file
    try:
        os.unlink(db_path)
    except OSError:
        pass


@pytest.fixture(scope="function")
def client(test_db):
    """FastAPI TestClient with test database (authenticated)"""
    return TestClient(app)


@pytest.fixture(scope="function")
def db_session(test_db):
    """Get a test DB session"""
    session = test_db()
    yield session
    session.close()


# ============================================================================
# ADVANCED FIXTURES - Realistic test data
# ============================================================================


@pytest.fixture
def sample_sites():
    """Load realistic site data (Arguel, Chalais, Planfait)"""
    import json

    fixtures_path = Path(__file__).parent / "tests" / "fixtures" / "sites.json"
    with open(fixtures_path) as f:
        data = json.load(f)
    return data["sites"]


@pytest.fixture
def sample_gpx():
    """Load sample GPX file (Arguel flight)"""
    fixtures_path = Path(__file__).parent / "tests" / "fixtures" / "sample_arguel.gpx"
    with open(fixtures_path) as f:
        return f.read()


@pytest.fixture
def sample_consensus_weather():
    """Load sample consensus weather data"""
    import json

    fixtures_path = Path(__file__).parent / "tests" / "fixtures" / "sample_consensus_weather.json"
    with open(fixtures_path) as f:
        return json.load(f)


@pytest.fixture
def sample_strava_activity():
    """Load sample Strava activity response"""
    import json

    fixtures_path = Path(__file__).parent / "tests" / "fixtures" / "sample_strava_activity.json"
    with open(fixtures_path) as f:
        return json.load(f)


@pytest.fixture
def mock_open_meteo_response():
    """Load mock Open-Meteo API response"""
    import json

    fixtures_path = (
        Path(__file__).parent / "tests" / "fixtures" / "mock_responses" / "open_meteo_response.json"
    )
    with open(fixtures_path) as f:
        return json.load(f)


@pytest.fixture
def fake_redis():
    """FakeRedis instance for cache testing"""
    try:
        from fakeredis import FakeRedis

        redis_client = FakeRedis(decode_responses=True)
        yield redis_client
        redis_client.flushall()
    except ImportError:
        pytest.skip("fakeredis not installed")


@pytest.fixture
def arguel_site(db_session):
    """Create Arguel site in test DB"""

    site = Site(
        id="site-arguel",
        code="ARG",
        name="Arguel",
        latitude=47.2,
        longitude=6.0,
        elevation_m=427,
        region="Doubs",
        country="France",
        orientation="SW",
        site_type="user_spot",
        usage_type="takeoff",
    )
    db_session.add(site)
    db_session.commit()
    db_session.refresh(site)
    return site


@pytest.fixture
def chalais_site(db_session):
    """Create Chalais site in test DB"""

    site = Site(
        id="site-chalais",
        code="CHA",
        name="Chalais",
        latitude=47.183333,
        longitude=6.216667,
        elevation_m=920,
        region="Doubs",
        country="France",
        orientation="W",
        site_type="user_spot",
        usage_type="takeoff",
    )
    db_session.add(site)
    db_session.commit()
    db_session.refresh(site)
    return site


@pytest.fixture
def landing_site(db_session):
    """Create a landing site in test DB"""

    site = Site(
        id="site-plaine-arguel",
        code="PLA",
        name="Plaine d'Arguel",
        latitude=47.19,
        longitude=5.99,
        elevation_m=250,
        region="Doubs",
        country="France",
        site_type="user_spot",
        usage_type="landing",
    )
    db_session.add(site)
    db_session.commit()
    db_session.refresh(site)
    return site


@pytest.fixture
def sample_flight(db_session, arguel_site):
    """Create sample flight in test DB"""
    from datetime import date, datetime

    flight = Flight(
        id="flight-test-001",
        name="Arguel 15-03 14h00",
        flight_date=date(2026, 3, 15),
        departure_time=datetime(2026, 3, 15, 14, 0, 0),
        duration_minutes=60,
        distance_km=15.5,
        max_altitude_m=1350,
        max_speed_kmh=45.5,
        site_id="site-arguel",
        strava_id="123456789",
    )
    db_session.add(flight)
    db_session.commit()
    db_session.refresh(flight)
    return flight


@pytest.fixture
def weather_sources(db_session):
    """Create default weather sources in test DB"""
    import uuid

    from models import WeatherSourceConfig

    sources_data = [
        {
            "id": str(uuid.uuid4()),
            "source_name": "open-meteo",
            "display_name": "Open-Meteo",
            "description": "Test weather source - open-source free API",
            "is_enabled": True,
            "requires_api_key": False,
            "api_key": None,
            "priority": 10,
            "scraper_type": "api",
            "base_url": "https://api.open-meteo.com/v1/forecast",
            "documentation_url": "https://open-meteo.com/en/docs",
        },
        {
            "id": str(uuid.uuid4()),
            "source_name": "weatherapi",
            "display_name": "WeatherAPI.com",
            "description": "Test weather source - API with key",
            "is_enabled": True,
            "requires_api_key": True,
            "api_key": "test_weather_key",
            "priority": 9,
            "scraper_type": "api",
            "base_url": "https://api.weatherapi.com/v1/forecast.json",
            "documentation_url": "https://www.weatherapi.com/docs/",
        },
        {
            "id": str(uuid.uuid4()),
            "source_name": "meteo-parapente",
            "display_name": "Météo Parapente",
            "description": "Test weather source - paragliding specific",
            "is_enabled": True,
            "requires_api_key": False,
            "api_key": None,
            "priority": 8,
            "scraper_type": "playwright",
            "base_url": "https://meteo-parapente.com",
            "documentation_url": None,
        },
    ]

    sources = []
    for data in sources_data:
        source = WeatherSourceConfig(**data)
        db_session.add(source)
        sources.append(source)

    db_session.commit()

    for source in sources:
        db_session.refresh(source)

    return sources
