from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pathlib import Path
from database import engine, Base
from models import Site
from routes import router
from webhooks import router as webhooks_router
from scheduler import start_scheduler, stop_scheduler
from database import SessionLocal
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Create tables
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan: startup and shutdown events
    """
    # Startup
    logger.info("🚀 Starting Dashboard Parapente API...")
    
    # Start scheduler
    start_scheduler()
    
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
