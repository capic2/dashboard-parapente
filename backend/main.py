from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from pathlib import Path

app = FastAPI(
    title="Dashboard Parapente API",
    description="Backend for paragliding weather dashboard",
    version="0.1.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database
DB_PATH = Path(__file__).parent / "db" / "dashboard.db"

@app.get("/")
def read_root():
    return {
        "status": "ok",
        "message": "Dashboard Parapente API v0.1.0",
        "db_path": str(DB_PATH),
        "db_exists": DB_PATH.exists()
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/api/spots")
def get_spots():
    """List all paragliding spots"""
    return {
        "spots": [
            {"id": "arguel", "name": "Arguel", "altitude": 427},
            {"id": "mont-poupet", "name": "Mont Poupet", "altitude": 842},
            {"id": "la-cote", "name": "La Côte", "altitude": 800},
        ]
    }

@app.get("/api/weather/{spot_id}")
def get_weather(spot_id: str):
    """Get weather data for a spot"""
    return {
        "spot_id": spot_id,
        "message": "Weather data endpoint (Phase 2 Week 2)"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
