"""
Migration: Add weather_source_config table
Created: 2025-03-07
Description: Adds weather source configuration table with statistics and default sources
"""

from sqlalchemy import create_engine, text
import os
from datetime import datetime
import uuid
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./db/dashboard.db")
engine = create_engine(DATABASE_URL)


def upgrade():
    """Create weather_source_config table and insert default sources"""
    
    logger.info("🔧 Creating weather_source_config table...")
    
    # Create the table
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS weather_source_config (
                id TEXT PRIMARY KEY,
                source_name TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                description TEXT,
                is_enabled BOOLEAN NOT NULL DEFAULT 1,
                requires_api_key BOOLEAN NOT NULL DEFAULT 0,
                api_key TEXT,
                priority INTEGER NOT NULL DEFAULT 1,
                scraper_type TEXT NOT NULL,
                base_url TEXT,
                documentation_url TEXT,
                last_success_at TIMESTAMP,
                last_error_at TIMESTAMP,
                last_error_message TEXT,
                success_count INTEGER NOT NULL DEFAULT 0,
                error_count INTEGER NOT NULL DEFAULT 0,
                total_response_time_ms BIGINT NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # Create indexes
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_weather_source_name 
            ON weather_source_config(source_name)
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_weather_source_enabled 
            ON weather_source_config(is_enabled)
        """))
        
        conn.commit()
    
    logger.info("✅ Table created successfully")
    
    # Insert default sources
    logger.info("📦 Inserting default weather sources...")
    
    # Get API keys from environment
    weatherapi_key = os.getenv("WEATHERAPI_KEY")
    meteoblue_key = os.getenv("METEOBLUE_API_KEY")
    
    default_sources = [
        {
            "id": str(uuid.uuid4()),
            "source_name": "open-meteo",
            "display_name": "Open-Meteo",
            "description": "API météo open-source gratuite, aucune clé requise. Données mondiales avec haute précision.",
            "is_enabled": 1,
            "requires_api_key": 0,
            "api_key": None,
            "priority": 10,
            "scraper_type": "api",
            "base_url": "https://api.open-meteo.com/v1/forecast",
            "documentation_url": "https://open-meteo.com/en/docs",
            "success_count": 0,
            "error_count": 0,
            "total_response_time_ms": 0,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "source_name": "weatherapi",
            "display_name": "WeatherAPI.com",
            "description": "API météo mondiale avec données détaillées. Clé API requise (plan gratuit disponible).",
            "is_enabled": 1 if weatherapi_key else 0,  # Désactivé si pas de clé
            "requires_api_key": 1,
            "api_key": weatherapi_key,
            "priority": 9,
            "scraper_type": "api",
            "base_url": "https://api.weatherapi.com/v1/forecast.json",
            "documentation_url": "https://www.weatherapi.com/docs/",
            "success_count": 0,
            "error_count": 0,
            "total_response_time_ms": 0,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "source_name": "meteo-parapente",
            "display_name": "Météo Parapente",
            "description": "Prévisions spécialisées parapente avec thermiques et conditions de vol.",
            "is_enabled": 1,
            "requires_api_key": 0,
            "api_key": None,
            "priority": 8,
            "scraper_type": "playwright",
            "base_url": "https://meteo-parapente.com",
            "documentation_url": None,
            "success_count": 0,
            "error_count": 0,
            "total_response_time_ms": 0,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "source_name": "meteociel",
            "display_name": "Météociel",
            "description": "Prévisions AROME haute résolution pour la France. Scraping de données HTML.",
            "is_enabled": 1,
            "requires_api_key": 0,
            "api_key": None,
            "priority": 7,
            "scraper_type": "playwright",
            "base_url": "https://www.meteociel.fr",
            "documentation_url": None,
            "success_count": 0,
            "error_count": 0,
            "total_response_time_ms": 0,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "source_name": "meteoblue",
            "display_name": "Meteoblue",
            "description": "Prévisions météo professionnelles avec modèles multiples. API key optionnelle.",
            "is_enabled": 1,
            "requires_api_key": 0,
            "api_key": meteoblue_key,
            "priority": 6,
            "scraper_type": "stealth",
            "base_url": "https://www.meteoblue.com",
            "documentation_url": "https://docs.meteoblue.com/",
            "success_count": 0,
            "error_count": 0,
            "total_response_time_ms": 0,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
    ]
    
    with engine.connect() as conn:
        for source in default_sources:
            # Check if source already exists
            result = conn.execute(
                text("SELECT id FROM weather_source_config WHERE source_name = :name"),
                {"name": source["source_name"]}
            )
            
            if result.fetchone() is None:
                # Insert source
                conn.execute(
                    text("""
                        INSERT INTO weather_source_config (
                            id, source_name, display_name, description,
                            is_enabled, requires_api_key, api_key, priority,
                            scraper_type, base_url, documentation_url,
                            success_count, error_count, total_response_time_ms,
                            created_at, updated_at
                        ) VALUES (
                            :id, :source_name, :display_name, :description,
                            :is_enabled, :requires_api_key, :api_key, :priority,
                            :scraper_type, :base_url, :documentation_url,
                            :success_count, :error_count, :total_response_time_ms,
                            :created_at, :updated_at
                        )
                    """),
                    source
                )
                status = "✅" if source["is_enabled"] else "⚠️ (disabled - no API key)"
                logger.info(f"  {status} Inserted: {source['display_name']}")
            else:
                logger.info(f"  ⏭️  Skipped (exists): {source['display_name']}")
        
        conn.commit()
    
    logger.info("✅ Default sources inserted successfully")
    logger.info("🎉 Migration completed!")


def downgrade():
    """Drop weather_source_config table (rollback)"""
    logger.info("⚠️  Rolling back weather_source_config table...")
    
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS weather_source_config"))
        conn.commit()
    
    logger.info("✅ Table dropped successfully")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
