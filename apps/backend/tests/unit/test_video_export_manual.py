"""Unit tests for frontend URL resolution in manual video export."""

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


def test_job_auth_token_storage_roundtrip():
    job_id = "job-token-test"

    video_export_manual._set_job_auth_token(job_id, "token-xyz")
    assert video_export_manual._get_job_auth_token(job_id) == "token-xyz"

    video_export_manual._clear_job_auth_token(job_id)
    assert video_export_manual._get_job_auth_token(job_id) is None


def test_set_job_auth_token_removes_value_when_none():
    job_id = "job-token-none"

    video_export_manual._set_job_auth_token(job_id, "token-xyz")
    video_export_manual._set_job_auth_token(job_id, None)

    assert video_export_manual._get_job_auth_token(job_id) is None
