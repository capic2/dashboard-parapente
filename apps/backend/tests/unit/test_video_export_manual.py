"""Unit tests for video export helpers."""

import os
import time
from datetime import datetime
from urllib.error import URLError

import pytest

from auth import create_access_token, create_job_token, decode_job_token
from models import VideoExportJob

import video_export
import video_export_manual


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


def test_capture_progress_percent_spans_capture_phase_range():
    assert video_export_manual._capture_progress_percent(0, 100) == 5
    assert video_export_manual._capture_progress_percent(50, 100) == 42
    assert video_export_manual._capture_progress_percent(100, 100) == 80


def test_parse_ffmpeg_out_time_seconds_parses_progress_lines():
    assert video_export_manual._parse_ffmpeg_out_time_seconds("out_time_ms=3000000") == 3.0
    assert video_export_manual._parse_ffmpeg_out_time_seconds("out_time_us=1500000") == 1.5
    assert video_export_manual._parse_ffmpeg_out_time_seconds("out_time=00:00:05.50") == 5.5
    assert video_export_manual._parse_ffmpeg_out_time_seconds("progress=continue") is None


def test_ffmpeg_encoding_settings_use_fast_preset_for_manual_fast():
    assert video_export_manual._ffmpeg_encoding_settings(True) == ("veryfast", "23")
    assert video_export_manual._ffmpeg_encoding_settings(False) == ("medium", "18")


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


def test_resume_video_export_waits_for_running_cancel_to_finish(test_db, tmp_path, monkeypatch):
    job_id = "job-cancel-pending"
    temp_root = tmp_path / "temp-images"
    frames_dir = temp_root / job_id / "frames"
    frames_dir.mkdir(parents=True)
    (frames_dir / "frame00000.png").write_bytes(b"frame")
    monkeypatch.setattr(video_export_manual, "SessionLocal", test_db)
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: temp_root)

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
    monkeypatch.setattr(video_export_manual, "_video_export_dir", lambda: export_root)

    orphan_temp_dir = temp_root / "orphan-job"
    orphan_temp_dir.mkdir(parents=True)
    (orphan_temp_dir / "frame00001.png").write_bytes(b"frame")
    old_timestamp = time.time() - video_export_manual._ORPHAN_TEMP_CLEANUP_GRACE_SECONDS - 1
    os.utime(orphan_temp_dir, (old_timestamp, old_timestamp))

    result = video_export_manual.cleanup_video_export_temp_files([])

    assert result["files_deleted"] == 1
    assert not orphan_temp_dir.exists()


def test_cleanup_video_export_temp_files_keeps_fresh_orphan_temp_dirs(tmp_path, monkeypatch):
    temp_root = tmp_path / "configured-temp-images"
    export_root = tmp_path / "configured-video-exports"
    monkeypatch.setattr(video_export_manual, "_video_temp_images_dir", lambda: temp_root)
    monkeypatch.setattr(video_export_manual, "_video_export_dir", lambda: export_root)

    fresh_temp_dir = temp_root / "fresh-job"
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
    monkeypatch.setattr(video_export_manual, "_video_export_dir", lambda: export_root)

    legacy_frames_dir = export_root / "frames_job-cancelled"
    legacy_frames_dir.mkdir(parents=True)
    (legacy_frames_dir / "frame00001.png").write_bytes(b"frame")

    result = video_export_manual.cleanup_video_export_temp_files(
        [{"job_id": "job-cancelled", "internal_status": "cancelled"}]
    )

    assert result["files_deleted"] == 1
    assert not legacy_frames_dir.exists()
