import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest

from video_thumbnail import VideoThumbnailError, get_video_thumbnail


def _successful_ffmpeg(command: list[str], **_kwargs: object) -> subprocess.CompletedProcess[str]:
    Path(command[-1]).write_bytes(b"jpeg")
    return subprocess.CompletedProcess(command, 0, "", "")


def test_get_video_thumbnail_generates_and_reuses_cache(tmp_path: Path) -> None:
    video_path = tmp_path / "flight.mp4"
    video_path.write_bytes(b"video")

    with patch("video_thumbnail.subprocess.run", side_effect=_successful_ffmpeg) as run:
        first = get_video_thumbnail(video_path)
        second = get_video_thumbnail(video_path)

    assert first == second
    assert first.read_bytes() == b"jpeg"
    run.assert_called_once()


def test_get_video_thumbnail_invalidates_cache_when_source_changes(tmp_path: Path) -> None:
    video_path = tmp_path / "flight.mp4"
    video_path.write_bytes(b"video")

    with patch("video_thumbnail.subprocess.run", side_effect=_successful_ffmpeg) as run:
        get_video_thumbnail(video_path)
        video_path.write_bytes(b"updated-video")
        get_video_thumbnail(video_path)

    assert run.call_count == 2


def test_get_video_thumbnail_retries_without_seek(tmp_path: Path) -> None:
    video_path = tmp_path / "short.mp4"
    video_path.write_bytes(b"video")

    def ffmpeg(command: list[str], **_kwargs: object) -> subprocess.CompletedProcess[str]:
        if "-ss" in command:
            return subprocess.CompletedProcess(command, 1, "", "no frame")
        Path(command[-1]).write_bytes(b"first-frame")
        return subprocess.CompletedProcess(command, 0, "", "")

    with patch("video_thumbnail.subprocess.run", side_effect=ffmpeg) as run:
        thumbnail_path = get_video_thumbnail(video_path)

    assert thumbnail_path.read_bytes() == b"first-frame"
    assert run.call_count == 2
    assert "-ss" not in run.call_args_list[1].args[0]


def test_get_video_thumbnail_wraps_permission_errors(tmp_path: Path) -> None:
    video_path = tmp_path / "flight.mp4"
    video_path.write_bytes(b"video")

    with (
        patch("video_thumbnail.subprocess.run", side_effect=PermissionError("denied")),
        pytest.raises(VideoThumbnailError, match="denied"),
    ):
        get_video_thumbnail(video_path)
