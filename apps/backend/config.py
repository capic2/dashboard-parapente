"""
Configuration centralisée pour l'application Dashboard Parapente

Charge les variables d'environnement avec la logique suivante :
1. En production (ENVIRONMENT=production) : Utilise les env vars Docker
2. En développement : Charge .env.development (si existe) ou .env (racine)
3. Valide les variables critiques
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

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
        PROJECT_ROOT / ".env",  # Racine (fallback)
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
DATABASE_URL = os.getenv("BACKEND_DATABASE_URL", "sqlite:///./db/dashboard.db")

# ============================================================================
# REDIS
# ============================================================================
REDIS_HOST = os.getenv("BACKEND_REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("BACKEND_REDIS_PORT", "6379"))
USE_FAKE_REDIS = os.getenv("BACKEND_USE_FAKE_REDIS", "true").lower() == "true"

# ============================================================================
# API
# ============================================================================
API_HOST = os.getenv("BACKEND_API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("BACKEND_API_PORT", "8001"))
API_DEBUG = os.getenv("BACKEND_API_DEBUG", "false").lower() == "true"

# ============================================================================
# WEATHER API KEYS
# ============================================================================
WEATHERAPI_KEY = os.getenv("BACKEND_WEATHERAPI_KEY")
METEOBLUE_API_KEY = os.getenv("BACKEND_METEOBLUE_API_KEY")

# ============================================================================
# STRAVA OAUTH
# ============================================================================
STRAVA_CLIENT_ID = os.getenv("BACKEND_STRAVA_CLIENT_ID")
STRAVA_CLIENT_SECRET = os.getenv("BACKEND_STRAVA_CLIENT_SECRET")
STRAVA_REFRESH_TOKEN = os.getenv("BACKEND_STRAVA_REFRESH_TOKEN")
STRAVA_ACCESS_TOKEN = os.getenv("BACKEND_STRAVA_ACCESS_TOKEN")
STRAVA_VERIFY_TOKEN = os.getenv("BACKEND_STRAVA_VERIFY_TOKEN")

# ============================================================================
# AI ANALYSIS
# ============================================================================
GOOGLE_API_KEY = os.getenv("BACKEND_GOOGLE_API_KEY")
GEMINI_MODEL = os.getenv("BACKEND_GEMINI_MODEL", "gemini-2.5-flash")
ANTHROPIC_API_KEY = os.getenv("BACKEND_ANTHROPIC_API_KEY")
GROQ_API_KEY = os.getenv("BACKEND_GROQ_API_KEY")

# ============================================================================
# SCHEDULER
# ============================================================================
SCHEDULER_ENABLED = os.getenv("BACKEND_SCHEDULER_ENABLED", "true").lower() == "true"
SCHEDULER_INTERVAL_MINUTES = int(os.getenv("BACKEND_SCHEDULER_INTERVAL_MINUTES", "30"))

# ============================================================================
# CACHE (default values, can be overridden from UI via app_settings table)
# ============================================================================
CACHE_TTL_DEFAULT = int(os.getenv("BACKEND_CACHE_TTL_DEFAULT", "3600"))
CACHE_TTL_SUMMARY = int(os.getenv("BACKEND_CACHE_TTL_SUMMARY", "3600"))

# ============================================================================
# AUTHENTICATION
# ============================================================================
JWT_SECRET = os.getenv("BACKEND_JWT_SECRET")
JWT_EXPIRE_HOURS = int(os.getenv("BACKEND_JWT_EXPIRE_HOURS", "168"))  # 7 days
ADMIN_EMAIL = os.getenv("BACKEND_ADMIN_EMAIL")
ADMIN_PASSWORD = os.getenv("BACKEND_ADMIN_PASSWORD")

# ============================================================================
# LOGGING
# ============================================================================
LOG_LEVEL = os.getenv("BACKEND_LOG_LEVEL", "INFO")
LOG_FILE = os.getenv("BACKEND_LOG_FILE", "logs/dashboard.log")

# ============================================================================
# TELEGRAM (Optional)
# ============================================================================
TELEGRAM_BOT_TOKEN = os.getenv("BACKEND_TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("BACKEND_TELEGRAM_CHAT_ID")

# ============================================================================
# FRONTEND URL (Optional)
# ============================================================================
FRONTEND_URL = os.getenv("BACKEND_FRONTEND_URL")

# ============================================================================
# VALIDATION
# ============================================================================

# Valider les variables critiques (sauf en mode test)
if not TESTING:
    if not JWT_SECRET:
        logger.error("❌ BACKEND_JWT_SECRET is required")
        raise ValueError("BACKEND_JWT_SECRET environment variable is required")

    if not WEATHERAPI_KEY:
        logger.error("❌ WEATHERAPI_KEY is required")
        raise ValueError("WEATHERAPI_KEY environment variable is required")

    if not METEOBLUE_API_KEY:
        logger.warning("⚠️ METEOBLUE_API_KEY is missing")

    if not STRAVA_VERIFY_TOKEN:
        logger.error("❌ STRAVA_VERIFY_TOKEN is required")
        raise ValueError("BACKEND_STRAVA_VERIFY_TOKEN environment variable is required")
else:
    logger.info("🧪 Testing mode: API key validation skipped")
    # In test mode, provide defaults to avoid breaking tests
    if not JWT_SECRET:
        JWT_SECRET = "test-secret-not-for-production"
    if not STRAVA_VERIFY_TOKEN:
        STRAVA_VERIFY_TOKEN = "PARAPENTE_2025"

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
logger.info(
    f"📅 Scheduler: {'enabled' if SCHEDULER_ENABLED else 'disabled'} ({SCHEDULER_INTERVAL_MINUTES} min)"
)
