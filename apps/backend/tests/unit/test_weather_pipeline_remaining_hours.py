from datetime import datetime
from zoneinfo import ZoneInfo

from weather_pipeline import filter_remaining_hours, get_forecast_target_date

PARIS_TZ = ZoneInfo("Europe/Paris")


def test_forecast_date_uses_paris_day_when_server_time_is_utc() -> None:
    utc_time = datetime(2026, 9, 19, 23, 30, tzinfo=ZoneInfo("UTC"))

    assert get_forecast_target_date(0, now=utc_time) == "2026-09-20"
    assert get_forecast_target_date(1, now=utc_time) == "2026-09-21"


def test_today_keeps_current_and_future_hours() -> None:
    hours = [{"hour": hour} for hour in range(8, 20)]

    result = filter_remaining_hours(
        hours, day_index=0, now=datetime(2026, 6, 15, 14, 30, tzinfo=PARIS_TZ)
    )

    assert [hour["hour"] for hour in result] == [14, 15, 16, 17, 18, 19]


def test_future_days_are_not_filtered_by_current_time() -> None:
    hours = [{"hour": hour} for hour in range(8, 12)]

    assert (
        filter_remaining_hours(hours, day_index=1, now=datetime(2026, 6, 15, 14, tzinfo=PARIS_TZ))
        == hours
    )


def test_today_has_no_remaining_hours_after_forecast() -> None:
    hours = [{"hour": hour} for hour in range(8, 12)]

    assert (
        filter_remaining_hours(hours, day_index=0, now=datetime(2026, 6, 15, 14, tzinfo=PARIS_TZ))
        == []
    )
