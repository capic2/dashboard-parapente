#!/usr/bin/env python3
"""
Migration: Add 'name' and 'departure_time' columns to flights table
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "db" / "dashboard.db"


def migrate():
    """Add name and departure_time columns to flights"""

    if not DB_PATH.exists():
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(flights)")
        columns = [col[1] for col in cursor.fetchall()]

        changes_made = False

        # Add 'name' column if missing
        if "name" not in columns:
            cursor.execute("ALTER TABLE flights ADD COLUMN name VARCHAR")
            changes_made = True

        # Add 'departure_time' column if missing
        if "departure_time" not in columns:
            cursor.execute("ALTER TABLE flights ADD COLUMN departure_time DATETIME")
            changes_made = True

        if changes_made:
            conn.commit()

        # Show current schema
        cursor.execute("PRAGMA table_info(flights)")
        for col in cursor.fetchall():
            print(col)

    except Exception:
        import traceback

        traceback.print_exc()
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
