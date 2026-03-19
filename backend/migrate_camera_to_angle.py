#!/usr/bin/env python3
"""
Migration: Replace camera_direction with camera_angle

This migration:
1. Drops camera_direction column (if exists)
2. Adds camera_angle INTEGER column
3. Initializes camera_angle from orientation if available

Date: 2026-03-07
"""

import sqlite3
import sys
from pathlib import Path

# Mapping of cardinal directions to degrees
ORIENTATION_TO_DEGREES = {
    'N': 0,
    'NNE': 22.5,
    'NE': 45,
    'ENE': 67.5,
    'E': 90,
    'ESE': 112.5,
    'SE': 135,
    'SSE': 157.5,
    'S': 180,
    'SSW': 202.5,
    'SW': 225,
    'WSW': 247.5,
    'W': 270,
    'WNW': 292.5,
    'NW': 315,
    'NNW': 337.5
}

def migrate(db_path: str):
    """Replace camera_direction with camera_angle"""
    
    print(f"🔄 Starting migration on: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if sites table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sites'")
        if not cursor.fetchone():
            print("⚠️ sites table doesn't exist yet, skipping migration")
            return
        
        # Check current columns
        cursor.execute("PRAGMA table_info(sites)")
        columns = {column[1]: column for column in cursor.fetchall()}
        
        has_camera_direction = 'camera_direction' in columns
        has_camera_angle = 'camera_angle' in columns
        
        # Step 1: Add camera_angle if it doesn't exist
        if not has_camera_angle:
            print("📐 Adding camera_angle column...")
            cursor.execute("""
                ALTER TABLE sites 
                ADD COLUMN camera_angle INTEGER
            """)
            print("✅ camera_angle column added")
        else:
            print("✅ camera_angle column already exists")
        
        # Step 2: Migrate data from camera_direction to camera_angle
        if has_camera_direction:
            print("🔄 Migrating camera_direction values to camera_angle...")
            
            # Get sites with camera_direction
            cursor.execute("SELECT id, camera_direction FROM sites WHERE camera_direction IS NOT NULL")
            sites_with_direction = cursor.fetchall()
            
            migrated_count = 0
            for site_id, direction in sites_with_direction:
                angle = ORIENTATION_TO_DEGREES.get(direction.upper())
                if angle is not None:
                    cursor.execute("UPDATE sites SET camera_angle = ? WHERE id = ?", (int(angle), site_id))
                    migrated_count += 1
            
            if migrated_count > 0:
                print(f"✅ Migrated {migrated_count} sites from camera_direction to camera_angle")
        
        # Step 3: Initialize camera_angle from orientation for sites without camera_angle
        print("🔧 Initializing camera_angle from orientation where needed...")
        cursor.execute("""
            SELECT id, orientation 
            FROM sites 
            WHERE camera_angle IS NULL 
            AND orientation IS NOT NULL
        """)
        sites_to_init = cursor.fetchall()
        
        init_count = 0
        for site_id, orientation in sites_to_init:
            angle = ORIENTATION_TO_DEGREES.get(orientation.upper())
            if angle is not None:
                cursor.execute("UPDATE sites SET camera_angle = ? WHERE id = ?", (int(angle), site_id))
                init_count += 1
        
        if init_count > 0:
            print(f"✅ Initialized camera_angle for {init_count} sites from orientation")
        
        # Step 4: Drop camera_direction column if it exists
        # SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
        if has_camera_direction:
            print("🗑️  Removing camera_direction column...")
            
            # Get the current table schema
            cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='sites'")
            create_table_sql = cursor.fetchone()[0]
            
            # Create a temporary table without camera_direction
            cursor.execute("""
                CREATE TABLE sites_new (
                    id TEXT PRIMARY KEY,
                    code TEXT UNIQUE,
                    name TEXT NOT NULL,
                    elevation_m INTEGER,
                    latitude REAL,
                    longitude REAL,
                    description TEXT,
                    region TEXT,
                    country TEXT DEFAULT 'FR',
                    site_type TEXT DEFAULT 'user_spot',
                    linked_spot_id TEXT,
                    rating INTEGER,
                    orientation TEXT,
                    camera_angle INTEGER,
                    camera_distance INTEGER DEFAULT 500,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(linked_spot_id) REFERENCES paragliding_spots(id)
                )
            """)
            
            # Copy data (excluding camera_direction)
            cursor.execute("""
                INSERT INTO sites_new 
                SELECT id, code, name, elevation_m, latitude, longitude, description, 
                       region, country, site_type, linked_spot_id, rating, orientation,
                       camera_angle, camera_distance, created_at, updated_at
                FROM sites
            """)
            
            # Drop old table and rename new one
            cursor.execute("DROP TABLE sites")
            cursor.execute("ALTER TABLE sites_new RENAME TO sites")
            
            print("✅ camera_direction column removed")
        
        conn.commit()
        print("✅ Migration completed successfully!")
        
        # Show summary
        cursor.execute("SELECT COUNT(*) FROM sites")
        total_sites = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM sites WHERE camera_angle IS NOT NULL")
        sites_with_angle = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM sites WHERE camera_distance IS NOT NULL")
        sites_with_distance = cursor.fetchone()[0]
        
        print("\n📊 Summary:")
        print(f"   Total sites: {total_sites}")
        print(f"   Sites with camera_angle: {sites_with_angle}")
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
        print("Usage: python migrate_camera_to_angle.py [path/to/database.db]")
        sys.exit(1)
    
    migrate(str(db_path))
