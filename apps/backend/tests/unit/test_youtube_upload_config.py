import pytest

import config


def test_youtube_upload_chunk_size_requires_256_kib_multiple(monkeypatch) -> None:
    monkeypatch.setenv("BACKEND_YOUTUBE_UPLOAD_CHUNK_SIZE", "307200")

    with pytest.raises(ValueError, match="multiple of 256 KiB"):
        config._youtube_upload_chunk_size()


def test_youtube_upload_chunk_size_accepts_default_multiple(monkeypatch) -> None:
    monkeypatch.setenv("BACKEND_YOUTUBE_UPLOAD_CHUNK_SIZE", str(8 * 1024 * 1024))

    assert config._youtube_upload_chunk_size() == 8 * 1024 * 1024
