"""Unit tests for video export helpers."""

import asyncio
import os
import time
from collections import deque
from datetime import datetime
from types import SimpleNamespace
from urllib.error import URLError

import pytest
from sqlalchemy.exc import SQLAlchemyError

from auth import create_access_token, create_job_token, decode_job_token
from deployment_drain import DeploymentDrainActive, deployment_drain
from models import Flight, VideoExportJob

import video_export
import video_export_manual


def test_video_export_log_survives_temp_cleanup_until_job_deletion(tmp_path, monkeypatch):
    export_root = tmp_path / "exports"
    temp_root = tmp_path / "temp"
    job_id = "job-persistent-log"
    job_temp_dir = temp_root / job_id
    job_temp_dir.mkdir(parents=True)
    (job_temp_dir / "frame.png").write_bytes(b"frame")

    monkeypatch.setattr(video_export_manual, "_video_export_dir", lambda: export_root)
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: temp_root)

    video_export_manual._log_job(job_id, "Captured 10/100 frames")
    log_path = video_export_manual._job_log_path(job_id)

    video_export_manual.cleanup_video_export_temp_files(
        [{"job_id": job_id, "status": "completed", "internal_status": "completed"}]
    )

    assert not job_temp_dir.exists()
    assert "Captured 10/100 frames" in log_path.read_text()

    video_export_manual.cleanup_video_export_job_temp_files(job_id)

    assert not log_path.exists()


def test_resolve_frontend_url_uses_backend_static_in_production(monkeypatch):
    """Production should avoid localhost:5173 when static frontend is bundled."""
    monkeypatch.setattr(video_export_manual.Path, "exists", lambda _self: True)
    monkeypatch.setattr(video_export_manual.config, "ENVIRONMENT", "production")
    monkeypatch.setattr(video_export_manual.config, "JOB_QUEUE_BACKEND", "rq")
    monkeypatch.setattr(video_export_manual.config, "API_HOST", "0.0.0.0")
    monkeypatch.setattr(video_export_manual.config, "API_PORT", 8001)

    resolved = video_export_manual.resolve_frontend_url("http://localhost:5173")

    assert resolved == "http://backend:8001"


def test_default_frontend_url_normalizes_configured_vite_url_in_production(monkeypatch):
    """Production defaults should not point browser workers to absent local Vite."""
    monkeypatch.setattr(video_export_manual.Path, "exists", lambda _self: True)
    monkeypatch.setattr(video_export_manual.config, "FRONTEND_URL", "http://localhost:5173")
    monkeypatch.setattr(video_export_manual.config, "ENVIRONMENT", "production")
    monkeypatch.setattr(video_export_manual.config, "JOB_QUEUE_BACKEND", "rq")
    monkeypatch.setattr(video_export_manual.config, "API_HOST", "0.0.0.0")
    monkeypatch.setattr(video_export_manual.config, "API_PORT", 8001)

    resolved = video_export_manual._default_frontend_url()

    assert resolved == "http://backend:8001"


def test_resolve_frontend_url_rewrites_local_backend_url_for_rq_worker(monkeypatch):
    """The worker container must reach the API through Docker DNS, not loopback."""
    monkeypatch.setattr(video_export_manual.Path, "exists", lambda _self: True)
    monkeypatch.setattr(video_export_manual.config, "ENVIRONMENT", "production")
    monkeypatch.setattr(video_export_manual.config, "JOB_QUEUE_BACKEND", "rq")
    monkeypatch.setattr(video_export_manual.config, "API_HOST", "0.0.0.0")
    monkeypatch.setattr(video_export_manual.config, "API_PORT", 8001)

    resolved = video_export_manual.resolve_frontend_url("http://127.0.0.1:8001")

    assert resolved == "http://backend:8001"


def test_resolve_frontend_url_keeps_local_backend_url_without_rq(monkeypatch):
    """Thread mode runs in the API process, where loopback remains valid."""
    monkeypatch.setattr(video_export_manual.Path, "exists", lambda _self: True)
    monkeypatch.setattr(video_export_manual.config, "ENVIRONMENT", "production")
    monkeypatch.setattr(video_export_manual.config, "JOB_QUEUE_BACKEND", "thread")
    monkeypatch.setattr(video_export_manual.config, "API_HOST", "0.0.0.0")
    monkeypatch.setattr(video_export_manual.config, "API_PORT", 8001)

    resolved = video_export_manual.resolve_frontend_url("http://127.0.0.1:8001")

    assert resolved == "http://127.0.0.1:8001"


def test_resolve_frontend_url_keeps_dev_vite_url(monkeypatch):
    """Development should keep localhost:5173 for local Vite workflow."""
    monkeypatch.setattr(video_export_manual.Path, "exists", lambda _self: True)
    monkeypatch.setattr(video_export_manual.config, "ENVIRONMENT", "development")

    resolved = video_export_manual.resolve_frontend_url("http://localhost:5173")

    assert resolved == "http://localhost:5173"


def test_resolve_frontend_url_strips_export_viewer_suffix(monkeypatch):
    """The base URL should not keep the /export-viewer route segment."""
    monkeypatch.setattr(video_export_manual.Path, "exists", lambda _self: False)
    monkeypatch.setattr(video_export_manual.config, "ENVIRONMENT", "development")

    resolved = video_export_manual.resolve_frontend_url(
        "http://frontend.example/export-viewer?flightId=abc"
    )

    assert resolved == "http://frontend.example"


def test_check_url_reachable_reports_connection_failure(monkeypatch):
    def fail_urlopen(_request, timeout):
        assert timeout == 5.0
        raise URLError("connection refused")

    monkeypatch.setattr(video_export_manual, "urlopen", fail_urlopen)

    with pytest.raises(RuntimeError, match="Export viewer is unreachable"):
        video_export_manual._check_url_reachable(
            "http://localhost:8001/export-viewer?flightId=flight-1"
        )


def test_build_playwright_init_script_sets_export_mode_and_token():
    script = video_export_manual._build_playwright_init_script("abc123")

    assert "window._exportMode = 'manual_render'" in script
    assert "window._exportToken" in script
    assert "parapente-auth" not in script
    assert '"abc123"' in script


def test_build_playwright_init_script_without_token_still_sets_export_mode():
    script = video_export_manual._build_playwright_init_script(None)

    assert "window._exportMode = 'manual_render'" in script
    assert "window._exportToken = null" in script


def test_job_auth_token_storage_roundtrip(test_db, monkeypatch):
    job_id = "job-token-test"
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)

    db_session = test_db()

    db_session.add(
        VideoExportJob(
            id=job_id,
            flight_id="flight-test-001",
            status="queued",
            mode="manual",
            quality="1080p",
            fps=15,
            speed=1,
            progress=0,
            message="test",
            frontend_url="http://localhost:5173",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    )
    db_session.commit()
    db_session.close()

    video_export_manual._set_job_auth_token(job_id, "token-xyz")
    assert video_export_manual._get_job_auth_token(job_id) == "token-xyz"

    video_export_manual._clear_job_auth_token(job_id)
    assert video_export_manual._get_job_auth_token(job_id) is None


def test_set_job_auth_token_removes_value_when_none(test_db, monkeypatch):
    job_id = "job-token-none"
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)

    db_session = test_db()

    db_session.add(
        VideoExportJob(
            id=job_id,
            flight_id="flight-test-001",
            status="queued",
            mode="manual",
            quality="1080p",
            fps=15,
            speed=1,
            progress=0,
            message="test",
            frontend_url="http://localhost:5173",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    )
    db_session.commit()
    db_session.close()

    video_export_manual._set_job_auth_token(job_id, "token-xyz")
    video_export_manual._set_job_auth_token(job_id, None)

    assert video_export_manual._get_job_auth_token(job_id) is None


def test_job_render_method_is_persisted_for_other_processes(test_db, monkeypatch):
    job_id = "job-render-method"
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)

    with test_db() as db_session:
        db_session.add(
            VideoExportJob(
                id=job_id,
                flight_id="flight-test-001",
                status="capturing",
                mode="manual_fast",
                render_method=None,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        )
        db_session.commit()

    video_export_manual._set_job_render_method(job_id, "gpu")

    with test_db() as db_session:
        job = db_session.get(VideoExportJob, job_id)
        assert job is not None
        assert job.render_method == "gpu"


def test_capture_progress_percent_spans_capture_phase_range():
    assert video_export_manual._capture_progress_percent(0, 100) == 5
    assert video_export_manual._capture_progress_percent(50, 100) == 42
    assert video_export_manual._capture_progress_percent(100, 100) == 80


def test_parse_ffmpeg_out_time_seconds_parses_progress_lines():
    assert video_export_manual._parse_ffmpeg_out_time_seconds("out_time_ms=3000000") == 3.0
    assert video_export_manual._parse_ffmpeg_out_time_seconds("out_time_us=1500000") == 1.5
    assert video_export_manual._parse_ffmpeg_out_time_seconds("out_time=00:00:05.50") == 5.5
    assert video_export_manual._parse_ffmpeg_out_time_seconds("progress=continue") is None


@pytest.mark.parametrize(
    "renderer",
    [
        "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))",
        "llvmpipe (LLVM 19.1.7, 256 bits)",
        "Mesa softpipe",
        "Software Rasterizer",
    ],
)
def test_software_webgl_renderer_is_detected(renderer):
    assert video_export_manual._is_software_webgl_renderer(renderer) is True


def test_hardware_webgl_renderer_is_not_marked_as_software():
    assert video_export_manual._is_software_webgl_renderer("NV168 (nouveau)") is False


def test_chromium_launch_args_use_hardware_egl_for_nvidia():
    args = video_export_manual._chromium_launch_args("nvidia")

    assert "--use-angle=gl-egl" in args
    assert "--enable-gpu-rasterization" in args
    assert "--use-angle=swiftshader-webgl" not in args


def test_chromium_launch_args_use_swiftshader_for_cpu():
    args = video_export_manual._chromium_launch_args("cpu")

    assert "--use-angle=swiftshader-webgl" in args
    assert "--enable-unsafe-swiftshader" in args
    assert "--use-angle=gl-egl" not in args


def test_ffmpeg_encoding_settings_use_fast_preset_for_manual_fast():
    assert video_export_manual._ffmpeg_encoding_settings(True) == ("veryfast", "23")
    assert video_export_manual._ffmpeg_encoding_settings(False) == ("medium", "18")


def test_ffmpeg_command_streams_png_frames_for_manual_fast(tmp_path):
    output_file = tmp_path / "export.mp4"

    command = video_export_manual._ffmpeg_command(
        fps=15,
        output_file=output_file,
        is_fast_mode=True,
    )

    assert command[:9] == [
        "ffmpeg",
        "-f",
        "image2pipe",
        "-framerate",
        "15",
        "-vcodec",
        "png",
        "-i",
        "pipe:0",
    ]
    assert command[-1] == str(output_file)
    assert command[command.index("-preset") + 1] == "veryfast"
    assert command[command.index("-crf") + 1] == "23"


def test_ffmpeg_command_reads_saved_frames_for_classic_mode(tmp_path):
    frames_dir = tmp_path / "frames"
    output_file = tmp_path / "export.mp4"

    command = video_export_manual._ffmpeg_command(
        fps=30,
        output_file=output_file,
        is_fast_mode=False,
        frames_dir=frames_dir,
    )

    assert command[:5] == [
        "ffmpeg",
        "-framerate",
        "30",
        "-i",
        str(frames_dir / "frame%05d.png"),
    ]
    assert "image2pipe" not in command
    assert command[command.index("-preset") + 1] == "medium"
    assert command[command.index("-crf") + 1] == "18"


def test_ffmpeg_command_uses_nvenc_when_nvidia_is_available(tmp_path):
    command = video_export_manual._ffmpeg_command(
        fps=15,
        output_file=tmp_path / "export.mp4",
        is_fast_mode=True,
        accelerator="nvidia",
    )

    assert command[command.index("-c:v") + 1] == "h264_nvenc"
    assert command[command.index("-cq") + 1] == "23"
    assert "-crf" not in command


def test_manual_fast_nvenc_command_reads_saved_frames_for_cpu_retry(tmp_path):
    frames_dir = tmp_path / "frames"
    command = video_export_manual._ffmpeg_command(
        fps=15,
        output_file=tmp_path / "export.mp4",
        is_fast_mode=True,
        frames_dir=frames_dir,
        accelerator="nvidia",
    )

    assert command[:5] == [
        "ffmpeg",
        "-framerate",
        "15",
        "-i",
        str(frames_dir / "frame%05d.png"),
    ]
    assert command[command.index("-c:v") + 1] == "h264_nvenc"


@pytest.mark.asyncio
async def test_drain_ffmpeg_stderr_tracks_latest_progress(monkeypatch):
    reader = asyncio.StreamReader()
    reader.feed_data(b"out_time_us=1500000\nprogress=continue\ninvalid PNG frame\n")
    reader.feed_eof()
    lines: deque[str] = deque(maxlen=2)
    state: dict[str, float] = {}
    logged_messages: list[str] = []
    monkeypatch.setattr(
        video_export_manual,
        "_log_job",
        lambda _job_id, message: logged_messages.append(message),
    )

    await video_export_manual._drain_ffmpeg_stderr("job-1", reader, lines, state)

    assert list(lines) == ["invalid PNG frame"]
    assert state["encoded_seconds"] == 1.5
    assert state["last_output_at"] > 0
    assert logged_messages == ["ffmpeg: invalid PNG frame"]


class _FakeFfmpegStdin:
    def __init__(self):
        self.frames: list[bytes] = []

    def write(self, frame: bytes) -> None:
        self.frames.append(frame)

    async def drain(self) -> None:
        return None


class _FakeFfmpegProcess:
    def __init__(self):
        self.stdin = _FakeFfmpegStdin()
        self.returncode = None


@pytest.mark.asyncio
async def test_write_ffmpeg_frame_writes_complete_png(monkeypatch):
    process = _FakeFfmpegProcess()
    stderr_task = asyncio.create_task(asyncio.sleep(0))
    monkeypatch.setattr(video_export_manual, "_is_cancelled", lambda _job_id: False)

    written = await video_export_manual._write_ffmpeg_frame(
        job_id="job-1",
        process=process,
        stderr_task=stderr_task,
        stderr_lines=deque(),
        state={"started_at": time.monotonic()},
        frame_png=b"png-frame",
    )

    await stderr_task
    assert written is True
    assert process.stdin.frames == [b"png-frame"]


@pytest.mark.asyncio
async def test_write_ffmpeg_frame_stops_before_write_when_cancelled(monkeypatch):
    process = _FakeFfmpegProcess()
    stderr_task = asyncio.create_task(asyncio.sleep(0))
    monkeypatch.setattr(video_export_manual, "_is_cancelled", lambda _job_id: True)

    written = await video_export_manual._write_ffmpeg_frame(
        job_id="job-1",
        process=process,
        stderr_task=stderr_task,
        stderr_lines=deque(),
        state={"started_at": time.monotonic()},
        frame_png=b"png-frame",
    )

    await stderr_task
    assert written is False
    assert process.stdin.frames == []


def test_ffmpeg_timeout_is_not_limited_to_thirty_minutes():
    assert video_export_manual._ffmpeg_timeout_seconds(60) == 6 * 60 * 60


def test_ffmpeg_timeout_scales_for_long_videos():
    duration_seconds = 7 * 60 * 60
    assert video_export_manual._ffmpeg_timeout_seconds(duration_seconds) == duration_seconds * 20


class _FakeTerrainPage:
    def __init__(self, tile_states: list[bool]):
        self.tile_states = tile_states
        self.evaluate_calls = 0

    async def evaluate(self, _script: str) -> bool:
        self.evaluate_calls += 1
        if self.tile_states:
            return self.tile_states.pop(0)
        return False


class _HangingTerrainPage:
    def __init__(self):
        self.evaluate_calls = 0

    async def evaluate(self, _script: str) -> bool:
        self.evaluate_calls += 1
        await asyncio.sleep(60)
        return True


@pytest.mark.asyncio
async def test_wait_for_export_frame_terrain_waits_until_tiles_loaded():
    page = _FakeTerrainPage([False, False, True])

    tiles_loaded = await video_export_manual._wait_for_export_frame_terrain(
        page,
        timeout_seconds=1,
        poll_seconds=0,
    )

    assert tiles_loaded is True
    assert page.evaluate_calls == 3


@pytest.mark.asyncio
async def test_wait_for_export_frame_terrain_returns_false_after_timeout():
    page = _FakeTerrainPage([False, False, False])

    tiles_loaded = await video_export_manual._wait_for_export_frame_terrain(
        page,
        timeout_seconds=0,
        poll_seconds=0,
    )

    assert tiles_loaded is False
    assert page.evaluate_calls == 1


@pytest.mark.asyncio
async def test_wait_for_export_frame_terrain_returns_false_when_evaluate_hangs():
    page = _HangingTerrainPage()

    tiles_loaded = await video_export_manual._wait_for_export_frame_terrain(
        page,
        timeout_seconds=1,
        poll_seconds=0,
        evaluate_timeout_seconds=0.01,
    )

    assert tiles_loaded is False
    assert page.evaluate_calls == 1


def test_ffmpeg_output_file_activity_tracks_size_and_mtime(tmp_path):
    output_file = tmp_path / "export.mp4"

    activity, size, mtime_ns = video_export_manual._ffmpeg_output_file_activity(output_file, -1, -1)
    assert activity is False
    assert size == -1
    assert mtime_ns == -1

    output_file.write_bytes(b"first")
    activity, size, mtime_ns = video_export_manual._ffmpeg_output_file_activity(
        output_file, size, mtime_ns
    )
    assert activity is True
    assert size == 5

    activity, size, mtime_ns = video_export_manual._ffmpeg_output_file_activity(
        output_file, size, mtime_ns
    )
    assert activity is False

    same_size_mtime_ns = mtime_ns + 1_000_000_000
    os.utime(output_file, ns=(same_size_mtime_ns, same_size_mtime_ns))
    activity, size, mtime_ns = video_export_manual._ffmpeg_output_file_activity(
        output_file, size, mtime_ns
    )
    assert activity is True
    assert size == 5
    assert mtime_ns == same_size_mtime_ns

    activity, size, mtime_ns = video_export_manual._ffmpeg_output_file_activity(
        output_file, size, mtime_ns
    )
    assert activity is False

    output_file.write_bytes(b"second-pass")
    activity, size, mtime_ns = video_export_manual._ffmpeg_output_file_activity(
        output_file, size, mtime_ns
    )
    assert activity is True
    assert size == 11


def test_encoding_progress_percent_spans_encoding_phase_range():
    assert video_export_manual._encoding_progress_percent(0, 100) == 80
    assert video_export_manual._encoding_progress_percent(50, 100) == 89
    assert video_export_manual._encoding_progress_percent(100, 100) == 99


def test_video_output_path_uses_configured_export_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(
        video_export_manual,
        "get_video_output_path",
        lambda flight_id, timestamp: tmp_path / "videos" / f"flight-{flight_id}-{timestamp}.mp4",
    )

    output_path = video_export_manual._video_output_path("flight-123", "20260430-120000")

    assert output_path == tmp_path / "videos" / "flight-flight-123-20260430-120000.mp4"


def test_job_frames_dir_uses_configured_temp_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(
        video_export_manual, "_video_temp_images_dir", lambda: tmp_path / "temp-images"
    )

    frames_dir = video_export_manual._job_frames_dir(
        video_export_manual._video_temp_images_dir(), "job-123"
    )

    assert frames_dir == tmp_path / "temp-images" / "job-123" / "frames"


def test_rq_job_id_does_not_use_forbidden_separator():
    rq_job_id = video_export_manual._rq_job_id("job-rq")

    assert rq_job_id == "video-export-job-rq"
    assert ":" not in rq_job_id


def test_resolve_video_export_job_token_replaces_access_token():
    user_token = create_access_token("pilot@example.test")

    job_token = video_export_manual._resolve_video_export_job_token(
        "job-export",
        "flight-test-001",
        user_token,
    )

    assert job_token != user_token
    payload = decode_job_token(job_token, purpose="video_export", job_id="job-export")
    assert payload["flight_id"] == "flight-test-001"


def test_resolve_video_export_job_token_keeps_matching_job_token():
    existing_token = create_job_token(
        purpose="video_export",
        job_id="job-export",
        flight_id="flight-test-001",
    )

    job_token = video_export_manual._resolve_video_export_job_token(
        "job-export",
        "flight-test-001",
        existing_token,
    )

    assert job_token == existing_token


def test_start_video_export_manual_enqueues_rq_job(test_db, monkeypatch):
    enqueued_job_ids: list[str] = []
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)
    monkeypatch.setattr(video_export_manual, "_dependencies_ok", True)
    monkeypatch.setattr(video_export_manual.uuid, "uuid4", lambda: "job-rq")
    monkeypatch.setattr(video_export_manual.config, "JOB_QUEUE_BACKEND", "rq")
    monkeypatch.setattr(
        video_export_manual,
        "_enqueue_video_export_job_in_rq",
        lambda job_id: enqueued_job_ids.append(job_id),
    )

    job_id = video_export_manual.start_video_export_manual(
        flight_id="flight-test-001",
        frontend_url="http://frontend.test",
    )

    db_session = test_db()
    job = db_session.query(VideoExportJob).filter(VideoExportJob.id == job_id).one()
    db_session.close()

    assert job_id == "job-rq"
    assert job.status == "queued"
    assert job.auth_token is not None
    payload = decode_job_token(job.auth_token, purpose="video_export", job_id=job_id)
    assert payload["flight_id"] == "flight-test-001"
    assert enqueued_job_ids == ["job-rq"]


def test_start_video_export_manual_drain_rejection_creates_no_job(test_db, monkeypatch):
    enqueued_job_ids: list[str] = []
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)
    monkeypatch.setattr(video_export_manual, "_dependencies_ok", True)
    monkeypatch.setattr(video_export_manual.config, "JOB_QUEUE_BACKEND", "rq")
    monkeypatch.setattr(
        video_export_manual,
        "_enqueue_video_export_job_in_rq",
        lambda job_id: enqueued_job_ids.append(job_id),
    )
    deployment_drain.begin("deploy-123", "sha-abc", "https://github.example/runs/123")

    with pytest.raises(DeploymentDrainActive):
        video_export_manual.start_video_export_manual(
            flight_id="flight-test-001",
            frontend_url="http://frontend.test",
        )

    with test_db() as db_session:
        assert db_session.query(VideoExportJob).count() == 0
    assert enqueued_job_ids == []


def test_start_video_export_worker_enqueues_pending_jobs_with_rq(test_db, monkeypatch):
    enqueued_job_ids: list[str] = []
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)
    monkeypatch.setattr(video_export_manual.config, "JOB_QUEUE_BACKEND", "rq")
    monkeypatch.setattr(
        video_export_manual,
        "_enqueue_video_export_job_in_rq",
        lambda job_id: enqueued_job_ids.append(job_id),
    )

    db_session = test_db()
    db_session.add(
        VideoExportJob(
            id="job-pending-rq",
            flight_id="flight-test-001",
            status="queued",
            mode="manual",
            quality="1080p",
            fps=15,
            speed=1,
            progress=0,
            message="queued",
            frontend_url="http://localhost:5173",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    )
    db_session.commit()
    db_session.close()

    video_export_manual.start_video_export_worker()

    assert enqueued_job_ids == ["job-pending-rq"]


def test_worker_restart_immediately_recovers_active_job(test_db, monkeypatch):
    enqueued_job_ids: list[str] = []
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)
    monkeypatch.setattr(video_export_manual.config, "JOB_QUEUE_BACKEND", "rq")
    monkeypatch.setattr(
        video_export_manual,
        "_enqueue_video_export_job_in_rq",
        lambda job_id: enqueued_job_ids.append(job_id),
    )

    with test_db() as db_session:
        db_session.add(
            VideoExportJob(
                id="job-active-rq",
                flight_id="flight-test-001",
                status="capturing",
                mode="manual_fast",
                quality="1080p",
                fps=15,
                speed=1,
                progress=50,
                message="capturing",
                frontend_url="http://localhost:5173",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        )
        db_session.commit()

    assert video_export_manual.enqueue_pending_video_export_jobs(recover_active=True) == 1

    with test_db() as db_session:
        job = db_session.get(VideoExportJob, "job-active-rq")
        assert job is not None
        assert job.status == "queued"
        assert job.message == "Recovered after worker restart"
    assert enqueued_job_ids == ["job-active-rq"]


def test_process_video_export_job_runs_only_requested_queued_job(test_db, monkeypatch):
    processed_job_ids: list[str] = []
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)

    async def fake_export(job_id: str):
        processed_job_ids.append(job_id)

    monkeypatch.setattr(video_export_manual, "_export_video_manual_render", fake_export)

    db_session = test_db()
    db_session.add(
        VideoExportJob(
            id="job-process-rq",
            flight_id="flight-test-001",
            status="queued",
            mode="manual",
            quality="1080p",
            fps=15,
            speed=1,
            progress=0,
            message="queued",
            frontend_url="http://localhost:5173",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    )
    db_session.commit()
    db_session.close()

    video_export_manual.process_video_export_job("job-process-rq")

    db_session = test_db()
    job = db_session.query(VideoExportJob).filter(VideoExportJob.id == "job-process-rq").one()
    db_session.close()

    assert processed_job_ids == ["job-process-rq"]
    assert job.status == "running"


def test_first_missing_frame_index_returns_resume_point(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    (frames_dir / "frame00000.png").write_bytes(b"frame")
    (frames_dir / "frame00001.png").write_bytes(b"frame")
    (frames_dir / "frame00003.png").write_bytes(b"frame")

    assert video_export_manual._first_missing_frame_index(frames_dir, 5) == 2


def test_first_missing_frame_index_ignores_partial_frame(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    (frames_dir / "frame00000.png").write_bytes(b"complete")
    (frames_dir / "frame00001.png.part").write_bytes(b"partial")

    assert video_export_manual._first_missing_frame_index(frames_dir, 3) == 1


def test_job_temp_dir_for_export_uses_local_storage_for_new_job(tmp_path, monkeypatch):
    local_root = tmp_path / "local"
    legacy_root = tmp_path / "legacy"
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: local_root)
    monkeypatch.setattr(video_export_manual, "_video_legacy_temp_images_dir", lambda: legacy_root)

    assert video_export_manual._job_temp_dir_for_export("job-new") == local_root / "job-new"


def test_job_temp_dir_for_export_resumes_legacy_frames(tmp_path, monkeypatch):
    local_root = tmp_path / "local"
    legacy_root = tmp_path / "legacy"
    legacy_frames = legacy_root / "job-resume" / "frames"
    legacy_frames.mkdir(parents=True)
    (legacy_frames / "frame00000.png").write_bytes(b"frame")
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: local_root)
    monkeypatch.setattr(video_export_manual, "_video_legacy_temp_images_dir", lambda: legacy_root)

    assert video_export_manual._job_temp_dir_for_export("job-resume") == legacy_root / "job-resume"


def test_job_temp_dir_for_export_prefers_local_frames(tmp_path, monkeypatch):
    local_root = tmp_path / "local"
    legacy_root = tmp_path / "legacy"
    local_frames = local_root / "job-resume" / "frames"
    legacy_frames = legacy_root / "job-resume" / "frames"
    local_frames.mkdir(parents=True)
    legacy_frames.mkdir(parents=True)
    (local_frames / "frame00000.png").write_bytes(b"local")
    (legacy_frames / "frame00000.png").write_bytes(b"legacy")
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: local_root)
    monkeypatch.setattr(video_export_manual, "_video_legacy_temp_images_dir", lambda: legacy_root)

    assert video_export_manual._job_temp_dir_for_export("job-resume") == local_root / "job-resume"


def test_job_temp_dir_for_export_uses_longest_contiguous_capture(tmp_path, monkeypatch):
    local_root = tmp_path / "local"
    legacy_root = tmp_path / "legacy"
    local_frames = local_root / "job-resume" / "frames"
    legacy_frames = legacy_root / "job-resume" / "frames"
    local_frames.mkdir(parents=True)
    legacy_frames.mkdir(parents=True)
    (local_frames / "frame00000.png").write_bytes(b"local")
    (local_frames / "frame00010.png").write_bytes(b"local-gap")
    (legacy_frames / "frame00000.png").write_bytes(b"legacy-0")
    (legacy_frames / "frame00001.png").write_bytes(b"legacy-1")
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: local_root)
    monkeypatch.setattr(video_export_manual, "_video_legacy_temp_images_dir", lambda: legacy_root)

    assert video_export_manual._job_temp_dir_for_export("job-resume") == legacy_root / "job-resume"


def test_write_frame_file_atomic_publishes_complete_frame(tmp_path):
    frame_path = tmp_path / "frame00000.png"

    video_export_manual._write_frame_file_atomic(frame_path, b"png-frame")

    assert frame_path.read_bytes() == b"png-frame"
    assert not (tmp_path / "frame00000.png.part").exists()


def test_job_resume_info_requires_terminal_status_and_frames(tmp_path, monkeypatch):
    temp_root = tmp_path / "temp-images"
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: temp_root)
    frames_dir = temp_root / "job-cancelled" / "frames"
    frames_dir.mkdir(parents=True)
    (frames_dir / "frame00000.png").write_bytes(b"frame")
    job = VideoExportJob(
        id="job-cancelled",
        flight_id="flight-test-001",
        status="cancelled",
        total_frames=10,
    )

    resume_info = video_export_manual._job_resume_info(job)

    assert resume_info == {
        "can_resume": True,
        "frames_captured": 1,
        "resume_from_frame": 1,
    }


def test_resume_video_export_requeues_cancelled_job_with_frames(test_db, tmp_path, monkeypatch):
    job_id = "job-resume"
    enqueued_job_ids: list[str] = []
    temp_root = tmp_path / "temp-images"
    frames_dir = temp_root / job_id / "frames"
    frames_dir.mkdir(parents=True)
    (frames_dir / "frame00000.png").write_bytes(b"frame")
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: temp_root)
    monkeypatch.setattr(video_export_manual.config, "JOB_QUEUE_BACKEND", "rq")

    def enqueue_rq_job(queued_job_id: str) -> None:
        enqueued_job_ids.append(video_export_manual._rq_job_id(queued_job_id))

    monkeypatch.setattr(
        video_export_manual,
        "_enqueue_video_export_job_in_rq",
        enqueue_rq_job,
    )

    db_session = test_db()
    db_session.add(
        VideoExportJob(
            id=job_id,
            flight_id="flight-test-001",
            status="cancelled",
            mode="manual",
            quality="1080p",
            fps=15,
            speed=1,
            progress=10,
            total_frames=10,
            message="cancelled",
            frontend_url="http://localhost:5173",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            cancelled_at=datetime.utcnow(),
        )
    )
    db_session.commit()
    db_session.close()

    assert video_export_manual.resume_video_export(job_id, auth_token="resume-token") is True

    db_session = test_db()
    job = db_session.query(VideoExportJob).filter(VideoExportJob.id == job_id).one()
    assert job.status == "queued"
    assert job.auth_token is not None
    payload = decode_job_token(job.auth_token, purpose="video_export", job_id=job_id)
    assert payload["flight_id"] == "flight-test-001"
    assert job.cancelled_at is None
    assert job.error is None
    assert job.video_path is None
    db_session.close()
    assert enqueued_job_ids == ["video-export-job-resume"]


def test_resume_video_export_drain_rejection_preserves_cancelled_job(
    test_db, tmp_path, monkeypatch
):
    job_id = "job-resume-drain"
    enqueued_job_ids: list[str] = []
    frames_dir = tmp_path / "temp-images" / job_id / "frames"
    frames_dir.mkdir(parents=True)
    (frames_dir / "frame00000.png").write_bytes(b"frame")
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)
    monkeypatch.setattr(
        video_export_manual,
        "_video_temp_images_dir",
        lambda: tmp_path / "temp-images",
    )
    monkeypatch.setattr(video_export_manual.config, "JOB_QUEUE_BACKEND", "rq")
    monkeypatch.setattr(
        video_export_manual,
        "_enqueue_video_export_job_in_rq",
        lambda queued_job_id: enqueued_job_ids.append(queued_job_id),
    )

    with test_db() as db_session:
        db_session.add(
            VideoExportJob(
                id=job_id,
                flight_id="flight-test-001",
                status="cancelled",
                mode="manual",
                quality="1080p",
                fps=15,
                speed=1,
                progress=10,
                total_frames=10,
                message="cancelled",
                frontend_url="http://localhost:5173",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                cancelled_at=datetime.utcnow(),
            )
        )
        db_session.commit()

    deployment_drain.begin("deploy-123", "sha-abc", "https://github.example/runs/123")

    with pytest.raises(DeploymentDrainActive):
        video_export_manual.resume_video_export(job_id, auth_token="resume-token")

    with test_db() as db_session:
        job = db_session.get(VideoExportJob, job_id)
        assert job is not None
        assert job.status == "cancelled"
        assert job.cancelled_at is not None
    assert enqueued_job_ids == []


def test_resume_video_export_waits_for_running_cancel_to_finish(test_db, tmp_path, monkeypatch):
    job_id = "job-cancel-pending"
    temp_root = tmp_path / "temp-images"
    frames_dir = temp_root / job_id / "frames"
    frames_dir.mkdir(parents=True)
    (frames_dir / "frame00000.png").write_bytes(b"frame")
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: temp_root)
    monkeypatch.setattr(video_export_manual.config, "JOB_QUEUE_BACKEND", "thread")

    db_session = test_db()
    db_session.add(
        VideoExportJob(
            id=job_id,
            flight_id="flight-test-001",
            status="cancelled",
            mode="manual",
            quality="1080p",
            fps=15,
            speed=1,
            progress=10,
            total_frames=10,
            message="cancelled",
            frontend_url="http://localhost:5173",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            cancelled_at=datetime.utcnow(),
        )
    )
    db_session.commit()
    db_session.close()

    video_export_manual._set_job_cancel_requested(job_id)
    try:
        assert video_export_manual.resume_video_export(job_id, auth_token="resume-token") is False
    finally:
        video_export_manual._clear_job_cancel_requested(job_id)


def test_resume_video_export_clears_stale_api_cancel_flag_for_finished_rq_job(
    test_db, tmp_path, monkeypatch
):
    job_id = "job-stale-cancel-flag"
    enqueued_job_ids: list[str] = []
    temp_root = tmp_path / "temp-images"
    frames_dir = temp_root / job_id / "frames"
    frames_dir.mkdir(parents=True)
    (frames_dir / "frame00000.png").write_bytes(b"frame")
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: temp_root)
    monkeypatch.setattr(video_export_manual.config, "JOB_QUEUE_BACKEND", "rq")
    monkeypatch.setattr(
        video_export_manual, "_is_rq_video_export_job_started", lambda _job_id: False
    )

    def enqueue_rq_job(queued_job_id: str) -> None:
        enqueued_job_ids.append(video_export_manual._rq_job_id(queued_job_id))

    monkeypatch.setattr(
        video_export_manual,
        "_enqueue_video_export_job_in_rq",
        enqueue_rq_job,
    )

    db_session = test_db()
    db_session.add(
        VideoExportJob(
            id=job_id,
            flight_id="flight-test-001",
            status="cancelled",
            mode="manual_fast",
            quality="1080p",
            fps=15,
            speed=1,
            progress=70,
            total_frames=10,
            message="cancelled",
            frontend_url="http://backend:8001",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            cancelled_at=datetime.utcnow(),
        )
    )
    db_session.commit()
    db_session.close()

    video_export_manual._set_job_cancel_requested(job_id)
    assert video_export_manual.resume_video_export(job_id, auth_token="resume-token") is True

    assert video_export_manual._is_job_cancel_requested(job_id) is False
    assert enqueued_job_ids == ["video-export-job-stale-cancel-flag"]


def test_cancel_queued_video_export_removes_rq_job(test_db, monkeypatch):
    deleted_rq_jobs: list[str] = []
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)
    monkeypatch.setattr(
        video_export_manual,
        "_delete_rq_video_export_job",
        lambda job_id: deleted_rq_jobs.append(job_id) or True,
    )
    db_session = test_db()
    db_session.add(
        VideoExportJob(
            id="job-queued-cancel",
            flight_id="flight-test-001",
            status="queued",
            mode="manual",
            quality="1080p",
            fps=15,
            speed=1,
            progress=0,
            message="queued",
            frontend_url="http://localhost:5173",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    )
    db_session.commit()
    db_session.close()

    assert video_export_manual.cancel_video_export("job-queued-cancel") is True

    assert deleted_rq_jobs == ["job-queued-cancel"]


def test_delete_video_export_job_removes_started_rq_job(test_db, monkeypatch):
    deleted_rq_jobs: list[str] = []
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)
    monkeypatch.setattr(
        video_export_manual,
        "_delete_rq_video_export_job",
        lambda job_id: deleted_rq_jobs.append(job_id) or True,
    )

    db_session = test_db()
    db_session.add(
        VideoExportJob(
            id="job-running-started-rq",
            flight_id="flight-test-001",
            status="running",
            mode="manual",
            quality="1080p",
            fps=15,
            speed=1,
            progress=10,
            message="capturing",
            frontend_url="http://localhost:5173",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    )
    db_session.commit()
    db_session.close()

    result = video_export_manual.delete_video_export_job("job-running-started-rq")

    assert result is not None
    assert result["deleted"] is True
    assert deleted_rq_jobs == ["job-running-started-rq"]

    db_session = test_db()
    assert (
        db_session.query(VideoExportJob)
        .filter(VideoExportJob.id == "job-running-started-rq")
        .first()
        is None
    )
    db_session.close()


def test_reconcile_video_export_flight_refs_clears_missing_active_job(test_db, monkeypatch):
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)
    db_session = test_db()
    db_session.add(
        Flight(
            id="flight-orphan-video",
            flight_date=datetime.utcnow().date(),
            video_export_job_id="missing-job",
            video_export_status="processing",
        )
    )
    db_session.commit()
    db_session.close()

    assert video_export_manual.reconcile_video_export_flight_refs() == 1

    db_session = test_db()
    flight = db_session.get(Flight, "flight-orphan-video")
    assert flight is not None
    assert flight.video_export_job_id is None
    assert flight.video_export_status is None
    db_session.close()


def test_delete_video_export_job_clears_flight_reference(test_db, monkeypatch):
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)
    monkeypatch.setattr(video_export_manual, "_delete_rq_video_export_job", lambda _job_id: True)
    monkeypatch.setattr(
        video_export_manual,
        "cleanup_video_export_job_temp_files",
        lambda _job_id: {
            "files_deleted": 0,
            "dirs_deleted": 0,
            "bytes_deleted": 0,
            "paths_deleted": [],
            "errors": [],
        },
    )
    db_session = test_db()
    db_session.add(
        VideoExportJob(
            id="job-delete-clears-flight",
            flight_id="flight-delete-clears-job",
            status="failed",
            mode="manual",
            quality="1080p",
            fps=15,
            speed=1,
            progress=100,
            message="failed",
            frontend_url="http://localhost:5173",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    )
    db_session.add(
        Flight(
            id="flight-delete-clears-job",
            flight_date=datetime.utcnow().date(),
            video_export_job_id="job-delete-clears-flight",
            video_export_status="processing",
        )
    )
    db_session.commit()
    db_session.close()

    result = video_export_manual.delete_video_export_job("job-delete-clears-flight")

    assert result is not None
    assert result["deleted"] is True
    db_session = test_db()
    flight = db_session.get(Flight, "flight-delete-clears-job")
    assert flight is not None
    assert flight.video_export_job_id is None
    assert flight.video_export_status is None
    db_session.close()


def test_trigger_auto_export_uses_manual_fast(db_session, sample_flight, monkeypatch):
    sample_flight.gpx_file_path = "db/gpx/sample.gpx"
    db_session.commit()

    def fail_manual_export(**_kwargs):
        raise AssertionError("classic manual export should not be used")

    monkeypatch.setattr(video_export_manual, "start_video_export_manual", fail_manual_export)
    monkeypatch.setattr(
        video_export_manual,
        "start_video_export_manual_fast",
        lambda **_kwargs: "job-manual-fast",
    )

    job_id = video_export_manual.trigger_auto_export(
        sample_flight.id,
        db_session,
        frontend_url="http://frontend.test",
    )

    assert job_id == "job-manual-fast"


def test_start_video_export_worker_restarts_when_previous_worker_is_stopping(monkeypatch):
    class StoppingThread:
        joined = False

        def is_alive(self):
            return True

        def join(self, timeout=None):
            self.joined = True

    class StartedThread:
        def __init__(self, target, name, daemon):
            self.target = target
            self.name = name
            self.daemon = daemon
            self.started = False

        def start(self):
            self.started = True

        def is_alive(self):
            return self.started

    previous_thread = StoppingThread()
    monkeypatch.setattr(video_export_manual.config, "JOB_QUEUE_BACKEND", "thread")
    monkeypatch.setattr(video_export_manual, "_WORKER_THREAD", previous_thread)
    monkeypatch.setattr(video_export_manual, "_mark_stale_jobs_as_queued", lambda: None)
    monkeypatch.setattr(video_export_manual.threading, "Thread", StartedThread)
    video_export_manual._WORKER_STOP.set()

    try:
        video_export_manual.start_video_export_worker()

        assert previous_thread.joined is True
        assert video_export_manual._WORKER_STOP.is_set() is False
        assert isinstance(video_export_manual._WORKER_THREAD, StartedThread)
        assert video_export_manual._WORKER_THREAD.started is True
    finally:
        video_export_manual._WORKER_THREAD = None
        video_export_manual._WORKER_STOP.clear()


def test_cleanup_temp_dir_removes_nested_files(tmp_path):
    temp_dir = tmp_path / "temp-images" / "job-123"
    frames_dir = temp_dir / "frames"
    debug_dir = temp_dir / "debug"
    frames_dir.mkdir(parents=True)
    debug_dir.mkdir()
    (frames_dir / "frame00001.png").write_bytes(b"frame")
    (debug_dir / "playwright-debug.png").write_bytes(b"debug")

    video_export_manual._cleanup_temp_dir(temp_dir)

    assert not temp_dir.exists()


def test_cleanup_job_temp_dirs_removes_configured_and_legacy_dirs(tmp_path, monkeypatch):
    configured_root = tmp_path / "configured-temp"
    legacy_root = tmp_path / "legacy-temp"
    job_id = "job-123"
    for temp_root in (configured_root, legacy_root):
        frames_dir = temp_root / job_id / "frames"
        frames_dir.mkdir(parents=True)
        (frames_dir / "frame00001.png").write_bytes(b"frame")

    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: configured_root)
    monkeypatch.setattr(video_export_manual, "_video_legacy_temp_images_dir", lambda: legacy_root)

    video_export_manual._cleanup_job_temp_dirs(job_id)

    assert not (configured_root / job_id).exists()
    assert not (legacy_root / job_id).exists()


@pytest.mark.asyncio
async def test_manual_export_preserves_temp_frames_after_resumable_failure(tmp_path, monkeypatch):
    configured_root = tmp_path / "configured-temp"
    legacy_root = tmp_path / "legacy-temp"
    job_id = "job-failed"
    for temp_root in (configured_root, legacy_root):
        frames_dir = temp_root / job_id / "frames"
        frames_dir.mkdir(parents=True)
        (frames_dir / "frame00001.png").write_bytes(b"frame")

    job = SimpleNamespace(
        id=job_id,
        status="failed",
        total_frames=10,
        quality="1080p",
        fps=15,
        speed=1,
        mode="manual",
        flight_id="flight-test-001",
        frontend_url="http://localhost:5173",
        auth_token=None,
    )

    async def fail_preflight(_url):
        raise RuntimeError("preflight failed")

    monkeypatch.setattr(video_export_manual, "_get_job", lambda _job_id: job)
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: configured_root)
    monkeypatch.setattr(video_export_manual, "_video_legacy_temp_images_dir", lambda: legacy_root)
    monkeypatch.setattr(video_export_manual, "_ensure_export_viewer_reachable", fail_preflight)
    monkeypatch.setattr(video_export_manual, "_update_job", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(video_export_manual, "_set_job_runtime", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(video_export_manual, "_log_job", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(video_export_manual, "_clear_job_cancel_requested", lambda _job_id: None)
    monkeypatch.setattr(video_export_manual, "_clear_job_auth_token", lambda _job_id: None)

    await video_export_manual._export_video_manual_render(job_id)

    assert (configured_root / job_id).exists()
    assert (legacy_root / job_id).exists()


def test_cleanup_job_temp_dirs_removes_non_resumable_failure(tmp_path, monkeypatch):
    configured_root = tmp_path / "configured-temp"
    legacy_root = tmp_path / "legacy-temp"
    job_id = "job-failed-without-frames"
    temp_dir = configured_root / job_id
    temp_dir.mkdir(parents=True)
    (temp_dir / "encoding.mp4").write_bytes(b"partial video")
    job = SimpleNamespace(id=job_id, status="failed", total_frames=10)

    monkeypatch.setattr(video_export_manual, "_get_job", lambda _job_id: job)
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: configured_root)
    monkeypatch.setattr(video_export_manual, "_video_legacy_temp_images_dir", lambda: legacy_root)

    video_export_manual._cleanup_job_temp_dirs_unless_resumable(job_id)

    assert not temp_dir.exists()


def test_cleanup_job_temp_dirs_is_non_fatal_when_job_inspection_fails(monkeypatch):
    cleanup_calls: list[str] = []
    log_messages: list[str] = []

    def fail_job_lookup(_job_id):
        raise SQLAlchemyError("database unavailable")

    monkeypatch.setattr(video_export_manual, "_get_job", fail_job_lookup)
    monkeypatch.setattr(
        video_export_manual,
        "_cleanup_job_temp_dirs",
        lambda job_id: cleanup_calls.append(job_id),
    )
    monkeypatch.setattr(
        video_export_manual,
        "_log_job",
        lambda _job_id, message: log_messages.append(message),
    )

    video_export_manual._cleanup_job_temp_dirs_unless_resumable("job-123")

    assert cleanup_calls == []
    assert log_messages == [
        "Unable to inspect temporary video files for cleanup: database unavailable"
    ]


def test_stream_export_paths_use_configured_storage_dirs(tmp_path, monkeypatch):
    monkeypatch.setattr(video_export, "_video_export_dir", lambda: tmp_path / "videos")
    monkeypatch.setattr(video_export, "_video_temp_images_dir", lambda: tmp_path / "temp-images")
    monkeypatch.setattr(
        video_export,
        "get_video_output_path",
        lambda flight_id, timestamp: tmp_path / "videos" / f"flight-{flight_id}-{timestamp}.mp4",
    )

    export_root = video_export._video_export_dir()
    temp_root = video_export._video_temp_images_dir()
    temp_dir = video_export._job_temp_dir(temp_root, "job-123")
    debug_dir = video_export._job_debug_dir(temp_root, "job-123")
    output_path = video_export._video_output_path("flight-123", "20260430-120000")

    video_export._prepare_export_dirs(export_root, temp_dir, debug_dir)

    assert temp_dir == tmp_path / "temp-images" / "job-123"
    assert debug_dir == tmp_path / "temp-images" / "job-123" / "debug"
    assert output_path == tmp_path / "videos" / "flight-flight-123-20260430-120000.mp4"
    assert debug_dir.exists()
    assert (tmp_path / "videos").exists()


def test_stream_export_cleanup_removes_temp_dir_on_success(tmp_path):
    temp_dir = tmp_path / "temp-images" / "job-123"
    debug_dir = temp_dir / "debug"
    debug_dir.mkdir(parents=True)
    (debug_dir / "playwright-debug.png").write_bytes(b"debug")

    video_export._cleanup_temp_dir(temp_dir)

    assert not temp_dir.exists()


def test_stream_export_cleanup_removes_temp_dir_on_error(tmp_path):
    temp_dir = tmp_path / "temp-images" / "job-123"
    debug_dir = temp_dir / "debug"
    debug_dir.mkdir(parents=True)
    (debug_dir / "playwright-error.png").write_bytes(b"debug")

    try:
        raise RuntimeError("export failed")
    except RuntimeError:
        video_export._cleanup_temp_dir(temp_dir)

    assert not temp_dir.exists()


def test_cleanup_video_export_temp_files_uses_configured_temp_dir(tmp_path, monkeypatch):
    temp_root = tmp_path / "configured-temp-images"
    export_root = tmp_path / "configured-video-exports"
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: temp_root)
    monkeypatch.setattr(video_export_manual, "_video_legacy_temp_images_dir", lambda: temp_root)
    monkeypatch.setattr(video_export_manual, "_video_export_dir", lambda: export_root)

    inactive_temp_dir = temp_root / "job-failed"
    active_temp_dir = temp_root / "job-active"
    inactive_temp_dir.mkdir(parents=True)
    active_temp_dir.mkdir(parents=True)
    (inactive_temp_dir / "frame00001.png").write_bytes(b"frame")
    (active_temp_dir / "frame00001.png").write_bytes(b"frame")

    result = video_export_manual.cleanup_video_export_temp_files(
        [
            {"job_id": "job-failed", "internal_status": "failed"},
            {"job_id": "job-active", "internal_status": "capturing"},
        ]
    )

    assert result["files_deleted"] == 1
    assert not inactive_temp_dir.exists()
    assert active_temp_dir.exists()


def test_cleanup_video_export_temp_files_removes_configured_orphan_temp_dirs(tmp_path, monkeypatch):
    temp_root = tmp_path / "configured-temp-images"
    export_root = tmp_path / "configured-video-exports"
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: temp_root)
    monkeypatch.setattr(video_export_manual, "_video_legacy_temp_images_dir", lambda: temp_root)
    monkeypatch.setattr(video_export_manual, "_video_export_dir", lambda: export_root)

    orphan_temp_dir = temp_root / "8cd6dce7-885e-4385-bf7f-a10d1731dfeb"
    orphan_temp_dir.mkdir(parents=True)
    (orphan_temp_dir / "frame00001.png").write_bytes(b"frame")
    old_timestamp = time.time() - video_export_manual._ORPHAN_TEMP_CLEANUP_GRACE_SECONDS - 1
    os.utime(orphan_temp_dir, (old_timestamp, old_timestamp))

    result = video_export_manual.cleanup_video_export_temp_files([])

    assert result["files_deleted"] == 1
    assert not orphan_temp_dir.exists()


def test_cleanup_video_export_temp_files_ignores_non_job_directories(tmp_path, monkeypatch):
    temp_root = tmp_path / "configured-temp-images"
    export_root = tmp_path / "configured-video-exports"
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: temp_root)
    monkeypatch.setattr(video_export_manual, "_video_legacy_temp_images_dir", lambda: temp_root)
    monkeypatch.setattr(video_export_manual, "_video_export_dir", lambda: export_root)

    unrelated_dir = temp_root / "unrelated-data"
    unrelated_dir.mkdir(parents=True)
    (unrelated_dir / "important.txt").write_text("keep")
    old_timestamp = time.time() - video_export_manual._ORPHAN_TEMP_CLEANUP_GRACE_SECONDS - 1
    os.utime(unrelated_dir, (old_timestamp, old_timestamp))

    result = video_export_manual.cleanup_video_export_temp_files([])

    assert result["files_deleted"] == 0
    assert unrelated_dir.exists()


def test_cleanup_video_export_temp_files_keeps_fresh_orphan_temp_dirs(tmp_path, monkeypatch):
    temp_root = tmp_path / "configured-temp-images"
    export_root = tmp_path / "configured-video-exports"
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: temp_root)
    monkeypatch.setattr(video_export_manual, "_video_legacy_temp_images_dir", lambda: temp_root)
    monkeypatch.setattr(video_export_manual, "_video_export_dir", lambda: export_root)

    fresh_temp_dir = temp_root / "2604316d-86bf-4882-bb3b-bfdb6e8e6cd7"
    fresh_temp_dir.mkdir(parents=True)
    (fresh_temp_dir / "frame00001.png").write_bytes(b"frame")

    result = video_export_manual.cleanup_video_export_temp_files([])

    assert result["files_deleted"] == 0
    assert fresh_temp_dir.exists()


def test_cleanup_video_export_temp_files_removes_legacy_frames_for_inactive_job(
    tmp_path, monkeypatch
):
    temp_root = tmp_path / "configured-temp-images"
    export_root = tmp_path / "configured-video-exports"
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: temp_root)
    monkeypatch.setattr(video_export_manual, "_video_legacy_temp_images_dir", lambda: temp_root)
    monkeypatch.setattr(video_export_manual, "_video_export_dir", lambda: export_root)

    legacy_frames_dir = export_root / "frames_job-cancelled"
    legacy_frames_dir.mkdir(parents=True)
    (legacy_frames_dir / "frame00001.png").write_bytes(b"frame")

    result = video_export_manual.cleanup_video_export_temp_files(
        [{"job_id": "job-cancelled", "internal_status": "cancelled"}]
    )

    assert result["files_deleted"] == 1
    assert not legacy_frames_dir.exists()
