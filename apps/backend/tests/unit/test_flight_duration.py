from flight_duration import calculate_real_flight_duration_minutes


def test_calculates_duration_from_takeoff_and_landing_on_the_same_video() -> None:
    markers = [
        {"youtube_video_id": "dQw4w9WgXcQ", "kind": "takeoff", "timestamp_seconds": 120},
        {"youtube_video_id": "dQw4w9WgXcQ", "kind": "interest", "timestamp_seconds": 240},
        {"youtube_video_id": "dQw4w9WgXcQ", "kind": "landing", "timestamp_seconds": 7320},
    ]

    assert calculate_real_flight_duration_minutes(markers) == 120


def test_ignores_takeoff_and_landing_markers_from_different_videos() -> None:
    markers = [
        {"youtube_video_id": "dQw4w9WgXcQ", "kind": "takeoff", "timestamp_seconds": 120},
        {"youtube_video_id": "9bZkp7q19f0", "kind": "landing", "timestamp_seconds": 7320},
    ]

    assert calculate_real_flight_duration_minutes(markers) is None


def test_rounds_half_minutes_up_consistently_with_migration() -> None:
    markers = [
        {"youtube_video_id": "dQw4w9WgXcQ", "kind": "takeoff", "timestamp_seconds": 0},
        {"youtube_video_id": "dQw4w9WgXcQ", "kind": "landing", "timestamp_seconds": 150},
    ]

    assert calculate_real_flight_duration_minutes(markers) == 3
