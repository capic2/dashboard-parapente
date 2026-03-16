"""
pytest configuration and fixtures
"""
import pytest
import sys
import os
from pathlib import Path

# Set testing mode before importing config
os.environ["TESTING"] = "true"
os.environ["USE_FAKE_REDIS"] = "true"

# Add backend dir to Python path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# IMPORTANT: Import all models BEFORE importing main.app
# This ensures all tables are registered with SQLAlchemy Base.metadata
# before Base.metadata.create_all() is called in the test_db fixture
from models import (
    Site,
    Flight,
    WeatherForecast,
    WeatherSourceConfig,
    EmagramAnalysis,
    EmagramFeedback,
    ParaglidingSpot
)

# DIAGNOSTIC CHECKPOINT 1: Verify models are registered after import
from database import Base
print("\n" + "=" * 80)
print("🔍 DIAGNOSTIC CHECKPOINT 1: After importing model classes")
print("=" * 80)
print(f"📊 Base.metadata.tables keys: {list(Base.metadata.tables.keys())}")
print(f"📈 Number of registered tables: {len(Base.metadata.tables)}")
print(f"✅ Expected: 7 tables")
print(f"📍 Status: {'PASS' if len(Base.metadata.tables) == 7 else 'FAIL ⚠️'}")
if len(Base.metadata.tables) != 7:
    print(f"⚠️  WARNING: Only {len(Base.metadata.tables)}/7 models registered!")
print("=" * 80 + "\n")

from database import get_db
from main import app

# DIAGNOSTIC CHECKPOINT 2: Verify registration after main.app import
print("\n" + "=" * 80)
print("🔍 DIAGNOSTIC CHECKPOINT 2: After importing main.app")
print("=" * 80)
print(f"📊 Base.metadata.tables keys: {list(Base.metadata.tables.keys())}")
print(f"📈 Number of registered tables: {len(Base.metadata.tables)}")
print(f"✅ Expected: 7 tables (should not change from Checkpoint 1)")
print(f"📍 Status: {'PASS' if len(Base.metadata.tables) == 7 else 'FAIL ⚠️'}")
if len(Base.metadata.tables) != 7:
    print(f"⚠️  WARNING: Only {len(Base.metadata.tables)}/7 models registered!")
print("=" * 80 + "\n")

import tempfile

# Use temporary file SQLite for tests
@pytest.fixture(scope="function")
def test_db():
    """Create a test database (temporary SQLite file)"""
    import tempfile
    import os
    
    # Create temporary DB file
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    
    # Connect to temp DB
    engine = create_engine(f"sqlite:///{db_path}")
    
    # DIAGNOSTIC CHECKPOINT 3: Verify registration before create_all()
    print("\n" + "=" * 80)
    print("🔍 DIAGNOSTIC CHECKPOINT 3: Before Base.metadata.create_all()")
    print("=" * 80)
    print(f"📊 Base.metadata.tables keys: {list(Base.metadata.tables.keys())}")
    print(f"📈 Number of tables to create: {len(Base.metadata.tables)}")
    print(f"✅ Expected: 7 tables")
    print(f"📍 Status: {'PASS' if len(Base.metadata.tables) == 7 else 'CRITICAL FAIL ⚠️'}")
    if len(Base.metadata.tables) != 7:
        print(f"🚨 CRITICAL: Only {len(Base.metadata.tables)}/7 models in metadata!")
        print(f"🚨 This means create_all() will only create {len(Base.metadata.tables)} tables")
    print("=" * 80 + "\n")
    
    Base.metadata.create_all(bind=engine)
    
    # DIAGNOSTIC CHECKPOINT 4: Verify actual tables created in database
    from sqlalchemy import inspect
    inspector = inspect(engine)
    actual_tables = inspector.get_table_names()
    
    print("\n" + "=" * 80)
    print("🔍 DIAGNOSTIC CHECKPOINT 4: After Base.metadata.create_all()")
    print("=" * 80)
    print(f"📊 Metadata tables: {list(Base.metadata.tables.keys())}")
    print(f"💾 Actual DB tables: {actual_tables}")
    print(f"📈 Metadata count: {len(Base.metadata.tables)}")
    print(f"💿 Actual DB count: {len(actual_tables)}")
    print(f"✅ Expected: 7 tables in both")
    
    if len(Base.metadata.tables) == len(actual_tables) == 7:
        print(f"✅ PASS: All 7 tables created successfully!")
    else:
        print(f"🚨 MISMATCH DETECTED!")
        print(f"   - Metadata has: {len(Base.metadata.tables)} tables")
        print(f"   - Database has: {len(actual_tables)} tables")
        
        if len(Base.metadata.tables) != 7:
            print(f"   - Issue: Models not registered in metadata")
        
        if len(actual_tables) != len(Base.metadata.tables):
            print(f"   - Issue: create_all() did not create all metadata tables")
            missing_in_db = set(Base.metadata.tables.keys()) - set(actual_tables)
            extra_in_db = set(actual_tables) - set(Base.metadata.tables.keys())
            if missing_in_db:
                print(f"   - Missing in DB: {missing_in_db}")
            if extra_in_db:
                print(f"   - Extra in DB: {extra_in_db}")
    
    print("=" * 80 + "\n")
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()
    
    app.dependency_overrides[get_db] = override_get_db
    yield SessionLocal
    
    # Cleanup
    app.dependency_overrides.clear()
    engine.dispose()
    
    # Remove temp file
    try:
        os.unlink(db_path)
    except:
        pass


@pytest.fixture(scope="function")
def client(test_db):
    """FastAPI TestClient with test database"""
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
    with open(fixtures_path, "r") as f:
        data = json.load(f)
    return data["sites"]


@pytest.fixture
def sample_gpx():
    """Load sample GPX file (Arguel flight)"""
    fixtures_path = Path(__file__).parent / "tests" / "fixtures" / "sample_arguel.gpx"
    with open(fixtures_path, "r") as f:
        return f.read()


@pytest.fixture
def sample_consensus_weather():
    """Load sample consensus weather data"""
    import json
    fixtures_path = Path(__file__).parent / "tests" / "fixtures" / "sample_consensus_weather.json"
    with open(fixtures_path, "r") as f:
        return json.load(f)


@pytest.fixture
def sample_strava_activity():
    """Load sample Strava activity response"""
    import json
    fixtures_path = Path(__file__).parent / "tests" / "fixtures" / "sample_strava_activity.json"
    with open(fixtures_path, "r") as f:
        return json.load(f)


@pytest.fixture
def mock_open_meteo_response():
    """Load mock Open-Meteo API response"""
    import json
    fixtures_path = (
        Path(__file__).parent / "tests" / "fixtures" / 
        "mock_responses" / "open_meteo_response.json"
    )
    with open(fixtures_path, "r") as f:
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
    from models import Site
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
        usage_type="takeoff"
    )
    db_session.add(site)
    db_session.commit()
    db_session.refresh(site)
    return site


@pytest.fixture
def chalais_site(db_session):
    """Create Chalais site in test DB"""
    from models import Site
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
        usage_type="takeoff"
    )
    db_session.add(site)
    db_session.commit()
    db_session.refresh(site)
    return site


@pytest.fixture
def sample_flight(db_session, arguel_site):
    """Create sample flight in test DB"""
    from models import Flight
    from datetime import datetime, date
    
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
        strava_id="123456789"
    )
    db_session.add(flight)
    db_session.commit()
    db_session.refresh(flight)
    return flight
