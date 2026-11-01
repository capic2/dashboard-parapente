"""Tests for smooth PiP composition in telemetry layout exports."""

import math
from pathlib import Path

import pytest

import youtube_telemetry_layout_export as telemetry_layout_export


def _pip_export(offset_seconds: object) -> dict[str, object]:
    return {
        "slot_id": "pip-camera",
        "source": "camera",
        "youtube_url": "https://www.youtube.com/watch?v=pip",
        "offset_seconds": offset_seconds,
    }


def _raw_pip_layout(**overrides: object) -> dict[str, object]:
    return {
        "slot_id": "pip-camera",
        "x": 960,
        "y": 540,
        "width": 480,
        "height": 270,
        **overrides,
    }


def test_parse_ffmpeg_stats_extracts_frame_rate_time_and_speed() -> None:
    stats = telemetry_layout_export._parse_ffmpeg_stats(
        "frame= 824 fps=5.1 q=26.0 size=102656KiB time=00:00:13.70 "
        "bitrate=61383.8kbits/s speed=0.0847x"
    )

    assert stats == (824, 5.1, 13.7, 0.0847)


def test_report_composition_output_skips_lines_without_ffmpeg_stats() -> None:
    progress_events: list[tuple[str, int | None]] = []
    composition_events: list[tuple[int, int, int | None, float, float | None]] = []

    telemetry_layout_export._report_composition_output(
        "Fusion du layout et de la vidéo YouTube",
        progress=lambda message, percent: progress_events.append((message, percent)),
        composition_progress=lambda *metrics: composition_events.append(metrics),
        total_frames=1000,
        duration=20,
    )

    assert progress_events == [("Fusion du layout et de la vidéo YouTube", None)]
    assert composition_events == []


def test_report_composition_output_omits_eta_when_ffmpeg_speed_is_zero() -> None:
    progress_events: list[tuple[str, int | None]] = []
    composition_events: list[tuple[int, int, int | None, float, float | None]] = []

    telemetry_layout_export._report_composition_output(
        "frame= 824 fps=5.1 q=26.0 time=00:00:13.70 speed=0.0x",
        progress=lambda message, percent: progress_events.append((message, percent)),
        composition_progress=lambda *metrics: composition_events.append(metrics),
        total_frames=1000,
        duration=20,
    )

    assert len(progress_events) == 1
    assert composition_events == [(824, 1000, None, 0.824, 5.1)]


@pytest.mark.parametrize(
    ("raw_layouts", "pip_exports"),
    [
        (None, [_pip_export(0)]),
        ([], [_pip_export(0)]),
        ([None], [_pip_export(0)]),
        ([{"slot_id": "different", "x": 1, "y": 1, "width": 1, "height": 1}], [_pip_export(0)]),
        ([_raw_pip_layout(x="invalid")], [_pip_export(0)]),
        ([_raw_pip_layout(x=math.nan)], [_pip_export(0)]),
        ([_raw_pip_layout(width=0)], [_pip_export(0)]),
        ([_raw_pip_layout(height=-1)], [_pip_export(0)]),
        ([{"slot_id": "pip-camera", "y": 1, "width": 1, "height": 1}], [_pip_export(0)]),
        ([_raw_pip_layout()], [_pip_export(math.inf)]),
    ],
)
def test_normalize_pip_layouts_rejects_invalid_layouts(
    raw_layouts: object, pip_exports: list[dict[str, object]]
) -> None:
    with pytest.raises(telemetry_layout_export.YoutubeExportError):
        telemetry_layout_export._normalize_pip_layouts(raw_layouts, pip_exports)


def test_normalize_pip_layouts_uses_saved_offset_and_validates_dimensions() -> None:
    normalized = telemetry_layout_export._normalize_pip_layouts(
        [_raw_pip_layout()], [_pip_export(-1.25)]
    )

    assert normalized == [
        {
            "slot_id": "pip-camera",
            "x": 960.0,
            "y": 540.0,
            "width": 480.0,
            "height": 270.0,
            "offset_seconds": -1.25,
        }
    ]


@pytest.mark.parametrize(
    ("offset_seconds", "trim_start", "start_pad"),
    [("2.5", "0.000000", "2.500000"), ("-1.5", "1.500000", "0.000000")],
)
def test_build_ffmpeg_composition_scales_and_formats_pip_offset(
    offset_seconds: str, trim_start: str, start_pad: str
) -> None:
    pip_layouts = telemetry_layout_export._normalize_pip_layouts(
        [_raw_pip_layout()], [_pip_export(offset_seconds)]
    )

    ffmpeg_inputs, filter_graph = telemetry_layout_export._build_ffmpeg_composition(
        source=Path("main.mp4"),
        frames_manifest=Path("frames.ffconcat"),
        pip_video_paths=[Path("pip.mp4")],
        pip_layouts=pip_layouts,
        pip_durations=[20.0],
        video_width=3840,
        video_height=2160,
        fps=30,
    )

    assert ffmpeg_inputs == [
        "-i",
        "main.mp4",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "frames.ffconcat",
        "-i",
        "pip.mp4",
    ]
    assert f"trim=start={trim_start},setpts=PTS-STARTPTS" in filter_graph
    assert f"start_duration={start_pad}" in filter_graph
    assert "scale=w=960:h=540:force_original_aspect_ratio=increase" in filter_graph
    assert "overlay=x=1920:y=1080:eof_action=repeat:shortest=0" in filter_graph


@pytest.mark.parametrize(
    ("offset_seconds", "trim_start", "start_pad"),
    [(2.5, "0.000000", "2.500000"), (-1.5, "1.500000", "0.000000")],
)
@pytest.mark.parametrize("accelerator", ["cpu", "nvidia"])
def test_export_composes_smooth_pip_at_source_resolution(
    offset_seconds: float,
    trim_start: str,
    start_pad: str,
    accelerator: str,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source = tmp_path / "main.mp4"
    pip_video = tmp_path / "pip.mp4"
    source.write_bytes(b"main")
    pip_video.write_bytes(b"pip")
    commands: list[list[str]] = []

    def fake_download(url: str, directory: Path, _progress, *, cookies=None) -> Path:
        assert url in {
            "https://www.youtube.com/watch?v=main",
            "https://www.youtube.com/watch?v=pip",
        }
        return source if "main" in url else pip_video

    async def fake_capture(**kwargs) -> list[dict[str, float | str]]:
        assert kwargs["pip_exports"] == [_pip_export(offset_seconds)]
        return telemetry_layout_export._normalize_pip_layouts(
            [_raw_pip_layout()], kwargs["pip_exports"]
        )

    def fake_run(command: list[str], *, on_output=None) -> None:
        commands.append(command)
        Path(command[-1]).write_bytes(b"rendered")

    monkeypatch.setattr(telemetry_layout_export, "download_youtube", fake_download)
    monkeypatch.setattr(telemetry_layout_export, "_video_duration", lambda _path: 20.0)
    monkeypatch.setattr(telemetry_layout_export, "_video_resolution", lambda _path: (3840, 2160))
    monkeypatch.setattr(telemetry_layout_export, "_capture_layout_frames", fake_capture)
    monkeypatch.setattr(telemetry_layout_export, "_flight_id_for_job", lambda _job_id: "flight")
    monkeypatch.setattr(telemetry_layout_export, "_run", fake_run)
    monkeypatch.setattr(
        telemetry_layout_export, "select_video_accelerator", lambda _preference: accelerator
    )

    output = tmp_path / "output.mp4"
    telemetry_layout_export.export_youtube_telemetry_layout(
        url="https://www.youtube.com/watch?v=main",
        output_path=output,
        offset_seconds=0,
        timeline_start_timestamp=0,
        frontend_url="https://dashboard.example",
        job_id="job",
        job_token="token",
        work_dir=tmp_path,
        progress=lambda _message, _percent: None,
        is_cancelled=lambda: False,
        pip_exports=[_pip_export(offset_seconds)],
    )

    filter_graph = commands[0][commands[0].index("-filter_complex") + 1]
    assert f"trim=start={trim_start},setpts=PTS-STARTPTS" in filter_graph
    assert f"start_duration={start_pad}" in filter_graph
    assert "scale=w=960:h=540:force_original_aspect_ratio=increase" in filter_graph
    assert "overlay=x=1920:y=1080:eof_action=repeat:shortest=0" in filter_graph
    assert "[basepip0][overlay]overlay=0:0:eof_action=repeat:shortest=1[outv]" in filter_graph
    command = commands[0]
    assert command[command.index("-filter_complex_threads") + 1] == "4"
    if accelerator == "nvidia":
        assert command[command.index("-c:v") + 1] == "h264_nvenc"
        assert "-threads" not in command
    else:
        assert command[command.index("-c:v") + 1] == "libx264"
        assert command[command.index("-threads") + 1] == "4"
    assert output.read_bytes() == b"rendered"
