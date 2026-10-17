from flight_duration import (
    calculate_real_flight_duration_minutes,
    effective_flight_duration_minutes,
)


def test_calculates_duration_from_flight_markers() -> None:
    markers = [
        {"kind": "takeoff", "timestamp_seconds": 120},
        {"kind": "interest", "timestamp_seconds": 240},
        {"kind": "landing", "timestamp_seconds": 7320},
    ]

    assert calculate_real_flight_duration_minutes(markers) == 120


def test_calculates_duration_from_markers_that_were_on_different_videos() -> None:
    markers = [
        {"youtube_video_id": "dQw4w9WgXcQ", "kind": "takeoff", "timestamp_seconds": 120},
        {"youtube_video_id": "9bZkp7q19f0", "kind": "landing", "timestamp_seconds": 7320},
    ]

    assert calculate_real_flight_duration_minutes(markers) == 120


def test_rounds_half_minutes_up_consistently_with_migration() -> None:
    markers = [
        {"kind": "takeoff", "timestamp_seconds": 0},
        {"kind": "landing", "timestamp_seconds": 150},
    ]

    assert calculate_real_flight_duration_minutes(markers) == 3


def test_effective_duration_prefers_current_takeoff_and_landing_markers() -> None:
    markers = [
        {"kind": "takeoff", "timestamp_seconds": 193},
        {"kind": "landing", "timestamp_seconds": 697},
    ]

    assert effective_flight_duration_minutes(markers, 12, 12) == 8


def test_effective_duration_falls_back_to_real_then_recorded_duration() -> None:
    assert effective_flight_duration_minutes([], 9, 12) == 9
    assert effective_flight_duration_minutes([], None, 12) == 12
    assert effective_flight_duration_minutes([], None, None) is None
