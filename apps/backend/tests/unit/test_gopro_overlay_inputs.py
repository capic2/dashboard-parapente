import os
from pathlib import Path

from gopro_overlay_inputs import resolve_automatic_overlay_inputs


def test_overlay_inputs_match_automatic_gopro_fallback_order(tmp_path: Path) -> None:
    zepp = tmp_path / "Zepp-flight.gpx"
    first_flight = tmp_path / "flight-old.mp4"
    latest_flight = tmp_path / "flight-latest.mp4"
    generated_video = tmp_path / "pano.mp4"
    for path in (zepp, first_flight, latest_flight, generated_video):
        path.write_bytes(b"media")
    os.utime(first_flight, ns=(1_000_000_000, 1_000_000_000))
    os.utime(latest_flight, ns=(2_000_000_000, 2_000_000_000))

    gpx_path, pip_path = resolve_automatic_overlay_inputs(
        tmp_path,
        tmp_path / "configured.gpx",
        generated_video,
    )

    assert gpx_path == zepp
    assert pip_path == latest_flight


def test_overlay_inputs_fall_back_to_configured_files(tmp_path: Path) -> None:
    configured_gpx = tmp_path / "configured.gpx"
    generated_video = tmp_path / "pano.mp4"
    configured_gpx.write_bytes(b"gpx")
    generated_video.write_bytes(b"video")

    gpx_path, pip_path = resolve_automatic_overlay_inputs(
        tmp_path,
        configured_gpx,
        generated_video,
    )

    assert gpx_path == configured_gpx
    assert pip_path == generated_video


def test_overlay_inputs_skip_the_previous_overlay_output(tmp_path: Path) -> None:
    base_video = tmp_path / "flight-base.mp4"
    previous_overlay = tmp_path / "flight-overlay.mp4"
    base_video.write_bytes(b"base")
    previous_overlay.write_bytes(b"overlay")
    os.utime(base_video, ns=(1_000_000_000, 1_000_000_000))
    os.utime(previous_overlay, ns=(2_000_000_000, 2_000_000_000))

    _gpx_path, pip_path = resolve_automatic_overlay_inputs(
        tmp_path,
        None,
        base_video,
        previous_overlay,
    )

    assert pip_path == base_video


def test_overlay_inputs_ignore_flight_export_from_another_date(tmp_path: Path) -> None:
    flight_dir = tmp_path / "20260822" / "01"
    flight_dir.mkdir(parents=True)
    wrong_flight = flight_dir / "flight-20260824-071510.mp4"
    source_video = flight_dir / "pano.mp4"
    wrong_flight.write_bytes(b"wrong")
    source_video.write_bytes(b"source")

    _gpx_path, pip_path = resolve_automatic_overlay_inputs(
        flight_dir,
        None,
        source_video,
    )

    assert pip_path is None
