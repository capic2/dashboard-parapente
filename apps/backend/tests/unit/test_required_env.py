from pathlib import Path

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
    data_root = Path(config.PARAGLIDING_DATA_ROOT)

    assert Path(config.VIDEO_EXPORT_DIR) == data_root
    assert Path(config.VIDEO_TEMP_IMAGES_DIR) == data_root / ".tmp" / "video-frames"


def test_gopro_overlay_paths_are_derived_from_paragliding_root():
    data_root = Path(config.PARAGLIDING_DATA_ROOT)

    assert Path(config.GOPRO_OVERLAY_PARAGLIDING_ROOT) == data_root
    assert Path(config.GOPRO_OVERLAY_OUTPUT_DIR) == data_root
    assert Path(config.GOPRO_OVERLAY_UPLOAD_DIR) == data_root / ".tmp" / "gopro-uploads"
