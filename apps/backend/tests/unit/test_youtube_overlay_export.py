"""Tests for the YouTube source + telemetry overlay export helpers."""

import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from io import StringIO
from pathlib import Path
from typing import Any

import pytest
import yaml
from sqlalchemy.orm import Session

import config
import gopro_overlay_export
import youtube_overlay_export
from models import GoproOverlayJob


def test_new_work_dir_uses_flight_temp_storage(tmp_path, monkeypatch):
    flight = object()

    class FakeSession:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def get(self, _model, flight_id):
            assert flight_id == "flight-id"
            return flight

    monkeypatch.setattr(youtube_overlay_export, "SessionLocal", FakeSession)
    monkeypatch.setattr(
        youtube_overlay_export,
        "flight_temporary_directory",
        lambda _db, selected_flight, namespace: (
            tmp_path / namespace if selected_flight is flight else None
        ),
    )

    assert youtube_overlay_export.new_work_dir("job-id", "flight-id") == (
        tmp_path / "youtube-exports" / "job-id"
    )


def test_output_path_uses_flight_work_dir(tmp_path, monkeypatch):
    work_dir = tmp_path / "flight" / "temp" / "youtube-exports" / "job-id"
    monkeypatch.setattr(youtube_overlay_export, "new_work_dir", lambda _job, _flight: work_dir)

    assert youtube_overlay_export.output_path("job-id", "flight-id") == (
        work_dir / "youtube-overlay-job-id.mp4"
    )


def test_youtube_overlay_pipeline_services_share_parapente_storage():
    compose_path = Path(__file__).resolve().parents[4] / "docker-compose.yml"
    services = yaml.safe_load(compose_path.read_text())["services"]
    pipeline_services = (
        "backend",
        "backend-worker",
        "gopro-overlay-worker",
        "youtube-upload-worker",
    )
    shared_sources = set()

    for service_name in pipeline_services:
        mounts = [
            (volume["source"] if isinstance(volume, dict) else str(volume).rsplit(":", 1)[0])
            for volume in services[service_name]["volumes"]
            if (
                volume.get("target") == "/app/parapente"
                if isinstance(volume, dict)
                else str(volume).rsplit(":", 1)[-1] == "/app/parapente"
            )
        ]

        assert len(mounts) == 1, f"{service_name} must mount /app/parapente exactly once"
        shared_sources.add(mounts[0])

    assert len(shared_sources) == 1


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


def test_download_youtube_stores_cookies_in_export_work_dir(tmp_path, monkeypatch):
    cookie_paths: list[Path] = []

    def fake_run(command, *, cwd=None, on_output=None):
        cookie_path = Path(command[command.index("--cookies") + 1])
        cookie_paths.append(cookie_path)
        assert cookie_path.parent == tmp_path
        assert cookie_path.read_text(encoding="utf-8") == "cookie data"
        (tmp_path / "source.mp4").write_bytes(b"video")

    monkeypatch.setattr(youtube_overlay_export, "_run", fake_run)
    youtube_overlay_export.download_youtube(
        "https://www.youtube.com/watch?v=test",
        tmp_path,
        lambda _message, _percent: None,
        cookies="cookie data",
    )

    assert len(cookie_paths) == 1
    assert not cookie_paths[0].exists()


def test_download_youtube_reuses_only_completed_download_for_same_url(tmp_path, monkeypatch):
    commands: list[list[str]] = []

    def fake_run(command, *, cwd=None, on_output=None):
        commands.append(command)
        (tmp_path / "source.mp4").write_bytes(b"complete video")

    monkeypatch.setattr(youtube_overlay_export, "_run", fake_run)
    progress_events: list[tuple[str, int | None]] = []

    def progress(message: str, percent: int | None) -> None:
        progress_events.append((message, percent))

    first = youtube_overlay_export.download_youtube(
        "https://www.youtube.com/watch?v=test", tmp_path, progress
    )
    second = youtube_overlay_export.download_youtube(
        "https://www.youtube.com/watch?v=test", tmp_path, progress
    )

    assert first == second == tmp_path / "source.mp4"
    assert len(commands) == 1
    assert progress_events[-1] == (
        "Vidéo YouTube téléchargée réutilisée: source.mp4",
        100,
    )

    youtube_overlay_export.download_youtube(
        "https://www.youtube.com/watch?v=other", tmp_path, progress
    )
    assert len(commands) == 2


def test_download_youtube_reuses_completed_download_from_previous_export(tmp_path, monkeypatch):
    url = "https://www.youtube.com/watch?v=test"
    previous_export = tmp_path / "4e58f4e1-1456-4421-a761-278d2eb86102"
    previous_export.mkdir()
    source = previous_export / "source.mp4"
    source.write_bytes(b"complete video")
    (previous_export / ".youtube-download-complete.json").write_text(
        json.dumps(
            {
                "cache_version": 2,
                "url_sha256": hashlib.sha256(url.encode("utf-8")).hexdigest(),
                "cookies_sha256": None,
                "filename": source.name,
            }
        ),
        encoding="utf-8",
    )
    current_export = tmp_path / "6b04f899-c788-4f27-a8b6-d9bc7d842498"
    commands: list[list[str]] = []

    def fake_run(command, *, cwd=None, on_output=None):
        commands.append(command)

    monkeypatch.setattr(youtube_overlay_export, "_run", fake_run)
    events: list[tuple[str, int | None]] = []

    reused_source = youtube_overlay_export.download_youtube(
        url, current_export, lambda message, percent: events.append((message, percent))
    )

    assert reused_source == current_export / "source.mp4"
    assert reused_source.read_bytes() == b"complete video"
    assert not commands
    assert events == [("Vidéo YouTube téléchargée réutilisée: source.mp4", 100)]


def test_download_youtube_does_not_reuse_download_with_different_cookies(tmp_path, monkeypatch):
    url = "https://www.youtube.com/watch?v=members-only"
    previous_export = tmp_path / "4e58f4e1-1456-4421-a761-278d2eb86102"
    previous_export.mkdir()
    previous_source = previous_export / "source.mp4"
    previous_source.write_bytes(b"video downloaded with another account")
    (previous_export / ".youtube-download-complete.json").write_text(
        json.dumps(
            {
                "cache_version": 2,
                "url_sha256": hashlib.sha256(url.encode("utf-8")).hexdigest(),
                "cookies_sha256": hashlib.sha256(b"previous account cookies").hexdigest(),
                "filename": previous_source.name,
            }
        ),
        encoding="utf-8",
    )
    current_export = tmp_path / "6b04f899-c788-4f27-a8b6-d9bc7d842498"
    commands: list[list[str]] = []

    def fake_run(command, *, cwd=None, on_output=None):
        commands.append(command)
        (current_export / "source.mp4").write_bytes(b"fresh video")

    monkeypatch.setattr(youtube_overlay_export, "_run", fake_run)
    result = youtube_overlay_export.download_youtube(
        url,
        current_export,
        lambda _message, _percent: None,
        cookies="current account cookies",
    )

    assert len(commands) == 1
    assert result.read_bytes() == b"fresh video"


def test_download_youtube_reuses_nested_pip_download_from_previous_export(tmp_path, monkeypatch):
    url = "https://www.youtube.com/watch?v=pip"
    previous_export = tmp_path / "4e58f4e1-1456-4421-a761-278d2eb86102"
    previous_pip_cache = previous_export / "youtube-pip" / "pip-0"
    previous_pip_cache.mkdir(parents=True)
    source = previous_pip_cache / "source.mp4"
    source.write_bytes(b"complete pip video")
    (previous_pip_cache / ".youtube-download-complete.json").write_text(
        json.dumps(
            {
                "cache_version": 2,
                "url_sha256": hashlib.sha256(url.encode("utf-8")).hexdigest(),
                "cookies_sha256": None,
                "filename": source.name,
            }
        ),
        encoding="utf-8",
    )
    current_pip_cache = tmp_path / "6b04f899-c788-4f27-a8b6-d9bc7d842498" / "youtube-pip" / "pip-0"
    commands: list[list[str]] = []

    def fake_run(command, *, cwd=None, on_output=None):
        commands.append(command)

    monkeypatch.setattr(youtube_overlay_export, "_run", fake_run)
    reused_source = youtube_overlay_export.download_youtube(
        url, current_pip_cache, lambda _message, _percent: None
    )

    assert reused_source == current_pip_cache / "source.mp4"
    assert reused_source.read_bytes() == b"complete pip video"
    assert not commands


def test_download_youtube_replaces_source_symlink_when_reusing_sibling_cache(tmp_path, monkeypatch):
    url = "https://www.youtube.com/watch?v=test"
    previous_export = tmp_path / "4e58f4e1-1456-4421-a761-278d2eb86102"
    previous_export.mkdir()
    source = previous_export / "source.mp4"
    source.write_bytes(b"complete video")
    (previous_export / ".youtube-download-complete.json").write_text(
        json.dumps(
            {
                "cache_version": 2,
                "url_sha256": hashlib.sha256(url.encode("utf-8")).hexdigest(),
                "cookies_sha256": None,
                "filename": source.name,
            }
        ),
        encoding="utf-8",
    )
    current_export = tmp_path / "6b04f899-c788-4f27-a8b6-d9bc7d842498"
    current_export.mkdir()
    outside_file = tmp_path / "outside.mp4"
    outside_file.write_bytes(b"must not be overwritten")
    (current_export / "source.mp4").symlink_to(outside_file)
    commands: list[list[str]] = []

    def fake_run(command, *, cwd=None, on_output=None):
        commands.append(command)

    monkeypatch.setattr(youtube_overlay_export, "_run", fake_run)
    reused_source = youtube_overlay_export.download_youtube(
        url, current_export, lambda _message, _percent: None
    )

    assert reused_source.read_bytes() == b"complete video"
    assert not reused_source.is_symlink()
    assert outside_file.read_bytes() == b"must not be overwritten"
    assert not commands


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
        lambda url, directory, progress, *, cookies=None: source,
    )

    def fake_render(
        overlay_job_id,
        source_video_path,
        *,
        offset_seconds,
        output_directory,
        progress,
        pip_video_path=None,
        pip_apply_offset=True,
    ):
        calls.append(
            (
                "render",
                (
                    overlay_job_id,
                    source_video_path,
                    offset_seconds,
                    output_directory,
                    pip_video_path,
                    pip_apply_offset,
                ),
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
        ("render", ("saved-overlay-job", source, 25.8, tmp_path / "work", None, True)),
    ]
    assert output.read_bytes() == b"overlay"


@pytest.mark.parametrize(
    "failure_stage",
    ["download", "render", "cancel", "final_validation"],
)
def test_export_youtube_overlay_keeps_work_dir_after_failure(
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
        *,
        cookies: str | None = None,
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
        pip_video_path: Path | None = None,
        pip_apply_offset: bool = True,
    ) -> Path:
        del pip_video_path, pip_apply_offset
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

    assert work_dir.exists()


@pytest.mark.parametrize("gpx_mode", ["saved", "prepared_only"])
def test_render_saved_overlay_preserves_manual_timeline_and_pip(gpx_mode, tmp_path, monkeypatch):
    camera = tmp_path / "camera.mp4"
    source = tmp_path / "source.mp4"
    saved_gpx = tmp_path / "saved.gpx"
    merged_gpx = tmp_path / "merged.gpx"
    missing_pip = tmp_path / "removed-prepared-pip.mp4"
    output = tmp_path / "youtube-overlay-saved-job.mp4"
    camera.write_bytes(b"camera")
    source.write_bytes(b"youtube")
    gpx_start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    saved_gpx.write_text(
        '<gpx><trk><trkseg><trkpt lat="0" lon="0"><time>'
        f"{gpx_start.isoformat().replace('+00:00', 'Z')}"
        "</time></trkpt></trkseg></trk></gpx>"
    )
    merged_start = gpx_start + timedelta(milliseconds=25_800)
    merged_gpx.write_text(
        '<gpx><trk><trkseg><trkpt lat="0" lon="0"><time>'
        f"{merged_start.isoformat().replace('+00:00', 'Z')}"
        "</time></trkpt></trkseg></trk></gpx>"
    )
    saved_gpx_path = saved_gpx if gpx_mode == "saved" else tmp_path / "missing.gpx"
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
                "gpx_path": str(saved_gpx_path),
                "layout_id": "parapente-3840",
                "pip_path": str(missing_pip),
                "output_path": str(tmp_path / "legacy.mp4"),
                "command": {
                    "overlay_only": False,
                    "render_gpx_path": str(merged_gpx),
                    "gpx_offset": 25.8,
                    "source_pip_path": str(missing_pip),
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
    output_filename = create_args.pop("output_filename")
    assert output_filename.startswith("youtube-overlay-saved-job-")
    assert output_filename.endswith(".mp4")
    assert create_args == {
        "video_path": source,
        "gpx_path": merged_gpx,
        "pip_path": camera,
        "layout_id": "parapente-3840",
        "output_resolution": "source",
        "output_dir": str(tmp_path / "work"),
        "gpx_offset": 0.0,
        "flight_id": None,
        "overlay_only": False,
        "video_start_override": gpx_start,
        "pip_offset_seconds": 0.0,
    }


def _checkpoint_render_inputs(tmp_path: Path) -> tuple[Path, Path, dict[str, object], str]:
    source = tmp_path / "source.mp4"
    camera = tmp_path / "camera.mp4"
    gpx = tmp_path / "track.gpx"
    source.write_bytes(b"youtube video")
    camera.write_bytes(b"camera video")
    gpx.write_text("<gpx></gpx>", encoding="utf-8")
    saved_job: dict[str, object] = {
        "job_id": "saved-overlay",
        "video_path": str(camera),
        "gpx_path": str(gpx),
        "pip_path": None,
        "layout_id": "parapente-1920",
        "command": {},
    }
    render_key = youtube_overlay_export._youtube_overlay_render_key(
        overlay_job_id="saved-overlay",
        source_video_path=source,
        gpx_path=gpx,
        pip_video_path=None,
        layout_id="parapente-1920",
        offset_seconds=0.0,
        pip_apply_offset=True,
        timeline_start=None,
    )
    return source, gpx, saved_job, render_key


def test_render_file_identity_ignores_missing_pip_path(tmp_path: Path) -> None:
    assert youtube_overlay_export._render_file_identity(tmp_path / "missing-pip.mp4") is None


def test_render_saved_overlay_reuses_valid_completed_checkpoint(tmp_path, monkeypatch):
    source, _gpx, saved_job, render_key = _checkpoint_render_inputs(tmp_path)
    output_directory = tmp_path / "work"
    output_directory.mkdir()
    output = output_directory / "completed.mp4"
    output.write_bytes(b"rendered")
    (output_directory / ".youtube-overlay-render.json").write_text(
        '{"job_id":"completed-job","render_key":"' + render_key + '"}',
        encoding="utf-8",
    )

    def fake_get(job_id, include_command=False):
        if job_id == "saved-overlay":
            return saved_job
        return {"job_id": job_id, "status": "completed", "output_path": str(output)}

    monkeypatch.setattr(gopro_overlay_export, "get_gopro_overlay_job", fake_get)
    monkeypatch.setattr(
        gopro_overlay_export,
        "create_gopro_overlay_job_from_paths",
        lambda **_kwargs: pytest.fail("completed render should be reused"),
    )

    result = youtube_overlay_export.render_saved_overlay(
        "saved-overlay",
        source,
        offset_seconds=0,
        output_directory=output_directory,
        progress=lambda _message, _percent: None,
    )

    assert result == output


@pytest.mark.parametrize("output_state", ["missing", "empty"])
def test_render_saved_overlay_recreates_unusable_completed_output(
    output_state: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source, _gpx, saved_job, render_key = _checkpoint_render_inputs(tmp_path)
    output_directory = tmp_path / "work"
    output_directory.mkdir()
    old_output = output_directory / "old.mp4"
    if output_state == "empty":
        old_output.write_bytes(b"")
    (output_directory / ".youtube-overlay-render.json").write_text(
        '{"job_id":"old-job","render_key":"' + render_key + '"}',
        encoding="utf-8",
    )
    create_calls: list[dict[str, object]] = []

    def fake_get(job_id, include_command=False):
        if job_id == "saved-overlay":
            return saved_job
        if job_id == "old-job":
            return {"job_id": job_id, "status": "completed", "output_path": str(old_output)}
        replacement_output = output_directory / str(create_calls[0]["output_filename"])
        replacement_output.write_bytes(b"replacement render")
        return {
            "job_id": job_id,
            "status": "completed",
            "output_path": str(replacement_output),
        }

    def fake_create(**kwargs):
        create_calls.append(kwargs)
        return {"job_id": "replacement-job"}

    monkeypatch.setattr(gopro_overlay_export, "get_gopro_overlay_job", fake_get)
    monkeypatch.setattr(gopro_overlay_export, "create_gopro_overlay_job_from_paths", fake_create)
    monkeypatch.setattr(youtube_overlay_export.time, "sleep", lambda _seconds: None)

    result = youtube_overlay_export.render_saved_overlay(
        "saved-overlay",
        source,
        offset_seconds=0,
        output_directory=output_directory,
        progress=lambda _message, _percent: None,
    )

    assert len(create_calls) == 1
    assert result != old_output
    assert result.read_bytes() == b"replacement render"


def test_render_saved_overlay_resumes_failed_checkpoint(tmp_path, monkeypatch):
    source, _gpx, saved_job, render_key = _checkpoint_render_inputs(tmp_path)
    output_directory = tmp_path / "work"
    output_directory.mkdir()
    output = output_directory / "resumed.mp4"
    (output_directory / ".youtube-overlay-render.json").write_text(
        '{"job_id":"failed-job","render_key":"' + render_key + '"}',
        encoding="utf-8",
    )
    statuses = iter(["failed", "queued", "completed"])
    resumed_jobs: list[str] = []

    def fake_get(job_id, include_command=False):
        if job_id == "saved-overlay":
            return saved_job
        status = next(statuses)
        if status == "completed":
            output.write_bytes(b"resumed render")
        return {"job_id": job_id, "status": status, "output_path": str(output)}

    monkeypatch.setattr(gopro_overlay_export, "get_gopro_overlay_job", fake_get)
    monkeypatch.setattr(
        gopro_overlay_export,
        "resume_failed_gopro_overlay_job",
        lambda job_id: resumed_jobs.append(job_id) or True,
    )
    monkeypatch.setattr(youtube_overlay_export.time, "sleep", lambda _seconds: None)

    result = youtube_overlay_export.render_saved_overlay(
        "saved-overlay",
        source,
        offset_seconds=0,
        output_directory=output_directory,
        progress=lambda _message, _percent: None,
    )

    assert resumed_jobs == ["failed-job"]
    assert result == output


@pytest.mark.parametrize(
    ("stale_status", "expected_cancelled"),
    [("running", True), ("completed", False)],
)
def test_render_saved_overlay_replaces_checkpoint_when_render_settings_change(
    stale_status: str,
    expected_cancelled: bool,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source, _gpx, saved_job, render_key = _checkpoint_render_inputs(tmp_path)
    output_directory = tmp_path / "work"
    output_directory.mkdir()
    (output_directory / ".youtube-overlay-render.json").write_text(
        '{"job_id":"stale-job","render_key":"' + render_key + '"}',
        encoding="utf-8",
    )
    cancelled_jobs: list[str] = []
    create_calls: list[dict[str, object]] = []
    replacement_output = output_directory / "replacement.mp4"
    stale_output = output_directory / f"youtube-overlay-saved-overlay-{render_key[:16]}.mp4"
    stale_output.write_bytes(b"stale render")

    def fake_get(job_id, include_command=False):
        if job_id == "saved-overlay":
            return saved_job
        if job_id == "stale-job":
            return {
                "job_id": job_id,
                "status": stale_status,
                "output_path": str(stale_output),
            }
        replacement_output.write_bytes(b"new settings render")
        return {
            "job_id": job_id,
            "status": "completed",
            "output_path": str(replacement_output),
        }

    def fake_create(**kwargs):
        create_calls.append(kwargs)
        return {"job_id": "replacement-job"}

    monkeypatch.setattr(gopro_overlay_export, "get_gopro_overlay_job", fake_get)
    monkeypatch.setattr(
        gopro_overlay_export,
        "cancel_gopro_overlay_job",
        lambda job_id: cancelled_jobs.append(job_id) or True,
    )
    monkeypatch.setattr(gopro_overlay_export, "create_gopro_overlay_job_from_paths", fake_create)

    result = youtube_overlay_export.render_saved_overlay(
        "saved-overlay",
        source,
        offset_seconds=3,
        output_directory=output_directory,
        progress=lambda _message, _percent: None,
    )

    assert cancelled_jobs == (["stale-job"] if expected_cancelled else [])
    assert len(create_calls) == 1
    assert create_calls[0]["output_filename"] != stale_output.name
    assert stale_output.exists() is expected_cancelled
    assert result == replacement_output


def test_gpx_overlay_retry_reuses_rendered_segments(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    gpx_path = tmp_path / "render.gpx"
    origin = datetime(2026, 10, 22, 9, 30, tzinfo=timezone.utc)
    trackpoints = "".join(
        f'<trkpt lat="45" lon="6"><time>{(origin + timedelta(seconds=i)).isoformat()}</time></trkpt>'
        for i in range(7)
    )
    gpx_path.write_text(f"<gpx><trk><trkseg>{trackpoints}</trkseg></trk></gpx>")
    video_path = tmp_path / "video.mp4"
    video_path.write_bytes(b"video")
    layout_path = tmp_path / "layout.xml"
    layout_path.write_text("<layout />")
    work_dir = tmp_path / "work"
    work_dir.mkdir()
    output_path = tmp_path / "overlay.webm"
    temp_output_path = tmp_path / "overlay.tmp.webm"
    job = {
        "id": "resume-test",
        "status": "queued",
        "video_path": str(video_path),
        "gpx_path": str(gpx_path),
        "layout_path": str(layout_path),
        "output_path": str(output_path),
        "temp_output_path": str(temp_output_path),
        "video_width": 1920,
        "video_height": 1080,
        "command": {"render_gpx_path": str(gpx_path), "overlay_only": True},
    }
    monkeypatch.setattr(config, "GOPRO_OVERLAY_GPX_SEGMENT_SECONDS", 3)
    monkeypatch.setattr(
        gopro_overlay_export, "_update_job", lambda _job, **changes: _record_job(job, changes)
    )
    monkeypatch.setattr(gopro_overlay_export, "_transition_job_to_running", lambda *_args: True)
    monkeypatch.setattr(
        gopro_overlay_export, "_finish_job", lambda _job, **changes: job.update(changes) or job
    )
    monkeypatch.setattr(
        gopro_overlay_export, "get_gopro_overlay_job", lambda *_args, **_kwargs: job
    )
    monkeypatch.setattr(
        gopro_overlay_export,
        "_create_gpx_overlay_timeline_segment",
        lambda path, _frames: path.write_bytes(b"timeline"),
    )
    rendered_commands: list[list[str]] = []

    def render_segment(_job_id: str, command: list[str], *_args: Any) -> int:
        rendered_commands.append(command)
        Path(command[-1]).write_bytes(b"rendered segment")
        return 0

    monkeypatch.setattr(gopro_overlay_export, "_run_overlay_process", render_segment)
    monkeypatch.setattr(gopro_overlay_export, "_verify_video_output", lambda _path: (True, None))
    concat_calls = 0

    def concat(segments: list[Path], destination: Path) -> None:
        nonlocal concat_calls
        concat_calls += 1
        assert len(segments) == 3
        if concat_calls == 1:
            raise ValueError("simulated final assembly failure")
        destination.write_bytes(b"final overlay")

    monkeypatch.setattr(gopro_overlay_export, "_concat_overlay_segments", concat)
    command = [
        "gopro-dashboard.py",
        "--use-gpx-only",
        "--gpx",
        str(gpx_path),
        "--generate",
        "overlay",
        "--video-time-start",
        "file-modified",
        str(video_path),
        str(temp_output_path),
    ]

    gopro_overlay_export._run_segmented_gpx_overlay_job(
        "resume-test", job, command, tmp_path / "job.log", output_path, temp_output_path
    )

    assert job["status"] == "failed"
    assert job["command"]["resume"]["completed_segments"] == [0, 1, 2]
    assert len(rendered_commands) == 3
    assert all(
        "--generate" in call and call[call.index("--generate") + 1] == "overlay"
        for call in rendered_commands
    )
    expected_starts = [
        origin.timestamp(),
        (origin + timedelta(seconds=3)).timestamp(),
        (origin + timedelta(seconds=5.9)).timestamp(),
    ]
    timeline_paths = [Path(call[-2]) for call in rendered_commands]
    assert [path.stat().st_mtime for path in timeline_paths] == pytest.approx(
        expected_starts, abs=0.01
    )

    for path in (gpx_path, layout_path):
        previous_stat = path.stat()
        path.write_bytes(path.read_bytes())
        os.utime(
            path,
            ns=(previous_stat.st_atime_ns, previous_stat.st_mtime_ns + 1_000_000_000),
        )
        assert path.stat().st_mtime_ns != previous_stat.st_mtime_ns

    job["status"] = "queued"
    gopro_overlay_export._run_segmented_gpx_overlay_job(
        "resume-test", job, command, tmp_path / "job.log", output_path, temp_output_path
    )

    assert len(rendered_commands) == 3
    assert concat_calls == 2
    assert output_path.read_bytes() == b"final overlay"
    assert job["status"] == "completed"


def test_gpx_overlay_setup_failure_marks_job_failed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    gpx_path = tmp_path / "render.gpx"
    origin = datetime(2026, 10, 22, 9, 30, tzinfo=timezone.utc)
    gpx_path.write_text(
        "<gpx><trk><trkseg>"
        f'<trkpt lat="45" lon="6"><time>{origin.isoformat()}</time></trkpt>'
        f'<trkpt lat="45" lon="6"><time>{(origin + timedelta(seconds=3)).isoformat()}</time></trkpt>'
        "</trkseg></trk></gpx>"
    )
    video_path = tmp_path / "video.mp4"
    video_path.write_bytes(b"video")
    job = {
        "id": "setup-failure",
        "status": "queued",
        "video_path": str(video_path),
        "gpx_path": str(gpx_path),
        "layout_path": str(tmp_path / "missing-layout.xml"),
        "command": {"render_gpx_path": str(gpx_path)},
    }
    monkeypatch.setattr(
        gopro_overlay_export, "_update_job", lambda _job, **changes: _record_job(job, changes)
    )
    monkeypatch.setattr(
        gopro_overlay_export, "_finish_job", lambda _job, **changes: job.update(changes) or job
    )
    monkeypatch.setattr(
        gopro_overlay_export, "get_gopro_overlay_job", lambda *_args, **_kwargs: job
    )

    gopro_overlay_export._run_segmented_gpx_overlay_job(
        "setup-failure",
        job,
        ["gopro-dashboard.py", "--gpx", str(gpx_path), str(video_path), "output.webm"],
        tmp_path / "job.log",
        tmp_path / "output.webm",
        tmp_path / "output.part.webm",
    )

    assert job["status"] == "failed"
    assert "missing-layout.xml" in job["error"]


def test_prepare_queued_job_creates_work_dir_before_preparation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    work_dir = tmp_path / "deleted-work-dir"
    job = {
        "id": "recreate-work-dir",
        "status": "queued",
        "layout_path": str(work_dir / "layout.xml"),
        "output_path": str(tmp_path / "overlay.webm"),
        "command": {"prepare_overlay_inputs": True},
    }
    monkeypatch.setattr(gopro_overlay_export, "_append_job_log", lambda *_args: None)
    monkeypatch.setattr(gopro_overlay_export, "_claim_job_for_preparation", lambda _job_id: None)

    assert gopro_overlay_export._prepare_queued_job("recreate-work-dir", job) is None
    assert work_dir.is_dir()


def test_run_job_cleans_segmented_gpx_work_dir_after_success(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job_id = "cleanup-segmented-gpx"
    job = {
        "id": job_id,
        "job_id": job_id,
        "status": "queued",
        "video_path": str(tmp_path / "video.mp4"),
        "gpx_path": str(tmp_path / "track.gpx"),
        "layout_path": str(tmp_path / "work" / "layout.xml"),
        "output_path": str(tmp_path / "overlay.webm"),
        "temp_output_path": str(tmp_path / "work" / "overlay.part.webm"),
        "command": {"overlay_only": True, "render_gpx_path": str(tmp_path / "track.gpx")},
    }
    gopro_overlay_export._JOBS[job_id] = job
    cleanups: list[str] = []
    monkeypatch.setattr(
        gopro_overlay_export, "get_gopro_overlay_job", lambda *_args, **_kwargs: job
    )
    monkeypatch.setattr(gopro_overlay_export, "_prepare_queued_job", lambda _job_id, value: value)
    monkeypatch.setattr(gopro_overlay_export, "gpx_duration_seconds", lambda _path: 30.0)
    monkeypatch.setattr(gopro_overlay_export, "select_video_accelerator", lambda _setting: "cpu")

    def complete_segmented_job(_job_id: str, selected_job: dict[str, Any], *_args: Any) -> None:
        selected_job["status"] = "completed"

    monkeypatch.setattr(
        gopro_overlay_export, "_run_segmented_gpx_overlay_job", complete_segmented_job
    )
    monkeypatch.setattr(
        gopro_overlay_export,
        "_cleanup_gopro_overlay_temp_files",
        lambda selected_job: cleanups.append(selected_job["status"]),
    )

    try:
        gopro_overlay_export._run_job(job_id)
    finally:
        gopro_overlay_export._JOBS.pop(job_id, None)

    assert cleanups == ["completed"]


def _record_job(job: dict[str, Any], changes: dict[str, Any]) -> dict[str, Any]:
    if "command_json" in changes:
        changes["command"] = json.loads(changes.pop("command_json"))
    job.update(changes)
    return job


def test_resume_failed_gopro_overlay_job_restores_original_pip_path(
    db_session: Session, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source_pip = tmp_path / "source-pip.mp4"
    prepared_pip = tmp_path / "prepared-pip.mp4"
    source_video = tmp_path / "source.mp4"
    source_gpx = tmp_path / "track.gpx"
    layout = tmp_path / "layout.xml"
    source_pip.write_bytes(b"source pip")
    prepared_pip.write_bytes(b"prepared pip")
    source_video.write_bytes(b"source video")
    source_gpx.write_text("<gpx />")
    layout.write_text("<layout />")
    job = GoproOverlayJob(
        id="failed-youtube-overlay-with-pip",
        status="failed",
        progress=100,
        message="Overlay rendering failed",
        error="ffmpeg failed",
        video_path=str(source_video),
        gpx_path=str(source_gpx),
        pip_path=str(prepared_pip),
        layout_id="parapente-1920",
        layout_label="Parapente",
        layout_path=str(layout),
        output_path=str(tmp_path / "output.mp4"),
        temp_output_path=str(tmp_path / "output.tmp.mp4"),
        output_filename="output.mp4",
        command_json=json.dumps(
            {
                "preserve_work_dir_on_failure": True,
                "source_pip_path": str(source_pip),
                "resume": {"completed_segments": [0, 1]},
            }
        ),
    )
    db_session.add(job)
    db_session.commit()
    enqueued_jobs: list[str] = []
    monkeypatch.setattr(
        gopro_overlay_export,
        "_enqueue_existing_gopro_overlay_job",
        enqueued_jobs.append,
    )

    assert gopro_overlay_export.resume_failed_gopro_overlay_job(job.id) is True

    db_session.expire_all()
    resumed_job = db_session.get(GoproOverlayJob, job.id)
    assert resumed_job is not None
    assert resumed_job.status == "queued"
    assert resumed_job.pip_path == str(source_pip)
    assert json.loads(resumed_job.command_json or "{}")["resume"]["completed_segments"] == [0, 1]
    assert enqueued_jobs == [job.id]


def test_resume_failed_gopro_overlay_job_rejects_missing_inputs(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    job = GoproOverlayJob(
        id="failed-overlay-missing-inputs",
        status="failed",
        progress=100,
        message="Overlay rendering failed",
        error="ffmpeg failed",
        video_path="/tmp/missing-source.mp4",
        gpx_path="/tmp/missing-track.gpx",
        layout_id="parapente-1920",
        layout_label="Parapente",
        layout_path="/tmp/missing-layout.xml",
        output_path="/tmp/output.mp4",
        temp_output_path="/tmp/output.tmp.mp4",
        output_filename="output.mp4",
        command_json=json.dumps({"prepare_overlay_inputs": False}),
    )
    db_session.add(job)
    db_session.commit()
    enqueued_jobs = []
    monkeypatch.setattr(
        gopro_overlay_export, "_enqueue_existing_gopro_overlay_job", enqueued_jobs.append
    )

    assert gopro_overlay_export.resume_failed_gopro_overlay_job(job.id) is False
    db_session.refresh(job)
    assert job.status == "failed"
    assert enqueued_jobs == []
