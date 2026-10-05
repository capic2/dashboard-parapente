from datetime import datetime, timezone

from datetime_utils import to_api_utc


def test_to_api_utc_marks_legacy_naive_database_values_as_utc() -> None:
    assert to_api_utc(datetime(2026, 8, 30, 10, 0)) == "2026-08-30T10:00:00Z"


def test_to_api_utc_converts_offset_aware_values() -> None:
    value = datetime(2026, 8, 30, 12, 0, tzinfo=timezone.utc)
    assert to_api_utc(value) == "2026-08-30T12:00:00Z"
