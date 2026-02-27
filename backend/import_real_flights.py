#!/usr/bin/env python3
"""Import real flights from GPX files"""

import sqlite3
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime, timedelta
import math

# GPX namespace
GPX_NS = {'gpx': 'http://www.topografix.com/GPX/1/1'}

# Flight GPX files with metadata
FLIGHTS = [
    {
        'gpx': 'gpx_files/strava_15954552836.gpx',
        'site': 'arguel',
        'date': '2025-09-27',
        'time': '17:08'
    },
    {
        'gpx': 'gpx_files/strava_15965366307.gpx',
        'site': 'arguel',
        'date': '2025-09-28',
        'time': '15:42'
    },
    {
        'gpx': 'gpx_files/strava_15967079829.gpx',
        'site': 'arguel',
        'date': '2025-09-28',
        'time': '17:22'
    },
    {
        'gpx': 'gpx_files/strava_16118040828.gpx',
        'site': 'mont-poupet',
        'date': '2025-10-12',
        'time': '16:17'
    },
    {
        'gpx': 'gpx_files/strava_16394022550.gpx',
        'site': 'la-cote',
        'date': '2025-11-08',
        'time': '14:53'
    },
    {
        'gpx': 'gpx_files/strava_16394749726.gpx',
        'site': 'la-cote',
        'date': '2025-11-08',
        'time': '16:01'
    }
]

SITE_NAMES = {
    'arguel': 'Arguel',
    'mont-poupet': 'Mont Poupet',
    'la-cote': 'La Côte'
}

def parse_gpx(gpx_path, flight_date, flight_time):
    """Parse GPX and extract metrics"""
    tree = ET.parse(gpx_path)
    root = tree.getroot()
    
    # Start time from flight metadata
    start_dt = datetime.strptime(f"{flight_date} {flight_time}", "%Y-%m-%d %H:%M")
    
    # Find track points
    points = []
    for trkpt in root.findall('.//gpx:trkpt', GPX_NS):
        lat = float(trkpt.get('lat'))
        lon = float(trkpt.get('lon'))
        
        ele_elem = trkpt.find('gpx:ele', GPX_NS)
        time_elem = trkpt.find('gpx:time', GPX_NS)
        
        if ele_elem is not None and time_elem is not None:
            # Time is in seconds since start
            seconds = int(time_elem.text)
            point_time = start_dt + timedelta(seconds=seconds)
            
            points.append({
                'lat': lat,
                'lon': lon,
                'ele': float(ele_elem.text),
                'time': point_time
            })
    
    if not points:
        return None
    
    # Calculate metrics
    start_time = points[0]['time']
    end_time = points[-1]['time']
    duration_min = (end_time - start_time).total_seconds() / 60
    
    # Distance (haversine)
    total_distance = 0
    for i in range(1, len(points)):
        p1, p2 = points[i-1], points[i]
        lat1, lon1 = math.radians(p1['lat']), math.radians(p1['lon'])
        lat2, lon2 = math.radians(p2['lat']), math.radians(p2['lon'])
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        total_distance += 6371 * c  # Earth radius in km
    
    # Elevation gain
    elevation_gain = 0
    for i in range(1, len(points)):
        diff = points[i]['ele'] - points[i-1]['ele']
        if diff > 0:
            elevation_gain += diff
    
    return {
        'departure_time': start_time,
        'duration_minutes': int(duration_min),
        'distance_km': round(total_distance, 2),
        'elevation_gain_m': int(elevation_gain),
        'gpx_data': open(gpx_path, 'r').read()
    }

def format_flight_name(site, date, time):
    """Format: Arguel 27-09 17h08"""
    dt = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")
    day = dt.strftime("%d")
    month = dt.strftime("%m")
    hour = dt.strftime("%H")
    minute = dt.strftime("%M")
    
    site_name = SITE_NAMES.get(site, site.title())
    return f"{site_name} {day}-{month} {hour}h{minute}"

def main():
    db_path = Path(__file__).parent / "db" / "dashboard.db"
    
    if not db_path.exists():
        print("❌ Database not found")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Clear existing flights
        cursor.execute("DELETE FROM flights")
        print("🗑️ Cleared existing flights")
        
        # Import each flight
        for flight in FLIGHTS:
            gpx_path = Path(__file__).parent / flight['gpx']
            
            if not gpx_path.exists():
                print(f"⚠️ GPX not found: {gpx_path}")
                continue
            
            print(f"📊 Processing {gpx_path}...")
            metrics = parse_gpx(gpx_path, flight['date'], flight['time'])
            
            if not metrics:
                print(f"❌ Failed to parse GPX")
                continue
            
            name = format_flight_name(flight['site'], flight['date'], flight['time'])
            
            # Insert flight
            flight_date = datetime.strptime(flight['date'], '%Y-%m-%d').date()
            cursor.execute("""
                INSERT INTO flights 
                (id, site_id, name, flight_date, departure_time, duration_minutes, distance_km, 
                 elevation_gain_m, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                f"flight-{flight['date']}-{flight['time'].replace(':', '')}",
                f"site-{flight['site']}",
                name,
                flight_date.isoformat(),
                metrics['departure_time'].isoformat(),
                metrics['duration_minutes'],
                metrics['distance_km'],
                metrics['elevation_gain_m'],
                datetime.utcnow().isoformat(),
                datetime.utcnow().isoformat()
            ))
            
            print(f"✅ {name} - {metrics['duration_minutes']}min, {metrics['distance_km']}km, +{metrics['elevation_gain_m']}m")
        
        conn.commit()
        print(f"\n✅ Imported {len(FLIGHTS)} flights")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    main()
