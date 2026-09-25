"""Tests for the YouTube source + telemetry overlay export helpers."""

from io import StringIO
from pathlib import Path

import youtube_overlay_export


def test_iter_process_output_supports_progress_carriage_returns():
    lines = list(
        youtube_overlay_export._iter_process_output(
            StringIO("[download]  12.0%\r[download]  42.0%\nffmpeg: done\n")
        )
    )

    assert lines == [
        "[download]  12.0%",
        "[download]  42.0%",
        "ffmpeg: done",
    ]


def test_download_youtube_reports_download_percentage(tmp_path, monkeypatch):
    commands: list[list[str]] = []
    events: list[tuple[str, int | None]] = []

    def fake_run(command, *, cwd=None, on_output=None):
        commands.append(command)
        assert cwd is None
        assert on_output is not None
        on_output("[info] Downloading format 18")
        on_output("[download]  42.5% of 10.00MiB at 2.00MiB/s ETA 00:03")
        (tmp_path / "source.mp4").write_bytes(b"video")

    monkeypatch.setattr(youtube_overlay_export, "_run", fake_run)

    source = youtube_overlay_export.download_youtube(
        "https://www.youtube.com/watch?v=test",
        tmp_path,
        lambda message, percent: events.append((message, percent)),
    )

    assert source == Path(tmp_path / "source.mp4")
    assert "--newline" in commands[0]
    assert events == [
        ("Téléchargement YouTube démarré", 0),
        ("yt-dlp: [info] Downloading format 18", None),
        (
            "yt-dlp: [download]  42.5% of 10.00MiB at 2.00MiB/s ETA 00:03",
            42,
        ),
        ("Téléchargement YouTube terminé: source.mp4", 100),
    ]


def test_compose_with_overlay_keeps_ffmpeg_output_in_progress_events(tmp_path, monkeypatch):
    events: list[tuple[str, int | None]] = []

    def fake_run(command, *, cwd=None, on_output=None):
        assert on_output is not None
        on_output("frame=42 fps=30 time=00:00:01.40")

    monkeypatch.setattr(youtube_overlay_export, "_run", fake_run)

    youtube_overlay_export.compose_with_overlay(
        source=tmp_path / "source.mp4",
        overlay=tmp_path / "overlay.mov",
        output=tmp_path / "final.mp4",
        offset_seconds=0,
        progress=lambda message, percent: events.append((message, percent)),
    )

    assert events == [
        ("Fusion de la vidéo YouTube et de l’overlay démarrée", 50),
        ("ffmpeg: frame=42 fps=30 time=00:00:01.40", None),
        ("Fusion terminée: final.mp4", 99),
    ]
