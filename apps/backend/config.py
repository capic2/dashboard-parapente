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

from env_utils import required_env

logger = logging.getLogger(__name__)


# Déterminer le répertoire racine du monorepo
BACKEND_ROOT = Path(__file__).resolve().parent


def _resolve_project_root(backend_root: Path) -> Path:
    if backend_root.parent.name == "apps":
        return backend_root.parents[1]

    return backend_root


PROJECT_ROOT = _resolve_project_root(BACKEND_ROOT)

# Charger les variables d'environnement selon le contexte
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
TESTING = os.getenv("TESTING", "false").lower() == "true"
IS_TEST_ENV = TESTING or ENVIRONMENT == "test"

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


def _default_job_queue_backend() -> str:
    return "rq" if ENVIRONMENT == "production" else "thread"


# ============================================================================
# DATABASE
# ============================================================================
DATABASE_URL = required_env("BACKEND_DATABASE_URL")

# ============================================================================
# REDIS
# ============================================================================
REDIS_HOST = os.getenv("BACKEND_REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("BACKEND_REDIS_PORT", "6379"))
USE_FAKE_REDIS = os.getenv("BACKEND_USE_FAKE_REDIS", "true").lower() == "true"

# ============================================================================
# JOB QUEUE
# ============================================================================
JOB_QUEUE_BACKEND = os.getenv(
    "BACKEND_JOB_QUEUE_BACKEND",
    _default_job_queue_backend(),
).lower()
JOB_QUEUE_NAME = os.getenv("BACKEND_JOB_QUEUE_NAME", "video_exports")
GOPRO_OVERLAY_QUEUE_NAME = os.getenv("BACKEND_GOPRO_OVERLAY_QUEUE_NAME", "gopro_overlays")
JOB_QUEUE_TIMEOUT_SECONDS = int(os.getenv("BACKEND_JOB_QUEUE_TIMEOUT_SECONDS", "21600"))

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
OPENWEATHERMAP_API_KEY = os.getenv("BACKEND_OPENWEATHERMAP_API_KEY")
SPOTAIR_BALISES_API_KEY = os.getenv("BACKEND_SPOTAIR_BALISES_API_KEY")

# ============================================================================
# SIA AZBA / RTBA
# ============================================================================
AZBA_API_BASE_URL = os.getenv(
    "BACKEND_AZBA_API_BASE_URL",
    "https://bo-prod-sofia-vac.sia-france.fr/api/",
)
AZBA_API_VERSION = os.getenv("BACKEND_AZBA_API_VERSION", "v3/")
AZBA_API_AUTH_SECRET = os.getenv("BACKEND_AZBA_API_AUTH_SECRET")
AZBA_CACHE_TTL_SECONDS = int(os.getenv("BACKEND_AZBA_CACHE_TTL_SECONDS", "900"))
AZBA_SITE_RADIUS_KM = float(os.getenv("BACKEND_AZBA_SITE_RADIUS_KM", "10"))

# ============================================================================
# STRAVA OAUTH
# ============================================================================
STRAVA_CLIENT_ID = os.getenv("BACKEND_STRAVA_CLIENT_ID")
STRAVA_CLIENT_SECRET = os.getenv("BACKEND_STRAVA_CLIENT_SECRET")
STRAVA_REFRESH_TOKEN = os.getenv("BACKEND_STRAVA_REFRESH_TOKEN")
STRAVA_ACCESS_TOKEN = os.getenv("BACKEND_STRAVA_ACCESS_TOKEN")
STRAVA_VERIFY_TOKEN = os.getenv("BACKEND_STRAVA_VERIFY_TOKEN")
STRAVA_TOKEN_LOG_HISTORY_LIMIT = max(
    1, int(os.getenv("BACKEND_STRAVA_TOKEN_LOG_HISTORY_LIMIT", "5"))
)

# ============================================================================
# AI ANALYSIS
# ============================================================================


def _csv_env(name: str, default: str) -> list[str]:
    return [value.strip() for value in os.getenv(name, default).split(",") if value.strip()]


GOOGLE_API_KEY = os.getenv("BACKEND_GOOGLE_API_KEY")
GEMINI_MODEL = os.getenv("BACKEND_GEMINI_MODEL", "gemini-2.5-flash")
GROQ_API_KEY = os.getenv("BACKEND_GROQ_API_KEY")
GROQ_MODEL = os.getenv("BACKEND_GROQ_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
OPENROUTER_API_KEY = os.getenv("BACKEND_OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("BACKEND_OPENROUTER_MODEL", "qwen/qwen2.5-vl-72b-instruct:free")
OPENROUTER_MODELS = _csv_env(
    "BACKEND_OPENROUTER_MODELS",
    OPENROUTER_MODEL
    + ",google/gemini-2.0-flash-exp:free,mistralai/mistral-small-3.2-24b-instruct:free",
)
GITHUB_MODELS_API_KEY = os.getenv("BACKEND_GITHUB_MODELS_API_KEY")
GITHUB_MODELS_BASE_URL = os.getenv(
    "BACKEND_GITHUB_MODELS_BASE_URL",
    "https://models.github.ai/inference/v1/chat/completions",
)
GITHUB_MODELS_MODELS = _csv_env("BACKEND_GITHUB_MODELS_MODELS", "openai/gpt-4o-mini")
HUGGINGFACE_API_KEY = os.getenv("BACKEND_HUGGINGFACE_API_KEY")
HUGGINGFACE_BASE_URL = os.getenv(
    "BACKEND_HUGGINGFACE_BASE_URL",
    "https://router.huggingface.co/v1/chat/completions",
)
HUGGINGFACE_MODELS = _csv_env("BACKEND_HUGGINGFACE_MODELS", "Qwen/Qwen2.5-VL-7B-Instruct")
CUSTOM_OPENAI_API_KEY = os.getenv("BACKEND_CUSTOM_OPENAI_API_KEY")
CUSTOM_OPENAI_BASE_URL = os.getenv("BACKEND_CUSTOM_OPENAI_BASE_URL")
CUSTOM_OPENAI_MODELS = _csv_env("BACKEND_CUSTOM_OPENAI_MODELS", "")
LLM_QUOTA_COOLDOWN_SECONDS = int(os.getenv("BACKEND_LLM_QUOTA_COOLDOWN_SECONDS", "3600"))
LLM_FALLBACK_ORDER = [
    provider.lower()
    for provider in _csv_env(
        "BACKEND_LLM_FALLBACK_ORDER",
        "groq,openrouter,github_models,huggingface,google,custom_openai",
    )
]

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
LOG_FILE = required_env("BACKEND_LOG_FILE")

# Monitoring
METRICS_TOKEN = os.getenv("BACKEND_METRICS_TOKEN")

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
# FLIGHT FILE STORAGE
# ============================================================================
PARAGLIDING_DATA_ROOT = (
    "/tmp/dashboard-parapente-test/parapente" if IS_TEST_ENV else "/app/parapente"
)
VIDEO_EXPORT_DIR = PARAGLIDING_DATA_ROOT
VIDEO_TEMP_IMAGES_DIR = str(Path(PARAGLIDING_DATA_ROOT) / ".tmp" / "video-frames")

# ============================================================================
# GOPRO OVERLAY EXPORT
# ============================================================================
GOPRO_OVERLAY_ROOT = "/app/gopro-overlay"
GOPRO_OVERLAY_BIN = str(Path(GOPRO_OVERLAY_ROOT) / "venv" / "bin" / "gopro-dashboard.py")
GOPRO_OVERLAY_LAYOUT_DIR = GOPRO_OVERLAY_ROOT
GOPRO_OVERLAY_PARAGLIDING_ROOT = PARAGLIDING_DATA_ROOT
GOPRO_OVERLAY_OUTPUT_DIR = PARAGLIDING_DATA_ROOT
GOPRO_OVERLAY_UPLOAD_DIR = str(Path(PARAGLIDING_DATA_ROOT) / ".tmp" / "gopro-uploads")
GOPRO_OVERLAY_FONT = os.getenv(
    "BACKEND_GOPRO_OVERLAY_FONT",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
)
GOPRO_OVERLAY_OSV_MERGE_TIMEOUT_SECONDS = int(
    os.getenv("BACKEND_GOPRO_OVERLAY_OSV_MERGE_TIMEOUT_SECONDS", "1800")
)
GOPRO_OVERLAY_PROCESS_NICE = int(os.getenv("BACKEND_GOPRO_OVERLAY_PROCESS_NICE", "19"))
GOPRO_OVERLAY_PROCESS_IONICE_CLASS = os.getenv("BACKEND_GOPRO_OVERLAY_PROCESS_IONICE_CLASS", "3")
GOPRO_OVERLAY_MAX_AUTO_LAYOUT_WIDTH = int(
    os.getenv("BACKEND_GOPRO_OVERLAY_MAX_AUTO_LAYOUT_WIDTH", "1920")
)
GOPRO_OVERLAY_MAX_AUTO_LAYOUT_HEIGHT = int(
    os.getenv("BACKEND_GOPRO_OVERLAY_MAX_AUTO_LAYOUT_HEIGHT", "1080")
)

# ============================================================================
# VALIDATION
# ============================================================================

# Valider les variables critiques (sauf en mode test)
if not IS_TEST_ENV:
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

    if ENVIRONMENT == "production" and not METRICS_TOKEN:
        logger.error("❌ BACKEND_METRICS_TOKEN is required in production")
        raise ValueError("BACKEND_METRICS_TOKEN environment variable is required in production")
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
