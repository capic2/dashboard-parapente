"""
Migration: Add emagram max age setting
Created: 2026-04-18
Description: Seeds emagram_max_age_minutes in app_settings for existing deployments
"""

import logging
from datetime import datetime

from sqlalchemy import create_engine, text

from env_utils import required_env

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


DATABASE_URL = required_env("DATABASE_URL")
engine = create_engine(DATABASE_URL)

SETTING_KEY = "emagram_max_age_minutes"
SETTING_VALUE = "180"


def upgrade() -> None:
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


def downgrade() -> None:
    """Safely remove seeded emagram freshness setting."""
    with engine.connect() as conn:
        conn.execute(
            text("DELETE FROM app_settings WHERE key = :key AND value = :value"),
            {"key": SETTING_KEY, "value": SETTING_VALUE},
        )
        conn.commit()
    logger.info(f"✅ Removed seeded setting if unchanged: {SETTING_KEY}={SETTING_VALUE}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
