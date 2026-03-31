"""
Migration 005: Add forecast_date column to emagram_analysis table
"""

from sqlalchemy import create_engine, text
import logging
import sys
import os

# Add parent directory to path so we can import config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

logger = logging.getLogger(__name__)

MIGRATION_NAME = "005_add_forecast_date"


def upgrade():
    """Add forecast_date column to emagram_analysis table and backfill from analysis_date"""

    engine = create_engine(config.DATABASE_URL)
    with engine.connect() as conn:
        # Check if table exists
        result = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='emagram_analysis'"
        ))

        if not result.fetchone():
            logger.info(f"⊙ Table emagram_analysis doesn't exist yet, skipping {MIGRATION_NAME}")
            print(f"⊙ Table emagram_analysis doesn't exist yet, skipping {MIGRATION_NAME}")
            return

        # Check if column already exists
        result = conn.execute(text("PRAGMA table_info(emagram_analysis)"))
        existing_columns = {row[1] for row in result.fetchall()}

        if 'forecast_date' in existing_columns:
            logger.info(f"⊙ Column forecast_date already exists, skipping {MIGRATION_NAME}")
            print(f"⊙ Column forecast_date already exists, skipping {MIGRATION_NAME}")
            return

        # Add column
        logger.info(f"Adding column forecast_date to emagram_analysis...")
        print(f"Adding column forecast_date to emagram_analysis...")

        conn.execute(text(
            "ALTER TABLE emagram_analysis ADD COLUMN forecast_date DATE"
        ))

        # Backfill: set forecast_date = analysis_date for existing rows
        conn.execute(text(
            "UPDATE emagram_analysis SET forecast_date = analysis_date WHERE forecast_date IS NULL"
        ))

        conn.commit()

        logger.info(f"✓ Migration {MIGRATION_NAME} applied successfully")
        print(f"✓ Migration {MIGRATION_NAME} applied successfully")


if __name__ == "__main__":
    upgrade()
