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
from contextlib import AbstractContextManager, contextmanager
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
PROFILE_VERSION = 3

PreviewStatus = Literal["missing", "generating", "ready", "failed"]


@dataclass(frozen=True)
class SourceFingerprint:
    size: int
    mtime_ns: int


@dataclass(frozen=True)
class PreviewSegment:
    preview_start_seconds: float
    source_start_seconds: float
    duration_seconds: float


@dataclass(frozen=True)
class PreviewState:
    status: PreviewStatus
    available_duration_seconds: int
    requested_duration_seconds: int
    source_duration_seconds: float | None
    error: str | None = None
    target_end_seconds: float | None = None
    segments: tuple[PreviewSegment, ...] = ()


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
    try:
        temporary_path.write_text(json.dumps(manifest, sort_keys=True), encoding="utf-8")
        temporary_path.replace(manifest_path)
    finally:
        _unlink_temp_file(temporary_path)


def _manifest_matches_source(manifest: dict[str, Any], fingerprint: SourceFingerprint) -> bool:
    return manifest.get("profile_version") == PROFILE_VERSION and manifest.get("source") == asdict(
        fingerprint
    )


def _manifest_matches_target(manifest: dict[str, Any], target_end_seconds: float | None) -> bool:
    if target_end_seconds is None:
        return True
    stored_target = manifest.get("target_end_seconds")
    try:
        source_duration = manifest.get("source_duration_seconds")
        normalized_target = min(
            target_end_seconds,
            float(source_duration) if source_duration is not None else target_end_seconds,
        )
        return stored_target is not None and math.isclose(
            float(stored_target), normalized_target, rel_tol=0, abs_tol=1e-6
        )
    except (TypeError, ValueError):
        return False


def preview_segments(target_end_seconds: float, duration_seconds: int) -> list[PreviewSegment]:
    target_end_seconds = max(0.0, float(target_end_seconds))
    duration_seconds = max(0, duration_seconds)
    if target_end_seconds <= 0 or duration_seconds <= 0:
        return []
    if target_end_seconds <= 2 * duration_seconds:
        return [PreviewSegment(0.0, 0.0, target_end_seconds)]
    return [
        PreviewSegment(0.0, 0.0, float(duration_seconds)),
        PreviewSegment(
            float(duration_seconds),
            target_end_seconds - duration_seconds,
            float(duration_seconds),
        ),
    ]


def _manifest_segments(manifest: dict[str, Any]) -> tuple[PreviewSegment, ...]:
    try:
        return tuple(
            PreviewSegment(
                preview_start_seconds=float(segment["preview_start_seconds"]),
                source_start_seconds=float(segment["source_start_seconds"]),
                duration_seconds=float(segment["duration_seconds"]),
            )
            for segment in manifest.get("segments", [])
            if isinstance(segment, dict)
        )
    except (KeyError, TypeError, ValueError):
        return ()


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


def _has_audio_stream(video_path: Path) -> bool:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "a:0",
                "-show_entries",
                "stream=index",
                "-of",
                "csv=p=0",
                str(video_path),
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (FileNotFoundError, subprocess.SubprocessError, TimeoutError):
        return False
    return result.returncode == 0 and bool(result.stdout.strip())


def _unlink_temp_file(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.warning("Failed to delete temporary GoPro preview file %s", path, exc_info=True)


def _generation_is_active(manifest: dict[str, Any]) -> bool:
    if manifest.get("status") != "generating":
        return False
    started_at = float(manifest.get("generation_started_at") or 0)
    return time.time() - started_at < config.GOPRO_PREVIEW_TIMEOUT_SECONDS


def get_preview_state(camera_path: Path, target_end_seconds: float | None = None) -> PreviewState:
    fingerprint = _source_fingerprint(camera_path)
    manifest = _load_manifest(camera_path)
    if not _manifest_matches_source(manifest, fingerprint) or not _manifest_matches_target(
        manifest, target_end_seconds
    ):
        return PreviewState("missing", 0, config.GOPRO_PREVIEW_DEFAULT_SECONDS, None)

    available = int(manifest.get("available_duration_seconds") or 0)
    requested = max(
        available,
        int(manifest.get("requested_duration_seconds") or config.GOPRO_PREVIEW_DEFAULT_SECONDS),
    )
    source_duration = manifest.get("source_duration_seconds")
    stored_target = manifest.get("target_end_seconds")
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
        target_end_seconds=(float(stored_target) if stored_target is not None else None),
        segments=_manifest_segments(manifest),
    )


def request_preview(
    camera_path: Path, duration_seconds: int, target_end_seconds: float | None = None
) -> PreviewState:
    duration_seconds = max(
        config.GOPRO_PREVIEW_DEFAULT_SECONDS,
        min(duration_seconds, config.GOPRO_PREVIEW_MAX_SECONDS),
    )
    target_end_seconds = (
        max(0.0, float(target_end_seconds)) if target_end_seconds is not None else None
    )
    with _state_lock(camera_path):
        fingerprint = _source_fingerprint(camera_path)
        manifest = _load_manifest(camera_path)
        if not _manifest_matches_source(manifest, fingerprint) or not _manifest_matches_target(
            manifest, target_end_seconds
        ):
            manifest = {
                "profile_version": PROFILE_VERSION,
                "source": asdict(fingerprint),
                "available_duration_seconds": 0,
                "target_end_seconds": target_end_seconds,
            }

        available = int(manifest.get("available_duration_seconds") or 0)
        previous_requested = int(manifest.get("requested_duration_seconds") or 0)
        requested = max(duration_seconds, previous_requested)
        source_duration = manifest.get("source_duration_seconds")
        covers_source = source_duration is not None and available * 2 >= math.ceil(
            float(source_duration)
        )
        stored_target = manifest.get("target_end_seconds")
        covers_target = stored_target is not None and available * 2 >= math.ceil(
            float(stored_target)
        )
        if (available >= requested or covers_source or covers_target) and _preview_path(
            camera_path
        ).is_file():
            return get_preview_state(camera_path, target_end_seconds)
        if _generation_is_active(manifest):
            if requested > previous_requested:
                manifest["requested_duration_seconds"] = requested
                _write_manifest(camera_path, manifest)
            return get_preview_state(camera_path, target_end_seconds)

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
        _enqueue_preview(camera_path, fingerprint, requested, generation_id, target_end_seconds)
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
    return get_preview_state(camera_path, target_end_seconds)


def _enqueue_preview(
    camera_path: Path,
    fingerprint: SourceFingerprint,
    duration_seconds: int,
    generation_id: str,
    target_end_seconds: float | None = None,
) -> None:
    digest = hashlib.sha256(
        (
            f"{camera_path}:{fingerprint.size}:{fingerprint.mtime_ns}:"
            f"{duration_seconds}:{target_end_seconds}:{generation_id}"
        ).encode()
    ).hexdigest()[:24]
    from job_queue import enqueue_once, is_rq_enabled

    if is_rq_enabled():
        enqueue_once(
            "gopro_preview_proxy.process_preview_job",
            str(camera_path),
            duration_seconds,
            generation_id,
            target_end_seconds,
            job_id=f"gopro-preview-{digest}",
            timeout=config.GOPRO_PREVIEW_TIMEOUT_SECONDS,
            queue_name=config.GOPRO_PREVIEW_QUEUE_NAME,
        )
        return

    if config.TESTING:
        return
    threading.Thread(
        target=process_preview_job,
        args=(str(camera_path), duration_seconds, generation_id, target_end_seconds),
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


def _preview_lock(camera_path: Path) -> AbstractContextManager[None]:
    return _file_lock(camera_path.with_name(LOCK_FILENAME))


def _state_lock(camera_path: Path) -> AbstractContextManager[None]:
    return _file_lock(camera_path.with_name(STATE_LOCK_FILENAME))


def _ffmpeg_command(
    camera_path: Path,
    output_path: Path,
    segments: list[PreviewSegment] | int,
    accelerator: Literal["cpu", "nvidia"],
    include_audio: bool,
) -> list[str]:
    if isinstance(segments, int):
        segments = preview_segments(float(segments), segments)
    if not segments:
        raise ValueError("Preview requires at least one source segment")
    scale = (
        f"scale=w='min({config.GOPRO_PREVIEW_MAX_WIDTH},iw)':"
        f"h='min({config.GOPRO_PREVIEW_MAX_HEIGHT},ih)':"
        "force_original_aspect_ratio=decrease:force_divisible_by=2"
    )
    use_cuda = accelerator == "nvidia"
    input_args: list[str] = []
    filters: list[str] = []
    for index, segment in enumerate(segments):
        if segment.source_start_seconds > 0:
            input_args.extend(["-ss", f"{segment.source_start_seconds:g}"])
        if use_cuda:
            input_args.extend(["-hwaccel", "cuda", "-hwaccel_output_format", "cuda"])
        input_args.extend(["-i", str(camera_path)])
        video_label = "outv" if len(segments) == 1 else f"v{index}"
        video_scale = scale
        if use_cuda:
            video_scale = (
                f"scale_cuda=w={config.GOPRO_PREVIEW_MAX_WIDTH}:"
                f"h={config.GOPRO_PREVIEW_MAX_HEIGHT}:"
                "force_original_aspect_ratio=decrease:force_divisible_by=2:format=yuv420p,"
                "hwdownload,format=yuv420p"
            )
        filters.append(
            f"[{index}:v:0]trim=duration={segment.duration_seconds:g},"
            f"setpts=PTS-STARTPTS,{video_scale}[{video_label}]"
        )
        if include_audio:
            audio_label = "outa" if len(segments) == 1 else f"a{index}"
            filters.append(
                f"[{index}:a:0]atrim=duration={segment.duration_seconds:g},"
                f"asetpts=PTS-STARTPTS[{audio_label}]"
            )
    if len(segments) > 1:
        if include_audio:
            inputs = "".join(f"[v{index}][a{index}]" for index in range(len(segments)))
            filters.append(f"{inputs}concat=n={len(segments)}:v=1:a=1[outv][outa]")
        else:
            inputs = "".join(f"[v{index}]" for index in range(len(segments)))
            filters.append(f"{inputs}concat=n={len(segments)}:v=1:a=0[outv]")
    encode_args = h264_encode_args(
        accelerator,
        quality=str(config.GOPRO_PREVIEW_QUALITY),
        cpu_preset="veryfast",
        include_audio=False,
    )
    if include_audio:
        encode_args.remove("-an")
        encode_args.extend(["-c:a", "aac", "-b:a", "128k"])
    return [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        *input_args,
        "-filter_complex",
        ";".join(filters),
        "-map",
        "[outv]",
        *(["-map", "[outa]"] if include_audio else []),
        *encode_args,
        "-g",
        "30",
        "-movflags",
        "+faststart",
        str(output_path),
    ]


def _run_ffmpeg(camera_path: Path, output_path: Path, segments: list[PreviewSegment]) -> None:
    selected = select_video_accelerator(config.VIDEO_ACCELERATOR)
    include_audio = _has_audio_stream(camera_path)
    accelerators: list[Literal["cpu", "nvidia"]] = [selected]
    if selected == "nvidia":
        accelerators.append("cpu")
    last_error = "ffmpeg failed"
    for accelerator in accelerators:
        result = subprocess.run(
            _ffmpeg_command(camera_path, output_path, segments, accelerator, include_audio),
            check=False,
            capture_output=True,
            text=True,
            timeout=config.GOPRO_PREVIEW_TIMEOUT_SECONDS,
        )
        if result.returncode == 0:
            return
        _unlink_temp_file(output_path)
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
    camera_path_value: str,
    duration_seconds: int,
    generation_id: str | None = None,
    target_end_seconds: float | None = None,
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
        if target_end_seconds is None and manifest.get("target_end_seconds") is not None:
            target_end_seconds = float(manifest["target_end_seconds"])
        requested = max(duration_seconds, int(manifest.get("requested_duration_seconds") or 0))
        available = int(manifest.get("available_duration_seconds") or 0)
        if available >= requested and _preview_path(camera_path).is_file():
            return
        try:
            with job_admission():
                source_duration = _probe_duration(camera_path)
                effective_duration = min(requested, max(1, math.ceil(source_duration or requested)))
                effective_target = min(
                    source_duration or target_end_seconds or effective_duration,
                    (
                        target_end_seconds
                        if target_end_seconds is not None
                        else source_duration or effective_duration
                    ),
                )
                segments = preview_segments(effective_target, effective_duration)
                _run_ffmpeg(camera_path, temporary_path, segments)
                proxy_duration = _probe_duration(temporary_path)
                if proxy_duration is None:
                    raise RuntimeError("Generated preview has no usable duration")
                expected_proxy_duration = sum(segment.duration_seconds for segment in segments)
                planned_available_duration = min(
                    effective_duration,
                    max(segment.duration_seconds for segment in segments),
                )
                published_duration = max(
                    1,
                    math.floor(
                        planned_available_duration
                        * min(1.0, proxy_duration / expected_proxy_duration)
                    ),
                )
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
                        target_end_seconds=effective_target,
                        segments=[asdict(segment) for segment in segments],
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
            _unlink_temp_file(temporary_path)
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
        request_preview(camera_path, follow_up_duration, effective_target)


_STABILITY_OBSERVATIONS: dict[Path, tuple[SourceFingerprint, float]] = {}


def _cleanup_stale_preview_temp_files(camera_path: Path) -> None:
    cutoff = time.time() - config.GOPRO_PREVIEW_TIMEOUT_SECONDS
    patterns = (f".{PREVIEW_FILENAME}.*.part.mp4", f"{MANIFEST_FILENAME}.*.tmp")
    for pattern in patterns:
        for temporary_path in camera_path.parent.glob(pattern):
            try:
                if temporary_path.stat().st_mtime < cutoff:
                    _unlink_temp_file(temporary_path)
            except OSError:
                logger.warning(
                    "Failed to inspect temporary GoPro preview file %s",
                    temporary_path,
                    exc_info=True,
                )


def scan_for_gopro_previews() -> int:
    root = Path(config.GOPRO_OVERLAY_PARAGLIDING_ROOT)
    if not root.is_dir():
        return 0
    requested = 0
    observed_paths: set[Path] = set()
    for camera_path in root.glob("[0-9]" * 8 + "/[0-9][0-9]/camera.mp4"):
        try:
            _cleanup_stale_preview_temp_files(camera_path)
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
                and state.available_duration_seconds * 2 >= math.ceil(state.source_duration_seconds)
            )
            if (
                state.available_duration_seconds < config.GOPRO_PREVIEW_DEFAULT_SECONDS
                and not covers_source
            ):
                request_preview(camera_path, config.GOPRO_PREVIEW_DEFAULT_SECONDS)
                requested += 1
        except Exception:
            logger.warning("GoPro preview scan skipped %s", camera_path, exc_info=True)
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
