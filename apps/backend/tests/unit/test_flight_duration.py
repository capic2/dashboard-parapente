from flight_duration import calculate_real_flight_duration_minutes


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
