#!/usr/bin/env python3
"""Test the complete API flow for GPX parsing"""

from pathlib import Path
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import List, Dict

def parse_gpx_file_from_string(gpx_content: str) -> List[Dict]:
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


def parse_gpx_file(gpx_path: Path) -> List[Dict]:
    """Parse GPX or IGC file - exactly as in routes.py"""
    # Read file content
    with open(gpx_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # Detect file format
    is_igc = gpx_path.suffix.lower() == '.igc' or content.strip().startswith(('A', 'H'))
    
    if is_igc:
        print("⚠️ Detected IGC format (should not happen for this test)")
        return []
    else:
        print("✅ Detected GPX format")
        return parse_gpx_file_from_string(content)


# Simulate the API endpoint
gpx_path = Path('db/gpx/strava_16394749726.gpx')
print(f"Testing with file: {gpx_path}")
print(f"File exists: {gpx_path.exists()}")
print("")

coordinates = parse_gpx_file(gpx_path)

print(f'\n📊 RESULTS:')
print(f'Total coordinates: {len(coordinates)}')
print(f'\nFirst 5 coordinates:')
for i in range(min(5, len(coordinates))):
    c = coordinates[i]
    dt = datetime.fromtimestamp(c["timestamp"] / 1000) if c["timestamp"] > 0 else None
    print(f'  {i}: lat={c["lat"]:.6f}, lon={c["lon"]:.6f}, ele={c["elevation"]}m')
    print(f'      timestamp={c["timestamp"]} ({dt})')

# Check if all timestamps are zero
all_zero = all(c["timestamp"] == 0 for c in coordinates)
print(f'\n⚠️ All timestamps zero: {all_zero}')

# This is what would be returned by the API
api_response = {
    "data": {
        "coordinates": coordinates,
    }
}

print(f'\n✅ API would return {len(api_response["data"]["coordinates"])} coordinates')
print(f'✅ Timestamps valid: {not all_zero}')
