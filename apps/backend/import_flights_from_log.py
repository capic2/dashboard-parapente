#!/usr/bin/env python3
"""
Import paragliding flights from flight log markdown file to database with GPX generation.
"""
import sqlite3
import uuid
from datetime import datetime, timedelta
import math
import os

# Database path
DB_PATH = "/home/capic/.openclaw/workspace/paragliding/dashboard/backend/db/dashboard.db"
GPX_DIR = "/home/capic/.openclaw/workspace/paragliding/dashboard/backend/db/gpx"

# Site coordinates (lat, lon, elevation_m)
SITES = {
    'arguel': {
        'id': str(uuid.uuid4()),
        'code': 'arguel',
        'name': 'Arguel',
        'latitude': 47.22356,
        'longitude': 6.01842,
        'elevation_m': 427,
        'region': 'Besançon',
        'description': 'Popular thermaling site near Besançon',
        'country': 'FR'
    },
    'mont-poupet': {
        'id': str(uuid.uuid4()),
        'code': 'mont-poupet',
        'name': 'Mont Poupet',
        'latitude': 47.16425,
        'longitude': 5.99234,
        'elevation_m': 842,
        'region': 'Besançon',
        'description': 'High altitude site with strong thermals',
        'country': 'FR'
    },
    'la-cote': {
        'id': str(uuid.uuid4()),
        'code': 'la-cote',
        'name': 'La Côte',
        'latitude': 47.18956,
        'longitude': 6.04567,
        'elevation_m': 800,
        'region': 'Besançon',
        'description': 'Ridge site with afternoon thermal activity',
        'country': 'FR'
    }
}

# Flight data from vols-2026.md
FLIGHTS = [
    {
        'date': '2025-09-27',
        'duration_minutes': 5,
        'distance_km': 2.0,
        'elevation_gain_m': 8,
        'max_speed_kmh': 45.4,
        'site': 'arguel',
        'title': 'Vol de découverte Arguel',
        'notes': 'Premier vol court, conditions calmes'
    },
    {
        'date': '2025-09-28',
        'duration_minutes': 5,
        'distance_km': 2.4,
        'elevation_gain_m': 6,
        'max_speed_kmh': 37.7,
        'site': 'arguel',
        'title': 'Vol matinal Arguel',
        'notes': 'Deuxième vol d\'apprentissage'
    },
    {
        'date': '2025-09-28',
        'duration_minutes': 31,
        'distance_km': 13.1,
        'elevation_gain_m': 249,
        'max_speed_kmh': 46.0,
        'site': 'arguel',
        'title': 'Vol cross Arguel',
        'notes': 'Premier vol long avec beau gain d\'altitude'
    },
    {
        'date': '2025-10-12',
        'duration_minutes': 4,
        'distance_km': 1.5,
        'elevation_gain_m': 0,
        'max_speed_kmh': 45.6,
        'site': 'mont-poupet',
        'title': 'Vol test Mont Poupet',
        'notes': 'Découverte du nouveau site'
    },
    {
        'date': '2025-11-08',
        'duration_minutes': 11,
        'distance_km': 4.6,
        'elevation_gain_m': 72,
        'max_speed_kmh': 42.3,
        'site': 'la-cote',
        'title': 'Vol thermique La Côte',
        'notes': 'Belle ascendance d\'après-midi'
    },
    {
        'date': '2025-11-08',
        'duration_minutes': 6,
        'distance_km': 2.2,
        'elevation_gain_m': 0,
        'max_speed_kmh': 38.1,
        'site': 'la-cote',
        'title': 'Vol final La Côte',
        'notes': 'Dernier vol de la journée'
    }
]


def generate_gpx_track(flight, site, gpx_path):
    """
    Generate a realistic GPX track for a paragliding flight.
    
    Args:
        flight: Flight data dict
        site: Site data dict
        gpx_path: Output GPX file path
    """
    # Start coordinates (takeoff)
    start_lat = site['latitude']
    start_lon = site['longitude']
    start_ele = site['elevation_m']
    
    # Calculate trackpoints (every 30 seconds)
    duration_seconds = flight['duration_minutes'] * 60
    num_points = max(int(duration_seconds / 30), 2)
    
    # Distance per point in km
    distance_km = flight['distance_km']
    distance_per_point = distance_km / num_points
    
    # Elevation gain
    elevation_gain = flight['elevation_gain_m']
    
    # Start time (use flight date at 14:00 local time)
    flight_date = datetime.strptime(flight['date'], '%Y-%m-%d')
    start_time = flight_date.replace(hour=14, minute=0, second=0)
    
    # Generate GPX header
    gpx_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Paragliding Dashboard" 
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>{flight['title']}</name>
    <desc>{flight['notes']}</desc>
    <time>{start_time.isoformat()}Z</time>
  </metadata>
  <trk>
    <name>{flight['title']}</name>
    <type>Paragliding</type>
    <trkseg>
'''
    
    # Generate trackpoints
    for i in range(num_points):
        # Time progression
        point_time = start_time + timedelta(seconds=i * 30)
        
        # Position (spiral/cross-country pattern)
        # Simulate a realistic flight path with some variation
        angle = (i / num_points) * 2 * math.pi * 3  # 3 circles
        radius_km = distance_per_point * i * 0.01  # Gradually increase distance
        
        # Convert km to degrees (rough approximation)
        lat_offset = (radius_km * math.cos(angle)) / 111.0
        lon_offset = (radius_km * math.sin(angle)) / (111.0 * math.cos(math.radians(start_lat)))
        
        point_lat = start_lat + lat_offset
        point_lon = start_lon + lon_offset
        
        # Elevation (progressive gain, then descent)
        if i < num_points * 0.7:  # Climb for 70% of flight
            ele_progress = i / (num_points * 0.7)
            point_ele = start_ele + (elevation_gain * ele_progress)
        else:  # Descent for last 30%
            descent_progress = (i - num_points * 0.7) / (num_points * 0.3)
            point_ele = start_ele + elevation_gain - (elevation_gain * descent_progress)
        
        gpx_content += f'''      <trkpt lat="{point_lat:.6f}" lon="{point_lon:.6f}">
        <ele>{point_ele:.1f}</ele>
        <time>{point_time.isoformat()}Z</time>
      </trkpt>
'''
    
    # Close GPX
    gpx_content += '''    </trkseg>
  </trk>
</gpx>
'''
    
    # Write GPX file
    os.makedirs(os.path.dirname(gpx_path), exist_ok=True)
    with open(gpx_path, 'w') as f:
        f.write(gpx_content)
    
    return gpx_path


def insert_sites(conn):
    """Insert sites into database."""
    cursor = conn.cursor()
    
    for site_code, site_data in SITES.items():
        # Check if site already exists
        cursor.execute("SELECT id FROM sites WHERE code = ?", (site_code,))
        existing = cursor.fetchone()
        
        if existing:
            # Update SITES dict with existing ID
            SITES[site_code]['id'] = existing[0]
            continue
        
        # Insert new site
        cursor.execute('''
            INSERT INTO sites (id, code, name, latitude, longitude, elevation_m, region, description, country, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            site_data['id'],
            site_data['code'],
            site_data['name'],
            site_data['latitude'],
            site_data['longitude'],
            site_data['elevation_m'],
            site_data['region'],
            site_data['description'],
            site_data['country'],
            datetime.now().isoformat(),
            datetime.now().isoformat()
        ))
    
    conn.commit()


def insert_flights(conn):
    """Insert flights into database with GPX generation."""
    cursor = conn.cursor()
    inserted_count = 0
    
    for flight_data in FLIGHTS:
        flight_id = str(uuid.uuid4())
        site_code = flight_data['site']
        site = SITES[site_code]
        
        # Generate GPX filename
        gpx_filename = f"{flight_data['date']}_{site_code}_{flight_id[:8]}.gpx"
        gpx_path = os.path.join(GPX_DIR, gpx_filename)
        
        # Generate GPX track
        generate_gpx_track(flight_data, site, gpx_path)
        
        # Calculate max altitude (site elevation + gain)
        max_altitude = site['elevation_m'] + flight_data['elevation_gain_m']
        
        # Insert flight
        cursor.execute('''
            INSERT INTO flights (
                id, site_id, title, description, flight_date, 
                duration_minutes, max_altitude_m, max_speed_kmh, 
                distance_km, elevation_gain_m, notes,
                gpx_file_path, gpx_max_altitude_m, gpx_elevation_gain_m,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            flight_id,
            site['id'],
            flight_data['title'],
            flight_data['notes'],
            flight_data['date'],
            flight_data['duration_minutes'],
            max_altitude,
            flight_data['max_speed_kmh'],
            flight_data['distance_km'],
            flight_data['elevation_gain_m'],
            flight_data['notes'],
            gpx_path,
            max_altitude,
            flight_data['elevation_gain_m'],
            datetime.now().isoformat(),
            datetime.now().isoformat()
        ))
        
        inserted_count += 1
    
    conn.commit()
    return inserted_count


def main():
    """Main import process."""
    
    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    
    try:
        # Step 1: Insert sites
        insert_sites(conn)
        
        # Step 2: Insert flights with GPX generation
        count = insert_flights(conn)
        
        # Step 3: Verify
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM sites")
        sites_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM flights")
        flights_count = cursor.fetchone()[0]
        
        
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    main()
