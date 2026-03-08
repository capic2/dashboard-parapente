#!/usr/bin/env python3
"""
Migration 004: Add screenshot_paths column to emagram_analysis table
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from config import engine


def check_column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table"""
    with engine.connect() as conn:
        result = conn.execute(text(
            f"SELECT COUNT(*) FROM pragma_table_info('{table_name}') WHERE name='{column_name}'"
        ))
        return result.scalar() > 0


def run_migration():
    """Add screenshot_paths column to emagram_analysis table"""
    
    print("\n" + "="*60)
    print("MIGRATION 004: Add screenshot_paths to emagram_analysis")
    print("="*60)
    
    # Check if column already exists
    if check_column_exists('emagram_analysis', 'screenshot_paths'):
        print("✅ Column 'screenshot_paths' already exists, skipping migration")
        return
    
    print("Adding 'screenshot_paths' column to emagram_analysis table...")
    
    with engine.begin() as conn:
        # Add screenshot_paths column (JSON text field)
        conn.execute(text("""
            ALTER TABLE emagram_analysis
            ADD COLUMN screenshot_paths TEXT
        """))
        
        print("✅ Column 'screenshot_paths' added successfully")
    
    print("="*60)
    print("MIGRATION 004 COMPLETE")
    print("="*60 + "\n")


if __name__ == "__main__":
    run_migration()
