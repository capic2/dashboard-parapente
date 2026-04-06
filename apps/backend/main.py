import asyncio
import logging
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text as sa_text

# Import configuration (loads environment variables automatically)
import config

# Import ALL models to register them with SQLAlchemy Base.metadata
# This ensures all tables are available for Base.metadata.create_all()
# even in test mode where initialize_database() is not called
import models  # noqa: F401 - imported for side effects (model registration)
from database import Base, SessionLocal, engine
from models import Site  # Needed for database initialization
from routes import router
from scheduler import start_scheduler, stop_scheduler
from webhooks import router as webhooks_router

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)


def initialize_database():
    """
    Initialize database: create schema and seed default sites
    This ensures the database is always properly set up on startup
    """
    from database import DB_PATH

    # models is already imported at module level

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

        # Ensure forecast_date column exists on emagram_analysis
        # (create_all won't alter existing tables missing this column)
        with engine.connect() as conn:
            cols = {
                row[1]
                for row in conn.execute(sa_text("PRAGMA table_info(emagram_analysis)")).fetchall()
            }
            if cols and "forecast_date" not in cols:
                logger.info("Adding missing forecast_date column to emagram_analysis...")
                conn.execute(sa_text("ALTER TABLE emagram_analysis ADD COLUMN forecast_date DATE"))
                conn.execute(
                    sa_text(
                        "UPDATE emagram_analysis SET forecast_date = analysis_date WHERE forecast_date IS NULL"
                    )
                )
                conn.execute(
                    sa_text(
                        "CREATE INDEX IF NOT EXISTS idx_emagram_analysis_forecast_date ON emagram_analysis (forecast_date)"
                    )
                )
                conn.commit()
                logger.info("✓ forecast_date column added successfully")

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
                "id": "site-arguel",
                "code": "arguel",
                "name": "Arguel",
                "latitude": 47.1944,
                "longitude": 5.9896,
                "elevation_m": 462,
                "region": "Besançon",
                "country": "FR",
                "rating": 3,
                "orientation": "NNW",
                "linked_spot_id": "merged_884e0213d9116315",
            },
            {
                "id": "site-mont-poupet-nord",
                "code": "mont-poupet-nord",
                "name": "Mont Poupet Nord",
                "latitude": 46.9716,
                "longitude": 5.8776,
                "elevation_m": 795,
                "region": "Besançon",
                "country": "FR",
                "rating": 4,
                "orientation": "N",
                "linked_spot_id": "merged_d370be468747c90a",
            },
            {
                "id": "site-mont-poupet-nw",
                "code": "mont-poupet-nw",
                "name": "Mont Poupet Nord-Ouest",
                "latitude": 46.9701,
                "longitude": 5.8742,
                "elevation_m": 795,
                "region": "Besançon",
                "country": "FR",
                "rating": 3,
                "orientation": "NW",
                "linked_spot_id": "merged_c30c861b49a65324",
            },
            {
                "id": "site-mont-poupet-ouest",
                "code": "mont-poupet-ouest",
                "name": "Mont Poupet Ouest",
                "latitude": 46.9693,
                "longitude": 5.8747,
                "elevation_m": 795,
                "region": "Besançon",
                "country": "FR",
                "rating": 4,
                "orientation": "W",
                "linked_spot_id": "merged_359e1153c44c269e",
            },
            {
                "id": "site-mont-poupet-sud",
                "code": "mont-poupet-sud",
                "name": "Mont Poupet Sud",
                "latitude": 46.9691,
                "longitude": 5.8762,
                "elevation_m": 795,
                "region": "Besançon",
                "country": "FR",
                "rating": 1,
                "orientation": "S",
                "linked_spot_id": "merged_60fbcc6724417e87",
            },
            {
                "id": "site-la-cote",
                "code": "la-cote",
                "name": "La Côte",
                "latitude": 46.9424,
                "longitude": 5.8438,
                "elevation_m": 800,
                "region": "Besançon",
                "country": "FR",
                "rating": 2,
                "orientation": "N",
                "linked_spot_id": "merged_d3836f8db6c839fa",
            },
        ]

        db = SessionLocal()
        now = datetime.utcnow()

        for site_data in sites_data:
            # Check if site already exists
            existing = db.query(Site).filter(Site.id == site_data["id"]).first()
            if existing:
                logger.info(f"⊙ Site already exists: {site_data['name']} ({site_data['code']})")
                continue

            # Create new site
            site = Site(
                id=site_data["id"],
                code=site_data["code"],
                name=site_data["name"],
                latitude=site_data["latitude"],
                longitude=site_data["longitude"],
                elevation_m=site_data["elevation_m"],
                region=site_data["region"],
                country=site_data["country"],
                rating=site_data.get("rating"),
                orientation=site_data.get("orientation"),
                linked_spot_id=site_data.get("linked_spot_id"),
                created_at=now,
                updated_at=now,
            )
            db.add(site)
            logger.info(
                f"✓ Seeded: {site_data['name']} ({site_data['code']}) at {site_data['latitude']:.4f}, {site_data['longitude']:.4f}"
            )

        db.commit()

        # Verify
        final_count = db.query(Site).count()
        db.close()

        logger.info(f"✓ Database now contains {final_count} sites")

        # Step 4: Seed weather sources
        if not seed_weather_sources():
            logger.warning(
                "⚠️  Failed to seed weather sources, but continuing (sources can be added later)..."
            )

        logger.info("=" * 60)
        logger.info("✅ DATABASE INITIALIZATION COMPLETE")
        logger.info("=" * 60)

        return True

    except Exception as e:
        logger.error(f"✗ Error seeding sites: {e}")
        import traceback

        traceback.print_exc()
        return False


def seed_weather_sources():
    """
    Seed default weather sources if table is empty
    This ensures weather data can be fetched on first startup
    """
    import uuid

    from models import WeatherSourceConfig

    logger.info("Checking for existing weather sources...")

    try:
        db = SessionLocal()

        # Check if sources already exist
        source_count = db.query(WeatherSourceConfig).count()

        if source_count > 0:
            logger.info(f"✓ Weather sources already exist ({source_count}) - checking API keys...")

            # Update sources with API keys that may have been added after initial seed
            weatherapi_key = config.WEATHERAPI_KEY
            meteoblue_key = config.METEOBLUE_API_KEY

            wa_source = (
                db.query(WeatherSourceConfig)
                .filter(WeatherSourceConfig.source_name == "weatherapi")
                .first()
            )
            if (
                wa_source
                and weatherapi_key
                and (wa_source.api_key != weatherapi_key or not wa_source.is_enabled)
            ):
                wa_source.api_key = weatherapi_key
                wa_source.is_enabled = True
                logger.info("✓ WeatherAPI: updated API key and re-enabled")

            mb_source = (
                db.query(WeatherSourceConfig)
                .filter(WeatherSourceConfig.source_name == "meteoblue")
                .first()
            )
            if mb_source and meteoblue_key and mb_source.api_key != meteoblue_key:
                mb_source.api_key = meteoblue_key
                logger.info("✓ Meteoblue: updated API key")

            db.commit()
            db.close()
            return True

        logger.info("No weather sources found - seeding defaults...")

        # Get API keys from config
        weatherapi_key = config.WEATHERAPI_KEY
        meteoblue_key = config.METEOBLUE_API_KEY

        # Define default sources (5 sources)
        default_sources = [
            {
                "id": str(uuid.uuid4()),
                "source_name": "open-meteo",
                "display_name": "Open-Meteo",
                "description": "API météo open-source gratuite, aucune clé requise. Données mondiales avec haute précision.",
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
                "description": "API météo mondiale avec données détaillées. Clé API requise (plan gratuit disponible).",
                "is_enabled": bool(weatherapi_key),  # Enabled only if API key present
                "requires_api_key": True,
                "api_key": weatherapi_key,
                "priority": 9,
                "scraper_type": "api",
                "base_url": "https://api.weatherapi.com/v1/forecast.json",
                "documentation_url": "https://www.weatherapi.com/docs/",
            },
            {
                "id": str(uuid.uuid4()),
                "source_name": "meteo-parapente",
                "display_name": "Météo Parapente",
                "description": "Prévisions spécialisées parapente avec thermiques et conditions de vol.",
                "is_enabled": True,
                "requires_api_key": False,
                "api_key": None,
                "priority": 8,
                "scraper_type": "playwright",
                "base_url": "https://meteo-parapente.com",
                "documentation_url": None,
            },
            {
                "id": str(uuid.uuid4()),
                "source_name": "meteociel",
                "display_name": "Météociel",
                "description": "Prévisions AROME haute résolution pour la France. Scraping de données HTML.",
                "is_enabled": True,
                "requires_api_key": False,
                "api_key": None,
                "priority": 7,
                "scraper_type": "playwright",
                "base_url": "https://www.meteociel.fr",
                "documentation_url": None,
            },
            {
                "id": str(uuid.uuid4()),
                "source_name": "meteoblue",
                "display_name": "Meteoblue",
                "description": "Prévisions météo professionnelles avec modèles multiples. API key optionnelle.",
                "is_enabled": True,
                "requires_api_key": False,
                "api_key": meteoblue_key,
                "priority": 6,
                "scraper_type": "stealth",
                "base_url": "https://www.meteoblue.com",
                "documentation_url": "https://docs.meteoblue.com/",
            },
        ]

        # Insert sources using ORM
        for source_data in default_sources:
            source = WeatherSourceConfig(**source_data)
            db.add(source)
            status = "✅" if source.is_enabled else "⚠️  (disabled - no API key)"
            logger.info(f"  {status} Seeded: {source.display_name}")

        db.commit()

        # Verify
        final_count = db.query(WeatherSourceConfig).count()
        logger.info(f"✓ Database now contains {final_count} weather sources")

        db.close()
        return True

    except Exception as e:
        logger.error(f"✗ Error seeding weather sources: {e}")
        import traceback

        traceback.print_exc()
        if "db" in locals():
            db.rollback()
            db.close()
        return False


def run_migrations():
    """
    Run SQL migrations from db/migrations directory.
    Each SQL statement is executed individually to handle idempotent migrations
    gracefully (e.g., ALTER TABLE ADD COLUMN that already exists).
    """
    from database import DB_PATH

    migrations_dir = Path(__file__).parent / "db" / "migrations"

    if not migrations_dir.exists():
        logger.warning(f"Migrations directory not found: {migrations_dir}")
        return

    # Get all .sql migration files
    migration_files = sorted(migrations_dir.glob("*.sql"))

    if not migration_files:
        logger.info("No migration files found")
        return

    logger.info(f"Running {len(migration_files)} migration(s)...")

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    for migration_file in migration_files:
        logger.info(f"Applying migration: {migration_file.name}")

        with open(migration_file) as f:
            sql = f.read()

        # Execute each statement individually so that one "already exists" error
        # doesn't prevent subsequent statements in the same migration from running.
        # Split by semicolons, strip comments, and skip empty statements.
        applied = 0
        skipped = 0

        for raw_statement in sql.split(";"):
            # Strip comment lines and whitespace
            lines = [l for l in raw_statement.splitlines() if not l.strip().startswith("--")]
            clean = "\n".join(lines).strip()
            if not clean:
                continue

            try:
                cursor.execute(clean)
                conn.commit()
                applied += 1
            except sqlite3.OperationalError as e:
                err_msg = str(e).lower()
                if "already exists" in err_msg or "duplicate column name" in err_msg:
                    skipped += 1
                else:
                    logger.error(f"✗ Migration {migration_file.name} failed on statement: {clean[:100]}")
                    logger.error(f"  Error: {e}")
                    raise

        if skipped > 0 and applied == 0:
            logger.info(f"⊙ Migration {migration_file.name} already applied (skipping)")
        elif skipped > 0:
            logger.info(f"✓ Migration {migration_file.name}: {applied} applied, {skipped} already existed")
        else:
            logger.info(f"✓ Migration {migration_file.name} applied successfully")

    conn.close()
    logger.info("✓ All migrations completed")


# Initialize database (create schema + seed sites)
# Skip in test mode - tests use temporary in-memory DB
if not config.TESTING:
    initialize_database()
    run_migrations()
else:
    logger.info("🧪 Testing mode: Skipping database initialization and migrations")


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
        logger.info(
            "⚠️ App will continue, cache will populate on first request or next hourly poll"
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan: startup and shutdown events
    """
    # Startup
    logger.info("🚀 Starting Dashboard Parapente API...")

    # Load app settings into memory cache
    try:
        from app_settings import reload_cache as reload_settings_cache

        db = SessionLocal()
        try:
            reload_settings_cache(db)
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"⚠️ Could not load app settings: {e}")

    # Start weather scheduler
    start_scheduler()

    # Start emagram scheduler
    from emagram_scheduler.emagram_scheduler import (
        setup_emagram_scheduler,
    )
    from emagram_scheduler.emagram_scheduler import start_scheduler as start_emagram

    emagram_scheduler = setup_emagram_scheduler(app)
    start_emagram(emagram_scheduler)

    # Initial cache warmup (non-blocking)
    logger.info("🔥 Triggering initial cache warmup...")
    asyncio.create_task(initial_cache_warmup())

    yield

    # Shutdown
    logger.info("⏹️ Shutting down Dashboard Parapente API...")
    stop_scheduler()

    # Close Redis connection
    from cache import close_redis

    await close_redis()
    # Emagram scheduler shutdown handled by registered event


app = FastAPI(
    title="Dashboard Parapente API",
    description="Backend for paragliding weather dashboard with multi-source forecasts, Para-Index scoring, and Strava integration",
    version="0.2.0",
    lifespan=lifespan,
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
            "hint": "Or access API docs at /docs",
        }

else:
    logger.warning(f"⚠️  Static directory not found: {STATIC_DIR}")
    logger.warning("Frontend will not be served. Build frontend: cd frontend && npm run build")

# Database
DB_PATH = Path(__file__).parent / "db" / "dashboard.db"


@app.get("/health")
def health_check():
    """
    Health check endpoint for monitoring and e2e tests.

    Returns a simple status response to verify the API server is running
    and ready to accept requests. Used by:
    - Playwright webServer configuration to wait for backend startup
    - Monitoring and load balancers for health checks
    - CI/CD pipelines to verify deployment success

    Returns:
        dict: A dictionary containing the status key with value "ok"

    Example:
        >>> response = client.get("/health")
        >>> response.json()
        {"status": "ok"}
    """
    return {"status": "ok"}


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
            "Telegram notifications",
        ],
        "db_path": str(DB_PATH),
        "db_exists": DB_PATH.exists(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
