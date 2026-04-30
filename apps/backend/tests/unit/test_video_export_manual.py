"""Unit tests for frontend URL resolution in manual video export."""

from datetime import datetime

from models import VideoExportJob

import video_export_manual


def test_resolve_frontend_url_uses_backend_static_in_production(monkeypatch):
    """Production should avoid localhost:5173 when static frontend is bundled."""
    monkeypatch.setattr(video_export_manual.Path, "exists", lambda _self: True)
    monkeypatch.setattr(video_export_manual.config, "ENVIRONMENT", "production")
    monkeypatch.setattr(video_export_manual.config, "API_HOST", "0.0.0.0")
    monkeypatch.setattr(video_export_manual.config, "API_PORT", 8001)

    resolved = video_export_manual.resolve_frontend_url("http://localhost:5173")

    assert resolved == "http://localhost:8001"


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


def test_build_playwright_init_script_sets_export_mode_and_token():
    script = video_export_manual._build_playwright_init_script("abc123")

    assert "window._exportMode = 'manual_render'" in script
    assert "parapente-auth" in script
    assert '"abc123"' in script


def test_build_playwright_init_script_without_token_still_sets_export_mode():
    script = video_export_manual._build_playwright_init_script(None)

    assert "window._exportMode = 'manual_render'" in script
    assert "const token = null" in script


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


def test_encoding_progress_percent_spans_encoding_phase_range():
    assert video_export_manual._encoding_progress_percent(0, 100) == 80
    assert video_export_manual._encoding_progress_percent(50, 100) == 89
    assert video_export_manual._encoding_progress_percent(100, 100) == 99


def test_video_output_path_uses_configured_export_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(video_export_manual, "VIDEO_EXPORT_DIR", tmp_path / "videos")

    output_path = video_export_manual._video_output_path("flight-123", "20260430-120000")

    assert output_path == tmp_path / "videos" / "flight-flight-123-20260430-120000.mp4"


def test_job_frames_dir_uses_configured_temp_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(video_export_manual, "VIDEO_TEMP_IMAGES_DIR", tmp_path / "temp-images")

    frames_dir = video_export_manual._job_frames_dir("job-123")

    assert frames_dir == tmp_path / "temp-images" / "job-123" / "frames"


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
