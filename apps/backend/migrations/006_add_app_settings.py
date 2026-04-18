"""
Migration: Add app_settings table
Created: 2026-04-03
Description: Adds key-value settings table for configurable cache, scheduler, and Redis parameters
"""

import logging
import os
from datetime import datetime

from sqlalchemy import create_engine, text

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./db/dashboard.db")
engine = create_engine(DATABASE_URL)


# Default settings values
DEFAULT_SETTINGS = {
    "cache_ttl_default": "3600",  # 60 minutes - TTL for weather sources
    "cache_ttl_summary": "3600",  # 60 minutes - TTL for summaries
    "scheduler_interval_minutes": "30",  # 30 minutes - scheduler polling interval
    "redis_connect_timeout": "5",  # 5 seconds
    "redis_socket_timeout": "5",  # 5 seconds
}


def upgrade():
    """Create app_settings table and insert default values"""

    logger.info("🔧 Creating app_settings table...")

    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # Insert default settings
        now = datetime.utcnow().isoformat()
        for key, value in DEFAULT_SETTINGS.items():
            conn.execute(
                text("""
                    INSERT INTO app_settings (key, value, updated_at)
                    VALUES (:key, :value, :updated_at)
                    ON CONFLICT(key) DO NOTHING
                """),
                {"key": key, "value": value, "updated_at": now},
            )
            logger.info(f"  ✅ Setting: {key} = {value}")

        conn.commit()

    logger.info("✅ app_settings table created with default values")


def downgrade():
    """Drop app_settings table"""

    logger.info("🔧 Dropping app_settings table...")

    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS app_settings"))
        conn.commit()

    logger.info("✅ app_settings table dropped")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
