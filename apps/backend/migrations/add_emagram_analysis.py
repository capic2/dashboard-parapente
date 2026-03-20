"""
Migration: Add emagram_analysis table
Created: 2025-03-07
Description: Adds emagram (sounding) analysis table for AI-powered thermal forecasting
"""

from sqlalchemy import create_engine, text
import os
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./db/dashboard.db")
engine = create_engine(DATABASE_URL)


def upgrade():
    """Create emagram_analysis table"""
    
    logger.info("🔧 Creating emagram_analysis table...")
    
    # Create the table
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS emagram_analysis (
                id TEXT PRIMARY KEY,
                
                -- Metadata
                analysis_date DATE NOT NULL,
                analysis_time TIME NOT NULL,
                analysis_datetime TIMESTAMP NOT NULL,
                station_code TEXT NOT NULL,
                station_name TEXT NOT NULL,
                station_latitude REAL NOT NULL,
                station_longitude REAL NOT NULL,
                distance_km REAL NOT NULL,
                
                -- Data source
                data_source TEXT NOT NULL DEFAULT 'wyoming',
                sounding_time TEXT NOT NULL,
                llm_provider TEXT,
                llm_model TEXT,
                llm_tokens_used INTEGER,
                llm_cost_usd REAL,
                analysis_method TEXT NOT NULL,
                
                -- AI Analysis Results (JSON from LLM)
                plafond_thermique_m INTEGER,
                force_thermique_ms REAL,
                cape_jkg REAL,
                stabilite_atmospherique TEXT,
                cisaillement_vent TEXT,
                heure_debut_thermiques TIME,
                heure_fin_thermiques TIME,
                heures_volables_total REAL,
                risque_orage TEXT,
                score_volabilite INTEGER,
                
                -- AI Textual Output
                resume_conditions TEXT,
                conseils_vol TEXT,
                alertes_securite TEXT,
                
                -- Classic Meteorology Fallback
                lcl_m INTEGER,
                lfc_m INTEGER,
                el_m INTEGER,
                lifted_index REAL,
                k_index REAL,
                total_totals REAL,
                showalter_index REAL,
                wind_shear_0_3km_ms REAL,
                wind_shear_0_6km_ms REAL,
                
                -- Raw Data Storage
                skewt_image_path TEXT,
                raw_sounding_data TEXT,
                ai_raw_response TEXT,
                
                -- Status
                analysis_status TEXT NOT NULL DEFAULT 'completed',
                error_message TEXT,
                
                -- Timestamps
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # Create indexes for common queries
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_emagram_datetime 
            ON emagram_analysis(analysis_datetime DESC)
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_emagram_date 
            ON emagram_analysis(analysis_date DESC)
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_emagram_station 
            ON emagram_analysis(station_code)
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_emagram_status 
            ON emagram_analysis(analysis_status)
        """))
        
        conn.commit()
    
    logger.info("✅ emagram_analysis table created successfully")
    logger.info("📊 Indexes created: datetime, date, station, status")


def downgrade():
    """Drop emagram_analysis table"""
    
    logger.info("🔧 Dropping emagram_analysis table...")
    
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS emagram_analysis"))
        conn.commit()
    
    logger.info("✅ Table dropped successfully")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
