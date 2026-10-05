"""Helpers for unambiguous timestamps at the API boundary."""

from datetime import datetime, timezone


def to_api_utc(value: datetime | None) -> str | None:
    """Serialize a UTC instant as RFC 3339 with an explicit ``Z`` suffix."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace("+00:00", "Z")
