"""Background rendering for pano highlight jobs.

The first renderer provides a deterministic baseline. Its selection function is
intentionally isolated so a visual scorer can replace it without changing job
storage, timing alignment, or export semantics.
"""

from __future__ import annotations

import json
import logging
import subprocess
import time
import uuid
from datetime import datetime, timezone
from dataclasses import replace
from pathlib import Path

import numpy as np

from database import SessionLocal
import config
from flight_storage import ensure_flight_directory
from flight_tracks import TrackPoint, normalize_track
from gopro_overlay_inputs import resolve_automatic_overlay_inputs
from highlight_video import HighlightClip, overlay_interval_for_clip
from models import Flight, HighlightVideoJob
from visual_event_detector import classify_motion_mask
from video_acceleration import h264_encode_args, select_video_accelerator

logger = logging.getLogger(__name__)

STATUS_QUEUED = "queued"
STATUS_RUNNING = "running"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"
STATUS_CANCELLED = "cancelled"


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
    output_width = 1920
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
    if not camera_path.is_file():
        return None
    gpx_path, pip_path = resolve_automatic_overlay_inputs(
        source_path.parent,
        _configured_gpx_path(configured_gpx_path),
        source_path,
    )
    if gpx_path is None or not gpx_path.is_file() or pip_path is None or not pip_path.is_file():
        return None

    from gopro_overlay_export import create_gopro_overlay_job_from_paths, get_gopro_overlay_job

    output_path = output_dir / "camera-overlay.mp4"
    if output_path.is_file():
        return output_path
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
    while time.monotonic() < deadline:
        current = get_gopro_overlay_job(job_id)
        if current and current.get("status") == "completed" and output_path.is_file():
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


def _frame_scores(source_path: Path, duration_seconds: float) -> list[tuple[float, float]]:
    """Score low-resolution samples without decoding full-resolution frames in Python."""
    width, height = 320, 160
    frame_size = width * height
    samples: list[tuple[float, np.ndarray]] = []
    for segment_start in range(0, max(1, int(duration_seconds)), 30):
        segment_duration = min(12, duration_seconds - segment_start)
        if segment_duration <= 0:
            break
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
    """Pick a clear view that also contains likely paraglider colors/silhouette."""
    yaws = tuple(range(-180, 180, 45))
    branches = "".join(
        f"[a{index}]v360=input=e:output=rectilinear:yaw={yaw}:pitch=0:v_fov=80:w=160:h=284[v{index}];"
        for index, yaw in enumerate(yaws)
    )
    layout = "|".join(f"{(index % 4) * 160}_{(index // 4) * 284}" for index in range(8))
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
    if frame.size == 640 * 568 * 3:
        tiled = frame.reshape(568, 640, 3).astype(np.float32)
        for index, yaw in enumerate(yaws):
            rgb = tiled[
                (index // 4) * 284 : (index // 4 + 1) * 284,
                (index % 4) * 160 : (index % 4 + 1) * 160,
            ]
            gray = rgb.mean(axis=2)
            lower = rgb[70:]
            red_wing = (
                (lower[:, :, 0] > lower[:, :, 1] * 1.25) & (lower[:, :, 0] > lower[:, :, 2] * 1.15)
            ).mean()
            saturated = ((lower.max(axis=2) - lower.min(axis=2)) > 45).mean()
            dark_foreground = (rgb.mean(axis=2) < 45).mean()
            skin_foreground = (
                (rgb[:, :, 0] > rgb[:, :, 1] * 1.12)
                & (rgb[:, :, 1] > rgb[:, :, 2] * 1.08)
                & (rgb[:, :, 0] > 60)
            ).mean()
            foreground_obstruction = min(1.0, dark_foreground * 0.7 + skin_foreground)
            sharpness = np.abs(np.diff(gray, axis=1)).mean()
            scores[yaw] = float(
                sharpness + red_wing * 20 + saturated * 8 - foreground_obstruction * 120
            )
    return float(max(scores, key=scores.get)) if scores else 0.0


def _gray_projection(source_path: Path, clip: HighlightClip, at_seconds: float) -> np.ndarray:
    filter_value = (
        f"v360=input=e:output=rectilinear:yaw={clip.yaw_degrees}:pitch=0:"
        "v_fov=80:w=320:h=568,format=gray"
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
    return np.frombuffer(result.stdout, dtype=np.uint8).reshape(568, 320)


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


def select_highlight_clips(
    duration_seconds: float, source_path: Path | None = None
) -> list[HighlightClip]:
    """Select high-interest windows using movement, sharpness and exposure."""
    if duration_seconds <= 0:
        return []
    clip_length = min(8.0, max(3.0, duration_seconds / 8))
    if source_path:
        scored = sorted(
            _frame_scores(source_path, duration_seconds), key=lambda item: item[1], reverse=True
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
    """Guarantee flight phases while filling remaining slots with visual highlights."""
    if not track_points:
        return visual_clips
    samples = [
        (point.get("timestamp", 0), point.get("elevation", 0.0))
        for point in track_points
        if point.get("timestamp", 0)
    ]
    timestamps = [timestamp for timestamp, _elevation in samples]
    if len(samples) < 2:
        return visual_clips
    track_duration = max(1.0, (timestamps[-1] - timestamps[0]) / 1000)

    def video_time(track_seconds: float) -> float:
        return min(duration_seconds, max(0.0, track_seconds / track_duration * duration_seconds))

    clip_length = min(8.0, max(3.0, duration_seconds / 8))
    # The first useful visual movement is a better takeoff anchor than the
    # first GPS sample: cameras often keep recording while the wing is being
    # prepared. Keep a little lead-in so the inflation is visible.
    early_visual = [clip for clip in visual_clips if clip.start_seconds <= duration_seconds * 0.25]
    takeoff_anchor = (
        min(
            early_visual,
            key=lambda clip: abs(clip.start_seconds - duration_seconds * 0.12),
        ).start_seconds
        if early_visual
        else duration_seconds * 0.04
    )
    takeoff_start = max(
        0.0,
        min(
            duration_seconds - clip_length,
            takeoff_anchor - clip_length,
        ),
    )
    phases = [("takeoff", takeoff_start + clip_length / 2)]
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

    phases.append(("landing", duration_seconds * 0.96))

    selected: list[HighlightClip] = []
    for category, position in phases:
        center = (
            position
            if category == "takeoff"
            else (video_time(position) if category == "thermal" else position)
        )
        start = max(0.0, min(duration_seconds - clip_length, center - clip_length / 2))
        selected.append(HighlightClip(start, clip_length, 0.0, category))
    for clip in visual_clips:
        if len(selected) >= 6:
            break
        if all(
            abs(clip.start_seconds - chosen.start_seconds) >= clip_length for chosen in selected
        ):
            selected.append(clip)
    return sorted(selected, key=lambda clip: clip.start_seconds)


def _render_clip(
    source_path: Path,
    output_path: Path,
    clip: HighlightClip,
    overlay_path: Path | None,
    overlay_offset_seconds: float,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_width, output_height = _output_dimensions(source_path)
    pano_filter = (
        f"v360=input=e:output=rectilinear:yaw={clip.yaw_degrees}:pitch=0:"
        f"h_fov=100:w={output_width}:h={output_height},setsar=1"
    )
    command = [
        "ffmpeg",
        "-y",
        "-ss",
        f"{clip.start_seconds:.3f}",
        "-i",
        str(source_path),
    ]
    overlay_interval = None
    if overlay_path and overlay_path.is_file():
        overlay_interval = overlay_interval_for_clip(
            clip, overlay_offset_seconds, _probe_duration(overlay_path)
        )
    if overlay_interval:
        overlay_start, _ = overlay_interval
        command.extend(["-ss", f"{overlay_start:.3f}", "-i", str(overlay_path)])
        filter_complex = (
            f"[0:v]{pano_filter}[pano];"
            "[1:v]scale=iw*0.32:-1[overlay];"
            "[pano][overlay]overlay=W-w-32:H-h-32:eof_action=pass[v]"
        )
        command.extend(
            [
                "-t",
                f"{clip.duration_seconds:.3f}",
                "-filter_complex",
                filter_complex,
                "-map",
                "[v]",
                "-map",
                "0:a?",
                "-shortest",
            ]
        )
    else:
        command.extend(
            [
                "-t",
                f"{clip.duration_seconds:.3f}",
                "-vf",
                pano_filter,
                "-map",
                "0:v:0",
                "-map",
                "0:a?",
                "-shortest",
            ]
        )
    accelerator = select_video_accelerator(config.VIDEO_ACCELERATOR)
    encode_args = h264_encode_args(
        accelerator,
        quality="21" if accelerator == "cpu" else "20",
        cpu_preset="fast",
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
    subprocess.run(command, check=True)


def _update_job(job_id: str, **values: object) -> None:
    with SessionLocal() as db:
        job = db.query(HighlightVideoJob).filter(HighlightVideoJob.id == job_id).first()
        if job is None:
            return
        for key, value in values.items():
            setattr(job, key, value)
        db.commit()


def _is_cancelled(job_id: str) -> bool:
    with SessionLocal() as db:
        job = db.query(HighlightVideoJob).filter(HighlightVideoJob.id == job_id).first()
        return job is None or job.status == STATUS_CANCELLED


def process_highlight_video_job(job_id: str) -> None:
    """RQ target for a highlight render job."""
    with SessionLocal() as db:
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
        if job.status == STATUS_CANCELLED:
            return
        job.status = STATUS_RUNNING
        job.progress = 5
        job.started_at = _now()
        job.message = "Analyse de la vidéo pano"
        db.commit()

    try:
        duration_seconds = _probe_duration(source_path)
        output_width, output_height = _output_dimensions(source_path)
        output_dir.mkdir(parents=True, exist_ok=True)
        if not overlay_path or not overlay_path.is_file():
            overlay_path = _ensure_overlay_video(
                source_path,
                gpx_file_path,
                duration_seconds,
                output_dir,
            )
        visual_clips = select_highlight_clips(duration_seconds, source_path)
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
                _normalized_gpx, track_points = normalize_track(
                    gpx_path.read_bytes(), gpx_path.suffix
                )
            except (OSError, ValueError) as exc:
                logger.warning("Unable to classify flight phases from GPX: %s", exc)
        clips = select_flight_event_clips(duration_seconds, track_points, visual_clips)
        if not clips:
            raise ValueError("La vidéo pano ne contient aucune durée exploitable")
        clips = [
            classify_visual_clip(
                source_path, replace(clip, yaw_degrees=_best_yaw(source_path, clip))
            )
            for clip in clips
        ]
        rendered: list[Path] = []
        for index, clip in enumerate(clips, start=1):
            if _is_cancelled(job_id):
                return
            target = output_dir / f"clip-{index:02d}.mp4"
            _render_clip(source_path, target, clip, overlay_path, offset)
            rendered.append(target)
            if _is_cancelled(job_id):
                return
            _update_job(
                job_id, progress=10 + index * 15, message=f"Rendu du clip {index}/{len(clips)}"
            )

        if _is_cancelled(job_id):
            return
        concat_file = output_dir / "concat.txt"
        concat_file.write_text(
            "\n".join(f"file '{path.resolve()}'" for path in rendered) + "\n", encoding="utf-8"
        )
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
    except Exception as exc:
        logger.exception("Highlight video job %s failed", job_id)
        _update_job(
            job_id, status=STATUS_FAILED, progress=100, message="Échec du rendu", error=str(exc)
        )


def create_highlight_job_id() -> str:
    return f"highlight-{uuid.uuid4().hex}"
