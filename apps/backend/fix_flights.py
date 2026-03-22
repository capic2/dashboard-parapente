#!/usr/bin/env python3
"""
Script to fix flights data in the dashboard database:
1. Generate title from site name + date/time
2. Extract max_altitude_m from GPX files
"""

import re
import sqlite3
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

# Database path (adjust if needed for Docker)
DB_PATH = "/app/db/dashboard.db"
GPX_DIR = Path("/app/gpx_files")

# Namespace for GPX files
GPX_NS = {"gpx": "http://www.topografix.com/GPX/1/1"}


def parse_flight_id(flight_id):
    """Extract date and time from flight_id like 'flight-2025-09-27-1708'"""
    match = re.match(r"flight-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})", flight_id)
    if match:
        year, month, day, hour, minute = match.groups()
        return {
            "date": f"{year}-{month}-{day}",
            "time": f"{hour}h{minute}",
            "day_month": f"{day}-{month}",
        }
    return None


def extract_max_altitude_from_gpx(gpx_path):
    """Parse GPX file and extract maximum altitude"""
    try:
        tree = ET.parse(gpx_path)
        root = tree.getroot()

        # Find all trackpoints
        altitudes = []
        for trkpt in root.findall(".//gpx:trkpt", GPX_NS):
            ele = trkpt.find("gpx:ele", GPX_NS)
            if ele is not None and ele.text:
                altitudes.append(float(ele.text))

        # Also check without namespace (some GPX files don't use it)
        if not altitudes:
            for trkpt in root.findall(".//trkpt"):
                ele = trkpt.find("ele")
                if ele is not None and ele.text:
                    altitudes.append(float(ele.text))

        if altitudes:
            return int(round(max(altitudes)))
        return None
    except Exception as e:
        print(f"Error parsing {gpx_path}: {e}")
        return None


def find_gpx_for_flight(flight_date, gpx_dir):
    """Find GPX file matching the flight date/time"""
    # List all GPX files and try to match by timestamp in filename or content
    gpx_files = list(gpx_dir.glob("strava_*.gpx"))

    # For now, let's parse each GPX to find the start time
    flight_dt = datetime.fromisoformat(flight_date)

    for gpx_path in gpx_files:
        try:
            tree = ET.parse(gpx_path)
            root = tree.getroot()

            # Find first time element
            time_elem = root.find(".//gpx:time", GPX_NS)
            if time_elem is None:
                time_elem = root.find(".//time")

            if time_elem is not None and time_elem.text:
                gpx_time = datetime.fromisoformat(time_elem.text.replace("Z", "+00:00"))
                # Remove timezone for comparison
                gpx_time = gpx_time.replace(tzinfo=None)

                # If the GPX starts within 30 minutes of the flight, it's a match
                time_diff = abs((gpx_time - flight_dt).total_seconds())
                if time_diff < 1800:  # 30 minutes
                    return gpx_path
        except Exception as e:
            print(f"Error checking {gpx_path}: {e}")
            continue

    return None


def main():
    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get all sites for name lookup
    cursor.execute("SELECT id, name FROM sites")
    sites = {row[0]: row[1] for row in cursor.fetchall()}

    # Get all flights
    cursor.execute(
        "SELECT id, site_id, flight_date FROM flights WHERE title IS NULL OR max_altitude_m IS NULL"
    )
    flights = cursor.fetchall()

    print(f"Found {len(flights)} flights to fix")

    for flight_id, site_id, flight_date in flights:
        print(f"\nProcessing {flight_id}...")

        # Parse flight ID
        parsed = parse_flight_id(flight_id)
        if not parsed:
            print("  ❌ Could not parse flight ID")
            continue

        # Get site name
        site_name = sites.get(site_id, "Unknown")

        # Build title: "site_name JJ-MM HHhMM"
        title = f"{site_name} {parsed['day_month']} {parsed['time']}"
        print(f"  Title: {title}")

        # Find and parse GPX file
        flight_dt = datetime.fromisoformat(flight_date)
        gpx_file = find_gpx_for_flight(flight_date, GPX_DIR)

        max_altitude = None
        if gpx_file:
            print(f"  Found GPX: {gpx_file.name}")
            max_altitude = extract_max_altitude_from_gpx(gpx_file)
            if max_altitude:
                print(f"  Max altitude: {max_altitude}m")
            else:
                print("  ⚠️  Could not extract altitude from GPX")
        else:
            print("  ⚠️  No matching GPX file found")

        # Update database
        if max_altitude:
            cursor.execute(
                "UPDATE flights SET title = ?, max_altitude_m = ? WHERE id = ?",
                (title, max_altitude, flight_id),
            )
        else:
            cursor.execute("UPDATE flights SET title = ? WHERE id = ?", (title, flight_id))

        print("  ✅ Updated")

    # Commit changes
    conn.commit()
    conn.close()

    print("\n✅ All flights updated!")


if __name__ == "__main__":
    main()
