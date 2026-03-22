#!/usr/bin/env python3
"""
Seed the database with real flights from existing GPX/IGC files
"""

import sys
import uuid
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from database import SessionLocal
from models import Flight, Site
from routes import calculate_gpx_stats, parse_gpx_file


def seed_real_flights():
    """Seed the database with real flights from GPX/IGC files"""
    db = SessionLocal()

    try:
        # Get existing sites
        sites = {site.code: site for site in db.query(Site).all()}

        # Check if flights already exist
        existing_flights = db.query(Flight).count()
        if existing_flights > 0:
            print(f"⚠️  Found {existing_flights} existing flights in database")
            response = input("Delete existing flights and recreate? (y/N): ")
            if response.lower() != "y":
                print("❌ Aborted")
                return
            # Delete existing flights
            db.query(Flight).delete()
            db.commit()
            print("✅ Existing flights deleted")

        # GPX/IGC files directory
        gpx_dir = Path(__file__).parent / "db" / "gpx"

        # Real flight data mapping
        real_flights = [
            {
                "file": "manual_06d8804c-5263-4cbe-8dd6-6b947e6b8c31.igc",
                "title": "Vol thermique Mont Poupet",
                "site_code": "mont-poupet-nord",
                "notes": "Vol IGC importé manuellement - belles conditions thermiques",
            },
            {
                "file": "strava_16394749726.gpx",
                "title": "Afternoon Workout",
                "site_code": "mont-poupet-nord",
                "strava_id": "16394749726",
                "notes": "Vol Strava synchronisé",
            },
            {
                "file": "strava_16394022550.gpx",
                "title": "Morning Flight",
                "site_code": "mont-poupet-nord",
                "strava_id": "16394022550",
                "notes": "Vol Strava synchronisé",
            },
            {
                "file": "strava_16118040828.gpx",
                "title": "Cross-country attempt",
                "site_code": "mont-poupet-nord",
                "strava_id": "16118040828",
                "notes": "Tentative de cross-country",
            },
            {
                "file": "strava_15967079829.gpx",
                "title": "Long distance flight",
                "site_code": "mont-poupet-nord",
                "strava_id": "15967079829",
                "notes": "Vol longue distance",
            },
            {
                "file": "strava_15965366307.gpx",
                "title": "Thermal soaring",
                "site_code": "mont-poupet-nord",
                "strava_id": "15965366307",
                "notes": "Exploitation des thermiques",
            },
            {
                "file": "strava_15963566849.gpx",
                "title": "Extended flight",
                "site_code": "arguel",
                "strava_id": "15963566849",
                "notes": "Vol prolongé",
            },
            {
                "file": "strava_15954552836.gpx",
                "title": "Local flight",
                "site_code": "mont-poupet-nord",
                "strava_id": "15954552836",
                "notes": "Vol local",
            },
            {
                "file": "2025-11-08_la-cote_72672aab.gpx",
                "title": "Vol La Côte",
                "site_code": "la-cote",
                "notes": "Vol du 8 novembre 2025",
            },
            {
                "file": "2025-11-08_la-cote_54b9af02.gpx",
                "title": "Vol La Côte (matin)",
                "site_code": "la-cote",
                "notes": "Vol matinal du 8 novembre",
            },
            {
                "file": "2025-10-12_mont-poupet_81c2567a.gpx",
                "title": "Vol Mont Poupet",
                "site_code": "mont-poupet-nord",
                "notes": "Vol du 12 octobre",
            },
            {
                "file": "2025-09-28_arguel_027949c0.gpx",
                "title": "Vol Arguel (long)",
                "site_code": "arguel",
                "notes": "Vol prolongé à Arguel",
            },
            {
                "file": "2025-09-28_arguel_7d386bbe.gpx",
                "title": "Vol Arguel",
                "site_code": "arguel",
                "notes": "Vol du 28 septembre",
            },
            {
                "file": "2025-09-27_arguel_dcf37f69.gpx",
                "title": "Vol Arguel (27/09)",
                "site_code": "arguel",
                "notes": "Vol du 27 septembre",
            },
            {
                "file": "2025-09-27_arguel_90d9748a.gpx",
                "title": "Vol Arguel (après-midi)",
                "site_code": "arguel",
                "notes": "Vol de l'après-midi du 27 septembre",
            },
        ]

        created_count = 0
        skipped_count = 0

        for flight_data in real_flights:
            gpx_path = gpx_dir / flight_data["file"]

            if not gpx_path.exists():
                print(f"⚠️  Skipping {flight_data['file']} - file not found")
                skipped_count += 1
                continue

            try:
                # Parse GPX/IGC file
                print(f"📊 Parsing {flight_data['file']}...")
                coordinates = parse_gpx_file(gpx_path)

                if not coordinates:
                    print(f"⚠️  Skipping {flight_data['file']} - no coordinates found")
                    skipped_count += 1
                    continue

                # Calculate statistics
                stats = calculate_gpx_stats(coordinates)

                # Get site
                site = sites.get(flight_data["site_code"])

                # Extract flight date from first trackpoint or filename
                flight_date = None
                if stats["first_trackpoint"]:
                    flight_date = stats["first_trackpoint"]["time"].date()
                else:
                    # Try to extract from filename (format: YYYY-MM-DD_site_hash.gpx)
                    try:
                        date_str = flight_data["file"].split("_")[0]
                        flight_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                    except (ValueError, IndexError):
                        flight_date = datetime.now(ZoneInfo("UTC")).date()

                # Extract departure time
                departure_time = None
                if stats["first_trackpoint"]:
                    departure_time = stats["first_trackpoint"]["time"]

                # Create flight
                flight_id = str(uuid.uuid4())
                flight = Flight(
                    id=flight_id,
                    strava_id=flight_data.get("strava_id"),
                    site_id=site.id if site else None,
                    name=flight_data["title"],
                    title=flight_data["title"],
                    flight_date=flight_date,
                    departure_time=departure_time,
                    duration_minutes=(
                        int(stats["flight_duration_seconds"] / 60)
                        if stats["flight_duration_seconds"] > 0
                        else None
                    ),
                    distance_km=round(stats["total_distance_km"], 2),
                    max_altitude_m=stats["max_altitude_m"],
                    elevation_gain_m=stats["elevation_gain_m"],
                    max_speed_kmh=(
                        round(stats["max_speed_kmh"], 1) if stats["max_speed_kmh"] > 0 else None
                    ),
                    gpx_file_path=str(gpx_path),
                    gpx_max_altitude_m=stats["max_altitude_m"],
                    gpx_elevation_gain_m=stats["elevation_gain_m"],
                    notes=flight_data.get("notes", ""),
                    created_at=datetime.now(ZoneInfo("UTC")),
                    updated_at=datetime.now(ZoneInfo("UTC")),
                )

                db.add(flight)
                created_count += 1

                print(f"✅ Created flight: {flight_data['title']}")
                print(f"   📍 Site: {site.name if site else 'N/A'}")
                print(f"   📅 Date: {flight_date}")
                print(f"   ⏱️  Duration: {flight.duration_minutes} min")
                print(f"   📏 Distance: {flight.distance_km} km")
                print(f"   ⛰️  Max altitude: {flight.max_altitude_m} m")
                print(f"   ⬆️  Elevation gain: {flight.elevation_gain_m} m")
                print(f"   🚀 Max speed: {flight.max_speed_kmh} km/h")
                print(f"   📊 Coordinates: {len(coordinates)}")
                print()

            except Exception as e:
                print(f"❌ Error processing {flight_data['file']}: {e}")
                skipped_count += 1
                continue

        db.commit()

        print("=" * 60)
        print(f"✅ Successfully created {created_count} flights")
        if skipped_count > 0:
            print(f"⚠️  Skipped {skipped_count} flights")
        print("=" * 60)

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_real_flights()
