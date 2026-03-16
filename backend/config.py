"""
Configuration centralisée pour l'application Dashboard Parapente

Charge les variables d'environnement avec la logique suivante :
1. En production (ENVIRONMENT=production) : Utilise les env vars Docker
2. En développement : Charge .env.development (si existe) ou .env (racine)
3. Valide les variables critiques
"""

import os
from pathlib import Path
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)

# Déterminer le répertoire racine du projet
PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_ROOT = Path(__file__).parent

# Charger les variables d'environnement selon le contexte
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
TESTING = os.getenv("TESTING", "false").lower() == "true"

if ENVIRONMENT != "production":
    # En développement : chercher .env.development puis .env
    env_files = [
        BACKEND_ROOT / ".env.development",  # Dev local (priorité)
        PROJECT_ROOT / ".env",               # Racine (fallback)
    ]
    
    for env_file in env_files:
        if env_file.exists():
            logger.info(f"📄 Loading environment from: {env_file}")
            load_dotenv(env_file, override=False)
            break
    else:
        logger.warning("⚠️ No .env file found, using system environment variables")
else:
    logger.info("🐳 Production mode: using Docker environment variables")

# ============================================================================
# DATABASE
# ============================================================================
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./db/dashboard.db")

# ============================================================================
# REDIS
# ============================================================================
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
USE_FAKE_REDIS = os.getenv("USE_FAKE_REDIS", "true").lower() == "true"

# ============================================================================
# WEATHER API KEYS
# ============================================================================
WEATHERAPI_KEY = os.getenv("WEATHERAPI_KEY")
METEOBLUE_API_KEY = os.getenv("METEOBLUE_API_KEY")

# ============================================================================
# STRAVA OAUTH
# ============================================================================
STRAVA_CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
STRAVA_CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
STRAVA_REFRESH_TOKEN = os.getenv("STRAVA_REFRESH_TOKEN")
STRAVA_ACCESS_TOKEN = os.getenv("STRAVA_ACCESS_TOKEN")

# ============================================================================
# SCHEDULER
# ============================================================================
SCHEDULER_ENABLED = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
SCHEDULER_INTERVAL_MINUTES = int(os.getenv("SCHEDULER_INTERVAL_MINUTES", "30"))

# ============================================================================
# LOGGING
# ============================================================================
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = os.getenv("LOG_FILE", "logs/dashboard.log")

# ============================================================================
# API
# ============================================================================
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
API_DEBUG = os.getenv("API_DEBUG", "false").lower() == "true"

# ============================================================================
# TELEGRAM (Optional)
# ============================================================================
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

# ============================================================================
# VALIDATION
# ============================================================================

# Valider les variables critiques (sauf en mode test)
if not TESTING:
    if not WEATHERAPI_KEY:
        logger.error("❌ WEATHERAPI_KEY is required")
        raise ValueError("WEATHERAPI_KEY environment variable is required")
    
    if not METEOBLUE_API_KEY:
        logger.warning("⚠️ METEOBLUE_API_KEY is missing")
else:
    logger.info("🧪 Testing mode: API key validation skipped")

# Log Strava credentials status
if STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET and STRAVA_REFRESH_TOKEN:
    logger.info(f"✅ Strava credentials loaded (Client ID: {STRAVA_CLIENT_ID})")
else:
    logger.warning(
        f"⚠️ Strava credentials incomplete: "
        f"CLIENT_ID={bool(STRAVA_CLIENT_ID)}, "
        f"CLIENT_SECRET={bool(STRAVA_CLIENT_SECRET)}, "
        f"REFRESH_TOKEN={bool(STRAVA_REFRESH_TOKEN)}"
    )

# Log configuration summary
logger.info(f"🔧 Environment: {ENVIRONMENT}")
logger.info(f"🗄️ Database: {DATABASE_URL}")
logger.info(f"🔴 Redis: {REDIS_HOST}:{REDIS_PORT} (fake: {USE_FAKE_REDIS})")
logger.info(f"📅 Scheduler: {'enabled' if SCHEDULER_ENABLED else 'disabled'} ({SCHEDULER_INTERVAL_MINUTES} min)")
