"""Generate and cache short, low-resolution GoPro camera previews."""

from __future__ import annotations

import fcntl
import hashlib
import json
import logging
import math
import os
import subprocess
import threading
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Literal

import config
from deployment_drain import DeploymentDrainActive, job_admission
from video_acceleration import h264_encode_args, select_video_accelerator

logger = logging.getLogger(__name__)

PREVIEW_FILENAME = "camera.preview.mp4"
MANIFEST_FILENAME = ".camera.preview.json"
LOCK_FILENAME = ".camera.preview.lock"
STATE_LOCK_FILENAME = ".camera.preview.state.lock"
PROFILE_VERSION = 1

PreviewStatus = Literal["missing", "generating", "ready", "failed"]


@dataclass(frozen=True)
class SourceFingerprint:
    size: int
    mtime_ns: int


@dataclass(frozen=True)
class PreviewState:
    status: PreviewStatus
    available_duration_seconds: int
    requested_duration_seconds: int
    source_duration_seconds: float | None
    error: str | None = None


def _source_fingerprint(camera_path: Path) -> SourceFingerprint:
    stat = camera_path.stat()
    return SourceFingerprint(size=stat.st_size, mtime_ns=stat.st_mtime_ns)


def _preview_path(camera_path: Path) -> Path:
    return camera_path.with_name(PREVIEW_FILENAME)


def _manifest_path(camera_path: Path) -> Path:
    return camera_path.with_name(MANIFEST_FILENAME)


def _load_manifest(camera_path: Path) -> dict[str, Any]:
    try:
        value = json.loads(_manifest_path(camera_path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def _write_manifest(camera_path: Path, manifest: dict[str, Any]) -> None:
    manifest_path = _manifest_path(camera_path)
    temporary_path = manifest_path.with_suffix(
        f"{manifest_path.suffix}.{os.getpid()}.{threading.get_ident()}.tmp"
    )
    temporary_path.write_text(json.dumps(manifest, sort_keys=True), encoding="utf-8")
    temporary_path.replace(manifest_path)


def _manifest_matches_source(manifest: dict[str, Any], fingerprint: SourceFingerprint) -> bool:
    return manifest.get("profile_version") == PROFILE_VERSION and manifest.get("source") == asdict(
        fingerprint
    )


def _probe_duration(video_path: Path) -> float | None:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(video_path),
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
        duration = float(result.stdout.strip())
    except (FileNotFoundError, subprocess.SubprocessError, ValueError):
        return None
    return duration if result.returncode == 0 and duration > 0 else None


def _generation_is_active(manifest: dict[str, Any]) -> bool:
    if manifest.get("status") != "generating":
        return False
    started_at = float(manifest.get("generation_started_at") or 0)
    return time.time() - started_at < config.GOPRO_PREVIEW_TIMEOUT_SECONDS


def get_preview_state(camera_path: Path) -> PreviewState:
    fingerprint = _source_fingerprint(camera_path)
    manifest = _load_manifest(camera_path)
    if not _manifest_matches_source(manifest, fingerprint):
        return PreviewState("missing", 0, config.GOPRO_PREVIEW_DEFAULT_SECONDS, None)

    available = int(manifest.get("available_duration_seconds") or 0)
    requested = max(
        available,
        int(manifest.get("requested_duration_seconds") or config.GOPRO_PREVIEW_DEFAULT_SECONDS),
    )
    source_duration = manifest.get("source_duration_seconds")
    return PreviewState(
        status=(
            "generating"
            if _generation_is_active(manifest)
            else (
                "failed"
                if manifest.get("status") == "failed"
                else (
                    "ready" if available > 0 and _preview_path(camera_path).is_file() else "missing"
                )
            )
        ),
        available_duration_seconds=available,
        requested_duration_seconds=requested,
        source_duration_seconds=(float(source_duration) if source_duration is not None else None),
        error=str(manifest["error"]) if manifest.get("error") else None,
    )


def request_preview(camera_path: Path, duration_seconds: int) -> PreviewState:
    duration_seconds = max(
        config.GOPRO_PREVIEW_DEFAULT_SECONDS,
        min(duration_seconds, config.GOPRO_PREVIEW_MAX_SECONDS),
    )
    with _state_lock(camera_path):
        fingerprint = _source_fingerprint(camera_path)
        manifest = _load_manifest(camera_path)
        if not _manifest_matches_source(manifest, fingerprint):
            manifest = {
                "profile_version": PROFILE_VERSION,
                "source": asdict(fingerprint),
                "available_duration_seconds": 0,
            }

        available = int(manifest.get("available_duration_seconds") or 0)
        previous_requested = int(manifest.get("requested_duration_seconds") or 0)
        requested = max(duration_seconds, previous_requested)
        source_duration = manifest.get("source_duration_seconds")
        covers_source = source_duration is not None and available >= math.ceil(
            float(source_duration)
        )
        if (available >= requested or covers_source) and _preview_path(camera_path).is_file():
            return get_preview_state(camera_path)
        if _generation_is_active(manifest):
            if requested > previous_requested:
                manifest["requested_duration_seconds"] = requested
                _write_manifest(camera_path, manifest)
            return get_preview_state(camera_path)

        generation_id = uuid.uuid4().hex
        manifest.update(
            status="generating",
            requested_duration_seconds=requested,
            generation_started_at=time.time(),
            generation_id=generation_id,
            error=None,
        )
        _write_manifest(camera_path, manifest)
    try:
        _enqueue_preview(camera_path, fingerprint, requested, generation_id)
    except Exception as error:
        with _state_lock(camera_path):
            latest_manifest = _load_manifest(camera_path)
            if _generation_matches(latest_manifest, fingerprint, generation_id):
                latest_manifest.update(
                    status="failed",
                    generation_started_at=None,
                    error=str(error)[:1000],
                )
                _write_manifest(camera_path, latest_manifest)
        raise
    return get_preview_state(camera_path)


def _enqueue_preview(
    camera_path: Path,
    fingerprint: SourceFingerprint,
    duration_seconds: int,
    generation_id: str,
) -> None:
    digest = hashlib.sha256(
        (
            f"{camera_path}:{fingerprint.size}:{fingerprint.mtime_ns}:"
            f"{duration_seconds}:{generation_id}"
        ).encode()
    ).hexdigest()[:24]
    from job_queue import enqueue_once, is_rq_enabled

    if is_rq_enabled():
        enqueue_once(
            "gopro_preview_proxy.process_preview_job",
            str(camera_path),
            duration_seconds,
            generation_id,
            job_id=f"gopro-preview-{digest}",
            timeout=config.GOPRO_PREVIEW_TIMEOUT_SECONDS,
            queue_name=config.GOPRO_OVERLAY_QUEUE_NAME,
        )
        return

    if config.TESTING:
        return
    threading.Thread(
        target=process_preview_job,
        args=(str(camera_path), duration_seconds, generation_id),
        name=f"gopro-preview-{digest}",
        daemon=True,
    ).start()


@contextmanager
def _file_lock(lock_path: Path) -> Iterator[None]:
    with lock_path.open("a", encoding="utf-8") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)


def _preview_lock(camera_path: Path) -> Iterator[None]:
    return _file_lock(camera_path.with_name(LOCK_FILENAME))


def _state_lock(camera_path: Path) -> Iterator[None]:
    return _file_lock(camera_path.with_name(STATE_LOCK_FILENAME))


def _ffmpeg_command(
    camera_path: Path,
    output_path: Path,
    duration_seconds: int,
    accelerator: Literal["cpu", "nvidia"],
) -> list[str]:
    scale = (
        f"scale=w='min({config.GOPRO_PREVIEW_MAX_WIDTH},iw)':"
        f"h='min({config.GOPRO_PREVIEW_MAX_HEIGHT},ih)':"
        "force_original_aspect_ratio=decrease:force_divisible_by=2"
    )
    return [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(camera_path),
        "-t",
        str(duration_seconds),
        "-map",
        "0:v:0",
        "-vf",
        scale,
        *h264_encode_args(
            accelerator,
            quality=str(config.GOPRO_PREVIEW_QUALITY),
            cpu_preset="veryfast",
            include_audio=False,
        ),
        "-g",
        "30",
        "-movflags",
        "+faststart",
        str(output_path),
    ]


def _run_ffmpeg(camera_path: Path, output_path: Path, duration_seconds: int) -> None:
    selected = select_video_accelerator(config.VIDEO_ACCELERATOR)
    accelerators: list[Literal["cpu", "nvidia"]] = [selected]
    if selected == "nvidia":
        accelerators.append("cpu")
    last_error = "ffmpeg failed"
    for accelerator in accelerators:
        result = subprocess.run(
            _ffmpeg_command(camera_path, output_path, duration_seconds, accelerator),
            check=False,
            capture_output=True,
            text=True,
            timeout=config.GOPRO_PREVIEW_TIMEOUT_SECONDS,
        )
        if result.returncode == 0:
            return
        output_path.unlink(missing_ok=True)
        last_error = (result.stderr or last_error).strip()[-1000:]
    raise RuntimeError(last_error)


def _generation_matches(
    manifest: dict[str, Any], fingerprint: SourceFingerprint, generation_id: str
) -> bool:
    stored_generation_id = manifest.get("generation_id")
    return _manifest_matches_source(manifest, fingerprint) and (
        not stored_generation_id or stored_generation_id == generation_id
    )


def process_preview_job(
    camera_path_value: str, duration_seconds: int, generation_id: str | None = None
) -> None:
    camera_path = Path(camera_path_value)
    if not camera_path.is_file():
        return
    temporary_path = camera_path.with_name(f".{PREVIEW_FILENAME}.{os.getpid()}.part.mp4")
    follow_up_duration = 0
    with _preview_lock(camera_path):
        fingerprint = _source_fingerprint(camera_path)
        manifest = _load_manifest(camera_path)
        if not _manifest_matches_source(manifest, fingerprint):
            return
        generation_id = generation_id or str(manifest.get("generation_id") or "")
        if manifest.get("generation_id") and not _generation_matches(
            manifest, fingerprint, generation_id
        ):
            return
        requested = max(duration_seconds, int(manifest.get("requested_duration_seconds") or 0))
        available = int(manifest.get("available_duration_seconds") or 0)
        if available >= requested and _preview_path(camera_path).is_file():
            return
        try:
            with job_admission():
                source_duration = _probe_duration(camera_path)
                effective_duration = min(requested, max(1, math.ceil(source_duration or requested)))
                _run_ffmpeg(camera_path, temporary_path, effective_duration)
                proxy_duration = _probe_duration(temporary_path)
                if proxy_duration is None:
                    raise RuntimeError("Generated preview has no usable duration")
                published_duration = min(effective_duration, max(1, math.floor(proxy_duration)))
                with _state_lock(camera_path):
                    latest_manifest = _load_manifest(camera_path)
                    if _source_fingerprint(camera_path) != fingerprint or not _generation_matches(
                        latest_manifest, fingerprint, generation_id
                    ):
                        raise RuntimeError("Camera video changed during preview generation")
                    temporary_path.replace(_preview_path(camera_path))
                    if _source_fingerprint(camera_path) != fingerprint:
                        _preview_path(camera_path).unlink(missing_ok=True)
                        raise RuntimeError("Camera video changed while publishing preview")
                    latest_requested = int(
                        latest_manifest.get("requested_duration_seconds") or effective_duration
                    )
                    follow_up_duration = (
                        latest_requested if latest_requested > effective_duration else 0
                    )
                    latest_manifest.update(
                        status="ready",
                        available_duration_seconds=published_duration,
                        requested_duration_seconds=max(effective_duration, latest_requested),
                        source_duration_seconds=source_duration,
                        generation_started_at=None,
                        error=None,
                    )
                    manifest = latest_manifest
                    _write_manifest(camera_path, manifest)
        except DeploymentDrainActive:
            manifest.update(status="missing", generation_started_at=None, error=None)
        except Exception as error:
            logger.warning("GoPro preview generation failed for %s: %s", camera_path, error)
            manifest.update(status="failed", generation_started_at=None, error=str(error)[:1000])
        finally:
            temporary_path.unlink(missing_ok=True)
            if not _preview_path(camera_path).is_file() or manifest.get("status") != "ready":
                with _state_lock(camera_path):
                    latest_manifest = _load_manifest(camera_path)
                    if _generation_matches(latest_manifest, fingerprint, generation_id):
                        latest_manifest.update(
                            status=manifest.get("status", "failed"),
                            generation_started_at=None,
                            error=manifest.get("error"),
                        )
                        latest_manifest["requested_duration_seconds"] = max(
                            int(manifest.get("requested_duration_seconds") or 0),
                            int(latest_manifest.get("requested_duration_seconds") or 0),
                        )
                        manifest = latest_manifest
                        _write_manifest(camera_path, manifest)
    if follow_up_duration:
        request_preview(camera_path, follow_up_duration)


_STABILITY_OBSERVATIONS: dict[Path, tuple[SourceFingerprint, float]] = {}


def scan_for_gopro_previews() -> int:
    root = Path(config.GOPRO_OVERLAY_PARAGLIDING_ROOT)
    if not root.is_dir():
        return 0
    requested = 0
    observed_paths: set[Path] = set()
    for camera_path in root.glob("[0-9]" * 8 + "/[0-9][0-9]/camera.mp4"):
        try:
            observed_paths.add(camera_path)
            fingerprint = _source_fingerprint(camera_path)
            previous = _STABILITY_OBSERVATIONS.get(camera_path)
            now = time.monotonic()
            if previous is None or previous[0] != fingerprint:
                _STABILITY_OBSERVATIONS[camera_path] = (fingerprint, now)
                continue
            if now - previous[1] < config.GOPRO_PREVIEW_STABLE_SECONDS:
                continue
            state = get_preview_state(camera_path)
            covers_source = (
                state.source_duration_seconds is not None
                and state.available_duration_seconds >= math.ceil(state.source_duration_seconds)
            )
            if (
                state.available_duration_seconds < config.GOPRO_PREVIEW_DEFAULT_SECONDS
                and not covers_source
            ):
                request_preview(camera_path, config.GOPRO_PREVIEW_DEFAULT_SECONDS)
                requested += 1
        except OSError:
            continue
    for stale_path in _STABILITY_OBSERVATIONS.keys() - observed_paths:
        del _STABILITY_OBSERVATIONS[stale_path]
    return requested


_SCANNER_STOP = threading.Event()
_SCANNER_THREAD: threading.Thread | None = None


def _scanner_loop() -> None:
    while not _SCANNER_STOP.is_set():
        try:
            scan_for_gopro_previews()
        except Exception:
            logger.exception("Automatic GoPro preview scan failed")
        _SCANNER_STOP.wait(config.GOPRO_PREVIEW_SCAN_INTERVAL_SECONDS)


def start_preview_scanner() -> None:
    global _SCANNER_THREAD
    if not config.GOPRO_PREVIEW_ENABLED or (_SCANNER_THREAD and _SCANNER_THREAD.is_alive()):
        return
    _SCANNER_STOP.clear()
    _SCANNER_THREAD = threading.Thread(
        target=_scanner_loop, name="gopro-preview-scanner", daemon=True
    )
    _SCANNER_THREAD.start()


def stop_preview_scanner() -> None:
    _SCANNER_STOP.set()
    if _SCANNER_THREAD and _SCANNER_THREAD.is_alive():
        _SCANNER_THREAD.join(timeout=5)
