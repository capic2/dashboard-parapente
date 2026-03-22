from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from config import DATABASE_URL

DB_PATH = Path(__file__).parent / "db" / "dashboard.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
    pool_size=20,  # Increase pool size for concurrent operations
    max_overflow=30,  # Allow more overflow connections
    pool_timeout=60,  # Increase timeout to 60 seconds
    pool_recycle=3600,  # Recycle connections after 1 hour
    pool_pre_ping=True,  # Verify connections before using
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
