"""
Migration: Add usage_type field to sites table

This migration adds a 'usage_type' column to distinguish between:
- 'takeoff': Site used for takeoff only
- 'landing': Site used for landing only  
- 'both': Site used for both takeoff and landing (default)

Note: 'site_type' already exists for classifying site source (user_spot/official_spot).
This is a different field for site usage classification.

Existing sites will be set to 'both' for compatibility.
"""
import sqlite3
from pathlib import Path

def migrate_add_site_type():
    """Add usage_type column to sites table"""
    db_path = Path(__file__).parent / "db" / "dashboard.db"
    
    print("=" * 60)
    print("Migration: Add usage_type field to sites table")
    print("=" * 60)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if column already exists
        cursor.execute("PRAGMA table_info(sites)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'usage_type' in columns:
            print("✓ usage_type column already exists")
            
            # Check if there are NULL values that need updating
            cursor.execute("SELECT COUNT(*) FROM sites WHERE usage_type IS NULL")
            null_count = cursor.fetchone()[0]
            
            if null_count > 0:
                print(f"📝 Updating {null_count} sites with NULL usage_type to 'both'...")
                cursor.execute("UPDATE sites SET usage_type = 'both' WHERE usage_type IS NULL")
                conn.commit()
                print(f"✅ Updated {null_count} sites")
            
            # Show statistics
            cursor.execute("""
                SELECT usage_type, COUNT(*) as count 
                FROM sites 
                GROUP BY usage_type
            """)
            stats = cursor.fetchall()
            
            print("\n📊 Current usage_type distribution:")
            for usage_type, count in stats:
                type_label = usage_type if usage_type else 'NULL'
                print(f"   {type_label}: {count} sites")
            
            conn.close()
            return
        
        # Add usage_type column
        print("📝 Adding usage_type column...")
        cursor.execute("""
            ALTER TABLE sites 
            ADD COLUMN usage_type VARCHAR DEFAULT 'both'
        """)
        
        # Set all existing sites to 'both'
        cursor.execute("""
            UPDATE sites 
            SET usage_type = 'both' 
            WHERE usage_type IS NULL
        """)
        updated_count = cursor.rowcount
        
        conn.commit()
        print(f"✅ usage_type column added successfully")
        print(f"✅ Updated {updated_count} existing sites to 'both'")
        
        # Verify
        cursor.execute("SELECT COUNT(*) FROM sites WHERE usage_type = 'both'")
        both_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM sites")
        total_count = cursor.fetchone()[0]
        
        print(f"\n📊 Verification:")
        print(f"   Total sites: {total_count}")
        print(f"   Sites with usage_type 'both': {both_count}")
        
        if both_count == total_count:
            print("✅ Migration successful - all sites have usage_type")
        else:
            print("⚠️  Warning: Some sites may not have usage_type set")
        
        conn.close()
        print("\n" + "=" * 60)
        print("Migration completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    migrate_add_site_type()
