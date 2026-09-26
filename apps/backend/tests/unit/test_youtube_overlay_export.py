"""Tests for the YouTube source + telemetry overlay export helpers."""

from io import StringIO
from pathlib import Path

import gopro_overlay_export
import pytest
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


def test_export_youtube_overlay_renders_saved_overlay_directly_onto_source(tmp_path, monkeypatch):
    source = tmp_path / "source.mp4"
    overlay = tmp_path / "rendered.mp4"
    output = tmp_path / "final.mp4"
    source.write_bytes(b"source")
    overlay.write_bytes(b"overlay")
    calls: list[tuple[str, object]] = []

    monkeypatch.setattr(
        youtube_overlay_export,
        "download_youtube",
        lambda url, directory, progress: source,
    )

    def fake_render(
        overlay_job_id,
        source_video_path,
        *,
        offset_seconds,
        output_directory,
        progress,
    ):
        calls.append(
            (
                "render",
                (overlay_job_id, source_video_path, offset_seconds, output_directory),
            )
        )
        return overlay

    monkeypatch.setattr(youtube_overlay_export, "render_saved_overlay", fake_render)

    youtube_overlay_export.export_youtube_overlay(
        url="https://www.youtube.com/watch?v=test",
        overlay_job_id="saved-overlay-job",
        output_path=output,
        offset_seconds=25.8,
        work_dir=tmp_path / "work",
        progress=lambda message, percent: None,
    )

    assert calls == [
        ("render", ("saved-overlay-job", source, 25.8, tmp_path / "work")),
    ]
    assert output.read_bytes() == b"overlay"


@pytest.mark.parametrize(
    "failure_stage",
    ["download", "render", "cancel", "final_validation"],
)
def test_export_youtube_overlay_cleans_work_dir_after_failure(
    failure_stage: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    work_dir = tmp_path / "work"
    output = tmp_path / "final.mp4"
    source = tmp_path / "source.mp4"
    overlay = tmp_path / "overlay.webm"

    def fake_download(
        url: str,
        directory: Path,
        progress: youtube_overlay_export.ProgressCallback,
    ) -> Path:
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "download.part").write_bytes(b"temporary")
        if failure_stage == "download":
            raise youtube_overlay_export.YoutubeExportError("download failed")
        return source

    def fake_render(
        overlay_job_id: str,
        source_video_path: Path,
        *,
        offset_seconds: float,
        output_directory: Path,
        progress: youtube_overlay_export.ProgressCallback,
    ) -> Path:
        (output_directory / "overlay.part").write_bytes(b"temporary")
        if failure_stage == "render":
            raise youtube_overlay_export.YoutubeExportError("render failed")
        if failure_stage == "cancel":
            raise youtube_overlay_export.YoutubeExportError("Export annulé")
        overlay.write_bytes(b"" if failure_stage == "final_validation" else b"rendered")
        return overlay

    monkeypatch.setattr(youtube_overlay_export, "download_youtube", fake_download)
    monkeypatch.setattr(youtube_overlay_export, "render_saved_overlay", fake_render)

    with pytest.raises(youtube_overlay_export.YoutubeExportError):
        youtube_overlay_export.export_youtube_overlay(
            url="https://www.youtube.com/watch?v=test",
            overlay_job_id="saved-overlay-job",
            output_path=output,
            offset_seconds=0,
            work_dir=work_dir,
            progress=lambda message, percent: None,
        )

    assert not work_dir.exists()


def test_render_saved_overlay_rebuilds_legacy_full_video_overlay(tmp_path, monkeypatch):
    camera = tmp_path / "camera.mp4"
    source = tmp_path / "source.mp4"
    merged_gpx = tmp_path / "merged.gpx"
    output = tmp_path / "youtube-overlay-saved-job.mp4"
    camera.write_bytes(b"camera")
    source.write_bytes(b"youtube")
    merged_gpx.write_text("<gpx />")
    create_args = {}
    states = iter(
        [
            {"job_id": "internal-job", "status": "queued", "progress": 0},
            {"job_id": "internal-job", "status": "running", "progress": 42},
            {
                "job_id": "internal-job",
                "status": "completed",
                "progress": 100,
                "output_path": str(output),
            },
        ]
    )

    def fake_get(job_id, include_command=False):
        if job_id == "saved-job":
            return {
                "job_id": "saved-job",
                "video_path": str(camera),
                "gpx_path": str(tmp_path / "stale.gpx"),
                "layout_id": "parapente-3840",
                "pip_path": None,
                "output_path": str(tmp_path / "legacy.mp4"),
                "command": {
                    "overlay_only": False,
                    "render_gpx_path": str(merged_gpx),
                    "gpx_offset": 25.8,
                },
            }
        state = next(states)
        if state["status"] == "completed":
            output.write_bytes(b"alpha")
        return state

    def fake_create(**kwargs):
        create_args.update(kwargs)
        return {"job_id": "internal-job"}

    monkeypatch.setattr(gopro_overlay_export, "get_gopro_overlay_job", fake_get)
    monkeypatch.setattr(
        gopro_overlay_export,
        "create_gopro_overlay_job_from_paths",
        fake_create,
    )
    monkeypatch.setattr(youtube_overlay_export.time, "sleep", lambda _: None)

    result = youtube_overlay_export.render_saved_overlay(
        "saved-job",
        source,
        offset_seconds=25.8,
        output_directory=tmp_path / "work",
        progress=lambda message, percent: None,
    )

    assert result == output
    assert create_args == {
        "video_path": source,
        "gpx_path": merged_gpx,
        "pip_path": None,
        "layout_id": "parapente-3840",
        "output_filename": "youtube-overlay-saved-job.mp4",
        "output_resolution": "source",
        "output_dir": str(tmp_path / "work"),
        "gpx_offset": 0.0,
        "flight_id": None,
        "overlay_only": False,
    }
