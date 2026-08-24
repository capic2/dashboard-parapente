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
