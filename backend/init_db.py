#!/usr/bin/env python3
"""Initialize SQLite database with default sites"""

import sqlite3
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent / "db" / "dashboard.db"

def init_db():
    """Insert default sites into existing database"""
    # Ensure db dir exists
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    if not DB_PATH.exists():
        return
    
    # Create connection
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        now = datetime.utcnow().isoformat()
        
        # Insert default sites with all required fields
        cursor.execute("""
            INSERT OR IGNORE INTO sites 
            (id, code, name, elevation_m, latitude, longitude, region, country, created_at, updated_at)
            VALUES 
                ('site-arguel', 'arguel', 'Arguel', 427, 47.012, 6.789, 'Besançon', 'FR', ?, ?),
                ('site-mont-poupet', 'mont-poupet', 'Mont Poupet', 842, 47.015, 6.750, 'Besançon', 'FR', ?, ?),
                ('site-la-cote', 'la-cote', 'La Côte', 800, 47.020, 6.770, 'Besançon', 'FR', ?, ?)
        """, (now, now, now, now, now, now))
        
        # Update existing sites that might be missing required fields
        cursor.execute("""
            UPDATE sites 
            SET country = 'FR', 
                created_at = COALESCE(created_at, ?),
                updated_at = COALESCE(updated_at, ?)
            WHERE country IS NULL OR created_at IS NULL OR updated_at IS NULL
        """, (now, now))
        
        conn.commit()
        
        # Verify
        cursor.execute('SELECT code, name, country FROM sites')
        sites = cursor.fetchall()
        for site in sites:
            print(f"✓ Site: {site[1]} ({site[0]}) - {site[2]}")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()
