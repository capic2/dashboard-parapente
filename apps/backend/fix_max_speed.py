"""
Script to recalculate max_speed_kmh for existing flights with GPX files
Run once to fix existing flights that have max_speed_kmh = 0
"""

from pathlib import Path

from database import SessionLocal
from models import Flight
from routes import calculate_max_speed, parse_gpx_file


def fix_max_speed():
    """Recalculate max_speed_kmh for all flights with GPX files"""
    db = SessionLocal()

    try:
        # Get all flights with GPX files but max_speed = 0
        flights = (
            db.query(Flight)
            .filter(Flight.gpx_file_path.isnot(None), Flight.max_speed_kmh == 0.0)
            .all()
        )

        print(f"Found {len(flights)} flights to fix")

        updated_count = 0
        error_count = 0

        for flight in flights:
            try:
                gpx_path = Path(flight.gpx_file_path)

                if not gpx_path.exists():
                    print(f"⚠️  GPX file not found: {flight.gpx_file_path}")
                    continue

                # Parse GPX and calculate max speed
                coordinates = parse_gpx_file(gpx_path)

                if coordinates and len(coordinates) > 1:
                    max_speed = calculate_max_speed(coordinates)
                    flight.max_speed_kmh = max_speed

                    print(f"✅ {flight.name}: {max_speed:.2f} km/h")
                    updated_count += 1
                else:
                    print(f"⚠️  No coordinates found for {flight.name}")

            except Exception as e:
                print(f"❌ Error processing {flight.name}: {e}")
                error_count += 1

        # Commit all updates
        db.commit()

        print(f"\n✅ Updated {updated_count} flights")
        print(f"❌ Errors: {error_count}")

    finally:
        db.close()


if __name__ == "__main__":
    fix_max_speed()
