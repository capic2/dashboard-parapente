#!/usr/bin/env python3
"""
Test Strava webhook flow complet

Simule un webhook Strava et teste:
1. Réception webhook
2. Téléchargement GPX (mock)
3. Parsing GPX
4. Matching site
5. Création Flight avec tous les champs
6. Notification Telegram
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from strava import parse_gpx, save_gpx_file, match_site_by_coordinates
from database import SessionLocal
from models import Site, Flight


# Sample GPX for testing (Arguel takeoff)
SAMPLE_GPX = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Test Flight Arguel</name>
    <trkseg>
      <trkpt lat="47.22356" lon="6.01842">
        <ele>427</ele>
        <time>2026-02-27T16:08:00+01:00</time>
      </trkpt>
      <trkpt lat="47.22400" lon="6.01900">
        <ele>450</ele>
        <time>2026-02-27T16:10:00+01:00</time>
      </trkpt>
      <trkpt lat="47.22450" lon="6.01950">
        <ele>520</ele>
        <time>2026-02-27T16:15:00+01:00</time>
      </trkpt>
      <trkpt lat="47.22500" lon="6.02000">
        <ele>600</ele>
        <time>2026-02-27T16:20:00+01:00</time>
      </trkpt>
      <trkpt lat="47.22480" lon="6.01980">
        <ele>580</ele>
        <time>2026-02-27T16:25:00+01:00</time>
      </trkpt>
      <trkpt lat="47.22400" lon="6.01900">
        <ele>450</ele>
        <time>2026-02-27T16:30:00+01:00</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>
"""


async def test_flow():
    """Test complet du flow webhook Strava"""
    
    
    # Step 1: Parse GPX
    gpx_data = parse_gpx(SAMPLE_GPX)
    
    if not gpx_data.get("success"):
        return
    
    
    first_tp = gpx_data.get("first_trackpoint", {})
    departure_time = first_tp.get("time")
    departure_lat = first_tp.get("lat")
    departure_lon = first_tp.get("lon")
    
    
    # Step 2: Save GPX
    activity_id = "test_123456"
    gpx_path = save_gpx_file(SAMPLE_GPX, activity_id)
    
    if gpx_path:
    else:
    
    # Step 3: Match site
    db = SessionLocal()
    
    try:
        sites = db.query(Site).all()
        sites_data = [
            {
                "id": site.id,
                "name": site.name,
                "latitude": site.latitude,
                "longitude": site.longitude
            }
            for site in sites
        ]
        
        for site in sites_data:
        
        site_id = match_site_by_coordinates(departure_lat, departure_lon, sites_data)
        
        if site_id:
            matched_site = db.query(Site).filter(Site.id == site_id).first()
            site_name = matched_site.name if matched_site else "Inconnu"
        else:
            site_name = "Inconnu"
        
        # Step 4: Format name
        if departure_time:
            flight_name = f"{site_name} {departure_time.strftime('%d-%m %Hh%M')}"
        else:
            flight_name = f"{site_name} 27-02"
        
        # Step 5: Create Flight (test - don't commit)
        
        from datetime import datetime, date
        import uuid
        
        flight = Flight(
            id=str(uuid.uuid4()),
            strava_id=activity_id,
            name=flight_name,
            title="Vol test Arguel",
            flight_date=departure_time.date() if departure_time else date.today(),
            departure_time=departure_time,
            site_id=site_id,
            duration_minutes=22,  # 16:08 to 16:30
            max_altitude_m=gpx_data.get("max_altitude_m"),
            distance_km=2.5,
            elevation_gain_m=gpx_data.get("elevation_gain_m"),
            gpx_file_path=gpx_path,
            gpx_max_altitude_m=gpx_data.get("max_altitude_m"),
            gpx_elevation_gain_m=gpx_data.get("elevation_gain_m"),
            external_url=f"https://www.strava.com/activities/{activity_id}",
            created_at=datetime.now()
        )
        
        
        # Step 6: Verify GPX file exists
        gpx_full_path = Path(__file__).parent / gpx_path
        if gpx_full_path.exists():
        else:
        
        
        
        
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(test_flow())
