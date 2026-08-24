from pathlib import Path
from unittest.mock import patch

from highlight_video import HighlightClip, clamp_clip, overlay_interval_for_clip
from highlight_video_worker import _probe_video_dimensions, select_flight_event_clips


def test_clip_maps_pano_time_to_overlay_time():
    clip = HighlightClip(start_seconds=12.5, duration_seconds=6.0, yaw_degrees=90)

    assert clip.overlay_start_seconds(2.25) == 14.75
    assert clip.overlay_end_seconds(2.25) == 20.75


def test_overlay_interval_is_clamped_to_overlay_duration():
    clip = HighlightClip(start_seconds=98, duration_seconds=8, yaw_degrees=0)

    assert overlay_interval_for_clip(clip, 3, 105) == (101, 105)


def test_overlay_interval_is_missing_when_clip_is_after_overlay():
    clip = HighlightClip(start_seconds=30, duration_seconds=5, yaw_degrees=0)

    assert overlay_interval_for_clip(clip, 10, 20) is None


def test_clamp_clip_keeps_source_bounds():
    clip = clamp_clip(-2, 12, 10)

    assert clip.start_seconds == 0
    assert clip.duration_seconds == 10


def test_event_selection_guarantees_takeoff_landing_and_thermal():
    points = [
        {"timestamp": index * 60_000, "elevation": elevation}
        for index, elevation in enumerate([500, 510, 530, 570, 590, 580])
    ]

    clips = select_flight_event_clips(
        600,
        points,
        [HighlightClip(300, 8, 0, "dynamic")],
    )

    assert {clip.category for clip in clips} >= {"takeoff", "landing", "thermal"}


def test_thermal_selection_uses_sustained_climb_not_single_altitude_spike():
    points = [
        {"timestamp": index * 10_000, "elevation": elevation}
        for index, elevation in enumerate([500, 501, 550, 502, 503, 504, 505])
    ]

    clips = select_flight_event_clips(120, points, [])

    thermal = next(clip for clip in clips if clip.category == "thermal")
    assert thermal.start_seconds > 20


def test_probe_video_dimensions_accepts_ffprobe_trailing_separator():
    result = type("Result", (), {"stdout": "6000x3000x\n"})()
    with patch("highlight_video_worker.subprocess.run", return_value=result):
        assert _probe_video_dimensions(Path("/tmp/pano.mp4")) == (6000, 3000)
