from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from pathlib import Path
from contextlib import contextmanager
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./db/dashboard.db")
DB_PATH = Path(__file__).parent / "db" / "dashboard.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@contextmanager
def get_db_context():
    """
    Context manager for database sessions (for use outside FastAPI dependency injection)
    
    Usage:
        with get_db_context() as db:
            result = db.query(Model).first()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
