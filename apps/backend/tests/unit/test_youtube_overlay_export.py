"""Tests for the YouTube source + telemetry overlay export helpers."""

import json
from datetime import datetime, timedelta, timezone
from io import StringIO
from pathlib import Path

import pytest
import yaml

import gopro_overlay_export
import youtube_overlay_export
from models import GoproOverlayJob


def test_new_work_dir_uses_shared_video_export_storage(tmp_path, monkeypatch):
    monkeypatch.setattr(youtube_overlay_export.config, "VIDEO_EXPORT_DIR", str(tmp_path))

    assert youtube_overlay_export.new_work_dir("job-id") == (
        tmp_path / ".youtube-exports" / "job-id"
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
            str(volume).rsplit(":", 1)[0]
            for volume in services[service_name]["volumes"]
            if str(volume).rsplit(":", 1)[-1] == "/app/parapente"
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


def test_resume_failed_gopro_overlay_job_restores_original_pip_path(
    db_session, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source_pip = tmp_path / "source-pip.mp4"
    prepared_pip = tmp_path / "prepared-pip.mp4"
    source_pip.write_bytes(b"source pip")
    prepared_pip.write_bytes(b"prepared pip")
    job = GoproOverlayJob(
        id="failed-youtube-overlay-with-pip",
        status="failed",
        progress=100,
        message="Overlay rendering failed",
        error="ffmpeg failed",
        video_path=str(tmp_path / "source.mp4"),
        gpx_path=str(tmp_path / "track.gpx"),
        pip_path=str(prepared_pip),
        layout_id="parapente-1920",
        layout_label="Parapente",
        layout_path=str(tmp_path / "layout.xml"),
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
