"""Background rendering for pano highlight jobs.

The first renderer provides a deterministic baseline. Its selection function is
intentionally isolated so a visual scorer can replace it without changing job
storage, timing alignment, or export semantics.
"""

from __future__ import annotations

import json
import logging
import subprocess
import threading
import time
import uuid
from datetime import datetime, timezone
from dataclasses import replace
from pathlib import Path
from collections.abc import Callable

import numpy as np

from database import SessionLocal
import config
from flight_storage import ensure_flight_directory
from flight_tracks import TrackPoint, normalize_track
from gopro_overlay_inputs import latest_matching_file, resolve_automatic_overlay_inputs
from highlight_video import HighlightClip, overlay_interval_for_clip
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

_ACTIVE_STATUSES = {STATUS_QUEUED, STATUS_RUNNING}

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
HIGHLIGHT_OVERLAY_WIDTH_RATIO = 0.28
HIGHLIGHT_OVERLAY_MARGIN_PX = 32


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


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
    source_width, source_height = _probe_video_dimensions(source_path)
    output_width = HIGHLIGHT_OUTPUT_WIDTH
    output_height = max(2, round(output_width * source_height / source_width))
    return output_width, output_height


def _configured_gpx_path(value: str | None) -> Path | None:
    if not value:
        return None
    path = Path(value)
    if path.is_absolute() or path.exists():
        return path
    return Path(__file__).parent / path


def _ensure_overlay_video(
    source_path: Path,
    configured_gpx_path: str | None,
    duration_seconds: float,
    output_dir: Path,
) -> Path | None:
    """Build a temporary telemetry overlay from raw camera inputs when needed."""
    camera_path = source_path.parent / "camera.mp4"
    # A flight directory may already contain the rendered GoPro view (the
    # ``Vol_du_*-4k.mp4`` export). Reuse it first so highlights get the exact
    # same parapente overlay layout instead of silently falling back to a
    # plain pano when the asynchronous overlay job is unavailable.
    existing_overlay = latest_matching_file(
        source_path.parent,
        "Vol_du*.mp4",
        (source_path, camera_path),
    )
    if existing_overlay and existing_overlay.is_file():
        logger.info("Highlight overlay reused from flight export: output=%s", existing_overlay)
        return existing_overlay
    if not camera_path.is_file():
        logger.info("Highlight overlay skipped: camera source is missing path=%s", camera_path)
        return None
    gpx_path, pip_path = resolve_automatic_overlay_inputs(
        source_path.parent,
        _configured_gpx_path(configured_gpx_path),
        source_path,
    )
    if gpx_path is None or not gpx_path.is_file() or pip_path is None or not pip_path.is_file():
        logger.info(
            "Highlight overlay skipped: inputs unavailable gpx=%s pip=%s",
            gpx_path or "none",
            pip_path or "none",
        )
        return None

    from gopro_overlay_export import create_gopro_overlay_job_from_paths, get_gopro_overlay_job

    output_path = output_dir / "camera-overlay.mp4"
    if output_path.is_file():
        logger.info("Highlight overlay reused: output=%s", output_path)
        return output_path
    logger.info(
        "Highlight overlay generation started: camera=%s gpx=%s pip=%s output=%s",
        camera_path,
        gpx_path,
        pip_path,
        output_path,
    )
    job = create_gopro_overlay_job_from_paths(
        video_path=camera_path,
        gpx_path=gpx_path,
        pip_path=pip_path,
        layout_id=None,
        output_filename=output_path.name,
        output_resolution="source",
        output_dir=str(output_dir),
        flight_id=None,
    )
    job_id = str(job["job_id"])
    deadline = time.monotonic() + config.JOB_QUEUE_TIMEOUT_SECONDS
    last_status: object = None
    while time.monotonic() < deadline:
        current = get_gopro_overlay_job(job_id)
        current_status = current.get("status") if current else None
        if current_status != last_status:
            logger.info(
                "Highlight overlay generation status: overlay_job_id=%s status=%s progress=%s message=%s",
                job_id,
                current_status or "missing",
                current.get("progress") if current else "unknown",
                current.get("message") if current else "unknown",
            )
            last_status = current_status
        if current and current.get("status") == "completed" and output_path.is_file():
            logger.info("Highlight overlay generation completed: overlay_job_id=%s", job_id)
            return output_path
        if current and current.get("status") in {"failed", "cancelled"}:
            raise RuntimeError(
                f"Overlay temporaire impossible: {current.get('error') or current.get('message')}"
            )
        time.sleep(1)
    raise TimeoutError("La génération de l'overlay temporaire a dépassé le délai autorisé")


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
) -> list[tuple[float, float]]:
    """Score low-resolution samples without decoding full-resolution frames in Python."""
    width, height = 320, 160
    frame_size = width * height
    samples: list[tuple[float, np.ndarray]] = []
    segment_starts = range(0, max(1, int(duration_seconds)), 30)
    total_segments = len(segment_starts)
    for segment_index, segment_start in enumerate(segment_starts, start=1):
        segment_duration = min(12, duration_seconds - segment_start)
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

    return takeoff, landing


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
) -> list[HighlightClip]:
    """Select visually detected phase changes and use telemetry for thermals."""
    if not visual_clips and not track_points:
        return []

    clip_length = min(8.0, max(3.0, duration_seconds / 8))

    def visual_phase_clip(category: str) -> HighlightClip | None:
        # The visual scorer provides the evidence. If it finds no candidate in
        # a phase window, leave that phase absent instead of inventing a fixed
        # timestamp (the camera may have started long before takeoff).
        if category == "takeoff":
            candidates = [
                clip for clip in visual_clips if clip.start_seconds <= duration_seconds * 0.5
            ]
            return min(candidates, key=lambda clip: clip.start_seconds) if candidates else None
        candidates = [clip for clip in visual_clips if clip.start_seconds >= duration_seconds * 0.5]
        return max(candidates, key=lambda clip: clip.start_seconds) if candidates else None

    selected: list[HighlightClip] = []
    phase_times = _flight_phase_times(track_points) if track_points else (None, None)
    takeoff_clip = visual_phase_clip("takeoff") if phase_times[0] is None else None
    if takeoff_clip:
        # The visual candidate usually scores the wing already overhead. Add
        # one clip length before it so the fallback includes the inflation and
        # the actual launch when the GPX starts after takeoff.
        takeoff_clip = replace(
            takeoff_clip,
            start_seconds=max(0.0, takeoff_clip.start_seconds - clip_length),
            category="takeoff",
        )
        selected.append(takeoff_clip)
    landing_clip = visual_phase_clip("landing") if phase_times[1] is None else None
    if landing_clip and (
        takeoff_clip is None or landing_clip.start_seconds != takeoff_clip.start_seconds
    ):
        selected.append(replace(landing_clip, category="landing"))

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
    track_duration = max(1.0, (timestamps[-1] - timestamps[0]) / 1000)

    def video_time(track_seconds: float) -> float:
        return min(duration_seconds, max(0.0, track_seconds / track_duration * duration_seconds))

    phases: list[tuple[str, float]] = []
    if phase_times[0] is not None:
        phases.append(("takeoff", phase_times[0]))
    if phase_times[1] is not None:
        phases.append(("landing", phase_times[1]))
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
        start = max(0.0, min(duration_seconds - clip_length, center - clip_length / 2))
        selected.append(HighlightClip(start, clip_length, 0.0, category))
    return fill_with_visual_clips()


def _render_clip(
    source_path: Path,
    output_path: Path,
    clip: HighlightClip,
    overlay_path: Path | None,
    overlay_offset_seconds: float,
    heartbeat_callback: Callable[[str], None] | None = None,
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
    ]
    overlay_interval = None
    if overlay_path and overlay_path.is_file():
        overlay_duration = _probe_duration(overlay_path)
        overlay_interval = overlay_interval_for_clip(
            clip, overlay_offset_seconds, overlay_duration
        )
        # Existing GoPro exports are rendered on the same flight timeline as
        # the pano. If an old database offset points outside that export,
        # falling back to the clip timestamp keeps the overlay visible instead
        # of silently switching to a pano-only render.
        clip_end_seconds = clip.start_seconds + clip.duration_seconds
        if overlay_interval is None and overlay_duration >= clip_end_seconds:
            overlay_interval = (clip.start_seconds, clip_end_seconds)
    if overlay_interval:
        overlay_start_seconds, _ = overlay_interval
        overlay_width = max(2, 2 * round(output_width * HIGHLIGHT_OVERLAY_WIDTH_RATIO / 2))
        command.extend(
            [
                "-ss",
                f"{overlay_start_seconds:.3f}",
                "-t",
                f"{clip.duration_seconds:.3f}",
                *hwaccel_args,
                "-i",
                str(overlay_path),
                "-filter_complex",
                (
                    f"[0:v]{pano_filter}[pano];"
                    f"[1:v]fps=30,scale=w={overlay_width}:h=-2[overlay];"
                    f"[pano][overlay]overlay=W-w-{HIGHLIGHT_OVERLAY_MARGIN_PX}:"
                    f"H-h-{HIGHLIGHT_OVERLAY_MARGIN_PX}:eof_action=pass[v]"
                ),
                "-map",
                "[v]",
            ]
        )
    else:
        command.extend(["-vf", pano_filter, "-map", "0:v:0"])
    command.extend(
        ["-map", "0:a?", "-shortest", "-t", f"{clip.duration_seconds:.3f}"]
    )
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
    with SessionLocal() as db:
        job = db.query(HighlightVideoJob).filter(HighlightVideoJob.id == job_id).first()
        if job is None:
            return
        for key, value in values.items():
            setattr(job, key, value)
        db.commit()


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


def _recover_active_jobs_after_worker_restart() -> int:
    """Make interrupted highlight jobs eligible for a fresh RQ execution."""
    now = _now()
    with SessionLocal() as db:
        recovered_count = (
            db.query(HighlightVideoJob)
            .filter(HighlightVideoJob.status.in_(_ACTIVE_STATUSES))
            .update(
                {
                    "status": STATUS_QUEUED,
                    "progress": 0,
                    "message": "Récupéré après le redémarrage du worker",
                    "error": None,
                    "started_at": None,
                    "updated_at": now,
                },
                synchronize_session=False,
            )
        )
        db.commit()
    return int(recovered_count)


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
    for job_id in job_ids:
        enqueue_highlight_video_job(job_id)
    return len(job_ids)


def process_highlight_video_job(job_id: str) -> None:
    """RQ target for a highlight render job."""
    started_monotonic = time.monotonic()
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
        overlay_path = Path(job.overlay_video_path) if job.overlay_video_path else None
        output_dir = ensure_flight_directory(db, flight) / "highlights" / job.id
        output_path = output_dir / "highlights-original-format.mp4"
        offset = float(job.overlay_offset_seconds or 0.0)
        db.commit()
        logger.info(
            "Highlight job running: job_id=%s flight_id=%s source=%s overlay=%s progress=5",
            job.id,
            flight.id,
            source_path,
            overlay_path or "none",
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
        if not overlay_path or not overlay_path.is_file():
            _set_job_stage(
                job_id,
                progress=6,
                stage="overlay",
                message="Préparation de l’overlay télémétrique",
            )
            overlay_path = _ensure_overlay_video(
                source_path,
                gpx_file_path,
                duration_seconds,
                output_dir,
            )
            logger.info(
                "Highlight overlay ready: job_id=%s overlay=%s",
                job_id,
                overlay_path or "none",
            )
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
        if gpx_path and not gpx_path.is_file():
            gpx_path = None
        if gpx_path:
            try:
                logger.info("Highlight GPX analysis started: job_id=%s gpx=%s", job_id, gpx_path)
                _normalized_gpx, track_points = normalize_track(
                    gpx_path.read_bytes(), gpx_path.suffix
                )
            except (OSError, ValueError) as exc:
                logger.warning("Unable to classify flight phases from GPX: %s", exc)
        clips = select_flight_event_clips(duration_seconds, track_points, visual_clips)
        logger.info(
            "Highlight clip selection complete: job_id=%s clips=%d categories=%s",
            job_id,
            len(clips),
            [clip.category for clip in clips],
        )
        if not clips:
            raise ValueError("La vidéo pano ne contient aucune durée exploitable")
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
        rendered: list[Path] = []
        for index, clip in enumerate(clips, start=1):
            if _is_cancelled(job_id):
                return
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
            clip_progress = 10 + (index - 1) * 12

            def render_heartbeat(
                message: str,
                *,
                current: int = clip_progress,
                segment: int = index,
                total: int = len(clips),
            ) -> None:
                nonlocal clip_progress
                clip_progress = min(current + 11, clip_progress + 1)
                _update_job(
                    job_id,
                    progress=clip_progress,
                    message=f"Clip {segment}/{total} — {message}",
                )

            _render_clip(source_path, target, clip, overlay_path, offset, render_heartbeat)
            rendered.append(target)
            if _is_cancelled(job_id):
                return
            _update_job(
                job_id,
                progress=min(90, 10 + index * 12),
                message=f"Rendu du clip {index}/{len(clips)}",
            )
            logger.info(
                "Highlight clip rendering complete: job_id=%s clip=%d/%d progress=%d output=%s",
                job_id,
                index,
                len(clips),
                min(90, 10 + index * 12),
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


def create_highlight_job_id() -> str:
    return f"highlight-{uuid.uuid4().hex}"
