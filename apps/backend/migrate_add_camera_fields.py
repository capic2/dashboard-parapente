#!/usr/bin/env python3
"""
Migration: Add camera_direction and camera_distance fields to sites table

This migration adds manual camera positioning fields to allow users to:
- Set the camera direction (cardinal direction: N, NE, E, etc.)
- Set the camera distance from takeoff point (in meters)

Date: 2026-03-07
"""

import sqlite3
import sys
from pathlib import Path


def migrate(db_path: str):
    """Add camera_direction and camera_distance columns to sites table"""

    print(f"🔄 Starting migration on: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(sites)")
        columns = [column[1] for column in cursor.fetchall()]

        needs_camera_direction = "camera_direction" not in columns
        needs_camera_distance = "camera_distance" not in columns

        if not needs_camera_direction and not needs_camera_distance:
            print("✅ Columns already exist. Nothing to do.")
            return

        # Add camera_direction column if needed
        if needs_camera_direction:
            print("📐 Adding camera_direction column...")
            cursor.execute("""
                ALTER TABLE sites
                ADD COLUMN camera_direction TEXT
            """)
            print("✅ camera_direction column added")
        else:
            print("✅ camera_direction column already exists")

        # Add camera_distance column if needed
        if needs_camera_distance:
            print("📏 Adding camera_distance column...")
            cursor.execute("""
                ALTER TABLE sites
                ADD COLUMN camera_distance INTEGER DEFAULT 500
            """)
            print("✅ camera_distance column added")
        else:
            print("✅ camera_distance column already exists")

        # Set default camera_distance for existing sites
        if needs_camera_distance:
            print("🔧 Setting default camera_distance (500m) for existing sites...")
            cursor.execute("""
                UPDATE sites
                SET camera_distance = 500
                WHERE camera_distance IS NULL
            """)
            print(f"✅ Updated {cursor.rowcount} sites with default camera_distance")

        # Optionally: Initialize camera_direction based on existing orientation
        # This makes camera positioned in the same direction as orientation
        print("🔧 Initializing camera_direction from orientation...")
        cursor.execute("""
            UPDATE sites
            SET camera_direction = orientation
            WHERE camera_direction IS NULL
            AND orientation IS NOT NULL
        """)
        updated_count = cursor.rowcount
        if updated_count > 0:
            print(f"✅ Initialized camera_direction for {updated_count} sites from orientation")

        conn.commit()
        print("✅ Migration completed successfully!")

        # Show summary
        cursor.execute("SELECT COUNT(*) FROM sites")
        total_sites = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM sites WHERE camera_direction IS NOT NULL")
        sites_with_direction = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM sites WHERE camera_distance IS NOT NULL")
        sites_with_distance = cursor.fetchone()[0]

        print("\n📊 Summary:")
        print(f"   Total sites: {total_sites}")
        print(f"   Sites with camera_direction: {sites_with_direction}")
        print(f"   Sites with camera_distance: {sites_with_distance}")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    # Default database path
    db_path = Path(__file__).parent / "db" / "dashboard.db"

    # Allow custom path from command line
    if len(sys.argv) > 1:
        db_path = Path(sys.argv[1])

    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        print("Usage: python migrate_add_camera_fields.py [path/to/database.db]")
        sys.exit(1)

    migrate(str(db_path))
