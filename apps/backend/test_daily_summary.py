#!/usr/bin/env python3
"""
Test script to debug daily-summary endpoint issues
Run this in production to see detailed error information
"""

import asyncio
import logging

from database import SessionLocal
from models import Site
from weather_pipeline import get_daily_aggregate

# Configure logging
logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def test_daily_summary():
    """Test fetching daily summary for site-arguel"""
    db = SessionLocal()

    try:
        # Get site
        site = db.query(Site).filter(Site.id == "site-arguel").first()
        if not site:
            logger.error("Site 'site-arguel' not found!")
            return

        logger.info(f"Testing daily summary for: {site.name}")
        logger.info(f"Coordinates: {site.latitude}, {site.longitude}")

        # Test fetching day 0 (today)
        logger.info("Fetching day 0 (today)...")

        result = await get_daily_aggregate(
            lat=site.latitude,
            lon=site.longitude,
            day_index=0,
            min_wind=2.8,
            max_wind=8.3,
            optimal_directions="N,NE,E,SE,S,SW,W,NW",
            sources=None,
            site_name=site.name,
            elevation_m=site.elevation_m,
        )

        if result:
            logger.info(f"✅ Success! Result: {result}")
        else:
            logger.error("❌ get_daily_aggregate returned None")

    except Exception as e:
        logger.error(f"❌ Exception occurred: {e}", exc_info=True)
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(test_daily_summary())
