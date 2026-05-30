"""
Application settings service with in-memory cache.

Provides get/set/reload for the app_settings table.
Settings are cached in memory to avoid DB queries on every call (e.g., cache TTL lookups).
"""

import logging
from datetime import datetime

from sqlalchemy.orm import Session

from models import AppSetting

logger = logging.getLogger(__name__)

# In-memory cache
_settings_cache: dict[str, str] = {}
_cache_loaded = False

# Default values (used as fallback if DB has no entry)
DEFAULTS: dict[str, str] = {
    "cache_ttl_default": "3600",
    "cache_ttl_summary": "3600",
    "spotair_live_wind_radius_km": "10",
    "spotair_live_wind_cache_ttl_seconds": "300",
    "scheduler_interval_minutes": "30",
    "emagram_max_age_minutes": "180",
    "redis_connect_timeout": "5",
    "redis_socket_timeout": "5",
    "para_wind_very_low_max": "3",
    "para_wind_low_max": "5",
    "para_wind_weak_max": "8",
    "para_wind_optimal_max": "15",
    "para_wind_high_max": "20",
    "para_gust_low_max": "15",
    "para_gust_moderate_max": "20",
    "para_gust_high_max": "25",
    "para_precip_none_max": "0",
    "para_precip_light_max": "1",
    "para_precip_heavy_min": "2",
    "para_slot_precipitation_max": "0.5",
    "para_li_stable_min": "-1",
    "para_li_slightly_unstable_min": "-3",
    "para_li_very_unstable_max": "-5",
    "para_temp_cool_min": "5",
    "para_temp_warm_min": "10",
    "para_verdict_good_min": "65",
    "para_verdict_medium_min": "45",
    "para_verdict_limit_min": "30",
    "ui_reason_wind_very_strong_min": "35",
    "ui_reason_gust_high_min": "45",
    "ui_reason_cloud_very_cloudy_min": "80",
    "ui_reason_wind_moderate_min": "25",
    "default_flight_objective": "tranquille",
}

# Keys that must never be exposed via the public settings API
_SENSITIVE_KEYS = {"strava_refresh_token"}
_RETIRED_KEYS = {"video_export_dir", "video_temp_images_dir"}


def _mask_value_for_logs(setting_key: str, setting_value: str) -> str:
    return "***REDACTED***" if setting_key in _SENSITIVE_KEYS else setting_value


def reload_cache(db: Session) -> None:
    """Reload all settings from DB into memory cache."""
    global _settings_cache, _cache_loaded
    rows = db.query(AppSetting).all()
    _settings_cache = {row.key: row.value for row in rows}
    _cache_loaded = True
    logger.info(f"✅ Settings cache loaded: {len(_settings_cache)} entries")


def get_setting(key: str, db: Session | None = None, default: str | None = None) -> str:
    """
    Read a setting value.

    Priority: memory cache → DB (if db provided) → DEFAULTS → default param.
    """
    if key in _RETIRED_KEYS:
        return default if default is not None else ""

    # Try memory cache first
    if key in _settings_cache:
        return _settings_cache[key]

    # Try DB if session provided and cache not loaded
    if db is not None and not _cache_loaded:
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if row:
            _settings_cache[key] = row.value
            return row.value

    # Fallback to defaults
    if key in DEFAULTS:
        return DEFAULTS[key]
    return default if default is not None else ""


def get_setting_int(key: str, db: Session | None = None, default: int = 0) -> int:
    """Read a setting as integer."""
    value = get_setting(key, db=db, default=str(default))
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def get_setting_float(key: str, db: Session | None = None, default: float = 0.0) -> float:
    """Read a setting as float."""
    value = get_setting(key, db=db, default=str(default))
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def set_setting(db: Session, key: str, value: str) -> None:
    """Write a setting to DB and update memory cache."""
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value = value
        row.updated_at = datetime.utcnow()
    else:
        row = AppSetting(key=key, value=value, updated_at=datetime.utcnow())
        db.add(row)
    db.commit()
    _settings_cache[key] = value
    logger.info(f"Setting updated: {key} = {_mask_value_for_logs(key, value)}")


def get_all_settings(db: Session) -> dict[str, str]:
    """Read all settings as a dict (sensitive keys excluded)."""
    if not _cache_loaded:
        reload_cache(db)
    return {
        **DEFAULTS,
        **{
            k: v
            for k, v in _settings_cache.items()
            if k not in _SENSITIVE_KEYS and k not in _RETIRED_KEYS
        },
    }


def invalidate_cache() -> None:
    """Clear the in-memory cache (forces next read to hit DB)."""
    global _settings_cache, _cache_loaded
    _settings_cache = {}
    _cache_loaded = False
