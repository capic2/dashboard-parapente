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
    "scheduler_interval_minutes": "30",
    "redis_connect_timeout": "5",
    "redis_socket_timeout": "5",
}


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
    if default is not None:
        return default
    return DEFAULTS.get(key, "")


def get_setting_int(key: str, db: Session | None = None, default: int = 0) -> int:
    """Read a setting as integer."""
    value = get_setting(key, db=db, default=str(default))
    try:
        return int(value)
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
    logger.info(f"Setting updated: {key} = {value}")


def get_all_settings(db: Session) -> dict[str, str]:
    """Read all settings as a dict."""
    if not _cache_loaded:
        reload_cache(db)
    return dict(_settings_cache)


def invalidate_cache() -> None:
    """Clear the in-memory cache (forces next read to hit DB)."""
    global _settings_cache, _cache_loaded
    _settings_cache = {}
    _cache_loaded = False
