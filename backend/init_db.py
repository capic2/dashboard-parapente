#!/usr/bin/env python3
"""Initialize SQLite database with schema"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "db" / "dashboard.db"
SCHEMA_PATH = Path(__file__).parent.parent / "docs" / "PHASE-1-DESIGN" / "dashboard-schema-sqlite.sql"

def init_db():
    """Create database and tables from schema"""
    # Ensure db dir exists
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    # Read schema
    with open(SCHEMA_PATH, 'r') as f:
        schema = f.read()
    
    # Create connection and execute schema
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.executescript(schema)
        conn.commit()
        print(f"✅ Database initialized: {DB_PATH}")
        
        # Insert default sites
        cursor.execute("""
            INSERT OR IGNORE INTO sites (id, code, name, elevation_m, latitude, longitude, region)
            VALUES 
                ('site-arguel', 'arguel', 'Arguel', 427, 47.012, 6.789, 'Besançon'),
                ('site-mont-poupet', 'mont-poupet', 'Mont Poupet', 842, 47.015, 6.750, 'Besançon'),
                ('site-la-cote', 'la-cote', 'La Côte', 800, 47.020, 6.770, 'Besançon')
        """)
        conn.commit()
        print(f"✅ Default sites inserted")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()
