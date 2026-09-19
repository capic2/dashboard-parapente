"""Background rendering for pano highlight jobs.

The first renderer provides a deterministic baseline. Its selection function is
intentionally isolated so a visual scorer can replace it without changing job
storage, timing alignment, or export semantics.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from dataclasses import replace
from pathlib import Path
from collections.abc import Callable

import numpy as np
from sqlalchemy.orm import Session

from database import SessionLocal
import config
from flight_storage import ensure_flight_directory
from flight_tracks import TrackPoint, normalize_track
from gopro_overlay_inputs import latest_matching_file, resolve_automatic_overlay_inputs
from highlight_video import HighlightClip
from models import Flight, HighlightVideoJob
from spots.distance import haversine_distance
from visual_event_detector import classify_motion_mask
from video_acceleration import h264_encode_args, select_video_accelerator

logger = logging.getLogger(__name__)

STATUS_QUEUED = "queued"
STATUS_RUNNING = "running"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"
STATUS_CANCELLED = "cancelled"
_TERMINAL_STATUSES = {STATUS_COMPLETED, STATUS_FAILED, STATUS_CANCELLED}

# A wider projection keeps the wing, pilot and landscape legible.  A narrower
# field of view tends to turn a 360° extract into an isolated, unclear detail.
# Cylindrical projection gives a genuinely wide view without the severe edge
# stretching caused by a rectilinear projection at the same field of view.
HIGHLIGHT_PROJECTION = "cylindrical"
HIGHLIGHT_HORIZONTAL_FOV_DEGREES = 160
HIGHLIGHT_PROJECTION_INPUT_SIZE = "3840:1920"
# Keep the worker responsive on CPU-only deployments; CRF 18 preserves detail
# without turning each 8-second clip into a multi-hour 4K render.
HIGHLIGHT_OUTPUT_WIDTH = 1920
HIGHLIGHT_OVERLAY_LAYOUT_ID = "parapente-3840"
# Phase clips must show context around the event: wing inflation before
# takeoff, and the final approach before touchdown.
HIGHLIGHT_EVENT_CLIP_LENGTH = 16.0
# A live render updates its durable job throughout analysis and every 15 seconds
# while ffmpeg is rendering. Five minutes tolerates slow storage and rolling
# deployments while still recovering a genuinely orphaned execution promptly.
HIGHLIGHT_JOB_LEASE_SECONDS = 300
_ACTIVE_EXECUTION_STARTED_AT: dict[str, datetime] = {}
_ACTIVE_EXECUTION_LOCK = threading.Lock()


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _render_method_for_accelerator(accelerator: str) -> str:
    return "gpu" if accelerator == "nvidia" else "cpu"


def _probe_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def _probe_video_dimensions(path: Path) -> tuple[int, int]:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=p=0:s=x",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    dimensions = [value for value in result.stdout.strip().split("x") if value]
    if len(dimensions) < 2:
        raise ValueError(f"Invalid video dimensions from ffprobe: {result.stdout!r}")
    width, height = (int(value) for value in dimensions[:2])
    return width, height


def _output_dimensions(source_path: Path) -> tuple[int, int]:
    _probe_video_dimensions(source_path)
    return HIGHLIGHT_OUTPUT_WIDTH, 1080


def _configured_gpx_path(value: str | None) -> Path | None:
    if not value:
        return None
    path = Path(value)
    if path.is_absolute() or path.exists():
        return path
    return Path(__file__).parent / path


def _existing_calibrated_gpx(source_path: Path, output_dir: Path) -> Path | None:
    """Find a completed GoPro calibration for this flight, excluding this job."""
    cache_dir = source_path.parent / ".tmp" / "gopro-overlay"
    if not cache_dir.is_dir():
        return None
    candidates = sorted(
        (
            path
            for path in cache_dir.glob("*/merged-gopro-overlay.gpx")
            if path.is_file() and path.parent != output_dir
        ),
        key=lambda path: (path.stat().st_mtime, path.name),
        reverse=True,
    )
    return candidates[0] if candidates else None


def _prepare_calibrated_highlight_gpx(
    source_path: Path,
    gpx_path: Path,
    output_dir: Path,
    *,
    gpx_offset: float,
    video_duration: float,
    heartbeat_callback: Callable[[], None] | None = None,
) -> Path:
    """Reuse the regular GoPro export OSV/GPX calibration for highlights."""
    cached_gpx = _existing_calibrated_gpx(source_path, output_dir)
    if cached_gpx is not None:
        logger.info("Reusing existing GoPro calibration GPX: %s", cached_gpx)
        return cached_gpx

    from gopro_overlay_export import _merge_osv_files_with_gpx

    osv_paths = sorted(
        (
            path
            for path in source_path.parent.iterdir()
            if path.is_file() and path.suffix.lower() == ".osv"
        ),
        key=lambda path: (path.stat().st_mtime, path.name),
    )
    if not osv_paths:
        raise ValueError("Le calage GoPro Overlay nécessite le fichier OSV du vol")

    heartbeat_stop = threading.Event()

    def heartbeat() -> None:
        if heartbeat_callback is None:
            return
        while not heartbeat_stop.wait(15):
            heartbeat_callback()

    if heartbeat_callback:
        heartbeat_callback()
        heartbeat_thread = threading.Thread(target=heartbeat, daemon=True)
        heartbeat_thread.start()
    else:
        heartbeat_thread = None
    try:
        return _merge_osv_files_with_gpx(
            osv_paths,
            gpx_path,
            output_dir,
            gpx_offset=gpx_offset,
            video_duration=video_duration,
            first_gpx_at=0.0,
        )
    finally:
        heartbeat_stop.set()
        if heartbeat_thread is not None:
            # Do not allow a final heartbeat to overwrite a later render
            # stage after the OSV merge has completed.
            heartbeat_thread.join()


def _source_timeline_start(source_path: Path, gpx_path: Path) -> datetime:
    """Resolve video time zero against the flight GPX without decoding the OSV."""
    from gopro_overlay_export import (
        align_video_start_time_to_gpx,
        first_gpx_timestamp,
        probe_video_start_time,
    )

    gpx_start = first_gpx_timestamp(gpx_path)
    if gpx_start is None:
        raise ValueError("Le fichier GPX ne contient aucun horodatage")
    osv_path = latest_matching_file(source_path.parent, "*.OSV", (source_path,))
    if osv_path is None:
        logger.warning("Highlight OSV source missing; aligning pano start to first GPX point")
        return gpx_start
    video_start = probe_video_start_time(osv_path)
    if video_start is None:
        logger.warning("Highlight OSV timestamp missing; aligning pano start to first GPX point")
        return gpx_start
    return align_video_start_time_to_gpx(video_start, gpx_start) or gpx_start


def _clip_creation_time(
    source_timeline_start: datetime,
    clip: HighlightClip,
    _legacy_overlay_offset_seconds: float = 0.0,
) -> datetime:
    """Timestamp a pano extract on its native OSV/GPX timeline.

    ``overlay_offset_seconds`` belongs to the legacy secondary-video overlay.
    Applying it here can move a clip completely outside the GPX time range.
    """
    return source_timeline_start + timedelta(seconds=clip.start_seconds)


def _clip_is_covered_by_gpx(
    source_timeline_start: datetime,
    clip: HighlightClip,
    track_points: list[TrackPoint],
) -> bool:
    """Return whether telemetry covers the complete source clip timeline."""
    timestamps = [
        int(point["timestamp"])
        for point in track_points
        if "timestamp" in point and int(point["timestamp"]) >= 0
    ]
    if not timestamps:
        return False
    clip_start = source_timeline_start + timedelta(seconds=clip.start_seconds)
    clip_end = clip_start + timedelta(seconds=clip.duration_seconds)
    gpx_start = datetime.fromtimestamp(min(timestamps) / 1000, tz=timezone.utc)
    gpx_end = datetime.fromtimestamp(max(timestamps) / 1000, tz=timezone.utc)
    return clip_start >= gpx_start and clip_end <= gpx_end


def _render_gopro_overlay(
    video_path: Path,
    gpx_path: Path,
    pip_path: Path | None,
    output_path: Path,
    progress_callback: Callable[[int, str], None] | None = None,
    cancellation_callback: Callable[[], bool] | None = None,
) -> bool:
    """Apply the real parapente telemetry layout directly to a video clip."""
    from gopro_overlay_export import (
        cancel_gopro_overlay_job,
        create_gopro_overlay_job_from_paths,
        get_gopro_overlay_job,
    )

    job = create_gopro_overlay_job_from_paths(
        video_path=video_path,
        gpx_path=gpx_path,
        pip_path=pip_path,
        layout_id=HIGHLIGHT_OVERLAY_LAYOUT_ID,
        output_filename=output_path.name,
        output_resolution="source",
        output_dir=str(output_path.parent),
        flight_id=None,
    )
    overlay_job_id = str(job["job_id"])
    deadline = time.monotonic() + config.JOB_QUEUE_TIMEOUT_SECONDS
    last_progress = -1
    while time.monotonic() < deadline:
        if cancellation_callback and cancellation_callback():
            cancel_gopro_overlay_job(overlay_job_id)
            return False
        current = get_gopro_overlay_job(overlay_job_id)
        status = current.get("status") if current else None
        progress = int(current.get("progress") or 0) if current else 0
        if progress != last_progress and progress_callback:
            progress_callback(progress, str((current or {}).get("message") or "Overlay GoPro"))
            last_progress = progress
        if status == "completed" and output_path.is_file():
            return True
        if status in {"failed", "cancelled"}:
            raise RuntimeError(
                f"Overlay GoPro impossible: {current.get('error') or current.get('message')}"
            )
        time.sleep(1)
    raise TimeoutError("La génération du véritable overlay GoPro a dépassé le délai autorisé")


def _create_overlay_timeline(path: Path, duration_seconds: float, creation_time: datetime) -> None:
    """Create a tiny dated video used only to define the complete overlay timeline."""
    timestamp = creation_time.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=16x16:r=30",
            "-t",
            f"{duration_seconds:.3f}",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-metadata",
            f"creation_time={timestamp}",
            str(path),
        ],
        check=True,
    )


def _render_full_flight_overlay(
    timeline_path: Path,
    gpx_path: Path,
    output_path: Path,
    output_size: tuple[int, int],
    progress_callback: Callable[[int, str], None] | None = None,
    cancellation_callback: Callable[[], bool] | None = None,
) -> bool:
    """Render one transparent overlay for the whole GPX timeline."""
    from gopro_overlay_export import (
        cancel_gopro_overlay_job,
        create_gopro_overlay_job_from_paths,
        get_gopro_overlay_job,
    )

    job = create_gopro_overlay_job_from_paths(
        video_path=timeline_path,
        gpx_path=gpx_path,
        pip_path=None,
        layout_id=HIGHLIGHT_OVERLAY_LAYOUT_ID,
        output_filename=output_path.name,
        output_resolution="source",
        output_dir=str(output_path.parent),
        flight_id=None,
        overlay_only=True,
        overlay_size=output_size,
    )
    overlay_job_id = str(job["job_id"])
    deadline = time.monotonic() + config.JOB_QUEUE_TIMEOUT_SECONDS
    last_progress = -1
    while time.monotonic() < deadline:
        if cancellation_callback and cancellation_callback():
            cancel_gopro_overlay_job(overlay_job_id)
            return False
        current = get_gopro_overlay_job(overlay_job_id)
        status = current.get("status") if current else None
        progress = int(current.get("progress") or 0) if current else 0
        if progress != last_progress and progress_callback:
            progress_callback(progress, str((current or {}).get("message") or "Overlay GoPro"))
            last_progress = progress
        if status == "completed" and output_path.is_file():
            return True
        if status in {"failed", "cancelled"}:
            raise RuntimeError(
                f"Overlay GoPro impossible: {current.get('error') or current.get('message')}"
            )
        time.sleep(1)
    raise TimeoutError("La génération de l'overlay GoPro complet a dépassé le délai autorisé")


def _compose_clip_with_full_overlay(
    video_path: Path, overlay_path: Path, clip: HighlightClip, output_path: Path
) -> None:
    """Composite the matching absolute overlay interval over a rendered pano clip."""
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-ss",
            f"{clip.start_seconds:.3f}",
            "-i",
            str(overlay_path),
            "-filter_complex",
            "[0:v][1:v]overlay=0:0:format=auto[v]",
            "-map",
            "[v]",
            "-map",
            "0:a?",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-crf",
            "18",
            "-c:a",
            "copy",
            "-shortest",
            str(output_path),
        ],
        check=True,
    )


def _normalise(values: list[float]) -> list[float]:
    if not values:
        return []
    low, high = np.percentile(values, [10, 90])
    if high <= low:
        return [0.5 for _ in values]
    return [float(np.clip((value - low) / (high - low), 0, 1)) for value in values]


def _frame_scores(
    source_path: Path,
    duration_seconds: float,
    progress_callback: Callable[[int, int], None] | None = None,
    analysis_windows: tuple[tuple[float, float], ...] | None = None,
) -> list[tuple[float, float]]:
    """Score low-resolution samples without decoding full-resolution frames in Python."""
    width, height = 320, 160
    frame_size = width * height
    samples: list[tuple[float, np.ndarray]] = []
    accelerator = select_video_accelerator(config.VIDEO_ACCELERATOR)
    hwaccel_args = ["-hwaccel", "cuda"] if accelerator == "nvidia" else []
    # The usual highlight search sparsely samples the whole flight.  Phase
    # detection instead supplies two continuous edge windows, because a
    # takeoff or landing can happen between those sparse samples.
    windows = analysis_windows or tuple(
        (float(segment_start), min(12.0, duration_seconds - segment_start))
        for segment_start in range(0, max(1, int(duration_seconds)), 30)
    )
    total_segments = len(windows)
    for segment_index, (segment_start, segment_duration) in enumerate(windows, start=1):
        if segment_duration <= 0:
            break
        logger.info(
            "Highlight analysis: scoring video segment start=%.1fs duration=%.1fs",
            segment_start,
            segment_duration,
        )
        result = subprocess.run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-skip_frame",
                "nokey",
                "-ss",
                str(segment_start),
                *hwaccel_args,
                "-i",
                str(source_path),
                "-t",
                str(segment_duration),
                "-vf",
                "fps=0.5,scale=320:160,format=gray",
                "-f",
                "rawvideo",
                "-pix_fmt",
                "gray",
                "pipe:1",
            ],
            check=True,
            capture_output=True,
        )
        frames = [
            np.frombuffer(result.stdout[index : index + frame_size], dtype=np.uint8).reshape(
                height, width
            )
            for index in range(0, len(result.stdout) - frame_size + 1, frame_size)
        ]
        samples.extend((segment_start + index * 2.0, frame) for index, frame in enumerate(frames))
        if progress_callback:
            progress_callback(segment_index, total_segments)
    if not samples:
        return []
    sharpness: list[float] = []
    motion: list[float] = []
    exposure: list[float] = []
    previous: np.ndarray | None = None
    previous_segment = -1
    for timestamp, frame in samples:
        segment = int(timestamp // 30)
        sharpness.append(float(np.abs(np.diff(frame.astype(np.int16), axis=1)).mean()))
        motion.append(
            0.0
            if previous is None or segment != previous_segment
            else float(np.abs(frame.astype(np.int16) - previous.astype(np.int16)).mean())
        )
        exposure.append(float(np.mean((frame > 18) & (frame < 238))))
        previous = frame
        previous_segment = segment
    scores = [
        0.45 * motion_score + 0.40 * sharpness_score + 0.15 * exposure_score
        for motion_score, sharpness_score, exposure_score in zip(
            _normalise(motion), _normalise(sharpness), _normalise(exposure), strict=True
        )
    ]
    return [
        (samples[index][0], score)
        for index, score in enumerate(scores)
        if samples[index][0] < duration_seconds
    ]


def _visual_phase_centers(source_path: Path, duration_seconds: float) -> tuple[float, float]:
    """Find launch and touchdown candidates from continuous edge-frame analysis.

    GPS timestamps describe the track, not necessarily the panorama timeline:
    cameras and GPS recorders may start or stop at different times.  The two
    flight phases are therefore selected from the source images themselves.
    """
    edge_window = min(duration_seconds * 0.35, 60.0)
    edge_window = max(0.0, edge_window)
    scores = _frame_scores(
        source_path,
        duration_seconds,
        analysis_windows=(
            (0.0, edge_window),
            (max(0.0, duration_seconds - edge_window), edge_window),
        ),
    )
    if not scores:
        return 0.0, max(0.0, duration_seconds)
    start_scores = [item for item in scores if item[0] <= edge_window]
    end_scores = [item for item in scores if item[0] >= duration_seconds - edge_window]
    takeoff = max(start_scores, key=lambda item: item[1])[0] if start_scores else 0.0
    landing = max(end_scores, key=lambda item: item[1])[0] if end_scores else duration_seconds
    return takeoff, landing


def _best_yaw(source_path: Path, clip: HighlightClip) -> float:
    """Pick the clearest wide view, avoiding the pilot and camera obstruction."""
    yaws = tuple(range(-180, 180, 45))
    branches = "".join(
        f"[a{index}]scale={HIGHLIGHT_PROJECTION_INPUT_SIZE}:flags=fast_bilinear,v360=input=e:output={HIGHLIGHT_PROJECTION}:yaw={yaw}:pitch=0:"
        f"h_fov={HIGHLIGHT_HORIZONTAL_FOV_DEGREES}:w=320:h=160[v{index}];"
        for index, yaw in enumerate(yaws)
    )
    layout = "|".join(f"{(index % 4) * 320}_{(index // 4) * 160}" for index in range(8))
    filter_value = (
        "[0:v]split=8"
        + "".join(f"[a{index}]" for index in range(8))
        + ";"
        + branches
        + f"[v0][v1][v2][v3][v4][v5][v6][v7]xstack=inputs=8:layout={layout},format=rgb24"
    )
    result = subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-ss",
            f"{clip.start_seconds + clip.duration_seconds / 2:.3f}",
            "-i",
            str(source_path),
            "-frames:v",
            "1",
            "-filter_complex",
            filter_value,
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "pipe:1",
        ],
        check=True,
        capture_output=True,
    )
    frame = np.frombuffer(result.stdout, dtype=np.uint8)
    scores: dict[int, float] = {}
    if frame.size == 1280 * 320 * 3:
        tiled = frame.reshape(320, 1280, 3).astype(np.float32)
        for index, yaw in enumerate(yaws):
            rgb = tiled[
                (index // 4) * 160 : (index // 4 + 1) * 160,
                (index % 4) * 320 : (index % 4 + 1) * 320,
            ]
            gray = rgb.mean(axis=2)
            lower = rgb[40:]
            red_wing = (
                (lower[:, :, 0] > lower[:, :, 1] * 1.25) & (lower[:, :, 0] > lower[:, :, 2] * 1.15)
            ).mean()
            saturated = ((lower.max(axis=2) - lower.min(axis=2)) > 45).mean()
            dark_foreground = (rgb.mean(axis=2) < 45).mean()
            skin = (
                (rgb[:, :, 0] > rgb[:, :, 1] * 1.12)
                & (rgb[:, :, 1] > rgb[:, :, 2] * 1.08)
                & (rgb[:, :, 0] > 60)
            )
            # A pilot can remain visible at the edge of a useful 160° view,
            # but a head/body covering the centre means the selected yaw is
            # unusable. Weight the centre more heavily instead of rejecting
            # every frame containing skin.
            centre_start = rgb.shape[1] // 5
            centre_end = rgb.shape[1] - centre_start
            centre_skin = skin[:, centre_start:centre_end].mean()
            skin_ratio = skin.mean()
            centre_dark = (gray[:, centre_start:centre_end] < 45).mean()
            foreground_obstruction = min(
                1.0,
                dark_foreground * 0.35
                + centre_dark * 1.35
                + centre_skin * 0.55
                + skin_ratio * 0.05,
            )
            sharpness = np.abs(np.diff(gray, axis=1)).mean()
            scores[yaw] = float(
                sharpness + red_wing * 1 + saturated * 3 - foreground_obstruction * 500
            )
    return float(max(scores, key=scores.get)) if scores else 0.0


def _gray_projection(source_path: Path, clip: HighlightClip, at_seconds: float) -> np.ndarray:
    filter_value = (
        f"scale={HIGHLIGHT_PROJECTION_INPUT_SIZE}:flags=fast_bilinear,v360=input=e:output={HIGHLIGHT_PROJECTION}:yaw={clip.yaw_degrees}:pitch=0:"
        f"h_fov={HIGHLIGHT_HORIZONTAL_FOV_DEGREES}:w=320:h=160,format=gray"
    )
    result = subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-ss",
            f"{at_seconds:.3f}",
            "-i",
            str(source_path),
            "-frames:v",
            "1",
            "-vf",
            filter_value,
            "-f",
            "rawvideo",
            "-pix_fmt",
            "gray",
            "pipe:1",
        ],
        check=True,
        capture_output=True,
    )
    return np.frombuffer(result.stdout, dtype=np.uint8).reshape(160, 320)


def classify_visual_clip(source_path: Path, clip: HighlightClip) -> HighlightClip:
    """Add visual categories without overriding GPX phase categories."""
    if clip.category in {"takeoff", "landing", "thermal"}:
        return clip
    try:
        previous = _gray_projection(source_path, clip, clip.start_seconds)
        current = _gray_projection(
            source_path, clip, clip.start_seconds + max(0.5, clip.duration_seconds - 0.5)
        )
        events = classify_motion_mask(previous, current)
    except (OSError, subprocess.CalledProcessError, ValueError) as exc:
        logger.warning("Unable to classify visual highlight at %.2fs: %s", clip.start_seconds, exc)
        return clip
    if any(event.category == "other_glider_candidate" for event in events):
        return replace(clip, category="other_glider_candidate")
    if any(event.category == "wing_movement" for event in events):
        return replace(clip, category="wing_movement")
    return clip


def _smoothed_track_elevations(track_points: list[TrackPoint]) -> list[float]:
    """Remove GPS altitude spikes while retaining the takeoff/landing trend."""
    elevations = np.asarray(
        [float(point.get("elevation", 0.0)) for point in track_points], dtype=np.float64
    )
    if elevations.size < 3:
        return elevations.tolist()
    # A median filter is enough here and avoids treating one bad GPS sample as
    # a phase change. Keep the window odd and small for short activities.
    window = min(9, elevations.size if elevations.size % 2 else elevations.size - 1)
    if window < 3:
        return elevations.tolist()
    half_window = window // 2
    padded = np.pad(elevations, (half_window, half_window), mode="edge")
    return [float(np.median(padded[index : index + window])) for index in range(elevations.size)]


def _horizontal_flight_phase_times(
    track_points: list[TrackPoint],
) -> tuple[float | None, float | None]:
    """Detect sustained ground-to-flight and flight-to-ground transitions."""
    samples = [
        point
        for point in track_points
        if all(key in point for key in ("timestamp", "lat", "lon")) and int(point["timestamp"]) >= 0
    ]
    if len(samples) < 3:
        return None, None

    start_timestamp = int(samples[0]["timestamp"])
    times = np.asarray(
        [(int(point["timestamp"]) - start_timestamp) / 1000 for point in samples],
        dtype=np.float64,
    )
    if times[-1] < 20:
        return None, None

    transition_window_seconds = min(8.0, max(4.0, float(times[-1]) / 40))

    def window_index(index: int, seconds: float) -> int:
        target = times[index] + seconds
        if seconds >= 0:
            return min(len(samples) - 1, int(np.searchsorted(times, target, side="left")))
        return max(0, int(np.searchsorted(times, target, side="right") - 1))

    def average_speed(start_index: int, end_index: int) -> float:
        elapsed = float(times[end_index] - times[start_index])
        if elapsed <= 0:
            return 0.0
        return (
            haversine_distance(
                samples[start_index]["lat"],
                samples[start_index]["lon"],
                samples[end_index]["lat"],
                samples[end_index]["lon"],
            )
            * 1000
            / elapsed
        )

    takeoff: float | None = None
    for index in range(1, len(samples) - 1):
        previous = window_index(index, -transition_window_seconds)
        following = window_index(index, transition_window_seconds)
        if following == index or times[following] - times[index] < transition_window_seconds * 0.8:
            continue
        if average_speed(previous, index) <= 1.5 and average_speed(index, following) >= 3.0:
            takeoff = float(times[index] + transition_window_seconds / 2)
            break

    landing: float | None = None
    for index in range(len(samples) // 2, len(samples) - 1):
        previous = window_index(index, -transition_window_seconds)
        following = window_index(index, transition_window_seconds)
        if following == index or times[following] - times[index] < transition_window_seconds * 0.8:
            continue
        if average_speed(previous, index) >= 3.0 and average_speed(index, following) <= 1.0:
            landing = float(times[index] + transition_window_seconds / 2)
            break

    return takeoff, landing


def _flight_phase_times(
    track_points: list[TrackPoint],
) -> tuple[float | None, float | None]:
    """Return takeoff and landing timestamps, in seconds from the track start.

    Takeoff is the first sustained climb after the initial altitude plateau.
    Landing is the end of the final sustained descent; a quiet altitude
    plateau after that descent is preferred when the recorder continued after
    touchdown.
    """
    samples = [
        (int(point.get("timestamp", 0)), elevation)
        for point, elevation in zip(
            track_points, _smoothed_track_elevations(track_points), strict=True
        )
        if "timestamp" in point and int(point["timestamp"]) >= 0
    ]
    if len(samples) < 3 or samples[-1][0] <= samples[0][0]:
        return None, None

    start_timestamp = samples[0][0]
    times = np.asarray([(timestamp - start_timestamp) / 1000 for timestamp, _ in samples])
    elevations = np.asarray([elevation for _, elevation in samples])
    track_duration = float(times[-1])
    window_seconds = min(30.0, max(10.0, track_duration / 12))

    def trend(index: int, direction: int) -> float | None:
        target = times[index] - window_seconds
        previous = np.searchsorted(times, target, side="right") - 1
        if previous < 0 or times[index] <= times[previous]:
            return None
        return (
            float((elevations[index] - elevations[previous]) / (times[index] - times[previous]))
            * direction
        )

    takeoff: float | None = None
    # Ignore a possible pre-flight GPS wobble and require several consecutive
    # climbing samples before calling it a takeoff.
    initial_window_end = min(60.0, track_duration * 0.2)
    initial_indices = np.searchsorted(times, initial_window_end, side="right")
    initial_plateau = float(np.ptp(elevations[: max(2, initial_indices)])) <= 25
    for index in range(1, len(samples)):
        if not initial_plateau or times[index] < initial_window_end:
            continue
        current_trend = trend(index, 1)
        if current_trend is None or current_trend < 0.12:
            continue
        following = [
            trend(next_index, 1) for next_index in range(index, min(len(samples), index + 4))
        ]
        if sum(value is not None and value >= 0.08 for value in following) >= 3:
            takeoff = float(times[index] - window_seconds / 2)
            break

    landing: float | None = None
    descent_indices = [
        index
        for index in range(1, len(samples))
        if (current_trend := trend(index, -1)) is not None and current_trend >= 0.08
    ]
    if descent_indices:
        descent_end = descent_indices[-1]
        # A barometric altitude sensor can keep drifting after touchdown. A
        # stable horizontal position is stronger evidence of the actual
        # landing than requiring the altitude to plateau, especially when the
        # watch keeps recording on the ground.
        stationary_window_seconds = min(10.0, max(6.0, track_duration / 18))
        for index in range(1, len(samples)):
            if times[index] < track_duration * 0.5:
                continue
            window_start = np.searchsorted(
                times, times[index] - stationary_window_seconds, side="left"
            )
            if window_start >= index:
                continue
            previous_point = track_points[window_start]
            current_point = track_points[index]
            if not all(key in previous_point and key in current_point for key in ("lat", "lon")):
                continue
            horizontal_distance_m = (
                haversine_distance(
                    previous_point["lat"],
                    previous_point["lon"],
                    current_point["lat"],
                    current_point["lon"],
                )
                * 1000
            )
            if horizontal_distance_m <= 20:
                preceding_descent = any(
                    descent_index <= index and times[index] - times[descent_index] <= 60
                    for descent_index in descent_indices
                )
                if preceding_descent:
                    landing = float(times[index] - stationary_window_seconds / 2)
                    break
    if landing is None and descent_indices:
        descent_end = descent_indices[-1]
        # Estimate touchdown halfway between the end of the descent trend and
        # the first stable post-landing point. Using the stable point itself
        # pushed the rendered clip past touchdown and hid the actual contact.
        landing = float(times[descent_end])
        for index in range(descent_end + 1, len(samples)):
            recent = elevations[descent_end : index + 1]
            if times[index] - times[descent_end] >= 8 and float(np.ptp(recent)) <= 8:
                landing = float(times[descent_end] + (times[index] - times[descent_end]) / 2)
                break

    horizontal_takeoff, horizontal_landing = _horizontal_flight_phase_times(track_points)
    return horizontal_takeoff or takeoff, horizontal_landing or landing


def _refine_visual_phase_time(
    source_path: Path,
    candidate_seconds: float,
    duration_seconds: float,
) -> float:
    """Refine a telemetry phase candidate using nearby full-panorama image motion."""
    radius_seconds = 4.0
    start_seconds = max(0.0, candidate_seconds - radius_seconds)
    end_seconds = min(duration_seconds, candidate_seconds + radius_seconds)
    sample_duration = end_seconds - start_seconds
    width, height = 320, 160
    frame_size = width * height
    if sample_duration < 2:
        return candidate_seconds
    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-skip_frame",
                "nokey",
                "-ss",
                f"{start_seconds:.3f}",
                "-i",
                str(source_path),
                "-t",
                f"{sample_duration:.3f}",
                "-vf",
                "fps=1,scale=320:160,format=gray",
                "-f",
                "rawvideo",
                "-pix_fmt",
                "gray",
                "pipe:1",
            ],
            check=True,
            capture_output=True,
        )
    except (OSError, subprocess.CalledProcessError):
        logger.exception("Unable to refine highlight phase visually at %.1fs", candidate_seconds)
        return candidate_seconds

    frames = [
        np.frombuffer(result.stdout[index : index + frame_size], dtype=np.uint8).reshape(
            height, width
        )
        for index in range(0, len(result.stdout) - frame_size + 1, frame_size)
    ]
    if len(frames) < 2:
        return candidate_seconds
    motion = [
        float(np.abs(current.astype(np.int16) - previous.astype(np.int16)).mean())
        for previous, current in zip(frames, frames[1:], strict=False)
    ]
    peak_index = int(np.argmax(motion)) + 1
    refined = start_seconds + peak_index
    return min(end_seconds, max(start_seconds, refined))


def select_highlight_clips(
    duration_seconds: float,
    source_path: Path | None = None,
    progress_callback: Callable[[int, int], None] | None = None,
) -> list[HighlightClip]:
    """Select high-interest windows using movement, sharpness and exposure."""
    if duration_seconds <= 0:
        return []
    clip_length = min(8.0, max(3.0, duration_seconds / 8))
    if source_path:
        scored = sorted(
            _frame_scores(source_path, duration_seconds, progress_callback),
            key=lambda item: item[1],
            reverse=True,
        )
        starts: list[float] = []
        for center, _score in scored:
            start = max(0.0, min(duration_seconds - clip_length, center - clip_length / 2))
            if all(abs(start - existing) >= clip_length * 2.5 for existing in starts):
                starts.append(start)
            if len(starts) == 4:
                break
        positions = tuple(sorted(starts))
    else:
        positions = tuple(duration_seconds * position for position in (0.12, 0.36, 0.62, 0.84))
    clips: list[HighlightClip] = []
    for position in positions:
        start = max(0.0, min(duration_seconds - clip_length, position))
        clips.append(HighlightClip(start, clip_length, 0.0, "dynamic"))
    return clips


def select_flight_event_clips(
    duration_seconds: float,
    track_points: list[TrackPoint] | None,
    visual_clips: list[HighlightClip],
    visual_phase_centers: tuple[float, float] | None = None,
) -> list[HighlightClip]:
    """Select visually detected phase changes and use telemetry for thermals."""
    if not visual_clips and not track_points:
        return []

    clip_length = min(8.0, max(3.0, duration_seconds / 8))

    selected: list[HighlightClip] = []
    event_clip_length = min(
        HIGHLIGHT_EVENT_CLIP_LENGTH,
        max(clip_length, duration_seconds),
    )
    takeoff_center, landing_center = visual_phase_centers or (0.0, duration_seconds)
    # Show the preparation/run before liftoff and the final approach before
    # touchdown instead of centring both events in generic symmetric windows.
    takeoff_context = event_clip_length * 0.75
    landing_context = event_clip_length * 0.875
    takeoff_clip = HighlightClip(
        max(0.0, min(duration_seconds - event_clip_length, takeoff_center - takeoff_context)),
        event_clip_length,
        0.0,
        "takeoff",
    )
    landing_clip = HighlightClip(
        max(0.0, min(duration_seconds - event_clip_length, landing_center - landing_context)),
        event_clip_length,
        0.0,
        "landing",
    )
    selected.extend((takeoff_clip, landing_clip))

    def fill_with_visual_clips() -> list[HighlightClip]:
        for clip in visual_clips:
            if len(selected) >= 6:
                break
            if all(
                abs(clip.start_seconds - chosen.start_seconds) > clip_length for chosen in selected
            ):
                selected.append(clip)
        return sorted(selected, key=lambda clip: clip.start_seconds)

    if not track_points:
        return fill_with_visual_clips()
    samples = [
        (point.get("timestamp", 0), point.get("elevation", 0.0))
        for point in track_points
        if "timestamp" in point and point["timestamp"] >= 0
    ]
    timestamps = [timestamp for timestamp, _elevation in samples]
    if len(samples) < 2:
        return fill_with_visual_clips()

    def video_time(track_seconds: float) -> float:
        return min(duration_seconds, max(0.0, track_seconds))

    phases: list[tuple[str, float]] = []
    elevations = [elevation for _timestamp, elevation in samples]
    climb_candidates: list[tuple[float, float]] = []
    for index in range(1, len(elevations)):
        target_timestamp = timestamps[index] - 30_000
        previous_index = next(
            (
                candidate
                for candidate in range(index - 1, -1, -1)
                if timestamps[candidate] <= target_timestamp
            ),
            None,
        )
        if previous_index is not None:
            elapsed = (timestamps[index] - timestamps[previous_index]) / 1000
            if elapsed > 0:
                climb_candidates.append(
                    ((elevations[index] - elevations[previous_index]) / elapsed, index)
                )
    if climb_candidates:
        _, best_index = max(climb_candidates)
        phases.append(("thermal", (timestamps[best_index] - timestamps[0]) / 1000))

    selected_categories = {clip.category for clip in selected}
    for category, position in phases:
        if category in selected_categories:
            continue
        center = video_time(position)
        start = max(
            0.0,
            min(duration_seconds - event_clip_length, center - event_clip_length / 2),
        )
        selected.append(HighlightClip(start, event_clip_length, 0.0, category))
    return fill_with_visual_clips()


def _render_clip(
    source_path: Path,
    output_path: Path,
    clip: HighlightClip,
    heartbeat_callback: Callable[[str], None] | None = None,
    creation_time: datetime | None = None,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_width, output_height = _output_dimensions(source_path)
    accelerator = select_video_accelerator(config.VIDEO_ACCELERATOR)
    hwaccel_args = ["-hwaccel", "cuda"] if accelerator == "nvidia" else []
    pano_filter = (
        f"scale={HIGHLIGHT_PROJECTION_INPUT_SIZE}:flags=fast_bilinear,v360=input=e:output={HIGHLIGHT_PROJECTION}:yaw={clip.yaw_degrees}:pitch=0:"
        f"h_fov={HIGHLIGHT_HORIZONTAL_FOV_DEGREES}:w={output_width}:h={output_height},setsar=1"
    )
    command = [
        "ffmpeg",
        "-y",
        "-ss",
        f"{clip.start_seconds:.3f}",
        *hwaccel_args,
        "-i",
        str(source_path),
        "-t",
        f"{clip.duration_seconds:.3f}",
        "-vf",
        pano_filter,
        "-map",
        "0:v:0",
    ]
    command.extend(["-map", "0:a?", "-shortest", "-t", f"{clip.duration_seconds:.3f}"])
    encode_args = h264_encode_args(
        accelerator,
        quality="18" if accelerator == "cpu" else "18",
        # Highlight clips are short and generated on the CPU in production;
        # ultrafast prevents an 8K pano projection from monopolising the worker.
        cpu_preset="ultrafast",
        include_audio=False,
        pixel_format="yuv420p",
    )[:-1]
    command.extend(
        [
            "-r",
            "30",
            *encode_args,
            "-aspect",
            f"{output_width}:{output_height}",
            "-metadata:s:v:0",
            "rotate=0",
        ]
    )
    if creation_time is not None:
        timestamp = creation_time.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        command.extend(
            [
                "-metadata",
                f"creation_time={timestamp}",
                "-metadata:s:v:0",
                f"creation_time={timestamp}",
            ]
        )
    command.extend(
        [
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
    )
    heartbeat_stop = threading.Event()
    render_started_at = time.monotonic()
    accelerator_label = "GPU" if accelerator == "nvidia" else "CPU"

    def log_render_heartbeat() -> None:
        while not heartbeat_stop.wait(15):
            size_mb = output_path.stat().st_size / (1024 * 1024) if output_path.exists() else 0
            logger.info(
                "Highlight clip rendering still active: mode=%s elapsed_s=%.0f output=%s size_mb=%.1f",
                accelerator_label,
                time.monotonic() - render_started_at,
                output_path,
                size_mb,
            )
            if heartbeat_callback:
                heartbeat_callback(
                    f"{accelerator_label} — {size_mb:.1f} Mo produits — "
                    f"{time.monotonic() - render_started_at:.0f}s"
                )

    heartbeat = threading.Thread(target=log_render_heartbeat, daemon=True)
    heartbeat.start()
    try:
        subprocess.run(command, check=True)
    finally:
        heartbeat_stop.set()
        heartbeat.join(timeout=1)


def _update_job(job_id: str, **values: object) -> None:
    with _ACTIVE_EXECUTION_LOCK:
        execution_started_at = _ACTIVE_EXECUTION_STARTED_AT.get(job_id)
    with SessionLocal() as db:
        query = db.query(HighlightVideoJob).filter(HighlightVideoJob.id == job_id)
        if execution_started_at is not None:
            query = query.filter(
                HighlightVideoJob.status == STATUS_RUNNING,
                HighlightVideoJob.started_at == execution_started_at,
            )
        job = query.first()
        if job is None:
            return
        for key, value in values.items():
            setattr(job, key, value)
        db.commit()


def cleanup_highlight_job_files(
    output_dir: Path,
    *,
    job_id: str,
    keep_output_path: Path | None = None,
) -> int:
    """Delete highlight intermediates while refusing paths outside the job directory."""
    if (
        output_dir.name != job_id
        or output_dir.parent.name != "highlights"
        or output_dir.is_symlink()
        or not output_dir.exists()
    ):
        if output_dir.exists():
            logger.warning("Refusing to clean unsafe highlight directory: %s", output_dir)
        return 0

    keep_path = keep_output_path.resolve() if keep_output_path else None
    deleted_files = 0
    for path in output_dir.iterdir():
        if keep_path is not None and path.resolve() == keep_path:
            continue
        try:
            if path.is_dir() and not path.is_symlink():
                deleted_files += sum(1 for candidate in path.rglob("*") if candidate.is_file())
                shutil.rmtree(path)
            else:
                path.unlink(missing_ok=True)
                deleted_files += 1
        except OSError:
            logger.exception("Failed to clean highlight temporary path %s", path)

    if keep_path is None:
        try:
            output_dir.rmdir()
        except OSError:
            logger.exception("Failed to remove empty highlight directory %s", output_dir)
    return deleted_files


def _terminal_status_for_execution(job_id: str, started_at: datetime) -> str | None:
    """Return terminal status only for the execution that still owns the job."""
    with SessionLocal() as db:
        status = (
            db.query(HighlightVideoJob.status)
            .filter(
                HighlightVideoJob.id == job_id,
                HighlightVideoJob.started_at == started_at,
                HighlightVideoJob.status.in_(_TERMINAL_STATUSES),
            )
            .scalar()
        )
    return str(status) if status else None


def _set_job_stage(job_id: str, *, progress: int, message: str, stage: str) -> None:
    """Persist and log a stage so slow background work is diagnosable."""
    _update_job(job_id, progress=progress, message=message)
    logger.info(
        "Highlight job stage: job_id=%s stage=%s progress=%d message=%s",
        job_id,
        stage,
        progress,
        message,
    )


def _is_cancelled(job_id: str) -> bool:
    with SessionLocal() as db:
        job = db.query(HighlightVideoJob).filter(HighlightVideoJob.id == job_id).first()
        return job is None or job.status == STATUS_CANCELLED


def _rq_job_id(job_id: str) -> str:
    return f"highlight-video-{job_id}"


def _enqueue_highlight_video_job_in_rq(job_id: str) -> None:
    from job_queue import enqueue_once

    enqueue_once(
        "highlight_video_worker.process_highlight_video_job",
        job_id,
        job_id=_rq_job_id(job_id),
        timeout=config.JOB_QUEUE_TIMEOUT_SECONDS,
        queue_name=config.HIGHLIGHT_QUEUE_NAME,
    )


def _queued_job_ids() -> list[str]:
    with SessionLocal() as db:
        jobs = (
            db.query(HighlightVideoJob.id)
            .filter(HighlightVideoJob.status == STATUS_QUEUED)
            .order_by(HighlightVideoJob.created_at)
            .all()
        )
    return [str(job_id) for (job_id,) in jobs]


def _recover_stale_running_job(
    db: Session,
    job_id: str,
    *,
    stale_before: datetime,
    recovered_at: datetime,
) -> bool:
    """Atomically recover one job only if its lease is still expired."""
    recovered = (
        db.query(HighlightVideoJob)
        .filter(
            HighlightVideoJob.id == job_id,
            HighlightVideoJob.status == STATUS_RUNNING,
            HighlightVideoJob.updated_at < stale_before,
        )
        .update(
            {
                "status": STATUS_QUEUED,
                "progress": 0,
                "message": "Récupéré après le redémarrage du worker",
                "error": None,
                "started_at": None,
                "updated_at": recovered_at,
            },
            synchronize_session=False,
        )
    )
    return recovered == 1


def _recover_active_jobs_after_worker_restart() -> list[str]:
    """Reset only running jobs whose durable heartbeat lease has expired."""
    now = _now()
    stale_before = now - timedelta(seconds=HIGHLIGHT_JOB_LEASE_SECONDS)
    with SessionLocal() as db:
        candidate_ids = [
            str(job_id)
            for (job_id,) in (
                db.query(HighlightVideoJob.id)
                .filter(
                    HighlightVideoJob.status == STATUS_RUNNING,
                    HighlightVideoJob.updated_at < stale_before,
                )
                .all()
            )
        ]
        recovered_ids = [
            job_id
            for job_id in candidate_ids
            if _recover_stale_running_job(
                db,
                job_id,
                stale_before=stale_before,
                recovered_at=now,
            )
        ]
        db.commit()
    return recovered_ids


def enqueue_highlight_video_job(job_id: str) -> bool:
    """Submit one durable highlight job to RQ when enabled."""
    from job_queue import is_rq_enabled

    if not is_rq_enabled():
        return False
    _enqueue_highlight_video_job_in_rq(job_id)
    return True


def enqueue_pending_highlight_video_jobs(*, recover_active: bool = False) -> int:
    """Enqueue durable highlight jobs after API or worker restarts."""
    from job_queue import is_rq_enabled

    if not is_rq_enabled():
        return 0
    if recover_active:
        _recover_active_jobs_after_worker_restart()
    job_ids = _queued_job_ids()
    if recover_active:
        from job_queue import delete_stale_started_job

        stale_before = _now() - timedelta(seconds=HIGHLIGHT_JOB_LEASE_SECONDS)
        for job_id in job_ids:
            # A database job can be queued while RQ still retains an interrupted
            # execution as started. Replace it only after its heartbeat expires.
            delete_stale_started_job(
                _rq_job_id(job_id),
                stale_before=stale_before,
                queue_name=config.HIGHLIGHT_QUEUE_NAME,
            )
    for job_id in job_ids:
        enqueue_highlight_video_job(job_id)
    return len(job_ids)


def process_highlight_video_job(job_id: str) -> None:
    """RQ target for a highlight render job."""
    started_monotonic = time.monotonic()
    render_method = _render_method_for_accelerator(
        select_video_accelerator(config.VIDEO_ACCELERATOR)
    )
    logger.info("Highlight job started: job_id=%s", job_id)
    with SessionLocal() as db:
        now = _now()
        claimed = (
            db.query(HighlightVideoJob)
            .filter(HighlightVideoJob.id == job_id, HighlightVideoJob.status == STATUS_QUEUED)
            .update(
                {
                    "status": STATUS_RUNNING,
                    "progress": 5,
                    "started_at": now,
                    "message": "Analyse de la vidéo pano (initialisation)",
                    "render_method": render_method,
                },
                synchronize_session=False,
            )
        )
        if claimed != 1:
            db.rollback()
            logger.info("Highlight job ignored: job_id=%s is no longer queued", job_id)
            return
        job = db.query(HighlightVideoJob).filter(HighlightVideoJob.id == job_id).first()
        if job is None:
            raise ValueError(f"Highlight job not found: {job_id}")
        flight = db.query(Flight).filter(Flight.id == job.flight_id).first()
        if flight is None:
            raise ValueError(f"Flight not found for highlight job: {job.flight_id}")
        source_path = Path(job.source_video_path)
        gpx_file_path = flight.gpx_file_path
        output_dir = ensure_flight_directory(db, flight) / "highlights" / job.id
        output_path = output_dir / "highlights-original-format.mp4"
        offset = float(job.overlay_offset_seconds or 0.0)
        db.commit()
        with _ACTIVE_EXECUTION_LOCK:
            _ACTIVE_EXECUTION_STARTED_AT[job_id] = now
        logger.info(
            "Highlight job running: job_id=%s flight_id=%s source=%s progress=5",
            job.id,
            flight.id,
            source_path,
        )

    try:
        _set_job_stage(
            job_id,
            progress=5,
            stage="probe_duration",
            message="Analyse de la vidéo pano (durée)",
        )
        duration_seconds = _probe_duration(source_path)
        output_width, output_height = _output_dimensions(source_path)
        logger.info(
            "Highlight video probed: job_id=%s duration=%.1fs output=%sx%s",
            job_id,
            duration_seconds,
            output_width,
            output_height,
        )
        output_dir.mkdir(parents=True, exist_ok=True)
        _set_job_stage(
            job_id,
            progress=10,
            stage="frame_scoring",
            message="Analyse des images pour sélectionner les meilleurs moments",
        )
        visual_clips = select_highlight_clips(
            duration_seconds,
            source_path,
            lambda completed, total: _update_job(
                job_id,
                progress=10 + round(completed * 20 / total),
                message=f"Analyse des images : segment {completed}/{total}",
            ),
        )
        logger.info(
            "Highlight visual selection complete: job_id=%s candidates=%d",
            job_id,
            len(visual_clips),
        )
        track_points: list[TrackPoint] | None = None
        gpx_path, _pip_path = resolve_automatic_overlay_inputs(
            source_path.parent,
            _configured_gpx_path(gpx_file_path),
            source_path,
        )
        # Best moments use the panoramic camera as the main image.  The flight
        # PIP is intentionally disabled here: it is a separate Cesium/flight
        # export, often with different timing and framing, and only distracts
        # from the selected scene.
        pip_path = None
        logger.info("Highlight PIP disabled: job_id=%s", job_id)
        if gpx_path and not gpx_path.is_file():
            gpx_path = None
        if gpx_path:
            try:
                calibration_started_at = time.monotonic()

                def gpx_calibration_heartbeat() -> None:
                    elapsed_seconds = max(0, round(time.monotonic() - calibration_started_at))
                    _update_job(
                        job_id,
                        progress=31,
                        message=(
                            "Calage GPX : fusion des fichiers OSV en cours "
                            f"({elapsed_seconds // 60} min {elapsed_seconds % 60:02d} s)"
                        ),
                    )

                _set_job_stage(
                    job_id,
                    progress=31,
                    stage="gpx_calibration",
                    message="Calage GPX : préparation de la fusion des fichiers OSV",
                )
                logger.info(
                    "Highlight GPX calibration started: job_id=%s gpx=%s offset=%.3f",
                    job_id,
                    gpx_path,
                    offset,
                )
                gpx_path = _prepare_calibrated_highlight_gpx(
                    source_path,
                    gpx_path,
                    output_dir,
                    gpx_offset=offset,
                    video_duration=duration_seconds,
                    heartbeat_callback=gpx_calibration_heartbeat,
                )
                logger.info("Highlight GPX analysis started: job_id=%s gpx=%s", job_id, gpx_path)
                _normalized_gpx, track_points = normalize_track(
                    gpx_path.read_bytes(), gpx_path.suffix
                )
            except (OSError, ValueError) as exc:
                logger.warning("Unable to classify flight phases from GPX: %s", exc)
        if gpx_path is None:
            raise ValueError("Le véritable overlay GoPro nécessite un fichier GPX")
        if pip_path is None or not pip_path.is_file():
            logger.warning(
                "Highlight PIP skipped: no flight video matching %s; overlay will contain telemetry only",
                source_path.parent,
            )
            pip_path = None
        if not track_points:
            raise ValueError("Le fichier GPX ne contient aucune télémétrie exploitable")
        from gopro_overlay_export import first_gpx_timestamp

        source_timeline_start = first_gpx_timestamp(gpx_path)
        if source_timeline_start is None:
            raise ValueError("Le GPX calé ne contient aucun horodatage")
        visual_clips = [
            clip
            for clip in visual_clips
            if _clip_is_covered_by_gpx(source_timeline_start, clip, track_points)
        ]
        # Track timestamps cannot be used as pano offsets: the camera and GPS
        # recorder may start and stop independently.  Use telemetry only for
        # diagnostics and thermal selection; launch and landing are detected
        # directly in the beginning and end images of this source video.
        telemetry_takeoff, telemetry_landing = _flight_phase_times(track_points)
        phase_centers = _visual_phase_centers(source_path, duration_seconds)
        logger.info(
            "Highlight phase detection: job_id=%s telemetry_takeoff=%s telemetry_landing=%s visual_takeoff=%.1f visual_landing=%.1f",
            job_id,
            telemetry_takeoff,
            telemetry_landing,
            phase_centers[0],
            phase_centers[1],
        )
        clips = select_flight_event_clips(
            duration_seconds,
            track_points,
            visual_clips,
            phase_centers,
        )
        clips = [
            clip
            for clip in clips
            # Preserve source-video takeoff/landing even when a tracker ended
            # a few seconds before the camera.  The calibrated full overlay
            # remains the source of telemetry frames for those clips.
            if clip.category in {"takeoff", "landing"}
            or _clip_is_covered_by_gpx(source_timeline_start, clip, track_points)
        ]
        logger.info(
            "Highlight clip selection complete: job_id=%s clips=%d categories=%s",
            job_id,
            len(clips),
            [clip.category for clip in clips],
        )
        if not clips:
            raise ValueError("Aucun meilleur moment ne recoupe entièrement la télémétrie GPX")
        classified_clips: list[HighlightClip] = []
        for index, clip in enumerate(clips, start=1):
            classified_clips.append(
                classify_visual_clip(
                    source_path, replace(clip, yaw_degrees=_best_yaw(source_path, clip))
                )
            )
            _update_job(
                job_id,
                progress=35 + round(index * 10 / len(clips)),
                message=f"Analyse des cadrages : clip {index}/{len(clips)}",
            )
        clips = classified_clips
        logger.info("Highlight viewpoints classified: job_id=%s clips=%d", job_id, len(clips))
        output_width, output_height = _output_dimensions(source_path)
        timeline_path = output_dir / "overlay-timeline.mp4"
        full_overlay_path = output_dir / "full-flight-overlay.mov"
        _create_overlay_timeline(timeline_path, duration_seconds, source_timeline_start)
        _set_job_stage(
            job_id,
            progress=45,
            stage="full_flight_overlay",
            message="Calcul du GoPro Overlay sur l'intégralité du vol",
        )

        def full_overlay_progress(progress: int, message: str) -> None:
            _update_job(
                job_id,
                progress=45 + round(progress * 10 / 100),
                message=f"GoPro Overlay complet : {message}",
            )

        if not _render_full_flight_overlay(
            timeline_path,
            gpx_path,
            full_overlay_path,
            (output_width, output_height),
            full_overlay_progress,
            lambda: _is_cancelled(job_id),
        ):
            return
        rendered: list[Path] = []
        for index, clip in enumerate(clips, start=1):
            if _is_cancelled(job_id):
                return
            raw_target = output_dir / f"clip-{index:02d}-pano.mp4"
            target = output_dir / f"clip-{index:02d}.mp4"
            logger.info(
                "Highlight clip rendering started: job_id=%s clip=%d/%d start=%.1fs duration=%.1fs yaw=%.0f category=%s",
                job_id,
                index,
                len(clips),
                clip.start_seconds,
                clip.duration_seconds,
                clip.yaw_degrees,
                clip.category,
            )
            clip_start_progress = 55 + round((index - 1) * 38 / len(clips))
            clip_end_progress = 55 + round(index * 38 / len(clips))
            clip_progress = clip_start_progress

            def render_heartbeat(
                message: str,
                *,
                final_render_progress: int = max(clip_start_progress, clip_end_progress - 3),
                segment: int = index,
                total: int = len(clips),
            ) -> None:
                nonlocal clip_progress
                clip_progress = min(final_render_progress, clip_progress + 1)
                _update_job(
                    job_id,
                    progress=clip_progress,
                    message=f"Clip {segment}/{total} — {message}",
                )

            clip_creation_time = _clip_creation_time(source_timeline_start, clip, offset)
            _render_clip(
                source_path,
                raw_target,
                clip,
                render_heartbeat,
                creation_time=clip_creation_time,
            )
            _update_job(
                job_id,
                progress=max(clip_progress, clip_end_progress - 3),
                message=f"Clip {index}/{len(clips)} — application du GoPro Overlay complet",
            )
            _compose_clip_with_full_overlay(raw_target, full_overlay_path, clip, target)
            rendered.append(target)
            if _is_cancelled(job_id):
                return
            _update_job(
                job_id,
                progress=clip_end_progress,
                message=f"Rendu du clip {index}/{len(clips)}",
            )
            logger.info(
                "Highlight clip rendering complete: job_id=%s clip=%d/%d progress=%d output=%s",
                job_id,
                index,
                len(clips),
                clip_end_progress,
                target,
            )

        if _is_cancelled(job_id):
            return
        concat_file = output_dir / "concat.txt"
        concat_file.write_text(
            "\n".join(f"file '{path.resolve()}'" for path in rendered) + "\n", encoding="utf-8"
        )
        _set_job_stage(
            job_id,
            progress=95,
            stage="concat",
            message="Assemblage des clips sélectionnés",
        )
        logger.info("Highlight concatenation started: job_id=%s clips=%d", job_id, len(rendered))
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_file),
                "-c",
                "copy",
                "-aspect",
                f"{output_width}:{output_height}",
                "-metadata:s:v:0",
                "rotate=0",
                "-movflags",
                "+faststart",
                str(output_path),
            ],
            check=True,
        )
        selection = [
            {
                "start_seconds": clip.start_seconds,
                "duration_seconds": clip.duration_seconds,
                "yaw_degrees": clip.yaw_degrees,
                "category": clip.category,
                "overlay_start_seconds": clip.overlay_start_seconds(offset),
            }
            for clip in clips
        ]
        _update_job(
            job_id,
            status=STATUS_COMPLETED,
            progress=100,
            message="Vidéo des meilleurs moments terminée",
            output_path=str(output_path),
            selection_json=json.dumps(selection),
            completed_at=_now(),
        )
        logger.info(
            "Highlight job completed: job_id=%s duration=%.1fs output=%s",
            job_id,
            time.monotonic() - started_monotonic,
            output_path,
        )
    except Exception as exc:
        logger.exception(
            "Highlight video job failed: job_id=%s elapsed=%.1fs",
            job_id,
            time.monotonic() - started_monotonic,
        )
        _update_job(
            job_id, status=STATUS_FAILED, progress=100, message="Échec du rendu", error=str(exc)
        )
    finally:
        try:
            terminal_status = _terminal_status_for_execution(job_id, now)
            if terminal_status is not None:
                cleanup_highlight_job_files(
                    output_dir,
                    job_id=job_id,
                    keep_output_path=output_path if terminal_status == STATUS_COMPLETED else None,
                )
        except Exception:
            logger.exception("Failed to clean highlight temporary files for job %s", job_id)
        with _ACTIVE_EXECUTION_LOCK:
            if _ACTIVE_EXECUTION_STARTED_AT.get(job_id) == now:
                _ACTIVE_EXECUTION_STARTED_AT.pop(job_id, None)


def create_highlight_job_id() -> str:
    return f"highlight-{uuid.uuid4().hex}"
