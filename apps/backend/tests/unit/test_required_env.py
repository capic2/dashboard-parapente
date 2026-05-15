import pytest

import config


def test_required_env_rejects_missing_variable(monkeypatch):
    monkeypatch.delenv("BACKEND_MISSING_PATH", raising=False)

    with pytest.raises(ValueError, match="BACKEND_MISSING_PATH environment variable is required"):
        config.required_env("BACKEND_MISSING_PATH")


def test_required_env_rejects_empty_variable(monkeypatch):
    monkeypatch.setenv("BACKEND_EMPTY_PATH", "   ")

    with pytest.raises(ValueError, match="BACKEND_EMPTY_PATH environment variable is required"):
        config.required_env("BACKEND_EMPTY_PATH")


def test_required_env_accepts_non_empty_variable(monkeypatch):
    monkeypatch.setenv("BACKEND_VALID_PATH", "  /valid/path  ")

    assert config.required_env("BACKEND_VALID_PATH") == "/valid/path"


def test_video_export_paths_are_fixed():
    assert config.VIDEO_EXPORT_DIR == str(config.BACKEND_ROOT / "exports" / "videos")
    assert config.VIDEO_TEMP_IMAGES_DIR == str(
        config.BACKEND_ROOT / "exports" / "video-temp-images"
    )
