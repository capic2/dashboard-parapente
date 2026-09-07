from contextlib import contextmanager
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from config import DATABASE_URL

# Extract database file path from DATABASE_URL
# For sqlite URLs like "sqlite:///./test.db" or "sqlite:///./db/dashboard.db"
if DATABASE_URL.startswith("sqlite:///"):
    db_file_path = DATABASE_URL.replace("sqlite:///", "")
    # Handle relative paths (with or without "./" prefix) as script-relative
    if db_file_path.startswith("./"):
        DB_PATH = Path(__file__).parent / db_file_path[2:]
    elif not Path(db_file_path).is_absolute():
        # Relative paths without "./" are also treated as script-relative
        DB_PATH = Path(__file__).parent / db_file_path
    else:
        # Absolute paths are used as-is
        DB_PATH = Path(db_file_path)
else:
    # Fallback for non-sqlite databases (DB_PATH unused for non-file databases)
    DB_PATH = Path(__file__).parent / "db" / "dashboard.db"

_SQLITE_BUSY_TIMEOUT_MS = 30_000

connect_args = {"check_same_thread": False}
if DATABASE_URL.startswith("sqlite"):
    # SQLite permits concurrent readers, but only one writer.  Waiting here
    # avoids transient failures when workers update job progress concurrently.
    connect_args["timeout"] = _SQLITE_BUSY_TIMEOUT_MS / 1000

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
    pool_size=20,  # Increase pool size for concurrent operations
    max_overflow=30,  # Allow more overflow connections
    pool_timeout=60,  # Increase timeout to 60 seconds
    pool_recycle=3600,  # Recycle connections after 1 hour
    pool_pre_ping=True,  # Verify connections before using
)


if DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _configure_sqlite_connection(dbapi_connection: Any, _connection_record: Any) -> None:
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute(f"PRAGMA busy_timeout = {_SQLITE_BUSY_TIMEOUT_MS}")
            cursor.execute("PRAGMA journal_mode = WAL")
            cursor.execute("PRAGMA synchronous = NORMAL")
        finally:
            cursor.close()


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
