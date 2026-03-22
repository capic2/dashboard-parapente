#!/usr/bin/env python3
"""
Script to extract max altitude from GPX files and update flights
Uses filename mapping since GPX timestamps are relative (0, 1, 2...)
"""

import sqlite3
import xml.etree.ElementTree as ET
from pathlib import Path

# Database path
DB_PATH = "/app/db/dashboard.db"
GPX_DIR = Path("/app/gpx_files")

# GPX namespace
GPX_NS = {"gpx": "http://www.topografix.com/GPX/1/1"}


def extract_max_altitude_from_gpx(gpx_path):
    """Parse GPX file and extract maximum altitude"""
    try:
        tree = ET.parse(gpx_path)
        root = tree.getroot()

        altitudes = []

        # Try with namespace
        for trkpt in root.findall(".//gpx:trkpt", GPX_NS):
            ele = trkpt.find("gpx:ele", GPX_NS)
            if ele is not None and ele.text:
                try:
                    altitudes.append(float(ele.text))
                except ValueError:
                    pass

        # Try without namespace
        if not altitudes:
            for trkpt in root.findall(".//trkpt"):
                ele = trkpt.find("ele")
                if ele is not None and ele.text:
                    try:
                        altitudes.append(float(ele.text))
                    except ValueError:
                        pass

        if altitudes:
            return int(round(max(altitudes)))
        return None
    except Exception as e:
        print(f"❌ Error parsing {gpx_path}: {e}")
        return None


# Manual mapping based on the Strava activity IDs and dates
# Format: flight_id -> strava_id
FLIGHT_TO_STRAVA = {
    "flight-2025-09-27-1708": "15954552836",  # 27 sept 17h08
    "flight-2025-09-28-1542": "15965366307",  # 28 sept 15h42
    "flight-2025-09-28-1722": "15967079829",  # 28 sept 17h22
    "flight-2025-10-12-1617": "16118040828",  # 12 oct 16h17
    "flight-2025-11-08-1453": "16394022550",  # 8 nov 14h53
    "flight-2025-11-08-1601": "16394749726",  # 8 nov 16h01
}


def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get all flights without max_altitude_m
    cursor.execute("SELECT id FROM flights WHERE max_altitude_m IS NULL")
    flights = [row[0] for row in cursor.fetchall()]

    print(f"Found {len(flights)} flights without altitude data\n")

    for flight_id in flights:
        print(f"Processing {flight_id}...")

        # Get Strava ID from mapping
        strava_id = FLIGHT_TO_STRAVA.get(flight_id)
        if not strava_id:
            print("  ⚠️  No Strava ID mapping found")
            continue

        # Find GPX file
        gpx_file = GPX_DIR / f"strava_{strava_id}.gpx"

        if not gpx_file.exists():
            print(f"  ⚠️  GPX file not found: {gpx_file.name}")
            continue

        print(f"  Found GPX: {gpx_file.name}")

        # Extract max altitude
        max_altitude = extract_max_altitude_from_gpx(gpx_file)

        if max_altitude:
            print(f"  Max altitude: {max_altitude}m")

            # Update database
            cursor.execute(
                "UPDATE flights SET max_altitude_m = ? WHERE id = ?", (max_altitude, flight_id)
            )
            print("  ✅ Updated")
        else:
            print("  ❌ Could not extract altitude")

        print()

    # Commit changes
    conn.commit()
    conn.close()

    print("✅ All flights processed!")


if __name__ == "__main__":
    main()
