"""
Migration: Add emagram max age setting
Created: 2026-04-18
Description: Seeds emagram_max_age_minutes in app_settings for existing deployments
"""

import logging
import os
from datetime import datetime

from sqlalchemy import create_engine, text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./db/dashboard.db")
engine = create_engine(DATABASE_URL)

SETTING_KEY = "emagram_max_age_minutes"
SETTING_VALUE = "180"


def upgrade():
    """Insert emagram freshness setting if missing."""
    with engine.connect() as conn:
        conn.execute(
            text("""
                INSERT INTO app_settings (key, value, updated_at)
                VALUES (:key, :value, :updated_at)
                ON CONFLICT(key) DO NOTHING
                """),
            {
                "key": SETTING_KEY,
                "value": SETTING_VALUE,
                "updated_at": datetime.utcnow().isoformat(),
            },
        )
        conn.commit()
    logger.info(f"✅ Ensured setting exists: {SETTING_KEY}={SETTING_VALUE}")


def downgrade():
    """Safely remove seeded emagram freshness setting."""
    with engine.connect() as conn:
        conn.execute(
            text("DELETE FROM app_settings WHERE key = :key"),
            {"key": SETTING_KEY},
        )
        conn.commit()
    logger.info(f"✅ Removed setting if present: {SETTING_KEY}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
