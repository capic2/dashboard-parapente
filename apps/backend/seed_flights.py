#!/usr/bin/env python3
"""
Seed the database with sample flights for testing
Creates realistic flight data with GPX files
"""
import sys
import uuid
from datetime import date, timedelta, datetime
from pathlib import Path
import random

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from database import SessionLocal, engine
from models import Base, Site, Flight

def create_sample_gpx(flight_id: str, start_lat: float, start_lon: float, duration_min: int) -> Path:
    """
    Create a sample GPX file for testing
    Generates a realistic flight track with elevation changes
    """
    gpx_dir = Path(__file__).parent / "gpx_files"
    gpx_dir.mkdir(exist_ok=True)
    
    gpx_path = gpx_dir / f"flight_{flight_id}.gpx"
    
    # Generate track points (one every 10 seconds)
    num_points = (duration_min * 60) // 10
    
    gpx_content = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Dashboard Parapente" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Sample Flight</name>
    <time>{timestamp}</time>
  </metadata>
  <trk>
    <name>Flight Track</name>
    <trkseg>
""".format(timestamp=datetime.utcnow().isoformat() + 'Z')
    
    base_time = datetime.utcnow() - timedelta(minutes=duration_min)
    lat, lon = start_lat, start_lon
    elevation = 800  # Start at 800m
    max_elevation = 800
    
    for i in range(num_points):
        # Simulate circular flight pattern with some drift
        angle = (i / num_points) * 2 * 3.14159 * 2  # 2 circles
        lat = start_lat + 0.01 * (i / num_points) + 0.005 * random.uniform(-1, 1)
        lon = start_lon + 0.01 * (i / num_points) + 0.005 * random.uniform(-1, 1)
        
        # Elevation changes - climb first, then descend
        if i < num_points * 0.3:
            elevation += random.uniform(5, 15)  # Climbing
        elif i < num_points * 0.8:
            elevation += random.uniform(-3, 3)  # Maintaining
        else:
            elevation -= random.uniform(5, 15)  # Descending
        
        elevation = max(500, min(1800, elevation))  # Clamp between 500-1800m
        max_elevation = max(max_elevation, elevation)
        
        point_time = base_time + timedelta(seconds=i * 10)
        
        gpx_content += f"""      <trkpt lat="{lat:.6f}" lon="{lon:.6f}">
        <ele>{elevation:.1f}</ele>
        <time>{point_time.isoformat()}Z</time>
      </trkpt>
"""
    
    gpx_content += """    </trkseg>
  </trk>
</gpx>"""
    
    gpx_path.write_text(gpx_content)
    
    return gpx_path


def seed_flights():
    """Seed the database with sample flights"""
    db = SessionLocal()
    
    try:
        # Get existing sites
        sites = db.query(Site).all()
        if not sites:
            return
        
        
        # Check if flights already exist
        existing_flights = db.query(Flight).count()
        if existing_flights > 0:
            response = input("Delete and recreate? (y/N): ")
            if response.lower() != 'y':
                return
            # Delete existing flights
            db.query(Flight).delete()
            db.commit()
        
        # Create sample flights
        flights_to_create = [
            {
                "title": "Vol d'initiation Arguel",
                "days_ago": 7,
                "duration": 45,
                "site": sites[0] if sites else None,
                "distance": 3.2,
                "max_alt": 950,
            },
            {
                "title": "Cross-country Mont Poupet",
                "days_ago": 5,
                "duration": 120,
                "site": sites[1] if len(sites) > 1 else sites[0],
                "distance": 18.5,
                "max_alt": 1420,
            },
            {
                "title": "Vol thermique La Côte",
                "days_ago": 3,
                "duration": 90,
                "site": sites[2] if len(sites) > 2 else sites[0],
                "distance": 12.3,
                "max_alt": 1350,
            },
            {
                "title": "Soaring Arguel",
                "days_ago": 2,
                "duration": 65,
                "site": sites[0] if sites else None,
                "distance": 8.7,
                "max_alt": 1120,
            },
            {
                "title": "Vol du soir Mont Poupet",
                "days_ago": 1,
                "duration": 50,
                "site": sites[1] if len(sites) > 1 else sites[0],
                "distance": 5.4,
                "max_alt": 1050,
            },
        ]
        
        created_count = 0
        
        for flight_data in flights_to_create:
            flight_id = str(uuid.uuid4())
            flight_date = date.today() - timedelta(days=flight_data["days_ago"])
            site = flight_data["site"]
            
            if not site:
                continue
            
            # Create GPX file
            gpx_path = create_sample_gpx(
                flight_id,
                site.latitude,
                site.longitude,
                flight_data["duration"]
            )
            
            # Calculate elevation gain (rough estimate)
            elevation_gain = int((flight_data["max_alt"] - site.elevation_m) * 0.7)
            
            flight = Flight(
                id=flight_id,
                title=flight_data["title"],
                site_id=site.id,
                flight_date=flight_date,
                duration_minutes=flight_data["duration"],
                distance_km=flight_data["distance"],
                max_altitude_m=flight_data["max_alt"],
                elevation_gain_m=elevation_gain,
                max_speed_kmh=random.uniform(25, 45),
                gpx_file_path=str(gpx_path),
                notes=f"Sample flight created for testing. Site: {site.name}",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(flight)
            created_count += 1
        
        db.commit()
        
    except Exception as e:
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_flights()
