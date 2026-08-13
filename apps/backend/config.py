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


def _configured_storage_dir(
    env_name: str,
    default: str,
    *,
    forbidden_roots: tuple[Path, ...] = (),
) -> str:
    raw_value = os.getenv(env_name)
    value = raw_value.strip() if raw_value and raw_value.strip() else default
    path = Path(value)
    if not path.is_absolute():
        raise ValueError(f"{env_name} must be an absolute path")

    resolved_path = path.resolve(strict=False)
    if resolved_path in {root.resolve(strict=False) for root in forbidden_roots}:
        raise ValueError(f"{env_name} points to an unsafe shared root: {resolved_path}")
    return str(path)


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


def _csv_env(name: str, default: str) -> list[str]:
    return [value.strip() for value in os.getenv(name, default).split(",") if value.strip()]


def _int_env_at_least(name: str, default: int, minimum: int) -> int:
    return max(minimum, int(os.getenv(name, str(default))))


def _intervals_sync_enabled(api_key: str | None) -> bool:
    requested = os.getenv("BACKEND_INTERVALS_ICU_SYNC_ENABLED", "false").lower() == "true"
    if requested and not api_key:
        logger.warning(
            "BACKEND_INTERVALS_ICU_SYNC_ENABLED ignored because "
            "BACKEND_INTERVALS_ICU_API_KEY is missing"
        )
    return requested and bool(api_key)


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
GOPRO_PREVIEW_QUEUE_NAME = os.getenv("BACKEND_GOPRO_PREVIEW_QUEUE_NAME", "gopro_previews")
JOB_QUEUE_TIMEOUT_SECONDS = int(os.getenv("BACKEND_JOB_QUEUE_TIMEOUT_SECONDS", "21600"))

# Deployment drain coordination
DEPLOY_DRAIN_TOKEN = os.getenv("BACKEND_DEPLOY_DRAIN_TOKEN")
DEPLOY_DRAIN_LEASE_SECONDS = _int_env_at_least("BACKEND_DEPLOY_DRAIN_LEASE_SECONDS", 4500, 1)

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
# INTERVALS.ICU
# ============================================================================
INTERVALS_ICU_API_KEY = os.getenv("BACKEND_INTERVALS_ICU_API_KEY")
INTERVALS_ICU_BASE_URL = os.getenv(
    "BACKEND_INTERVALS_ICU_BASE_URL", "https://intervals.icu/api/v1"
).rstrip("/")
INTERVALS_ICU_ACTIVITY_TYPES = _csv_env("BACKEND_INTERVALS_ICU_ACTIVITY_TYPES", "")

# ============================================================================
# AI ANALYSIS
# ============================================================================


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
CODEX_MODEL = os.getenv("BACKEND_CODEX_MODEL") or None
CODEX_TIMEOUT_SECONDS = _int_env_at_least("BACKEND_CODEX_TIMEOUT_SECONDS", 180, 1)
LLM_QUOTA_COOLDOWN_SECONDS = int(os.getenv("BACKEND_LLM_QUOTA_COOLDOWN_SECONDS", "3600"))
EMAGRAM_FAILURE_RETRY_MINUTES = _int_env_at_least("BACKEND_EMAGRAM_FAILURE_RETRY_MINUTES", 360, 0)
LLM_FALLBACK_ORDER = [
    provider.lower()
    for provider in _csv_env(
        "BACKEND_LLM_FALLBACK_ORDER",
        "groq,openrouter,github_models,huggingface,google,custom_openai,codex",
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
VIDEO_LEGACY_TEMP_IMAGES_DIR = str(Path(PARAGLIDING_DATA_ROOT) / ".tmp" / "video-frames")
VIDEO_TEMP_IMAGES_DIR = _configured_storage_dir(
    "BACKEND_VIDEO_TEMP_IMAGES_DIR",
    VIDEO_LEGACY_TEMP_IMAGES_DIR,
    forbidden_roots=(
        Path("/"),
        Path("/tmp"),
        Path("/var/tmp"),
        Path("/app"),
        Path("/app/db"),
        Path("/app/video-exports"),
        Path("/app/emagram-cache"),
        Path("/app/gopro-overlay"),
        Path("/app/codex-home"),
        Path(PARAGLIDING_DATA_ROOT),
    ),
)
VIDEO_ACCELERATOR = os.getenv("BACKEND_VIDEO_ACCELERATOR", "cpu").strip().lower()
if VIDEO_ACCELERATOR not in {"cpu", "nvidia"}:
    logger.warning("Unknown BACKEND_VIDEO_ACCELERATOR=%s; using cpu", VIDEO_ACCELERATOR)
    VIDEO_ACCELERATOR = "cpu"

# ============================================================================
# GOPRO OVERLAY EXPORT
# ============================================================================
GOPRO_OVERLAY_ROOT = "/app/gopro-overlay"
GOPRO_OVERLAY_BIN = str(Path(GOPRO_OVERLAY_ROOT) / "venv" / "bin" / "gopro-dashboard.py")
GOPRO_OVERLAY_LAYOUT_DIR = GOPRO_OVERLAY_ROOT
GOPRO_OVERLAY_PARAGLIDING_ROOT = PARAGLIDING_DATA_ROOT
GOPRO_OVERLAY_OUTPUT_DIR = PARAGLIDING_DATA_ROOT
GOPRO_OVERLAY_UPLOAD_DIR = str(Path(PARAGLIDING_DATA_ROOT) / ".tmp" / "gopro-uploads")
GOPRO_OVERLAY_RENDER_DEVICE = os.getenv(
    "BACKEND_GOPRO_OVERLAY_RENDER_DEVICE", "/dev/dri/renderD128"
)
GOPRO_OVERLAY_CONFIG_DIR = os.getenv("BACKEND_GOPRO_OVERLAY_CONFIG_DIR")
GOPRO_OVERLAY_PROFILE = os.getenv("BACKEND_GOPRO_OVERLAY_PROFILE")
GOPRO_OVERLAY_EXTRA_ARGS = os.getenv("BACKEND_GOPRO_OVERLAY_EXTRA_ARGS")
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

# Short browser-friendly camera preview used to synchronize the GoPro overlay.
GOPRO_PREVIEW_ENABLED = os.getenv("BACKEND_GOPRO_PREVIEW_ENABLED", "true").lower() == "true"
GOPRO_PREVIEW_DEFAULT_SECONDS = _int_env_at_least("BACKEND_GOPRO_PREVIEW_DEFAULT_SECONDS", 180, 180)
GOPRO_PREVIEW_MAX_SECONDS = _int_env_at_least(
    "BACKEND_GOPRO_PREVIEW_MAX_SECONDS", 900, GOPRO_PREVIEW_DEFAULT_SECONDS
)
GOPRO_PREVIEW_MAX_WIDTH = _int_env_at_least("BACKEND_GOPRO_PREVIEW_MAX_WIDTH", 854, 2)
GOPRO_PREVIEW_MAX_HEIGHT = _int_env_at_least("BACKEND_GOPRO_PREVIEW_MAX_HEIGHT", 480, 2)
GOPRO_PREVIEW_QUALITY = _int_env_at_least("BACKEND_GOPRO_PREVIEW_QUALITY", 28, 0)
GOPRO_PREVIEW_SCAN_INTERVAL_SECONDS = _int_env_at_least(
    "BACKEND_GOPRO_PREVIEW_SCAN_INTERVAL_SECONDS", 30, 1
)
GOPRO_PREVIEW_STABLE_SECONDS = _int_env_at_least("BACKEND_GOPRO_PREVIEW_STABLE_SECONDS", 30, 1)
GOPRO_PREVIEW_TIMEOUT_SECONDS = _int_env_at_least("BACKEND_GOPRO_PREVIEW_TIMEOUT_SECONDS", 1800, 1)

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

    if ENVIRONMENT == "production" and not METRICS_TOKEN:
        logger.error("❌ BACKEND_METRICS_TOKEN is required in production")
        raise ValueError("BACKEND_METRICS_TOKEN environment variable is required in production")
else:
    logger.info("🧪 Testing mode: API key validation skipped")
    # In test mode, provide defaults to avoid breaking tests
    if not JWT_SECRET:
        JWT_SECRET = "test-secret-not-for-production"
# Log configuration summary
logger.info(f"🔧 Environment: {ENVIRONMENT}")
logger.info(f"🗄️ Database: {DATABASE_URL}")
logger.info(f"🔴 Redis: {REDIS_HOST}:{REDIS_PORT} (fake: {USE_FAKE_REDIS})")
logger.info(
    f"📅 Scheduler: {'enabled' if SCHEDULER_ENABLED else 'disabled'} ({SCHEDULER_INTERVAL_MINUTES} min)"
)
