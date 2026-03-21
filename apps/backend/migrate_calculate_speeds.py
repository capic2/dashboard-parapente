"""
Migration script to calculate max_speed_kmh for existing flights with GPX data
"""

import logging
from pathlib import Path

from database import SessionLocal
from models import Flight
from routes import calculate_max_speed, parse_gpx_file

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate_speeds():
    """Recalculate max_speed_kmh for all flights with GPX files"""
    db = SessionLocal()

    try:
        # Get all flights with GPX files
        flights = db.query(Flight).filter(Flight.gpx_file_path.isnot(None)).all()

        logger.info(f"Found {len(flights)} flights with GPX files")

        updated_count = 0
        failed_count = 0

        for flight in flights:
            try:
                # Build GPX path
                gpx_path = Path(__file__).parent / flight.gpx_file_path

                if not gpx_path.exists():
                    logger.warning(f"GPX file not found for flight {flight.id}: {gpx_path}")
                    failed_count += 1
                    continue

                # Parse GPX
                coordinates = parse_gpx_file(gpx_path)

                if not coordinates:
                    logger.warning(f"No coordinates found in GPX for flight {flight.id}")
                    failed_count += 1
                    continue

                # Calculate max speed
                max_speed = calculate_max_speed(coordinates)

                # Update flight
                flight.max_speed_kmh = max_speed
                updated_count += 1

                logger.info(f"✅ Flight {flight.id[:8]}... - Max speed: {max_speed} km/h")

            except Exception as e:
                logger.error(f"❌ Failed to process flight {flight.id}: {e}")
                failed_count += 1

        # Commit all changes
        db.commit()

        logger.info("=" * 60)
        logger.info("✅ Migration complete!")
        logger.info(f"   Updated: {updated_count} flights")
        logger.info(f"   Failed: {failed_count} flights")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_speeds()
