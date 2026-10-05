"""Generate and cache thumbnails for locally stored videos."""

from __future__ import annotations

import fcntl
import json
import os
import subprocess
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

PROFILE_VERSION = 1
THUMBNAIL_WIDTH = 640
THUMBNAIL_SEEK_SECONDS = 1
THUMBNAIL_TIMEOUT_SECONDS = 30


class VideoThumbnailError(RuntimeError):
    """Raised when FFmpeg cannot extract a usable thumbnail."""


def _thumbnail_path(video_path: Path) -> Path:
    return _thumbnail_directory(video_path) / f"{video_path.name}.thumbnail.jpg"


def _manifest_path(video_path: Path) -> Path:
    return _thumbnail_directory(video_path) / f"{video_path.name}.thumbnail.json"


def _lock_path(video_path: Path) -> Path:
    return _thumbnail_directory(video_path) / f"{video_path.name}.thumbnail.lock"


def _thumbnail_directory(video_path: Path) -> Path:
    return video_path.parent / "temp" / "thumbnails"


def _source_fingerprint(video_path: Path) -> dict[str, int]:
    stat = video_path.stat()
    return {"size": stat.st_size, "mtime_ns": stat.st_mtime_ns}


def _load_manifest(video_path: Path) -> dict[str, Any]:
    try:
        value = json.loads(_manifest_path(video_path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def _cache_is_current(video_path: Path, fingerprint: dict[str, int]) -> bool:
    thumbnail_path = _thumbnail_path(video_path)
    manifest = _load_manifest(video_path)
    return (
        thumbnail_path.is_file()
        and thumbnail_path.stat().st_size > 0
        and manifest.get("profile_version") == PROFILE_VERSION
        and manifest.get("source") == fingerprint
    )


@contextmanager
def _thumbnail_lock(video_path: Path) -> Iterator[None]:
    lock_path = _lock_path(video_path)
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a", encoding="utf-8") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)


def _ffmpeg_command(video_path: Path, output_path: Path, *, seek: bool) -> list[str]:
    return [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        *(["-ss", str(THUMBNAIL_SEEK_SECONDS)] if seek else []),
        "-i",
        str(video_path),
        "-frames:v",
        "1",
        "-vf",
        f"scale=w='min({THUMBNAIL_WIDTH},iw)':h=-2",
        "-q:v",
        "3",
        str(output_path),
    ]


def _extract_thumbnail(video_path: Path, output_path: Path) -> None:
    last_error = "FFmpeg failed to extract a video thumbnail"
    for seek in (True, False):
        try:
            output_path.unlink(missing_ok=True)
            result = subprocess.run(
                _ffmpeg_command(video_path, output_path, seek=seek),
                check=False,
                capture_output=True,
                text=True,
                timeout=THUMBNAIL_TIMEOUT_SECONDS,
            )
            if result.returncode == 0 and output_path.is_file() and output_path.stat().st_size > 0:
                return
            last_error = (result.stderr or last_error).strip()[-1000:]
        except (OSError, subprocess.SubprocessError, TimeoutError) as error:
            last_error = str(error)
    raise VideoThumbnailError(last_error)


def get_video_thumbnail(video_path: Path) -> Path:
    """Return a current cached thumbnail, generating it on first access."""
    if not video_path.is_file():
        raise FileNotFoundError(video_path)

    with _thumbnail_lock(video_path):
        fingerprint = _source_fingerprint(video_path)
        thumbnail_path = _thumbnail_path(video_path)
        if _cache_is_current(video_path, fingerprint):
            return thumbnail_path

        temporary_path = thumbnail_path.with_name(f"{thumbnail_path.name}.{os.getpid()}.part.jpg")
        manifest_path = _manifest_path(video_path)
        temporary_manifest_path = manifest_path.with_name(f"{manifest_path.name}.{os.getpid()}.tmp")
        try:
            _extract_thumbnail(video_path, temporary_path)
            temporary_path.replace(thumbnail_path)
            temporary_manifest_path.write_text(
                json.dumps(
                    {"profile_version": PROFILE_VERSION, "source": fingerprint},
                    sort_keys=True,
                ),
                encoding="utf-8",
            )
            temporary_manifest_path.replace(manifest_path)
        finally:
            temporary_path.unlink(missing_ok=True)
            temporary_manifest_path.unlink(missing_ok=True)
        return thumbnail_path
