#!/usr/bin/env python3
"""
Link existing GPX files to flights in database
- Updates gpx_file_path
- Extracts and updates max_altitude_m from GPX
"""

import sqlite3
import xml.etree.ElementTree as ET
from pathlib import Path

# Database path (inside Docker container)
DB_PATH = "/app/db/dashboard.db"
GPX_DIR = Path("/app/db/gpx")

# GPX namespace
GPX_NS = {"gpx": "http://www.topografix.com/GPX/1/1"}

# Manual mapping: flight_id -> strava_id
FLIGHT_TO_STRAVA = {
    "flight-2025-09-27-1708": "15954552836",  # 27 sept 17h08
    "flight-2025-09-28-1542": "15965366307",  # 28 sept 15h42
    "flight-2025-09-28-1722": "15967079829",  # 28 sept 17h22
    "flight-2025-10-12-1617": "16118040828",  # 12 oct 16h17
    "flight-2025-11-08-1453": "16394022550",  # 8 nov 14h53
    "flight-2025-11-08-1601": "16394749726",  # 8 nov 16h01
}


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


def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("🔍 Linking GPX files to flights...\n")

    success_count = 0
    missing_gpx = []

    for flight_id, strava_id in FLIGHT_TO_STRAVA.items():
        print(f"Processing {flight_id} → Strava {strava_id}")

        # Check if GPX file exists
        gpx_file = GPX_DIR / f"strava_{strava_id}.gpx"

        if not gpx_file.exists():
            print(f"  ⚠️  GPX file not found: {gpx_file}")
            missing_gpx.append(flight_id)
            continue

        # Extract max altitude from GPX
        max_altitude = extract_max_altitude_from_gpx(gpx_file)

        if not max_altitude:
            print("  ⚠️  Could not extract altitude from GPX")
            continue

        print(f"  Max altitude: {max_altitude}m")

        # Update database
        gpx_relative_path = f"db/gpx/strava_{strava_id}.gpx"

        cursor.execute(
            """
            UPDATE flights 
            SET gpx_file_path = ?,
                max_altitude_m = ?
            WHERE id = ?
        """,
            (gpx_relative_path, max_altitude, flight_id),
        )

        if cursor.rowcount > 0:
            print("  ✅ Updated flight with GPX path and altitude")
            success_count += 1
        else:
            print("  ⚠️  Flight not found in database")

        print()

    # Commit changes
    conn.commit()

    print(f"\n{'='*50}")
    print(f"✅ Successfully updated: {success_count}/{len(FLIGHT_TO_STRAVA)} flights")

    if missing_gpx:
        print("\n⚠️  Missing GPX files for:")
        for flight_id in missing_gpx:
            print(f"  - {flight_id}")

    # Verify results
    print(f"\n{'='*50}")
    print("Verification:")
    cursor.execute("SELECT id, gpx_file_path, max_altitude_m FROM flights ORDER BY id")
    for row in cursor.fetchall():
        flight_id, gpx_path, altitude = row
        status = "✅" if gpx_path else "❌"
        print(f"  {status} {flight_id}: {gpx_path} (altitude: {altitude}m)")

    conn.close()

    print(f"\n{'='*50}")
    print("🎉 Done!")


if __name__ == "__main__":
    main()
