#!/usr/bin/env python3
"""Test GPX timestamp parsing"""

import xml.etree.ElementTree as ET
from datetime import datetime

def parse_gpx_file_from_string(gpx_content: str):
    """Parse GPX content from string and extract coordinates with timestamps"""
    root = ET.fromstring(gpx_content)
    
    # Handle GPX namespace
    ns = {'gpx': 'http://www.topografix.com/GPX/1/1'}
    
    coordinates = []
    
    # Find all track points - try with namespace first, then without
    trkpts = root.findall('.//gpx:trkpt', ns)
    if not trkpts:
        trkpts = root.findall('.//trkpt')
        ns = {}  # No namespace
    
    print(f"🔍 DEBUG Parse GPX - Found {len(trkpts)} trackpoints")
    
    for trkpt in trkpts:
        lat = float(trkpt.get('lat', 0))
        lon = float(trkpt.get('lon', 0))
        
        # Get elevation - try with namespace first, then without
        ele_elem = trkpt.find('gpx:ele', ns) if ns else None
        if ele_elem is None:
            ele_elem = trkpt.find('ele')
        elevation = float(ele_elem.text) if ele_elem is not None and ele_elem.text else 0
        
        # Get timestamp - try with namespace first, then without
        time_elem = trkpt.find('gpx:time', ns) if ns else None
        if time_elem is None:
            time_elem = trkpt.find('time')
            
        if time_elem is not None and time_elem.text:
            try:
                dt = datetime.fromisoformat(time_elem.text.replace('Z', '+00:00'))
                timestamp = int(dt.timestamp() * 1000)  # milliseconds
            except Exception as e:
                print(f"⚠️ DEBUG Parse time failed: {e}")
                timestamp = 0
        else:
            timestamp = 0
        
        coordinates.append({
            "lat": lat,
            "lon": lon,
            "elevation": elevation,
            "timestamp": timestamp
        })
    
    if coordinates:
        print(f"🔍 DEBUG First coord - ele:{coordinates[0]['elevation']}m, ts:{coordinates[0]['timestamp']}")
    
    return coordinates


# Test with actual file
with open('db/gpx/strava_16394749726.gpx', 'r') as f:
    content = f.read()

coords = parse_gpx_file_from_string(content)
print(f'\nTotal coordinates: {len(coords)}')
if coords:
    print(f'\nFirst 5 coords:')
    for i in range(min(5, len(coords))):
        c = coords[i]
        print(f'  {i}: lat={c["lat"]:.6f}, lon={c["lon"]:.6f}, ele={c["elevation"]}m, ts={c["timestamp"]}')
