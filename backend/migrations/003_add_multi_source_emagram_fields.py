"""
Migration: Add Multi-Source Emagram Fields
Adds columns to emagram_analysis table for multi-source screenshot-based analysis
"""

from database import engine
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)

MIGRATION_NAME = "003_add_multi_source_emagram_fields"


def upgrade():
    """Add new columns for multi-source emagram analysis"""
    
    with engine.connect() as conn:
        # Check if migration already applied
        result = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='emagram_analysis'"
        ))
        
        if not result.fetchone():
            logger.info(f"⊙ Table emagram_analysis doesn't exist yet, skipping {MIGRATION_NAME}")
            return
        
        # Check if columns already exist
        result = conn.execute(text("PRAGMA table_info(emagram_analysis)"))
        existing_columns = {row[1] for row in result.fetchall()}
        
        columns_to_add = [
            ("external_source_urls", "TEXT"),
            ("sources_count", "INTEGER"),
            ("sources_agreement", "VARCHAR(20)"),
        ]
        
        added_count = 0
        for column_name, column_type in columns_to_add:
            if column_name not in existing_columns:
                logger.info(f"Adding column {column_name} to emagram_analysis...")
                conn.execute(text(
                    f"ALTER TABLE emagram_analysis ADD COLUMN {column_name} {column_type}"
                ))
                conn.commit()
                added_count += 1
                logger.info(f"✓ Column {column_name} added")
            else:
                logger.info(f"⊙ Column {column_name} already exists (skipping)")
        
        if added_count > 0:
            logger.info(f"✓ Migration {MIGRATION_NAME} applied successfully ({added_count} columns added)")
        else:
            logger.info(f"⊙ Migration {MIGRATION_NAME} already applied (skipping)")


def downgrade():
    """Remove multi-source emagram columns (optional, for rollback)"""
    
    # SQLite doesn't support DROP COLUMN easily
    # Would need to recreate table without these columns
    # For now, just log that downgrade is not supported
    
    logger.warning(f"⚠️ Downgrade not supported for {MIGRATION_NAME} (SQLite limitation)")
    logger.warning("   To rollback, restore database from backup")


if __name__ == "__main__":
    # Run migration if executed directly
    logging.basicConfig(level=logging.INFO)
    logger.info(f"Running migration: {MIGRATION_NAME}")
    upgrade()
