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
import asyncio

# Import configuration (loads environment variables automatically)
import config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def initialize_database():
    """
    Initialize database: create schema and seed default sites
    This ensures the database is always properly set up on startup
    """
    from database import Base, engine, DB_PATH
    import models  # Import models to register them with Base
    
    logger.info("=" * 60)
    logger.info("DATABASE INITIALIZATION")
    logger.info("=" * 60)
    
    # Step 1: Create schema
    logger.info("Creating database schema...")
    try:
        # Ensure db directory exists
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        
        # Verify database file
        if DB_PATH.exists():
            size = DB_PATH.stat().st_size
            logger.info(f"✓ Database file exists: {DB_PATH} ({size:,} bytes)")
        else:
            logger.error(f"✗ Database file not created at {DB_PATH}")
            return False
            
    except Exception as e:
        logger.error(f"✗ Error creating schema: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Step 2: Check if sites exist
    logger.info("Checking for existing sites...")
    try:
        db = SessionLocal()
        site_count = db.query(Site).count()
        db.close()
        
        if site_count > 0:
            logger.info(f"✓ Database already contains {site_count} sites - skipping seed")
            return True
            
        logger.info("No sites found - seeding default sites...")
        
    except Exception as e:
        logger.warning(f"Could not check sites: {e}")
        logger.info("Attempting to seed sites anyway...")
    
    # Step 3: Seed sites
    try:
        from datetime import datetime
        
        sites_data = [
            {
                'id': 'site-arguel',
                'code': 'arguel',
                'name': 'Arguel',
                'latitude': 47.1944,
                'longitude': 5.9896,
                'elevation_m': 462,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 3,
                'orientation': 'NNW',
                'linked_spot_id': 'merged_884e0213d9116315'
            },
            {
                'id': 'site-mont-poupet-nord',
                'code': 'mont-poupet-nord',
                'name': 'Mont Poupet Nord',
                'latitude': 46.9716,
                'longitude': 5.8776,
                'elevation_m': 795,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 4,
                'orientation': 'N',
                'linked_spot_id': 'merged_d370be468747c90a'
            },
            {
                'id': 'site-mont-poupet-nw',
                'code': 'mont-poupet-nw',
                'name': 'Mont Poupet Nord-Ouest',
                'latitude': 46.9701,
                'longitude': 5.8742,
                'elevation_m': 795,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 3,
                'orientation': 'NW',
                'linked_spot_id': 'merged_c30c861b49a65324'
            },
            {
                'id': 'site-mont-poupet-ouest',
                'code': 'mont-poupet-ouest',
                'name': 'Mont Poupet Ouest',
                'latitude': 46.9693,
                'longitude': 5.8747,
                'elevation_m': 795,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 4,
                'orientation': 'W',
                'linked_spot_id': 'merged_359e1153c44c269e'
            },
            {
                'id': 'site-mont-poupet-sud',
                'code': 'mont-poupet-sud',
                'name': 'Mont Poupet Sud',
                'latitude': 46.9691,
                'longitude': 5.8762,
                'elevation_m': 795,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 1,
                'orientation': 'S',
                'linked_spot_id': 'merged_60fbcc6724417e87'
            },
            {
                'id': 'site-la-cote',
                'code': 'la-cote',
                'name': 'La Côte',
                'latitude': 46.9424,
                'longitude': 5.8438,
                'elevation_m': 800,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 2,
                'orientation': 'N',
                'linked_spot_id': 'merged_d3836f8db6c839fa'
            }
        ]
        
        db = SessionLocal()
        now = datetime.utcnow()
        
        for site_data in sites_data:
            # Check if site already exists
            existing = db.query(Site).filter(Site.id == site_data['id']).first()
            if existing:
                logger.info(f"⊙ Site already exists: {site_data['name']} ({site_data['code']})")
                continue
            
            # Create new site
            site = Site(
                id=site_data['id'],
                code=site_data['code'],
                name=site_data['name'],
                latitude=site_data['latitude'],
                longitude=site_data['longitude'],
                elevation_m=site_data['elevation_m'],
                region=site_data['region'],
                country=site_data['country'],
                rating=site_data.get('rating'),
                orientation=site_data.get('orientation'),
                linked_spot_id=site_data.get('linked_spot_id'),
                created_at=now,
                updated_at=now
            )
            db.add(site)
            logger.info(f"✓ Seeded: {site_data['name']} ({site_data['code']}) at {site_data['latitude']:.4f}, {site_data['longitude']:.4f}")
        
        db.commit()
        
        # Verify
        final_count = db.query(Site).count()
        db.close()
        
        logger.info(f"✓ Database now contains {final_count} sites")
        logger.info("=" * 60)
        logger.info("✅ DATABASE INITIALIZATION COMPLETE")
        logger.info("=" * 60)
        
        return True
        
    except Exception as e:
        logger.error(f"✗ Error seeding sites: {e}")
        import traceback
        traceback.print_exc()
        return False

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

# Initialize database (create schema + seed sites)
initialize_database()

# Run migrations (if any exist)
run_migrations()


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

# CORS - Allow all origins for development (restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins during development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)
app.include_router(webhooks_router)

# ============================================
# Serve Static Files (Frontend React SPA)
# ============================================
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

STATIC_DIR = Path(__file__).parent / "static"

if STATIC_DIR.exists():
    logger.info(f"✓ Static directory found: {STATIC_DIR}")
    
    # Mount static assets (CSS, JS, images, etc.)
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")
    
    # Catch-all route for SPA (MUST be LAST route)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """
        Serve React SPA for all non-API routes
        
        Priority:
        1. API routes (handled by routers above)
        2. Static files (assets, favicon, etc.)
        3. index.html (React Router SPA)
        """
        # Check if requesting a specific static file
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        
        # Serve index.html for all other routes (SPA client-side routing)
        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        
        # Fallback if frontend not built
        return {
            "error": "Frontend not built",
            "message": "Build frontend first: cd frontend && npm run build",
            "static_dir": str(STATIC_DIR),
            "hint": "Or access API docs at /docs"
        }
else:
    logger.warning(f"⚠️  Static directory not found: {STATIC_DIR}")
    logger.warning("Frontend will not be served. Build frontend: cd frontend && npm run build")

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
