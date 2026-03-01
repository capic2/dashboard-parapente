"""
pytest configuration and fixtures
"""
import pytest
import sys
import os
from pathlib import Path

# Add backend dir to Python path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from database import Base, get_db
from main import app
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
    Base.metadata.create_all(bind=engine)
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
