from datetime import date, datetime

from flight_naming import format_automatic_flight_name


def test_format_automatic_flight_name_with_date_only() -> None:
    assert format_automatic_flight_name(date(2026, 7, 8)) == "Vol du 08/07/2026"


def test_format_automatic_flight_name_with_departure_time() -> None:
    assert (
        format_automatic_flight_name(date(2026, 7, 8), datetime(2026, 7, 8, 9, 5))
        == "Vol du 08/07/2026 à 09:05"
    )
