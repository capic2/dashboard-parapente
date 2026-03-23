#!/usr/bin/env python3
"""
One-shot migration to populate weather_source_config table
Use this if your database already exists but weather sources are missing

Usage:
    cd apps/backend
    python migrate_weather_sources_local.py
"""

import logging
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

# Import after adding to path
from main import seed_weather_sources

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("MIGRATING WEATHER SOURCES")
    logger.info("=" * 60)

    result = seed_weather_sources()

    if result:
        logger.info("=" * 60)
        logger.info("✅ Weather sources migration completed successfully!")
        logger.info("=" * 60)
        sys.exit(0)
    else:
        logger.error("=" * 60)
        logger.error("❌ Weather sources migration failed!")
        logger.error("=" * 60)
        sys.exit(1)
