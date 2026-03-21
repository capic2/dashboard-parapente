#!/usr/bin/env python3
"""
Seed database with the 6 default flying sites
Coordinates verified from paragliding_spots database (merged OpenAIP + ParaglidingSpots.com)
"""

import sqlite3
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent / "db" / "dashboard.db"

def seed_sites():
    """Insert or update the 6 default sites into database"""
    
    if not DB_PATH.exists():
        print(f"❌ Database not found at {DB_PATH}")
        return False
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        now = datetime.utcnow().isoformat()
        
        # Define the 6 sites with precise coordinates
        sites = [
            {
                'id': 'site-arguel',
                'code': 'arguel',
                'name': 'Arguel',
                'latitude': 47.1944,
                'longitude': 5.9896,
                'elevation_m': 462,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 3,
                'orientation': 'NNW',
                'linked_spot_id': 'merged_884e0213d9116315'
            },
            {
                'id': 'site-mont-poupet-nord',
                'code': 'mont-poupet-nord',
                'name': 'Mont Poupet Nord',
                'latitude': 46.9716,
                'longitude': 5.8776,
                'elevation_m': 795,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 4,
                'orientation': 'N',
                'linked_spot_id': 'merged_d370be468747c90a'
            },
            {
                'id': 'site-mont-poupet-nw',
                'code': 'mont-poupet-nw',
                'name': 'Mont Poupet Nord-Ouest',
                'latitude': 46.9701,
                'longitude': 5.8742,
                'elevation_m': 795,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 3,
                'orientation': 'NW',
                'linked_spot_id': 'merged_c30c861b49a65324'
            },
            {
                'id': 'site-mont-poupet-ouest',
                'code': 'mont-poupet-ouest',
                'name': 'Mont Poupet Ouest',
                'latitude': 46.9693,
                'longitude': 5.8747,
                'elevation_m': 795,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 4,
                'orientation': 'W',
                'linked_spot_id': 'merged_359e1153c44c269e'
            },
            {
                'id': 'site-mont-poupet-sud',
                'code': 'mont-poupet-sud',
                'name': 'Mont Poupet Sud',
                'latitude': 46.9691,
                'longitude': 5.8762,
                'elevation_m': 795,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 1,
                'orientation': 'S',
                'linked_spot_id': 'merged_60fbcc6724417e87'
            },
            {
                'id': 'site-la-cote',
                'code': 'la-cote',
                'name': 'La Côte',
                'latitude': 46.9424,
                'longitude': 5.8438,
                'elevation_m': 800,
                'region': 'Besançon',
                'country': 'FR',
                'rating': 2,
                'orientation': 'N',
                'linked_spot_id': 'merged_d3836f8db6c839fa'
            }
        ]
        
        # Insert or replace each site
        for site in sites:
            cursor.execute("""
                INSERT OR REPLACE INTO sites 
                (id, code, name, latitude, longitude, elevation_m, region, country, 
                 rating, orientation, linked_spot_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                site['id'],
                site['code'],
                site['name'],
                site['latitude'],
                site['longitude'],
                site['elevation_m'],
                site['region'],
                site['country'],
                site['rating'],
                site['orientation'],
                site['linked_spot_id'],
                now,
                now
            ))
            
            print(f"✓ Seeded: {site['name']} ({site['code']}) at {site['latitude']:.4f}, {site['longitude']:.4f}")
        
        conn.commit()
        
        # Verify
        cursor.execute('SELECT COUNT(*) FROM sites')
        count = cursor.fetchone()[0]
        print(f"\n✅ Database now contains {count} sites")
        
        return True
        
    except Exception as e:
        print(f"❌ Error seeding sites: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    print("🌱 Seeding sites into database...")
    success = seed_sites()
    exit(0 if success else 1)
