from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pathlib import Path
from database import engine, Base
from models import Site, ParaglidingSpot
from routes import router
from webhooks import router as webhooks_router
from scheduler import start_scheduler, stop_scheduler
from database import SessionLocal
import logging
import sqlite3
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def run_migrations():
    """
    Run database migrations
    This handles SQLite's limitations with ALTER TABLE gracefully
    """
    migrations_dir = Path(__file__).parent / "db" / "migrations"
    db_path = Path(__file__).parent / "db" / "dashboard.db"
    
    if not migrations_dir.exists():
        logger.warning(f"Migrations directory not found: {migrations_dir}")
        return
    
    # Get all .sql migration files
    migration_files = sorted(migrations_dir.glob("*.sql"))
    
    if not migration_files:
        logger.info("No migration files found")
        return
    
    logger.info(f"Running {len(migration_files)} migration(s)...")
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    for migration_file in migration_files:
        logger.info(f"Applying migration: {migration_file.name}")
        
        try:
            with open(migration_file, 'r') as f:
                sql = f.read()
            
            # Execute migration (handle multi-statement SQL)
            cursor.executescript(sql)
            conn.commit()
            logger.info(f"✓ Migration {migration_file.name} applied successfully")
            
        except sqlite3.OperationalError as e:
            if "already exists" in str(e) or "duplicate column name" in str(e):
                logger.info(f"⊙ Migration {migration_file.name} already applied (skipping)")
            else:
                logger.error(f"✗ Migration {migration_file.name} failed: {e}")
                raise
    
    # Add new columns to sites table (handle gracefully if already exist)
    try:
        cursor.execute("ALTER TABLE sites ADD COLUMN site_type VARCHAR DEFAULT 'user_spot'")
        conn.commit()
        logger.info("✓ Added site_type column to sites table")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            logger.info("⊙ Column site_type already exists (skipping)")
        else:
            raise
    
    try:
        cursor.execute("ALTER TABLE sites ADD COLUMN linked_spot_id VARCHAR REFERENCES paragliding_spots(id)")
        conn.commit()
        logger.info("✓ Added linked_spot_id column to sites table")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            logger.info("⊙ Column linked_spot_id already exists (skipping)")
        else:
            raise
    
    conn.close()
    logger.info("✓ All migrations completed")

# Run migrations first
run_migrations()

# Create tables (SQLAlchemy will handle new models)
Base.metadata.create_all(bind=engine)


async def initial_cache_warmup():
    """
    Warm up Redis cache on startup
    Fetches today's data for all sites (non-blocking)
    """
    from scheduler import scheduled_weather_fetch
    
    try:
        # Wait 3 seconds for app to fully start
        await asyncio.sleep(3)
        
        logger.info("🔥 Starting cache warmup...")
        await scheduled_weather_fetch()
        logger.info("✅ Cache warmup complete!")
        
    except Exception as e:
        logger.error(f"❌ Cache warmup failed: {e}")
        logger.info("⚠️ App will continue, cache will populate on first request or next hourly poll")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan: startup and shutdown events
    """
    # Startup
    logger.info("🚀 Starting Dashboard Parapente API...")
    
    # Start scheduler
    start_scheduler()
    
    # Initial cache warmup (non-blocking)
    logger.info("🔥 Triggering initial cache warmup...")
    asyncio.create_task(initial_cache_warmup())
    
    yield
    
    # Shutdown
    logger.info("⏹️ Shutting down Dashboard Parapente API...")
    stop_scheduler()


app = FastAPI(
    title="Dashboard Parapente API",
    description="Backend for paragliding weather dashboard with multi-source forecasts, Para-Index scoring, and Strava integration",
    version="0.2.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "0.0.0.0"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)
app.include_router(webhooks_router)

# Database
DB_PATH = Path(__file__).parent / "db" / "dashboard.db"

@app.get("/")
def read_root():
    return {
        "status": "ok",
        "message": "Dashboard Parapente API v0.2.0",
        "features": [
            "Multi-source weather aggregation (5 sources)",
            "Para-Index scoring (0-100)",
            "Hourly scheduler (every hour)",
            "Strava webhook integration",
            "Telegram notifications"
        ],
        "db_path": str(DB_PATH),
        "db_exists": DB_PATH.exists()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
