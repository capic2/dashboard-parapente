"""Helpers for configurable emagram freshness windows."""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app_settings import get_setting_int


def get_emagram_max_age_minutes(db: Session | None = None) -> int:
    """Return max allowed age for emagram analyses in minutes."""
    max_age_minutes = get_setting_int("emagram_max_age_minutes", db=db, default=180)
    return max_age_minutes if max_age_minutes > 0 else 180


def get_emagram_cutoff_utc(db: Session | None = None) -> datetime:
    """Return UTC cutoff datetime used to consider an emagram as fresh."""
    return datetime.utcnow() - timedelta(minutes=get_emagram_max_age_minutes(db=db))


def get_emagram_next_update_utc(analysis_datetime: datetime, db: Session | None = None) -> datetime:
    """Return next expected update datetime based on configured freshness."""
    base_datetime = analysis_datetime.replace(tzinfo=None)
    return base_datetime + timedelta(minutes=get_emagram_max_age_minutes(db=db))
