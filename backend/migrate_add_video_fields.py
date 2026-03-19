#!/usr/bin/env python3
"""
Migration script to add video export fields to Flight table
"""
from sqlalchemy import create_engine, text
import config

def migrate():
    engine = create_engine(config.DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if flights table exists
        result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='flights'"))
        if not result.fetchone():
            print("⚠️ flights table doesn't exist yet, skipping migration")
            return
        
        # For SQLite, check columns using PRAGMA
        result = conn.execute(text("PRAGMA table_info(flights)"))
        existing_columns = {row[1] for row in result}
        
        print(f"Existing columns: {existing_columns}")
        
        # Add columns if they don't exist
        if 'video_export_job_id' not in existing_columns:
            print("Adding video_export_job_id column...")
            conn.execute(text("ALTER TABLE flights ADD COLUMN video_export_job_id VARCHAR"))
            conn.commit()
            print("✓ video_export_job_id added")
        else:
            print("✓ video_export_job_id already exists")
            
        if 'video_export_status' not in existing_columns:
            print("Adding video_export_status column...")
            conn.execute(text("ALTER TABLE flights ADD COLUMN video_export_status VARCHAR"))
            conn.commit()
            print("✓ video_export_status added")
        else:
            print("✓ video_export_status already exists")
            
        if 'video_file_path' not in existing_columns:
            print("Adding video_file_path column...")
            conn.execute(text("ALTER TABLE flights ADD COLUMN video_file_path VARCHAR"))
            conn.commit()
            print("✓ video_file_path added")
        else:
            print("✓ video_file_path already exists")
    
    print("\n✅ Migration completed successfully!")

if __name__ == "__main__":
    migrate()
