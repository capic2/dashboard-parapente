"""
Migration: Add emagram_feedback table
Created: 2025-03-07
Description: Pilot feedback system to compare predictions vs reality
"""

from sqlalchemy import create_engine, text
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./db/dashboard.db")
engine = create_engine(DATABASE_URL)


def upgrade():
    """Create emagram_feedback table"""
    
    logger.info("🔧 Creating emagram_feedback table...")
    
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS emagram_feedback (
                id TEXT PRIMARY KEY,
                emagram_analysis_id TEXT NOT NULL,
                pilot_name TEXT,
                feedback_date DATE NOT NULL,
                flight_took_place BOOLEAN NOT NULL,
                
                -- Actual conditions reported by pilot
                actual_plafond_m INTEGER,
                actual_force_ms REAL,
                actual_thermal_quality TEXT,
                actual_hours_start TIME,
                actual_hours_end TIME,
                actual_risk_level TEXT,
                
                -- Accuracy rating (1-5)
                accuracy_plafond INTEGER,
                accuracy_force INTEGER,
                accuracy_hours INTEGER,
                accuracy_overall INTEGER,
                
                -- Comments
                comments TEXT,
                would_recommend BOOLEAN,
                
                -- Metadata
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (emagram_analysis_id) REFERENCES emagram_analysis(id)
            )
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_feedback_analysis 
            ON emagram_feedback(emagram_analysis_id)
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_feedback_date 
            ON emagram_feedback(feedback_date DESC)
        """))
        
        conn.commit()
    
    logger.info("✅ emagram_feedback table created")


def downgrade():
    """Drop emagram_feedback table"""
    logger.info("🔧 Dropping emagram_feedback table...")
    
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS emagram_feedback"))
        conn.commit()
    
    logger.info("✅ Table dropped")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
