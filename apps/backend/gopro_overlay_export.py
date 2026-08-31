import asyncio
import fnmatch
import json
import logging
import math
import os
import re
import shlex
import select
import shutil
import subprocess
import threading
import time
import uuid
import xml.etree.ElementTree as ET
from collections.abc import AsyncGenerator, Awaitable, Callable, Iterator
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import UploadFile

import config
from datetime_utils import to_api_utc
from database import SessionLocal
from deployment_drain import job_admission
from models import Flight, GoproOverlayJob
from sqlalchemy.exc import OperationalError
from video_acceleration import (
    VideoAccelerator,
    ffmpeg_supports_cuda_overlay,
    h264_encode_args,
    select_video_accelerator,
)

logger = logging.getLogger(__name__)

_STATUS_QUEUED = "queued"
_STATUS_PREPARING = "preparing"
_STATUS_RUNNING = "running"
_STATUS_COMPLETED = "completed"
_STATUS_FAILED = "failed"
_STATUS_CANCELLED = "cancelled"
_ACTIVE_STATUSES = {_STATUS_QUEUED, _STATUS_PREPARING, _STATUS_RUNNING}
_INTERRUPTIBLE_STATUSES = {_STATUS_PREPARING, _STATUS_RUNNING}
_TERMINAL_STATUSES = {_STATUS_COMPLETED, _STATUS_FAILED, _STATUS_CANCELLED}

_GPX_NAMESPACE = "http://www.topografix.com/GPX/1/1"
_GARMIN_GPX_EXTENSION_NAMESPACE = "http://www.garmin.com/xmlschemas/GpxExtensions/v3"
_XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance"

_VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v"}
_GPX_EXTENSIONS = {".gpx", ".fit"}
_UPLOAD_WORK_ROOT = Path("/tmp/dashboard-parapente/gopro-overlays")
_PATH_WORK_DIR_NAME = ".gopro-overlay-work"
_PROGRESS_PERCENT_RE = re.compile(r"(?P<percent>\d{1,3})\s*%")
_LOG_TAIL_LINE_COUNT = 100
_PIP_FRAME_RATE = 10
_OUTPUT_RESOLUTIONS: dict[str, tuple[int, int] | None] = {
    "source": None,
    "1080p": (1920, 1080),
    "4k": (3840, 2160),
}


def _gopro_overlay_log_dir() -> Path:
    return Path(config.GOPRO_OVERLAY_PARAGLIDING_ROOT) / ".logs" / "gopro-overlays"


def _gopro_overlay_log_path(job_id: str) -> Path:
    return _gopro_overlay_log_dir() / f"{job_id}.log"


@dataclass(frozen=True)
class GoproOverlayLayout:
    id: str
    label: str
    path: str
    width: int | None
    height: int | None


@dataclass(frozen=True)
class GpxVideoAlignment:
    video_start: datetime
    video_duration: float
    gpx_start: datetime
    gpx_end: datetime


_LAYOUTS = [
    GoproOverlayLayout(
        id="parapente-1080",
        label="Parapente 1920x1080",
        path="layout_parapente_1080.xml",
        width=1920,
        height=1080,
    ),
    GoproOverlayLayout(
        id="parapente-3840",
        label="Parapente 3840x2160",
        path="layout_parapente_3840.xml",
        width=3840,
        height=2160,
    ),
    GoproOverlayLayout(
        id="parapente-7680",
        label="Parapente 7680x4320",
        path="layout_parapente_7680.xml",
        width=7680,
        height=4320,
    ),
    GoproOverlayLayout(
        id="parapente-360",
        label="Parapente 360 / 6000x3000",
        path="layout_parapente_6000-360-.xml",
        width=6000,
        height=3000,
    ),
]

_JOBS: dict[str, dict[str, Any]] = {}
_PROCESSES: dict[str, subprocess.Popen[str]] = {}
_LOCK = threading.Lock()
_WORKER_THREAD: threading.Thread | None = None
_WORKER_STOP = threading.Event()
_WORKER_LOCK = threading.Lock()
_JOB_HEARTBEAT_INTERVAL_SECONDS = 30.0


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _utc_now_dt() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _to_iso(value: datetime | None) -> str | None:
    return to_api_utc(value)


def _coerce_datetime(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return value
    if isinstance(value, datetime) and value.tzinfo is not None:
        return value.replace(tzinfo=None)
    return value


def _layout_dir() -> Path:
    return Path(config.GOPRO_OVERLAY_LAYOUT_DIR)


def _layout_path(layout: GoproOverlayLayout) -> Path:
    return _layout_dir() / layout.path


def _uploaded_job_work_dir(job_id: str) -> Path:
    return _UPLOAD_WORK_ROOT / job_id


def _path_job_work_dir(video_path: Path, job_id: str) -> Path:
    return video_path.expanduser().resolve().parent / _PATH_WORK_DIR_NAME / job_id


def _first_matching_file(directory: Path, pattern: str) -> Path | None:
    if not directory.is_dir():
        return None
    pattern_lower = pattern.lower()
    matches = sorted(
        path
        for path in directory.iterdir()
        if path.is_file() and fnmatch.fnmatchcase(path.name.lower(), pattern_lower)
    )
    return matches[0] if matches else None


def _matching_files_by_mtime(directory: Path, pattern: str) -> list[Path]:
    if not directory.is_dir():
        return []
    pattern_lower = pattern.lower()
    matches = [
        path
        for path in directory.iterdir()
        if path.is_file() and fnmatch.fnmatchcase(path.name.lower(), pattern_lower)
    ]
    return sorted(matches, key=lambda path: (path.stat().st_mtime, path.name))


def _merge_osv_files_with_gpx(
    osv_paths: list[Path],
    gpx_path: Path,
    input_dir: Path,
    log_path: Path | None = None,
    gpx_offset: float = 0.0,
    video_duration: float | None = None,
    first_gpx_at: float | None = None,
) -> Path:
    if not osv_paths:
        return gpx_path

    merge_script = Path(config.GOPRO_OVERLAY_ROOT) / "osv_merge.py"
    if not merge_script.exists():
        raise ValueError(f"OSV merge script not found: {merge_script}")

    input_dir.mkdir(parents=True, exist_ok=True)
    merged_gpx_path = input_dir / "merged-gopro-overlay.gpx"
    if merged_gpx_path.exists():
        merged_gpx_path.unlink()

    logger.info(
        "Merging %s OSV file(s) with GPX %s into %s",
        len(osv_paths),
        gpx_path,
        merged_gpx_path,
    )
    if log_path:
        _append_job_log(
            log_path,
            f"Merging {len(osv_paths)} OSV file(s) into {merged_gpx_path.name}",
        )
    effective_first_gpx_at = (
        max(0.0, first_gpx_at) if video_duration is not None and first_gpx_at is not None else None
    )
    command = [
        "python3",
        str(merge_script),
        "--sync",
        "gpx-start",
        *(["--video-duration", f"{video_duration:.3f}"] if video_duration is not None else []),
        *(
            ["--first-gpx-at", f"{effective_first_gpx_at:.3f}"]
            if effective_first_gpx_at is not None
            else []
        ),
        *(["--gpx-offset", str(gpx_offset)] if gpx_offset else []),
        *(str(path) for path in osv_paths),
        str(gpx_path),
        str(merged_gpx_path),
    ]

    try:
        result = subprocess.run(
            command,
            cwd=config.GOPRO_OVERLAY_ROOT or None,
            capture_output=True,
            check=False,
            text=True,
            timeout=config.GOPRO_OVERLAY_OSV_MERGE_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        detail = exc.stderr or exc.stdout or "OSV merge timed out"
        if log_path:
            _append_job_log(log_path, f"OSV merge timed out: {detail}")
        raise ValueError(detail) from exc

    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "OSV merge failed"
        if log_path:
            _append_job_log(log_path, f"OSV merge failed: {detail}")
        raise ValueError(detail)
    if log_path:
        for line in result.stdout.splitlines():
            if line.strip():
                _append_job_log(log_path, f"OSV merge: {line.strip()}")
    if not merged_gpx_path.exists():
        if log_path:
            _append_job_log(log_path, "OSV merge did not create a GPX file")
        raise ValueError("OSV merge did not create a GPX file")

    logger.info("Created merged GoPro overlay GPX: %s", merged_gpx_path)
    if log_path:
        _append_job_log(log_path, f"Created merged GPX: {merged_gpx_path.name}")
    return merged_gpx_path


def _output_path_for_video(video_path: Path, output_name: str) -> Path:
    return video_path.expanduser().resolve().parent / output_name


def _output_path_for_dir(output_dir: str | None, video_path: Path, output_name: str) -> Path:
    if not output_dir or not output_dir.strip():
        return _output_path_for_video(video_path, output_name)
    return Path(output_dir).expanduser().resolve() / output_name


def _temp_output_path(output_path: Path, job_id: str) -> Path:
    suffix = output_path.suffix or ".mp4"
    stem = (
        output_path.name[: -len(suffix)] if output_path.name.endswith(suffix) else output_path.name
    )
    return output_path.with_name(f".{stem}.{job_id}.part{suffix}")


def _prepare_layout_file(
    layout_path: Path,
    destination: Path,
    has_pip: bool,
    target_width: int | None = None,
    target_height: int | None = None,
    layout_width: int | None = None,
    layout_height: int | None = None,
) -> Path:
    tree = ET.parse(layout_path)
    root = tree.getroot()
    parsed_width = _parse_float(root.attrib.get("width"))
    parsed_height = _parse_float(root.attrib.get("height"))
    source_width = (
        parsed_width
        if parsed_width is not None and math.isfinite(parsed_width) and parsed_width > 0
        else layout_width
    )
    source_height = (
        parsed_height
        if parsed_height is not None and math.isfinite(parsed_height) and parsed_height > 0
        else layout_height
    )
    scale_x = target_width / source_width if target_width and source_width else None
    scale_y = target_height / source_height if target_height and source_height else None

    if target_width is not None and target_height is not None:
        root.set("width", str(target_width))
        root.set("height", str(target_height))

    if scale_x is not None and scale_y is not None:
        _scale_layout_geometry(root, scale_x, scale_y)

    def normalize_video_components(parent: ET.Element) -> None:
        for child in list(parent):
            if child.tag == "component" and child.attrib.get("type") == "video":
                if has_pip:
                    continue
                # The stock parapente layouts may declare the PIP explicitly
                # as ``id="pip"``. Remove that component too when highlights
                # intentionally run without a PIP input.
                if child.attrib.get("id") == "pip" or not child.attrib.get("file"):
                    parent.remove(child)
                continue
            normalize_video_components(child)

    normalize_video_components(root)
    destination.parent.mkdir(parents=True, exist_ok=True)
    tree.write(destination, encoding="unicode")
    return destination


def _parse_float(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _format_scaled_number(value: float) -> str:
    # GoPro Overlay parses layout geometry with ``int()``. Rounded integer
    # coordinates keep non-16:9 targets valid instead of producing XML values
    # such as ``8.888889`` that make the renderer fail at startup.
    return str(round(value))


def _scale_layout_geometry(parent: ET.Element, scale_x: float, scale_y: float) -> None:
    x_attrs = {"x", "cx", "rx"}
    y_attrs = {"y", "cy", "ry"}
    uniform_attrs = {"width", "height", "size", "font-size", "stroke-width", "r"}

    for child in parent.iter():
        if child is parent:
            continue
        for attr, raw_value in list(child.attrib.items()):
            numeric_value = _parse_float(raw_value)
            if numeric_value is None:
                continue
            if attr in x_attrs:
                child.set(attr, _format_scaled_number(numeric_value * scale_x))
            elif attr in y_attrs:
                child.set(attr, _format_scaled_number(numeric_value * scale_y))
            elif attr in uniform_attrs:
                uniform_scale = (scale_x + scale_y) / 2
                child.set(attr, _format_scaled_number(numeric_value * uniform_scale))


def _safe_filename(filename: str | None, fallback: str) -> str:
    raw = filename or fallback
    cleaned = "".join(char if char.isalnum() or char in ".-_" else "_" for char in raw)
    return cleaned or fallback


def _validate_file_extension(path: Path, allowed_extensions: set[str]) -> None:
    suffix = path.suffix.lower()
    if suffix not in allowed_extensions:
        allowed = ", ".join(sorted(allowed_extensions))
        raise ValueError(f"Unsupported file extension '{suffix}'. Expected one of: {allowed}")


def _copy_job_input(source: Path, destination: Path, allowed_extensions: set[str]) -> Path:
    _validate_file_extension(source, allowed_extensions)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return destination


def _job_preparation_metadata(
    pin_inputs: bool,
    requested_layout_id: str | None,
    output_resolution: str,
    gpx_offset: float = 0.0,
    render_method: str | None = None,
) -> dict[str, Any]:
    metadata = {
        "prepare_overlay_inputs": True,
        "pin_inputs": pin_inputs,
        "requested_layout_id": requested_layout_id,
        "output_resolution": output_resolution,
        "gpx_offset": gpx_offset,
    }
    if render_method:
        metadata["render_method"] = render_method
    return metadata


def _queued_render_method() -> str:
    accelerator = select_video_accelerator(config.VIDEO_ACCELERATOR)
    return "gpu" if accelerator == "nvidia" and config.GOPRO_OVERLAY_PROFILE else "cpu"


def _gpx_offset_from_command_metadata(command: Any) -> float:
    if isinstance(command, dict):
        try:
            return float(command.get("gpx_offset") or 0.0)
        except (TypeError, ValueError):
            return 0.0
    if isinstance(command, list) and "--gpx-offset" in command:
        try:
            return float(command[command.index("--gpx-offset") + 1])
        except (IndexError, TypeError, ValueError):
            return 0.0
    return 0.0


def _render_method_from_command(command: Any) -> str | None:
    if isinstance(command, list):
        return "gpu" if "--profile" in command else "cpu"
    if isinstance(command, dict):
        value = command.get("render_method")
        return str(value) if isinstance(value, str) and value else None
    return None


def _format_job_log_line(message: str) -> str:
    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return f"[{timestamp}] {message}\n"


def _append_job_log(log_path: Path, message: str) -> None:
    try:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("a", encoding="utf-8") as log_file:
            log_file.write(_format_job_log_line(message))
    except OSError:
        pass


def _job_to_payload(
    job: GoproOverlayJob,
    include_command: bool = False,
    include_log_tail: bool = True,
) -> dict[str, Any]:
    command = json.loads(job.command_json) if job.command_json else None
    payload = {
        "job_id": job.id,
        "flight_id": job.flight_id,
        "status": job.status,
        "progress": job.progress or 0,
        "message": job.message or "",
        "error": job.error,
        "video_path": job.video_path,
        "gpx_path": job.gpx_path,
        "pip_path": job.pip_path,
        "layout_id": job.layout_id,
        "layout_label": job.layout_label,
        "layout_path": job.layout_path,
        "output_path": job.output_path,
        "temp_output_path": job.temp_output_path,
        "output_filename": job.output_filename,
        "log_path": job.log_path,
        "log_tail": (
            _tail_log_lines(Path(job.log_path), _LOG_TAIL_LINE_COUNT)
            if include_log_tail and job.log_path
            else []
        ),
        "video_width": job.video_width,
        "video_height": job.video_height,
        "output_resolution": (
            command.get("output_resolution") if isinstance(command, dict) else None
        ),
        "gpx_offset": _gpx_offset_from_command_metadata(command),
        "render_method": _render_method_from_command(command),
        "created_at": _to_iso(job.created_at),
        "updated_at": _to_iso(job.updated_at),
        "completed_at": _to_iso(job.completed_at),
    }
    if include_command:
        payload["command"] = command
    return payload


def gopro_overlay_job_to_payload(job: GoproOverlayJob) -> dict[str, Any]:
    """Serialize a durable overlay job for flight API responses."""
    return _job_to_payload(job)


def _get_db_job_payload(job_id: str, include_command: bool = False) -> dict[str, Any] | None:
    try:
        with SessionLocal() as db:
            job = db.query(GoproOverlayJob).filter(GoproOverlayJob.id == job_id).first()
            if not job:
                return None
            return _job_to_payload(job, include_command=include_command)
    except OperationalError as exc:
        if "no such table: gopro_overlay_jobs" in str(exc):
            return None
        raise


def _set_memory_snapshot(payload: dict[str, Any]) -> None:
    with _LOCK:
        _JOBS[payload["job_id"]] = payload.copy()


def _touch_db_job(job_id: str, **changes: Any) -> dict[str, Any] | None:
    try:
        with SessionLocal() as db:
            job = db.query(GoproOverlayJob).filter(GoproOverlayJob.id == job_id).first()
            if not job:
                return None
            if job.status in _TERMINAL_STATUSES:
                payload = _job_to_payload(job, include_log_tail=False)
                _set_memory_snapshot(payload)
                return payload

            for key, value in changes.items():
                if key == "job_id" or not hasattr(job, key):
                    continue
                if key.endswith("_at"):
                    value = _coerce_datetime(value)
                setattr(job, key, value)
            job.updated_at = _utc_now_dt()
            if job.status == _STATUS_RUNNING and not job.started_at:
                job.started_at = _utc_now_dt()
            if job.status in _TERMINAL_STATUSES:
                if job.status == _STATUS_CANCELLED and not job.cancelled_at:
                    job.cancelled_at = _utc_now_dt()
                if job.status in {_STATUS_COMPLETED, _STATUS_FAILED} and not job.completed_at:
                    job.completed_at = _utc_now_dt()
            _sync_flights_from_job(db, job)
            db.commit()
            payload = _job_to_payload(job, include_log_tail=False)
            _set_memory_snapshot(payload)
            return payload
    except OperationalError as exc:
        if "no such table: gopro_overlay_jobs" not in str(exc):
            raise

    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return None
        if job["status"] in _TERMINAL_STATUSES:
            return job.copy()
        job.update(changes)
        job["updated_at"] = _utc_now()
        return job.copy()


def _update_job(job_id: str, **changes: Any) -> dict[str, Any]:
    db_payload = _touch_db_job(job_id, **changes)
    if db_payload is not None:
        return db_payload

    with _LOCK:
        job = _JOBS[job_id]
        if job["status"] in _TERMINAL_STATUSES:
            return job.copy()
        job.update(changes)
        job["updated_at"] = _utc_now()
        return job.copy()


def _claim_job_for_preparation(job_id: str) -> dict[str, Any] | None:
    """Atomically reserve a queued job before creating shared temporary files."""
    try:
        with SessionLocal() as db:
            claimed_count = (
                db.query(GoproOverlayJob)
                .filter(
                    GoproOverlayJob.id == job_id,
                    GoproOverlayJob.status == _STATUS_QUEUED,
                )
                .update(
                    {
                        GoproOverlayJob.status: _STATUS_PREPARING,
                        GoproOverlayJob.progress: 5,
                        GoproOverlayJob.message: "Preparing overlay files",
                        GoproOverlayJob.updated_at: _utc_now_dt(),
                    },
                    synchronize_session=False,
                )
            )
            if claimed_count != 1:
                db.rollback()
                return None
            job = db.query(GoproOverlayJob).filter(GoproOverlayJob.id == job_id).first()
            if not job:
                db.rollback()
                return None
            _sync_flights_from_job(db, job)
            db.commit()
            payload = _job_to_payload(job, include_command=True)
            _set_memory_snapshot(payload)
            return payload
    except OperationalError as exc:
        if "no such table: gopro_overlay_jobs" not in str(exc):
            raise

    with _LOCK:
        job = _JOBS.get(job_id)
        if not job or job["status"] != _STATUS_QUEUED:
            return None
        job.update(
            status=_STATUS_PREPARING,
            progress=5,
            message="Preparing overlay files",
            updated_at=_utc_now(),
        )
        return job.copy()


def _sync_flights_from_job(db: Any, job: GoproOverlayJob) -> None:
    flights = db.query(Flight).filter(Flight.gopro_overlay_job_id == job.id).all()
    for flight in flights:
        flight.gopro_overlay_status = job.status
        if job.status == _STATUS_COMPLETED:
            flight.gopro_overlay_file_path = job.output_path


def reconcile_gopro_overlay_flight_refs() -> int:
    """Clear or sync active flight overlay references that no longer have a live job."""
    reconciled = 0
    try:
        with SessionLocal() as db:
            flights = (
                db.query(Flight).filter(Flight.gopro_overlay_status.in_(_ACTIVE_STATUSES)).all()
            )
            for flight in flights:
                if not flight.gopro_overlay_job_id:
                    flight.gopro_overlay_status = None
                    reconciled += 1
                    continue

                job = (
                    db.query(GoproOverlayJob)
                    .filter(GoproOverlayJob.id == flight.gopro_overlay_job_id)
                    .first()
                )
                if not job:
                    flight.gopro_overlay_job_id = None
                    flight.gopro_overlay_status = None
                    reconciled += 1
                    continue

                if job.status != flight.gopro_overlay_status:
                    _sync_flights_from_job(db, job)
                    reconciled += 1
            if reconciled:
                db.commit()
    except OperationalError as exc:
        if "no such table" not in str(exc):
            raise
    return reconciled


def _progress_from_output_chunk(chunk: str) -> int | None:
    matches = list(_PROGRESS_PERCENT_RE.finditer(chunk))
    if not matches:
        return None
    percent = int(matches[-1].group("percent"))
    return max(5, min(percent, 99))


def _read_process_updates(stream: Any) -> Iterator[str]:
    current = ""
    while char := stream.read(1):
        if char in {"\n", "\r"}:
            if current.strip():
                yield current.strip()
            current = ""
            continue
        current += char
    if current.strip():
        yield current.strip()


def _is_job_cancelled(job_id: str) -> bool:
    try:
        with SessionLocal() as db:
            status = db.query(GoproOverlayJob.status).filter(GoproOverlayJob.id == job_id).scalar()
            return status == _STATUS_CANCELLED
    except OperationalError as exc:
        if "no such table: gopro_overlay_jobs" not in str(exc):
            raise
        with _LOCK:
            return _JOBS.get(job_id, {}).get("status") == _STATUS_CANCELLED


def _read_process_updates_from_process(
    process: subprocess.Popen[str],
    job_id: str,
) -> Iterator[str]:
    stream = process.stdout
    if not stream:
        return

    current = ""
    last_heartbeat = time.monotonic()
    while True:
        if process.poll() is None:
            if _is_job_cancelled(job_id):
                process.terminate()
                return

            now = time.monotonic()
            if now - last_heartbeat >= _JOB_HEARTBEAT_INTERVAL_SECONDS:
                _update_job(job_id)
                last_heartbeat = now

            ready, _, _ = select.select([stream], [], [], 1)
            if not ready:
                continue

        char = stream.read(1)
        if not char:
            if process.poll() is None:
                continue
            break
        if char in {"\n", "\r"}:
            if current.strip():
                yield current.strip()
            current = ""
            continue
        current += char

    if current.strip():
        yield current.strip()


def _background_process_command(command: list[str]) -> list[str]:
    if config.TESTING:
        return command.copy()

    wrapped = command.copy()
    ionice_class = str(config.GOPRO_OVERLAY_PROCESS_IONICE_CLASS).strip()
    if os.name == "posix" and ionice_class and shutil.which("ionice"):
        wrapped = ["ionice", "-c", ionice_class, *wrapped]

    nice_value = config.GOPRO_OVERLAY_PROCESS_NICE
    if os.name == "posix" and nice_value > 0 and shutil.which("nice"):
        wrapped = ["nice", "-n", str(nice_value), *wrapped]
    return wrapped


def _tail_log_lines(path: Path, limit: int = _LOG_TAIL_LINE_COUNT) -> list[str]:
    if not path.exists():
        return []
    try:
        lines = path.read_text(errors="replace").splitlines()
    except OSError:
        return []
    return lines[-limit:]


def _tail_lines(path: Path, limit: int = 20) -> str:
    lines = _tail_log_lines(path, limit)
    return "\n".join(lines[-limit:])


def _verify_video_output(path: Path) -> tuple[bool, str | None]:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(path),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (FileNotFoundError, subprocess.SubprocessError, TimeoutError) as exc:
        return False, str(exc) or exc.__class__.__name__

    try:
        duration = float((json.loads(result.stdout or "{}").get("format") or {}).get("duration", 0))
    except (TypeError, ValueError, json.JSONDecodeError):
        duration = 0
    if duration <= 0:
        return False, "ffprobe did not report a valid duration"
    return True, None


def probe_video_duration(video_path: Path) -> float | None:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(video_path),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except (FileNotFoundError, subprocess.SubprocessError, TimeoutError):
        return None

    try:
        duration = float((json.loads(result.stdout or "{}").get("format") or {}).get("duration", 0))
    except (TypeError, ValueError, json.JSONDecodeError):
        return None
    return duration if duration > 0 else None


def _parse_utc_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _gpx_time_bounds(gpx_path: Path) -> tuple[datetime | None, datetime | None]:
    try:
        root = ET.parse(gpx_path).getroot()
    except (ET.ParseError, OSError):
        return None, None

    times = [
        parsed
        for element in root.iter()
        if element.tag.rsplit("}", 1)[-1] == "time"
        and element.text
        and (parsed := _parse_utc_datetime(element.text))
    ]
    if not times:
        return None, None
    return times[0], times[-1]


def _gpx_video_alignment(osv_path: Path, gpx_path: Path) -> GpxVideoAlignment | None:
    osv_start = probe_video_start_time(osv_path)
    osv_duration = probe_video_duration(osv_path)
    gpx_start, gpx_end = _gpx_time_bounds(gpx_path)
    if not osv_start or not osv_duration or not gpx_start or not gpx_end:
        return None

    best_start = osv_start
    best_overlap = -1.0
    best_offset_minutes = 0
    for offset_minutes in range(-12 * 60, 14 * 60 + 1, 15):
        shift = timedelta(minutes=-offset_minutes)
        candidate_start = osv_start + shift
        candidate_end = candidate_start + timedelta(seconds=osv_duration)
        overlap = max(
            0.0, (min(candidate_end, gpx_end) - max(candidate_start, gpx_start)).total_seconds()
        )
        if (overlap, -abs(offset_minutes)) > (best_overlap, -abs(best_offset_minutes)):
            best_start = candidate_start
            best_overlap = overlap
            best_offset_minutes = offset_minutes

    return GpxVideoAlignment(
        video_start=best_start,
        video_duration=osv_duration,
        gpx_start=gpx_start,
        gpx_end=gpx_end,
    )


def probe_video_start_time(video_path: Path) -> datetime | None:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format_tags=creation_time:stream_tags=creation_time",
                "-of",
                "json",
                str(video_path),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except (FileNotFoundError, subprocess.SubprocessError, TimeoutError):
        return None

    try:
        payload = json.loads(result.stdout or "{}")
    except json.JSONDecodeError:
        return None

    candidates = [
        ((payload.get("format") or {}).get("tags") or {}).get("creation_time"),
        *[
            ((stream.get("tags") or {}).get("creation_time"))
            for stream in payload.get("streams") or []
        ],
    ]
    return next(
        (parsed for candidate in candidates if (parsed := _parse_utc_datetime(candidate))),
        None,
    )


def first_gpx_timestamp(gpx_path: Path) -> datetime | None:
    try:
        root = ET.parse(gpx_path).getroot()
    except (ET.ParseError, OSError):
        return None

    for trackpoint in root.iter():
        if trackpoint.tag.rsplit("}", 1)[-1] != "trkpt":
            continue
        for element in trackpoint:
            if element.tag.rsplit("}", 1)[-1] == "time" and element.text:
                if parsed := _parse_utc_datetime(element.text):
                    return parsed
    for element in root.iter():
        if element.tag.rsplit("}", 1)[-1] == "time" and element.text:
            if parsed := _parse_utc_datetime(element.text):
                return parsed
    return None


def gpx_duration_seconds(gpx_path: Path) -> float | None:
    try:
        root = ET.parse(gpx_path).getroot()
    except (ET.ParseError, OSError):
        return None

    timestamps: list[datetime] = []
    for trackpoint in root.iter():
        if trackpoint.tag.rsplit("}", 1)[-1] != "trkpt":
            continue
        for element in trackpoint:
            if element.tag.rsplit("}", 1)[-1] != "time" or not element.text:
                continue
            if parsed := _parse_utc_datetime(element.text):
                timestamps.append(parsed)
            break
    if len(timestamps) < 2:
        return None
    return max(0.0, (timestamps[-1] - timestamps[0]).total_seconds())


def _shift_gpx_timestamps(gpx_path: Path, output_path: Path, offset: float) -> Path:
    tree = ET.parse(gpx_path)
    for trackpoint in tree.getroot().iter():
        if trackpoint.tag.rsplit("}", 1)[-1] != "trkpt":
            continue
        for element in trackpoint:
            if element.tag.rsplit("}", 1)[-1] != "time" or not element.text:
                continue
            timestamp = _parse_utc_datetime(element.text)
            if timestamp:
                element.text = (
                    (timestamp + timedelta(seconds=offset)).isoformat().replace("+00:00", "Z")
                )
            break
    tree.write(output_path, encoding="utf-8", xml_declaration=True)
    return output_path


def _pip_timeline_offsets(
    video_start: datetime | None,
    gpx_start: datetime | None,
) -> tuple[float, float]:
    if video_start is None or gpx_start is None:
        return 0.0, 0.0
    offset = (gpx_start - video_start).total_seconds()
    if offset >= 0:
        return offset, 0.0
    return 0.0, abs(offset)


def align_video_start_time_to_gpx(
    video_start: datetime | None,
    gpx_start: datetime | None,
) -> datetime | None:
    if video_start is None or gpx_start is None:
        return video_start

    aligned_start = video_start
    aligned_gap = abs((video_start - gpx_start).total_seconds())
    for shift_minutes in range(-12 * 60, 14 * 60 + 1, 15):
        candidate_start = video_start + timedelta(minutes=shift_minutes)
        candidate_gap = abs((candidate_start - gpx_start).total_seconds())
        if candidate_gap < aligned_gap:
            aligned_start = candidate_start
            aligned_gap = candidate_gap

    if aligned_start != video_start:
        logger.info(
            "Adjusted video start time %s -> %s to better align with GPX %s",
            video_start,
            aligned_start,
            gpx_start,
        )
    return aligned_start


def _prepared_pip_path(work_dir: Path, job_id: str) -> Path:
    return work_dir / f"pip-prepared-{job_id}.mp4"


def _ffmpeg_timeout_for_duration(duration: float) -> int:
    return max(600, min(int(duration * 20), 6 * 60 * 60))


def _ffmpeg_output_args(
    *,
    accelerator: VideoAccelerator,
    software_filters: list[str] | None,
    include_audio: bool,
) -> list[str]:
    args: list[str] = []
    if software_filters:
        args.extend(["-vf", ",".join(software_filters)])
    args.extend(
        h264_encode_args(
            accelerator,
            quality="18",
            cpu_preset="medium",
            include_audio=include_audio,
        )
    )
    return args


def _prepare_pip_video_for_overlay(
    job_id: str,
    video_path: Path,
    gpx_path: Path,
    pip_path: Path,
    work_dir: Path,
    log_path: Path | None = None,
    timeline_start: datetime | None = None,
    gpx_offset: float = 0.0,
) -> Path:
    video_duration = probe_video_duration(video_path)
    pip_width, pip_height = probe_video_resolution(pip_path)
    if video_duration is None or not pip_width or not pip_height:
        return pip_path

    if log_path:
        _append_job_log(log_path, f"Preparing PIP video: {pip_path.name}")

    pip_duration = probe_video_duration(pip_path)
    gpx_start = first_gpx_timestamp(gpx_path)
    if gpx_start is not None and gpx_offset:
        gpx_start += timedelta(seconds=gpx_offset)
    video_start = timeline_start or align_video_start_time_to_gpx(
        probe_video_start_time(video_path), gpx_start
    )
    pip_delay, pip_trim = _pip_timeline_offsets(video_start, gpx_start)
    if log_path:
        _append_job_log(
            log_path,
            f"PIP timeline: delay={pip_delay:.3f}s trim={pip_trim:.3f}s",
        )
    visible_pip_duration = max(0.0, pip_duration - pip_trim) if pip_duration is not None else None
    pip_tail_duration = (
        max(0.0, video_duration - pip_delay - visible_pip_duration)
        if visible_pip_duration is not None
        else None
    )
    prepared_path = _prepared_pip_path(work_dir, job_id)
    _unlink_if_exists(prepared_path)

    software_filters: list[str] | None = None
    if pip_delay >= video_duration or (pip_duration is not None and pip_trim >= pip_duration):
        command_prefix = [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"color=c=black:s={pip_width}x{pip_height}:r=30:d={video_duration:.3f}",
            "-t",
            f"{video_duration:.3f}",
        ]
    else:
        software_filters = [f"fps={_PIP_FRAME_RATE}", "setpts=PTS-STARTPTS"]
        if pip_delay > 0:
            start_frames = math.ceil(pip_delay * _PIP_FRAME_RATE)
            software_filters.append(f"tpad=start_mode=add:start={start_frames}")
        if pip_tail_duration and pip_tail_duration > 0:
            stop_frames = math.ceil(pip_tail_duration * _PIP_FRAME_RATE)
            software_filters.append(f"tpad=stop_mode=clone:stop={stop_frames}")
        software_filters.append(f"setpts=N/({_PIP_FRAME_RATE}*TB)")
        command_prefix = [
            "ffmpeg",
            "-y",
        ]
        if pip_trim > 0:
            command_prefix.extend(["-ss", f"{pip_trim:.3f}"])
        command_prefix.extend(
            [
                "-i",
                str(pip_path),
                "-t",
                f"{video_duration:.3f}",
            ]
        )

    output_args = ["-movflags", "+faststart", str(prepared_path)]
    accelerator = select_video_accelerator(config.VIDEO_ACCELERATOR)
    command = [
        *command_prefix,
        *_ffmpeg_output_args(
            accelerator=accelerator,
            software_filters=software_filters,
            include_audio=False,
        ),
        *output_args,
    ]

    hardware_error: str | None = None
    try:
        result: subprocess.CompletedProcess[str] | None = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=_ffmpeg_timeout_for_duration(video_duration),
        )
    except FileNotFoundError as exc:
        _unlink_if_exists(prepared_path)
        if log_path:
            _append_job_log(log_path, f"PIP preparation failed: {exc}")
        raise ValueError(str(exc) or exc.__class__.__name__) from exc
    except (subprocess.SubprocessError, TimeoutError) as exc:
        result = None
        hardware_error = str(exc) or exc.__class__.__name__

    if accelerator == "nvidia" and (result is None or result.returncode != 0):
        _unlink_if_exists(prepared_path)
        hardware_error = hardware_error or (
            result.stderr.strip() or result.stdout.strip() or "ffmpeg NVENC pip preparation failed"
        )
        logger.warning(
            "NVENC PIP preparation failed for job %s; retrying on CPU: %s",
            job_id,
            hardware_error,
        )
        if log_path:
            _append_job_log(log_path, f"NVENC PIP preparation failed: {hardware_error}")
            _append_job_log(log_path, "Retrying PIP preparation with CPU encoding")
        command = [
            *command_prefix,
            *_ffmpeg_output_args(
                accelerator="cpu",
                software_filters=software_filters,
                include_audio=False,
            ),
            *output_args,
        ]
        try:
            result = subprocess.run(
                command,
                check=False,
                capture_output=True,
                text=True,
                timeout=_ffmpeg_timeout_for_duration(video_duration),
            )
        except (FileNotFoundError, subprocess.SubprocessError, TimeoutError) as exc:
            _unlink_if_exists(prepared_path)
            if log_path:
                _append_job_log(log_path, f"CPU PIP preparation failed: {exc}")
            raise ValueError(str(exc) or exc.__class__.__name__) from exc

    if result is None:
        detail = hardware_error or "ffmpeg pip preparation failed"
        _unlink_if_exists(prepared_path)
        if log_path:
            _append_job_log(log_path, f"PIP preparation failed: {detail}")
        raise ValueError(detail)
    if result.returncode != 0:
        _unlink_if_exists(prepared_path)
        detail = result.stderr.strip() or result.stdout.strip() or "ffmpeg pip preparation failed"
        if log_path:
            _append_job_log(log_path, f"PIP preparation failed: {detail}")
        raise ValueError(detail)
    if not prepared_path.exists():
        if log_path:
            _append_job_log(log_path, "ffmpeg did not create the prepared PIP video")
        raise ValueError("ffmpeg did not create the prepared PIP video")
    if log_path:
        _append_job_log(log_path, f"Prepared PIP video: {prepared_path.name}")
    return prepared_path


def _scaled_video_path(path: Path) -> Path:
    return path.with_name(f".{path.stem}.scaled{path.suffix or '.mp4'}")


def _unlink_if_exists(path: Path) -> None:
    try:
        if path.exists():
            path.unlink()
    except OSError:
        logger.exception("Failed to delete temporary GoPro overlay file %s", path)


def _ensure_video_output_resolution(
    path: Path,
    expected_width: int | None,
    expected_height: int | None,
    log_path: Path | None = None,
) -> tuple[bool, str | None]:
    if not expected_width or not expected_height:
        return True, None
    if expected_width <= 0 or expected_height <= 0:
        return False, f"Invalid expected dimensions: {expected_width}x{expected_height}"
    if expected_width > 16384 or expected_height > 16384:
        return False, f"Expected dimensions too large: {expected_width}x{expected_height}"

    output_width, output_height = probe_video_resolution(path)
    if output_width == expected_width and output_height == expected_height:
        return True, None
    if output_width is None or output_height is None:
        return False, "ffprobe did not report a valid output resolution"

    scaled_path = _scaled_video_path(path)
    _unlink_if_exists(scaled_path)
    accelerator = select_video_accelerator(config.VIDEO_ACCELERATOR)
    video_duration = probe_video_duration(path)
    ffmpeg_timeout = (
        _ffmpeg_timeout_for_duration(video_duration)
        if video_duration is not None
        else config.JOB_QUEUE_TIMEOUT_SECONDS
    )

    if accelerator == "nvidia" and ffmpeg_supports_cuda_overlay():
        command = [
            "ffmpeg",
            "-y",
            "-hwaccel",
            "cuda",
            "-hwaccel_output_format",
            "cuda",
            "-i",
            str(path),
            "-vf",
            f"scale_cuda=w={expected_width}:h={expected_height}:format=yuv420p",
            *h264_encode_args(
                "nvidia",
                quality="18",
                cpu_preset="medium",
                include_audio=True,
                pixel_format="cuda",
            ),
            "-movflags",
            "+faststart",
            str(scaled_path),
        ]
    else:
        command = [
            "ffmpeg",
            "-y",
            "-i",
            str(path),
            *_ffmpeg_output_args(
                accelerator=accelerator,
                software_filters=[f"scale=w={expected_width}:h={expected_height}:flags=lanczos"],
                include_audio=True,
            ),
            "-movflags",
            "+faststart",
            str(scaled_path),
        ]
    logger.info(
        "Rescaling GoPro overlay output from %sx%s to %sx%s: %s",
        output_width,
        output_height,
        expected_width,
        expected_height,
        path,
    )
    hardware_error: str | None = None
    try:
        result: subprocess.CompletedProcess[str] | None = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=ffmpeg_timeout,
        )
    except FileNotFoundError as exc:
        _unlink_if_exists(scaled_path)
        detail = str(exc) or exc.__class__.__name__
        if log_path:
            _append_job_log(log_path, f"Output scaling failed: {detail}")
        return False, detail
    except (subprocess.SubprocessError, TimeoutError) as exc:
        result = None
        hardware_error = str(exc) or exc.__class__.__name__

    if accelerator == "nvidia" and (result is None or result.returncode != 0):
        hardware_error = hardware_error or (
            result.stderr.strip() or result.stdout.strip() or "ffmpeg NVENC output scaling failed"
        )
        logger.warning(
            "NVENC output scaling failed; retrying with CPU encoding: %s",
            hardware_error,
        )
        if log_path:
            _append_job_log(log_path, f"NVENC output scaling failed: {hardware_error}")
            _append_job_log(log_path, "Retrying output scaling with CPU encoding")
        _unlink_if_exists(scaled_path)
        command = [
            "ffmpeg",
            "-y",
            "-i",
            str(path),
            *_ffmpeg_output_args(
                accelerator="cpu",
                software_filters=[f"scale=w={expected_width}:h={expected_height}:flags=lanczos"],
                include_audio=True,
            ),
            "-movflags",
            "+faststart",
            str(scaled_path),
        ]
        try:
            result = subprocess.run(
                command,
                check=False,
                capture_output=True,
                text=True,
                timeout=ffmpeg_timeout,
            )
        except (FileNotFoundError, subprocess.SubprocessError, TimeoutError) as exc:
            _unlink_if_exists(scaled_path)
            detail = str(exc) or exc.__class__.__name__
            if log_path:
                _append_job_log(log_path, f"CPU output scaling failed: {detail}")
            return False, detail
    if result is None:
        _unlink_if_exists(scaled_path)
        detail = hardware_error or "ffmpeg output scaling failed"
        if log_path:
            _append_job_log(log_path, f"Output scaling failed: {detail}")
        return False, detail
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "ffmpeg scale failed"
        _unlink_if_exists(scaled_path)
        if log_path:
            _append_job_log(log_path, f"Output scaling failed: {detail}")
        return False, detail
    scaled_width, scaled_height = probe_video_resolution(scaled_path)
    if scaled_width != expected_width or scaled_height != expected_height:
        _unlink_if_exists(scaled_path)
        return (
            False,
            f"scaled output resolution is {scaled_width}x{scaled_height}, expected "
            f"{expected_width}x{expected_height}",
        )

    scaled_path.replace(path)
    return True, None


def _transition_job_to_running(
    job_id: str, command: list[str], render_method: str
) -> dict[str, Any] | None:
    try:
        with SessionLocal() as db:
            db_job = db.query(GoproOverlayJob).filter(GoproOverlayJob.id == job_id).first()
            if db_job:
                if db_job.status != _STATUS_QUEUED:
                    return None
                db_job.status = _STATUS_RUNNING
                db_job.progress = 5
                db_job.message = "Rendering overlay"
                command_metadata = json.loads(db_job.command_json) if db_job.command_json else {}
                if not isinstance(command_metadata, dict):
                    command_metadata = {}
                command_metadata.update(command=command, render_method=render_method)
                db_job.command_json = json.dumps(command_metadata)
                db_job.started_at = _utc_now_dt()
                db_job.updated_at = _utc_now_dt()
                db.commit()
                payload = _job_to_payload(db_job, include_command=True)
                _set_memory_snapshot(payload)
                return payload
    except OperationalError as exc:
        if "no such table: gopro_overlay_jobs" not in str(exc):
            raise

    with _LOCK:
        job = _JOBS.get(job_id)
        if not job or job["status"] != _STATUS_QUEUED:
            return None
        job.update(
            status=_STATUS_RUNNING,
            progress=5,
            message="Rendering overlay",
            command=command,
            render_method=render_method,
            updated_at=_utc_now(),
        )
        return job.copy()


def _prepare_queued_job(job_id: str, job: dict[str, Any]) -> dict[str, Any] | None:
    metadata = job.get("command")
    if not isinstance(metadata, dict) or not metadata.get("prepare_overlay_inputs"):
        return job

    log_path = Path(str(job.get("log_path") or Path(str(job["output_path"])).with_suffix(".log")))

    try:
        _append_job_log(log_path, "Preparing overlay files")
        current_job = _claim_job_for_preparation(job_id)
        if not current_job or current_job.get("status") != _STATUS_PREPARING:
            return None
        work_dir = Path(str(job["layout_path"])).parent
        video_path = Path(str(job["video_path"]))
        gpx_path = Path(str(job["gpx_path"]))
        pip_path = Path(str(job["pip_path"])) if job.get("pip_path") else None
        command_metadata = dict(metadata)
        render_gpx_path = gpx_path

        if metadata.get("pin_inputs"):
            _append_job_log(log_path, "Pinning GPX input file")
            _update_job(job_id, progress=7, message="Preparing GPX input")
            render_gpx_path = _copy_job_input(
                gpx_path,
                work_dir / f"gpx-{job_id}{gpx_path.suffix.lower()}",
                _GPX_EXTENSIONS,
            )

        source_input_dir = Path(str(job["output_path"])).parent
        osv_paths = _matching_files_by_mtime(source_input_dir, "*.osv")
        gpx_offset = _gpx_offset_from_command_metadata(command_metadata)
        embedded_video_start = probe_video_start_time(video_path)
        alignment_video_start = embedded_video_start
        if alignment_video_start is None:
            try:
                alignment_video_start = datetime.fromtimestamp(
                    video_path.stat().st_mtime, tz=timezone.utc
                )
            except OSError:
                alignment_video_start = None
        gpx_start = first_gpx_timestamp(render_gpx_path)
        aligned_video_start = align_video_start_time_to_gpx(alignment_video_start, gpx_start)
        first_gpx_at = (
            (gpx_start - aligned_video_start).total_seconds() + gpx_offset
            if gpx_offset and gpx_start is not None and aligned_video_start is not None
            else None
        )
        if osv_paths:
            _update_job(job_id, progress=10, message="Merging OSV telemetry")
            video_duration = probe_video_duration(video_path)
            render_gpx_path = _merge_osv_files_with_gpx(
                osv_paths,
                render_gpx_path,
                work_dir,
                log_path=log_path,
                gpx_offset=gpx_offset,
                video_duration=video_duration,
                first_gpx_at=first_gpx_at,
            )
        else:
            _append_job_log(log_path, "No OSV files found; using GPX directly")
            if gpx_offset:
                render_gpx_path = _shift_gpx_timestamps(
                    render_gpx_path,
                    work_dir / f"gpx-offset-{job_id}.gpx",
                    gpx_offset,
                )

        command_metadata["render_gpx_path"] = str(render_gpx_path)
        if embedded_video_start is not None:
            command_metadata["video_time_start"] = "video-created"
        else:
            command_metadata.pop("video_time_start", None)
        _append_job_log(log_path, f"Render GPX: {render_gpx_path.name}")

        if pip_path:
            _update_job(job_id, progress=15, message="Preparing PIP video")
            pip_path = _prepare_pip_video_for_overlay(
                job_id,
                video_path,
                gpx_path,
                pip_path,
                work_dir,
                log_path=log_path,
                timeline_start=first_gpx_timestamp(render_gpx_path),
                gpx_offset=gpx_offset,
            )
        else:
            _append_job_log(log_path, "No PIP video configured")

        width, height = probe_video_resolution(video_path)
        _update_job(job_id, progress=20, message="Preparing overlay layout")
        output_resolution = str(metadata.get("output_resolution") or "source")
        if output_resolution not in _OUTPUT_RESOLUTIONS:
            raise ValueError("Unknown output resolution")
        requested_layout_id = metadata.get("requested_layout_id")
        selected_layout = (
            _find_layout(str(requested_layout_id))
            if requested_layout_id
            else _nearest_layout(width, height)
        )
        if not selected_layout:
            raise ValueError("Unknown layout")
        source_layout_path = _layout_path(selected_layout)
        if not source_layout_path.exists():
            raise ValueError(f"Layout file not found: {source_layout_path}")
        _append_job_log(log_path, f"Using layout {selected_layout.label}")
        render_width, render_height = _layout_render_size(
            selected_layout,
            width,
            height,
            output_resolution,
        )
        layout_path = _prepare_layout_file(
            source_layout_path,
            work_dir / source_layout_path.name,
            has_pip=pip_path is not None,
            target_width=render_width,
            target_height=render_height,
            layout_width=selected_layout.width,
            layout_height=selected_layout.height,
        )

        prepared_job = _update_job(
            job_id,
            status=_STATUS_QUEUED,
            video_path=str(video_path),
            gpx_path=str(gpx_path),
            pip_path=str(pip_path) if pip_path else None,
            layout_id=selected_layout.id,
            layout_label=selected_layout.label,
            layout_path=str(layout_path),
            video_width=render_width,
            video_height=render_height,
            command_json=json.dumps(command_metadata),
            message="Overlay queued",
        )
        if not prepared_job or prepared_job.get("status") != _STATUS_QUEUED:
            return None
        prepared_job["gpx_offset"] = _gpx_offset_from_command_metadata(command_metadata)
        prepared_job["command"] = command_metadata
        _append_job_log(log_path, "Overlay queued")
        return prepared_job
    except Exception as exc:
        _append_job_log(log_path, f"Overlay preparation failed: {exc}")
        logger.exception("Failed to prepare GoPro overlay job %s", job_id)
        _finish_job(
            job_id,
            status=_STATUS_FAILED,
            progress=100,
            message="Overlay preparation failed",
            error=str(exc) or exc.__class__.__name__,
            completed_at=_utc_now(),
        )
        return None


def _finish_job(job_id: str, **changes: Any) -> dict[str, Any]:
    db_payload = _touch_db_job(job_id, **changes)
    if db_payload is not None:
        return db_payload

    with _LOCK:
        job = _JOBS[job_id]
        if job["status"] in _TERMINAL_STATUSES:
            return job.copy()
        job.update(changes)
        job["updated_at"] = _utc_now()
        return job.copy()


def _overlay_segment_path(work_dir: Path, job_id: str, index: int, kind: str) -> Path:
    return work_dir / f"{kind}-{job_id}-{index:05d}.mp4"


def _create_overlay_segment(
    source_path: Path,
    destination: Path,
    start_seconds: float,
    duration_seconds: float,
) -> None:
    if destination.exists():
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            f"{start_seconds:.3f}",
            "-i",
            str(source_path),
            "-t",
            f"{duration_seconds:.3f}",
            "-map",
            "0",
            "-c",
            "copy",
            "-avoid_negative_ts",
            "make_zero",
            str(destination),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0 or not destination.exists():
        detail = result.stderr.strip() or "Unable to create overlay segment"
        raise ValueError(detail)


def _concat_overlay_segments(segment_paths: list[Path], destination: Path) -> None:
    concat_path = destination.with_suffix(".concat.txt")
    concat_lines = []
    for path in segment_paths:
        escaped_path = path.as_posix().replace("'", "'\\''")
        concat_lines.append(f"file '{escaped_path}'\n")
    concat_path.write_text(
        "".join(concat_lines),
        encoding="utf-8",
    )
    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_path),
                "-c",
                "copy",
                str(destination),
            ],
            check=False,
            capture_output=True,
            text=True,
        )
    finally:
        concat_path.unlink(missing_ok=True)
    if result.returncode != 0 or not destination.exists():
        detail = result.stderr.strip() or "Unable to concatenate overlay segments"
        raise ValueError(detail)


def _run_segmented_overlay_job(
    job_id: str,
    job: dict[str, Any],
    command: list[str],
    cpu_command: list[str],
    gpu_render_enabled: bool,
    render_method: str,
    log_path: Path,
    output_path: Path,
    temp_output_path: Path,
) -> None:
    video_path = Path(str(job["video_path"]))
    work_dir = Path(str(job["layout_path"])).parent
    duration = probe_video_duration(video_path)
    segment_seconds = max(30, config.GOPRO_OVERLAY_SEGMENT_SECONDS)
    if duration is None or duration <= segment_seconds:
        raise ValueError("Segmented overlay requested for a video shorter than one segment")

    total_segments = math.ceil(duration / segment_seconds)
    metadata = job.get("command") if isinstance(job.get("command"), dict) else {}
    resume = metadata.get("resume") if isinstance(metadata.get("resume"), dict) else {}
    completed = {
        int(index)
        for index in resume.get("completed_segments", [])
        if isinstance(index, int) or str(index).isdigit()
    }
    metadata = dict(metadata)
    metadata["resume"] = {
        "segment_seconds": segment_seconds,
        "total_segments": total_segments,
        "completed_segments": sorted(completed),
    }
    _update_job(job_id, command_json=json.dumps(metadata), message="Overlay queued")
    if not _transition_job_to_running(job_id, command, render_method):
        return

    base_start = probe_video_start_time(video_path)
    if base_start is None:
        base_start = datetime.fromtimestamp(video_path.stat().st_mtime, tz=timezone.utc)
    rendered_segments: list[Path] = []
    try:
        for index in range(total_segments):
            start = index * segment_seconds
            length = min(segment_seconds, duration - start)
            source_segment = _overlay_segment_path(work_dir, job_id, index, "source")
            rendered_segment = _overlay_segment_path(work_dir, job_id, index, "overlay")
            _create_overlay_segment(video_path, source_segment, start, length)
            segment_timestamp = (base_start + timedelta(seconds=start)).timestamp()
            os.utime(source_segment, (segment_timestamp, segment_timestamp))

            pip_segment = None
            if job.get("pip_path"):
                pip_segment = _overlay_segment_path(work_dir, job_id, index, "pip")
                _create_overlay_segment(Path(str(job["pip_path"])), pip_segment, start, length)
                os.utime(pip_segment, (segment_timestamp, segment_timestamp))

            if index not in completed or not rendered_segment.exists():
                segment_command = command[:-2] + [str(source_segment), str(rendered_segment)]
                segment_cpu_command = cpu_command[:-2] + [
                    str(source_segment),
                    str(rendered_segment),
                ]
                for segment_command_variant in (segment_command, segment_cpu_command):
                    if "--video-time-start" in segment_command_variant:
                        time_start_index = segment_command_variant.index("--video-time-start") + 1
                        segment_command_variant[time_start_index] = "file-modified"
                if pip_segment:
                    original_pip = f"pip={job['pip_path']}"
                    segment_pip = f"pip={pip_segment}"
                    segment_command = [
                        segment_pip if arg == original_pip else arg for arg in segment_command
                    ]
                    segment_cpu_command = [
                        segment_pip if arg == original_pip else arg for arg in segment_cpu_command
                    ]
                _unlink_if_exists(rendered_segment)
                return_code = _run_overlay_process(
                    job_id,
                    segment_command,
                    segment_cpu_command,
                    gpu_render_enabled,
                    log_path,
                    index,
                    total_segments,
                )
                if return_code != 0:
                    raise RuntimeError(_tail_lines(log_path) or f"Segment {index} failed")
                completed.add(index)
                metadata["resume"]["completed_segments"] = sorted(completed)
                _update_job(
                    job_id,
                    progress=math.floor(len(completed) * 100 / total_segments),
                    message=f"Overlay segment {index + 1}/{total_segments} completed",
                    command_json=json.dumps(metadata),
                )
            rendered_segments.append(rendered_segment)

        _concat_overlay_segments(rendered_segments, temp_output_path)
        is_valid, validation_error = _verify_video_output(temp_output_path)
        if not is_valid:
            raise ValueError(validation_error or "ffprobe validation failed")
        temp_output_path.replace(output_path)
        _finish_job(
            job_id,
            status=_STATUS_COMPLETED,
            progress=100,
            message="Overlay ready",
            completed_at=_utc_now(),
        )
    except Exception as exc:
        current = get_gopro_overlay_job(job_id)
        if current and current.get("status") == _STATUS_CANCELLED:
            return
        _finish_job(
            job_id,
            status=_STATUS_FAILED,
            progress=100,
            message="Overlay rendering failed",
            error=str(exc) or exc.__class__.__name__,
            completed_at=_utc_now(),
        )


def _run_overlay_process(
    job_id: str,
    command: list[str],
    cpu_command: list[str],
    gpu_render_enabled: bool,
    log_path: Path,
    segment_index: int,
    total_segments: int,
) -> int:
    selected_command = command
    for attempt in range(2 if gpu_render_enabled else 1):
        process = subprocess.Popen(
            _background_process_command(selected_command),
            cwd=config.GOPRO_OVERLAY_ROOT or None,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        with _LOCK:
            _PROCESSES[job_id] = process
        try:
            with log_path.open("a", encoding="utf-8") as log_file:
                log_file.write(
                    _format_job_log_line(
                        f"Starting overlay segment {segment_index + 1}/{total_segments}"
                    )
                )
                for line in _read_process_updates_from_process(process, job_id):
                    log_file.write(_format_job_log_line(line))
                    log_file.flush()
                    progress = _progress_from_output_chunk(line)
                    if progress is not None:
                        overall = math.floor((segment_index * 100 + progress) / total_segments)
                        _update_job(
                            job_id, progress=overall, message=f"Rendering overlay: {overall}%"
                        )
            return_code = process.wait()
        finally:
            with _LOCK:
                _PROCESSES.pop(job_id, None)
        if return_code == 0 or not gpu_render_enabled or attempt == 1:
            return return_code
        _append_job_log(log_path, "GPU segment failed; retrying with CPU rendering")
        selected_command = cpu_command
    return 1


def _find_layout(layout_id: str) -> GoproOverlayLayout | None:
    return next((layout for layout in _LAYOUTS if layout.id == layout_id), None)


def _nearest_layout(width: int | None, height: int | None) -> GoproOverlayLayout:
    layouts = _LAYOUTS

    if width is None or height is None:
        return layouts[0]

    exact = next(
        (layout for layout in layouts if layout.width == width and layout.height == height), None
    )
    if exact:
        return exact

    def score(layout: GoproOverlayLayout) -> int:
        if layout.width is None or layout.height is None:
            return 10**12
        return abs(layout.width - width) + abs(layout.height - height)

    return min(layouts, key=score)


def _layout_render_size(
    layout: GoproOverlayLayout,
    source_width: int | None,
    source_height: int | None,
    output_resolution: str = "source",
) -> tuple[int | None, int | None]:
    if output_resolution not in _OUTPUT_RESOLUTIONS:
        raise ValueError("Unknown output resolution")
    if dimensions := _OUTPUT_RESOLUTIONS[output_resolution]:
        return dimensions
    return source_width or layout.width, source_height or layout.height


def list_gopro_overlay_layouts(
    video_width: int | None = None,
    video_height: int | None = None,
) -> list[dict[str, Any]]:
    recommended = _nearest_layout(video_width, video_height)
    return [
        {
            "id": layout.id,
            "label": layout.label,
            "filename": layout.path,
            "width": layout.width,
            "height": layout.height,
            "exists": _layout_path(layout).exists(),
            "recommended": layout.id == recommended.id,
        }
        for layout in _LAYOUTS
    ]


def probe_video_resolution(video_path: Path) -> tuple[int | None, int | None]:
    try:
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
                "json",
                str(video_path),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except (FileNotFoundError, subprocess.SubprocessError, TimeoutError):
        return None, None

    payload = json.loads(result.stdout or "{}")
    streams = payload.get("streams") or []
    if not streams:
        return None, None
    stream = streams[0]
    return stream.get("width"), stream.get("height")


async def save_uploaded_file(
    upload: UploadFile,
    destination: Path,
    allowed_extensions: set[str],
) -> Path:
    _validate_file_extension(Path(upload.filename or ""), allowed_extensions)

    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as output:
        while chunk := await upload.read(1024 * 1024):
            output.write(chunk)
    return destination


async def create_gopro_overlay_job(
    video_file: UploadFile,
    gpx_file: UploadFile | None,
    pip_file: UploadFile | None,
    layout_id: str | None,
    output_filename: str | None,
    output_resolution: str = "source",
    fallback_gpx_path: Path | None = None,
    fallback_pip_path: Path | None = None,
    output_dir: str | None = None,
    pin_inputs: bool = False,
    gpx_offset: float = 0.0,
    flight_id: str | None = None,
) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    job_upload_dir = _uploaded_job_work_dir(job_id)
    try:
        video_path = await save_uploaded_file(
            video_file,
            job_upload_dir / _safe_filename(video_file.filename, "input.mp4"),
            _VIDEO_EXTENSIONS,
        )
        if gpx_file and gpx_file.filename:
            gpx_path = await save_uploaded_file(
                gpx_file,
                job_upload_dir / _safe_filename(gpx_file.filename, "track.gpx"),
                _GPX_EXTENSIONS,
            )
        elif fallback_gpx_path:
            _validate_file_extension(fallback_gpx_path, _GPX_EXTENSIONS)
            gpx_path = fallback_gpx_path
        else:
            raise ValueError("A GPX file is required")
        pip_path = None
        if pip_file and pip_file.filename:
            pip_path = await save_uploaded_file(
                pip_file,
                job_upload_dir / _safe_filename(pip_file.filename, "pip.mp4"),
                _VIDEO_EXTENSIONS,
            )
        elif fallback_pip_path:
            _validate_file_extension(fallback_pip_path, _VIDEO_EXTENSIONS)
            pip_path = fallback_pip_path

        with job_admission():
            return await asyncio.to_thread(
                _create_gopro_overlay_job_from_paths,
                job_id=job_id,
                video_path=video_path,
                gpx_path=gpx_path,
                pip_path=pip_path,
                layout_id=layout_id,
                output_filename=output_filename,
                output_resolution=output_resolution,
                work_dir=job_upload_dir,
                output_dir=output_dir,
                pin_inputs=pin_inputs,
                gpx_offset=gpx_offset,
                flight_id=flight_id,
            )
    except Exception:
        shutil.rmtree(job_upload_dir, ignore_errors=True)
        raise


def create_gopro_overlay_job_from_paths(
    video_path: Path,
    gpx_path: Path,
    pip_path: Path | None,
    layout_id: str | None,
    output_filename: str | None,
    output_resolution: str = "source",
    output_dir: str | None = None,
    gpx_offset: float = 0.0,
    flight_id: str | None = None,
) -> dict[str, Any]:
    _validate_file_extension(video_path, _VIDEO_EXTENSIONS)
    _validate_file_extension(gpx_path, _GPX_EXTENSIONS)
    if pip_path:
        _validate_file_extension(pip_path, _VIDEO_EXTENSIONS)

    job_id = str(uuid.uuid4())
    work_dir = _path_job_work_dir(video_path, job_id)
    work_dir.mkdir(parents=True, exist_ok=True)
    try:
        with job_admission():
            return _create_gopro_overlay_job_from_paths(
                job_id=job_id,
                video_path=video_path,
                gpx_path=gpx_path,
                pip_path=pip_path,
                layout_id=layout_id,
                output_filename=output_filename,
                output_resolution=output_resolution,
                work_dir=work_dir,
                pin_inputs=True,
                output_dir=output_dir,
                gpx_offset=gpx_offset,
                flight_id=flight_id,
            )
    except Exception:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise


def _create_gopro_overlay_job_from_paths(
    job_id: str,
    video_path: Path,
    gpx_path: Path,
    pip_path: Path | None,
    layout_id: str | None,
    output_filename: str | None,
    work_dir: Path,
    output_resolution: str = "source",
    pin_inputs: bool = False,
    output_dir: str | None = None,
    gpx_offset: float = 0.0,
    flight_id: str | None = None,
) -> dict[str, Any]:
    if output_resolution not in _OUTPUT_RESOLUTIONS:
        raise ValueError("Unknown output resolution")
    output_name = _safe_filename(output_filename, f"gopro-overlay-{job_id}.mp4")
    if Path(output_name).suffix.lower() != ".mp4":
        output_name = f"{Path(output_name).stem}.mp4"
    output_path = _output_path_for_dir(output_dir, video_path, output_name)

    selected_layout = _find_layout(layout_id) if layout_id else _LAYOUTS[0]
    if not selected_layout:
        raise ValueError("Unknown layout")
    source_layout_path = _layout_path(selected_layout)
    if not source_layout_path.exists():
        raise ValueError(f"Layout file not found: {source_layout_path}")
    layout_path = work_dir / source_layout_path.name

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_output_path = _temp_output_path(output_path, job_id)
    log_path = _gopro_overlay_log_path(job_id)
    render_method = _queued_render_method()
    preparation_metadata = _job_preparation_metadata(
        pin_inputs=pin_inputs,
        requested_layout_id=layout_id,
        output_resolution=output_resolution,
        gpx_offset=gpx_offset,
        render_method=render_method,
    )

    now = _utc_now_dt()
    db_job: GoproOverlayJob | None = None
    try:
        with SessionLocal() as db:
            db_job = GoproOverlayJob(
                id=job_id,
                flight_id=flight_id,
                status=_STATUS_QUEUED,
                progress=0,
                message="Overlay queued",
                error=None,
                video_path=str(video_path),
                gpx_path=str(gpx_path),
                pip_path=str(pip_path) if pip_path else None,
                layout_id=selected_layout.id,
                layout_label=selected_layout.label,
                layout_path=str(layout_path),
                output_path=str(output_path),
                temp_output_path=str(temp_output_path),
                output_filename=output_path.name,
                log_path=str(log_path),
                command_json=json.dumps(preparation_metadata),
                render_method=render_method,
                video_width=None,
                video_height=None,
                created_at=now,
                updated_at=now,
            )
            db.add(db_job)
            db.commit()
            db.refresh(db_job)
            job = _job_to_payload(db_job)
    except OperationalError as exc:
        if "no such table: gopro_overlay_jobs" not in str(exc):
            raise

    if db_job is None:
        job = {
            "job_id": job_id,
            "flight_id": flight_id,
            "status": _STATUS_QUEUED,
            "progress": 0,
            "message": "Overlay queued",
            "error": None,
            "video_path": str(video_path),
            "gpx_path": str(gpx_path),
            "pip_path": str(pip_path) if pip_path else None,
            "layout_id": selected_layout.id,
            "layout_label": selected_layout.label,
            "layout_path": str(layout_path),
            "output_path": str(output_path),
            "temp_output_path": str(temp_output_path),
            "output_filename": output_path.name,
            "log_path": str(log_path),
            "render_method": render_method,
            "video_width": None,
            "video_height": None,
            "gpx_offset": gpx_offset,
            "created_at": _utc_now(),
            "updated_at": _utc_now(),
            "completed_at": None,
            "command": preparation_metadata,
        }

    legacy_job = {
        "job_id": job_id,
        "status": _STATUS_QUEUED,
        "progress": 0,
        "message": "Overlay queued",
        "error": None,
        "video_path": str(video_path),
        "gpx_path": str(gpx_path),
        "pip_path": str(pip_path) if pip_path else None,
        "layout_id": selected_layout.id,
        "layout_label": selected_layout.label,
        "layout_path": str(layout_path),
        "output_path": str(output_path),
        "temp_output_path": str(temp_output_path),
        "output_filename": output_path.name,
        "log_path": str(log_path),
        "video_width": None,
        "video_height": None,
        "output_resolution": output_resolution,
        "gpx_offset": gpx_offset,
        "created_at": _utc_now(),
        "updated_at": _utc_now(),
        "completed_at": None,
        "command": preparation_metadata,
    }
    with _LOCK:
        _JOBS[job_id] = legacy_job

    logger.info(
        "Queued GoPro overlay job %s with layout %s and output %s",
        job_id,
        selected_layout.id,
        output_path,
    )
    _enqueue_existing_gopro_overlay_job(job_id)

    return job.copy()


def _run_job(job_id: str) -> None:
    job = get_gopro_overlay_job(job_id, include_command=True)
    if not job:
        return
    job = _prepare_queued_job(job_id, job)
    if not job or job.get("status") != _STATUS_QUEUED:
        current_job = get_gopro_overlay_job(job_id)
        if current_job and current_job.get("status") in _TERMINAL_STATUSES:
            _cleanup_gopro_overlay_temp_files(current_job)
        return

    prepared_command = job.get("command") if isinstance(job.get("command"), dict) else {}
    render_gpx_path = Path(str(prepared_command.get("render_gpx_path") or job["gpx_path"]))

    command = [
        config.GOPRO_OVERLAY_BIN,
        "--use-gpx-only",
        "--gpx",
        str(render_gpx_path),
        "--layout",
        "xml",
        "--layout-xml",
        job["layout_path"],
    ]
    if video_time_start := prepared_command.get("video_time_start"):
        command[4:4] = ["--video-time-start", str(video_time_start)]
    if config.GOPRO_OVERLAY_FONT:
        command.extend(["--font", config.GOPRO_OVERLAY_FONT])
    if config.GOPRO_OVERLAY_CONFIG_DIR:
        command.extend(["--config-dir", config.GOPRO_OVERLAY_CONFIG_DIR])
    cpu_command = command.copy()
    accelerator = select_video_accelerator(config.VIDEO_ACCELERATOR)
    profile = config.GOPRO_OVERLAY_PROFILE
    if accelerator == "nvidia" and profile == "nnvgpu" and not ffmpeg_supports_cuda_overlay():
        logger.warning("CUDA overlay filters unavailable; using nvgpu profile")
        profile = "nvgpu"
    gpu_render_enabled = accelerator == "nvidia" and bool(profile)
    render_method = "gpu" if gpu_render_enabled else "cpu"

    if gpu_render_enabled:
        command.extend(["--profile", profile])
        if config.GOPRO_OVERLAY_EXTRA_ARGS:
            command.extend(shlex.split(config.GOPRO_OVERLAY_EXTRA_ARGS))
    else:
        logger.info(
            "GoPro overlay job %s falling back to CPU rendering (requested_accelerator=%s profile=%s)",
            job_id,
            config.VIDEO_ACCELERATOR,
            profile or "<none>",
        )
    common_args: list[str] = []
    if job.get("video_width") and job.get("video_height"):
        common_args.extend(["--overlay-size", f"{job['video_width']}x{job['video_height']}"])
    if job.get("pip_path"):
        common_args.extend(["--video", f"pip={job['pip_path']}"])
    output_path = Path(job["output_path"])
    temp_output_path = Path(job.get("temp_output_path") or _temp_output_path(output_path, job_id))
    log_path = Path(job.get("log_path") or temp_output_path.with_suffix(".log"))
    temp_output_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    common_args.extend([job["video_path"], str(temp_output_path)])
    command.extend(common_args)
    cpu_command.extend(common_args)

    logger.info(
        "GoPro overlay runtime for job %s: accelerator=%s profile=%s config_dir=%s extra_args=%s method=%s",
        job_id,
        accelerator,
        profile,
        config.GOPRO_OVERLAY_CONFIG_DIR or "<none>",
        config.GOPRO_OVERLAY_EXTRA_ARGS or "<none>",
        render_method,
    )

    video_duration = probe_video_duration(Path(str(job["video_path"])))
    if video_duration is not None and video_duration > max(
        30, config.GOPRO_OVERLAY_SEGMENT_SECONDS
    ):
        _run_segmented_overlay_job(
            job_id,
            job,
            command,
            cpu_command,
            gpu_render_enabled,
            render_method,
            log_path,
            output_path,
            temp_output_path,
        )
        return

    if not _transition_job_to_running(job_id, command, render_method):
        current_job = get_gopro_overlay_job(job_id)
        if current_job and current_job.get("status") in _TERMINAL_STATUSES:
            _cleanup_gopro_overlay_temp_files(current_job)
        return
    logger.info("Starting GoPro overlay job %s", job_id)
    _append_job_log(log_path, f"Starting GoPro overlay job {job_id}")
    try:
        if temp_output_path.exists():
            temp_output_path.unlink()
        process = subprocess.Popen(
            _background_process_command(command),
            cwd=config.GOPRO_OVERLAY_ROOT or None,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
    except FileNotFoundError as exc:
        logger.exception("GoPro overlay binary not found for job %s", job_id)
        finished_job = _finish_job(
            job_id,
            status=_STATUS_FAILED,
            progress=100,
            message="gopro-dashboard.py not found",
            error=str(exc),
            completed_at=_utc_now(),
        )
        _cleanup_gopro_overlay_temp_files(finished_job)
        return
    except Exception as exc:
        logger.exception("Failed to start GoPro overlay job %s", job_id)
        finished_job = _finish_job(
            job_id,
            status=_STATUS_FAILED,
            progress=100,
            message="Overlay rendering failed to start",
            error=str(exc) or exc.__class__.__name__,
            completed_at=_utc_now(),
        )
        _cleanup_gopro_overlay_temp_files(finished_job)
        return

    with _LOCK:
        if _JOBS[job_id]["status"] == _STATUS_CANCELLED:
            process.terminate()
            return
        _PROCESSES[job_id] = process

    output_lines: list[str] = []
    try:
        with log_path.open("a", encoding="utf-8") as log_file:
            log_file.write(_format_job_log_line(f"Starting GoPro overlay job {job_id}"))
            log_file.write(_format_job_log_line("Command: " + " ".join(command)))
            log_file.flush()
            for line in _read_process_updates_from_process(process, job_id):
                log_file.write(_format_job_log_line(line))
                log_file.flush()
                output_lines.append(line)
                if len(output_lines) > 50:
                    output_lines = output_lines[-50:]
                progress = _progress_from_output_chunk(line)
                if progress is None:
                    _update_job(job_id, message=line or "Rendering overlay")
                else:
                    _update_job(
                        job_id, progress=progress, message=f"Rendering overlay: {progress}%"
                    )

        return_code = process.wait()
        with _LOCK:
            _PROCESSES.pop(job_id, None)

        current_job = get_gopro_overlay_job(job_id, include_command=True)
        if current_job and current_job.get("status") == _STATUS_CANCELLED:
            return

        if return_code != 0 and gpu_render_enabled:
            _unlink_if_exists(temp_output_path)
            _append_job_log(log_path, "GPU overlay failed; retrying with CPU rendering")
            fallback_metadata = current_job.get("command") if current_job else None
            if not isinstance(fallback_metadata, dict):
                fallback_metadata = {}
            fallback_metadata = {
                **fallback_metadata,
                "command": cpu_command,
                "render_method": "cpu",
            }
            _update_job(
                job_id,
                message="GPU unavailable; retrying overlay on CPU",
                render_method="cpu",
                command=cpu_command,
                command_json=json.dumps(fallback_metadata),
            )
            logger.warning("GPU overlay failed for job %s; retrying on CPU", job_id)
            try:
                process = subprocess.Popen(
                    _background_process_command(cpu_command),
                    cwd=config.GOPRO_OVERLAY_ROOT or None,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                )
                with _LOCK:
                    if _JOBS.get(job_id, {}).get("status") == _STATUS_CANCELLED:
                        process.terminate()
                        return
                    _PROCESSES[job_id] = process
                with log_path.open("a", encoding="utf-8") as log_file:
                    log_file.write(
                        _format_job_log_line("CPU fallback command: " + " ".join(cpu_command))
                    )
                    log_file.flush()
                    for line in _read_process_updates_from_process(process, job_id):
                        log_file.write(_format_job_log_line(line))
                        log_file.flush()
                        output_lines.append(line)
                        if len(output_lines) > 50:
                            output_lines = output_lines[-50:]
                        progress = _progress_from_output_chunk(line)
                        if progress is None:
                            _update_job(job_id, message=line or "Rendering overlay on CPU")
                        else:
                            _update_job(
                                job_id,
                                progress=progress,
                                message=f"Rendering overlay on CPU: {progress}%",
                            )
                return_code = process.wait()
            except Exception as exc:
                output_lines.append(str(exc) or exc.__class__.__name__)
                return_code = 1
            finally:
                with _LOCK:
                    _PROCESSES.pop(job_id, None)

            current_job = get_gopro_overlay_job(job_id, include_command=True)
            if current_job and current_job.get("status") == _STATUS_CANCELLED:
                return

        if return_code != 0:
            error = _tail_lines(log_path) or f"Process exited with {return_code}"
            logger.error(
                "GoPro overlay job %s failed with exit code %s: %s",
                job_id,
                return_code,
                error,
            )
            _finish_job(
                job_id,
                status=_STATUS_FAILED,
                progress=100,
                message="Overlay rendering failed",
                error=error,
                completed_at=_utc_now(),
            )
            return

        if not temp_output_path.exists():
            logger.error("GoPro overlay job %s did not create output %s", job_id, temp_output_path)
            _finish_job(
                job_id,
                status=_STATUS_FAILED,
                progress=100,
                message="Output file was not created",
                error=f"Missing output: {temp_output_path}",
                completed_at=_utc_now(),
            )
            return

        is_valid, validation_error = _verify_video_output(temp_output_path)
        if not is_valid:
            _finish_job(
                job_id,
                status=_STATUS_FAILED,
                progress=100,
                message="Overlay output is invalid",
                error=validation_error or "ffprobe validation failed",
                completed_at=_utc_now(),
            )
            return

        resolution_ok, resolution_error = _ensure_video_output_resolution(
            temp_output_path,
            int(job["video_width"]) if job.get("video_width") else None,
            int(job["video_height"]) if job.get("video_height") else None,
            log_path=log_path,
        )
        if not resolution_ok:
            _finish_job(
                job_id,
                status=_STATUS_FAILED,
                progress=100,
                message="Overlay output resolution is invalid",
                error=resolution_error or "ffmpeg resolution correction failed",
                completed_at=_utc_now(),
            )
            return

        temp_output_path.replace(output_path)

        _finish_job(
            job_id,
            status=_STATUS_COMPLETED,
            progress=100,
            message="Overlay ready",
            completed_at=_utc_now(),
        )
        logger.info("Completed GoPro overlay job %s", job_id)
    except Exception as exc:
        logger.exception("GoPro overlay job %s failed unexpectedly", job_id)
        _finish_job(
            job_id,
            status=_STATUS_FAILED,
            progress=100,
            message="Overlay rendering failed unexpectedly",
            error=str(exc) or exc.__class__.__name__,
            completed_at=_utc_now(),
        )
    finally:
        with _LOCK:
            _PROCESSES.pop(job_id, None)
        current_job = get_gopro_overlay_job(job_id)
        if current_job and current_job.get("status") in _TERMINAL_STATUSES:
            _cleanup_gopro_overlay_temp_files(current_job)


def get_gopro_overlay_job(job_id: str, include_command: bool = False) -> dict[str, Any] | None:
    db_payload = _get_db_job_payload(job_id, include_command=include_command)
    if db_payload is not None:
        return db_payload

    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return None
        payload = job.copy()
    log_path = payload.get("log_path")
    payload["log_tail"] = _tail_log_lines(Path(str(log_path))) if log_path else []
    if not include_command:
        payload.pop("command", None)
    return payload


def list_gopro_overlay_jobs() -> list[dict[str, Any]]:
    try:
        with SessionLocal() as db:
            jobs = db.query(GoproOverlayJob).order_by(GoproOverlayJob.created_at.desc()).all()
            if jobs:
                return [_job_to_payload(job) for job in jobs]
    except OperationalError as exc:
        if "no such table: gopro_overlay_jobs" not in str(exc):
            raise

    with _LOCK:
        jobs = []
        for job in _JOBS.values():
            payload = {key: value for key, value in job.items() if key != "command"}
            log_path = payload.get("log_path")
            payload["log_tail"] = _tail_log_lines(Path(str(log_path))) if log_path else []
            jobs.append(payload)
        return jobs


def _path_usage(path: Path) -> tuple[int, int, int]:
    if not path.exists():
        return 0, 0, 0

    if path.is_file() or path.is_symlink():
        try:
            return 1, 0, path.stat().st_size
        except OSError:
            return 1, 0, 0

    files_count = 0
    dirs_count = 1
    bytes_count = 0
    for item in path.rglob("*"):
        if item.is_dir() and not item.is_symlink():
            dirs_count += 1
            continue
        files_count += 1
        try:
            bytes_count += item.stat().st_size
        except OSError:
            pass
    return files_count, dirs_count, bytes_count


def _is_path_inside(path: Path, directory: Path) -> bool:
    try:
        path.resolve(strict=False).relative_to(directory.resolve(strict=False))
    except ValueError:
        return False
    return True


def _job_work_dir(job: dict[str, Any]) -> Path | None:
    layout_path = job.get("layout_path")
    if not layout_path:
        return None
    return Path(str(layout_path)).parent


def _can_delete_work_dir(work_dir: Path) -> bool:
    if _is_path_inside(work_dir, _UPLOAD_WORK_ROOT):
        return True
    return work_dir.parent.name == _PATH_WORK_DIR_NAME


def _cleanup_gopro_overlay_temp_files(job: dict[str, Any]) -> None:
    temp_output_path = job.get("temp_output_path")
    if temp_output_path:
        _unlink_if_exists(Path(str(temp_output_path)))

    work_dir = _job_work_dir(job)
    if not work_dir or not work_dir.exists():
        return
    if not _can_delete_work_dir(work_dir):
        logger.warning(
            "Refusing to clean GoPro overlay work directory outside temp roots: %s", work_dir
        )
        return

    try:
        if work_dir.is_dir() and not work_dir.is_symlink():
            shutil.rmtree(work_dir)
        else:
            work_dir.unlink()
    except OSError:
        logger.exception("Failed to clean GoPro overlay work directory %s", work_dir)


def _queued_job_ids() -> list[str]:
    try:
        with SessionLocal() as db:
            return [
                job.id
                for job in db.query(GoproOverlayJob)
                .filter(GoproOverlayJob.status == _STATUS_QUEUED)
                .order_by(GoproOverlayJob.created_at)
                .all()
            ]
    except OperationalError as exc:
        if "no such table: gopro_overlay_jobs" not in str(exc):
            raise
        with _LOCK:
            return [job_id for job_id, job in _JOBS.items() if job.get("status") == _STATUS_QUEUED]


def _rq_job_id(job_id: str) -> str:
    return f"gopro-overlay-{job_id}"


def _enqueue_gopro_overlay_job_in_rq(job_id: str) -> None:
    from job_queue import enqueue_once

    enqueue_once(
        "gopro_overlay_export.process_gopro_overlay_job",
        job_id,
        job_id=_rq_job_id(job_id),
        timeout=config.GOPRO_OVERLAY_JOB_TIMEOUT_SECONDS,
        queue_name=config.GOPRO_OVERLAY_QUEUE_NAME,
        at_front=True,
    )


def _enqueue_existing_gopro_overlay_job(job_id: str) -> None:
    from job_queue import is_rq_enabled

    if is_rq_enabled():
        _enqueue_gopro_overlay_job_in_rq(job_id)
    elif not config.TESTING:
        start_gopro_overlay_worker()


def _delete_rq_gopro_overlay_job(job_id: str) -> bool:
    from job_queue import delete_job, is_rq_enabled

    if not is_rq_enabled():
        return False
    return delete_job(_rq_job_id(job_id), queue_name=config.GOPRO_OVERLAY_QUEUE_NAME)


def enqueue_pending_gopro_overlay_jobs(*, recover_active: bool = False) -> int:
    """Enqueue durable overlay jobs, recovering interrupted work on worker startup."""
    from job_queue import is_rq_enabled

    if not is_rq_enabled():
        return 0

    if recover_active:
        _mark_interrupted_jobs_failed()
    job_ids = _queued_job_ids()
    for job_id in job_ids:
        _enqueue_gopro_overlay_job_in_rq(job_id)
    return len(job_ids)


def process_gopro_overlay_job(job_id: str) -> None:
    """RQ job target for one GoPro overlay render."""
    _run_job(job_id)


def _mark_interrupted_jobs_failed() -> None:
    jobs_to_clean: list[dict[str, Any]] = []
    try:
        with SessionLocal() as db:
            jobs = (
                db.query(GoproOverlayJob)
                .filter(GoproOverlayJob.status.in_(_INTERRUPTIBLE_STATUSES | _TERMINAL_STATUSES))
                .all()
            )
            for job in jobs:
                if job.status in _INTERRUPTIBLE_STATUSES:
                    job.status = _STATUS_QUEUED
                    job.message = "Overlay interrupted; resuming from the last completed segment"
                    job.error = "The backend stopped while the overlay process was running"
                    job.completed_at = None
                    job.updated_at = _utc_now_dt()
                    _sync_flights_from_job(db, job)
                if job.status in _TERMINAL_STATUSES:
                    jobs_to_clean.append(_job_to_payload(job))
            db.commit()
    except OperationalError as exc:
        if "no such table: gopro_overlay_jobs" not in str(exc):
            raise
        with _LOCK:
            for job in _JOBS.values():
                if job.get("status") in _INTERRUPTIBLE_STATUSES:
                    job.update(
                        status=_STATUS_QUEUED,
                        message="Overlay interrupted; resuming from the last completed segment",
                        error="The backend stopped while the overlay process was running",
                        completed_at=None,
                        updated_at=_utc_now(),
                    )
                if job.get("status") in _TERMINAL_STATUSES:
                    jobs_to_clean.append(job.copy())

    for job in jobs_to_clean:
        _cleanup_gopro_overlay_temp_files(job)


def _worker_loop() -> None:
    logger.info("GoPro overlay worker started")
    _mark_interrupted_jobs_failed()
    while not _WORKER_STOP.is_set():
        job_ids = _queued_job_ids()
        if job_ids:
            _run_job(job_ids[0])
            continue
        _WORKER_STOP.wait(1)


def start_gopro_overlay_worker() -> None:
    global _WORKER_THREAD
    from job_queue import is_rq_enabled

    with _WORKER_LOCK:
        reconcile_gopro_overlay_flight_refs()
        if is_rq_enabled():
            enqueue_pending_gopro_overlay_jobs()
            return
        if _WORKER_THREAD and _WORKER_THREAD.is_alive() is True:
            return
        _WORKER_STOP.clear()
        _WORKER_THREAD = threading.Thread(
            target=_worker_loop,
            name="gopro-overlay-worker",
            daemon=True,
        )
        _WORKER_THREAD.start()


def stop_gopro_overlay_worker() -> None:
    _WORKER_STOP.set()
    if _WORKER_THREAD and _WORKER_THREAD.is_alive():
        _WORKER_THREAD.join(timeout=5)


def delete_gopro_overlay_job(job_id: str) -> dict[str, Any] | None:
    job = get_gopro_overlay_job(job_id)
    if not job:
        return None
    if job["status"] not in _TERMINAL_STATUSES:
        return {"job_id": job_id, "deleted": False, "error": "active"}
    work_dir = _job_work_dir(job)

    result: dict[str, Any] = {
        "job_id": job_id,
        "deleted": False,
        "files_deleted": 0,
        "dirs_deleted": 0,
        "bytes_deleted": 0,
        "paths_deleted": [],
        "errors": [],
    }

    standalone_paths = {
        Path(str(path_value))
        for path_value in (job.get("output_path"), job.get("temp_output_path"))
        if path_value
    }
    for path in standalone_paths:
        if path.exists() and path.is_dir():
            result["errors"].append(
                {"path": str(path), "error": "Refusing to delete a directory as an overlay file"}
            )
            return result

    if work_dir and work_dir.exists():
        if not _can_delete_work_dir(work_dir):
            result["errors"].append(
                {
                    "path": str(work_dir),
                    "error": "Refusing to delete outside overlay work directory",
                }
            )
            return result

    for path in standalone_paths:
        if not path.exists() or (work_dir and _is_path_inside(path, work_dir)):
            continue
        try:
            file_size = path.stat().st_size
            path.unlink()
        except OSError as exc:
            result["errors"].append({"path": str(path), "error": str(exc)})
            return result
        result["files_deleted"] += 1
        result["bytes_deleted"] += file_size
        result["paths_deleted"].append(str(path))

    if work_dir and work_dir.exists():
        files_count, dirs_count, bytes_count = _path_usage(work_dir)
        try:
            if work_dir.is_dir() and not work_dir.is_symlink():
                shutil.rmtree(work_dir)
            else:
                work_dir.unlink()
        except OSError as exc:
            result["errors"].append({"path": str(work_dir), "error": str(exc)})
            return result

        result["files_deleted"] += files_count
        result["dirs_deleted"] += dirs_count
        result["bytes_deleted"] += bytes_count
        result["paths_deleted"].append(str(work_dir))

    log_path_value = job.get("log_path")
    if log_path_value:
        log_path = Path(str(log_path_value))
        if log_path.exists() and _is_path_inside(log_path, _gopro_overlay_log_dir()):
            try:
                log_size = log_path.stat().st_size
                log_path.unlink()
            except OSError as exc:
                result["errors"].append({"path": str(log_path), "error": str(exc)})
                return result
            result["files_deleted"] += 1
            result["bytes_deleted"] += log_size
            result["paths_deleted"].append(str(log_path))

    with _LOCK:
        _JOBS.pop(job_id, None)
    try:
        with SessionLocal() as db:
            db_job = db.query(GoproOverlayJob).filter(GoproOverlayJob.id == job_id).first()
            for flight in db.query(Flight).filter(Flight.gopro_overlay_job_id == job_id).all():
                fallback_job = (
                    db.query(GoproOverlayJob)
                    .filter(
                        GoproOverlayJob.flight_id == flight.id,
                        GoproOverlayJob.id != job_id,
                    )
                    .order_by(GoproOverlayJob.created_at.desc())
                    .first()
                )
                if fallback_job:
                    fallback_command = (
                        json.loads(fallback_job.command_json) if fallback_job.command_json else None
                    )
                    flight.gopro_overlay_job_id = fallback_job.id
                    flight.gopro_overlay_status = fallback_job.status
                    flight.gopro_overlay_file_path = (
                        fallback_job.output_path
                        if fallback_job.status == _STATUS_COMPLETED
                        else None
                    )
                    flight.gopro_overlay_gpx_offset = _gpx_offset_from_command_metadata(
                        fallback_command
                    )
                else:
                    flight.gopro_overlay_job_id = None
                    flight.gopro_overlay_status = None
                    flight.gopro_overlay_file_path = None
            if db_job:
                db.delete(db_job)
            db.commit()
    except OperationalError as exc:
        if "no such table: gopro_overlay_jobs" not in str(exc):
            raise

    result["deleted"] = True
    return result


def cancel_gopro_overlay_job(job_id: str) -> bool:
    with _LOCK:
        process = _PROCESSES.get(job_id)
    job = get_gopro_overlay_job(job_id)

    if not job:
        return False
    if job["status"] in _TERMINAL_STATUSES:
        return True

    if process and process.poll() is None:
        process.terminate()
    else:
        _delete_rq_gopro_overlay_job(job_id)

    _finish_job(
        job_id,
        status=_STATUS_CANCELLED,
        progress=100,
        message="Overlay cancelled",
        completed_at=_utc_now(),
    )
    return True


async def stream_gopro_overlay_job(
    job_id: str,
    is_disconnected: Callable[[], Awaitable[bool]] | None = None,
) -> AsyncGenerator[str, None]:
    last_payload = ""
    while True:
        if is_disconnected and await is_disconnected():
            break
        job = get_gopro_overlay_job(job_id)
        if not job:
            yield 'event: error\ndata: {"detail": "Job not found"}\n\n'
            break

        payload = json.dumps(job, sort_keys=True)
        if payload != last_payload:
            yield f"event: status\ndata: {payload}\n\n"
            last_payload = payload

        if job["status"] in {_STATUS_COMPLETED, _STATUS_FAILED, _STATUS_CANCELLED}:
            break
        await asyncio.sleep(2)


def gopro_overlay_output_path(job_id: str) -> Path | None:
    job = get_gopro_overlay_job(job_id)
    if not job or job["status"] != _STATUS_COMPLETED:
        return None
    path = Path(job["output_path"])
    return path if path.exists() else None


def delete_gopro_overlay_output(job_id: str) -> dict[str, Any] | None:
    job = get_gopro_overlay_job(job_id)
    if not job:
        return None
    if job["status"] not in _TERMINAL_STATUSES:
        return {"job_id": job_id, "deleted": False, "error": "active"}
    output_path = Path(job["output_path"])

    if not output_path.exists():
        return {"job_id": job_id, "deleted": False, "path": str(output_path)}
    if output_path.is_dir():
        return {"job_id": job_id, "deleted": False, "path": str(output_path), "error": "dir"}

    output_path.unlink()
    return {"job_id": job_id, "deleted": True, "path": str(output_path)}


def check_gopro_overlay_dependencies() -> dict[str, bool]:
    gopro_bin = config.GOPRO_OVERLAY_BIN
    has_gopro_dashboard = (
        Path(gopro_bin).exists()
        if os.path.sep in gopro_bin
        else shutil.which(gopro_bin) is not None
    )
    has_ffmpeg = shutil.which("ffmpeg") is not None
    has_ffprobe = shutil.which("ffprobe") is not None
    return {
        "gopro_dashboard": has_gopro_dashboard,
        "ffmpeg": has_ffmpeg,
        "ffprobe": has_ffprobe,
        "ffmpeg_vaapi": _ffmpeg_supports_vaapi() if has_ffmpeg and has_ffprobe else False,
    }


def _ffmpeg_supports_vaapi() -> bool:
    try:
        encoders = subprocess.run(
            ["ffmpeg", "-hide_banner", "-encoders"],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
        hwaccels = subprocess.run(
            ["ffmpeg", "-hide_banner", "-hwaccels"],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (FileNotFoundError, subprocess.SubprocessError, TimeoutError):
        return False
    return "h264_vaapi" in (encoders.stdout or "") and "vaapi" in (hwaccels.stdout or "")


def _ffmpeg_can_use_vaapi_device(render_device: Path) -> bool:
    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-vaapi_device",
                str(render_device),
                "-f",
                "lavfi",
                "-i",
                "nullsrc=s=16x16:d=0.04",
                "-frames:v",
                "1",
                "-c:v",
                "h264_vaapi",
                "-f",
                "null",
                "-",
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (FileNotFoundError, subprocess.SubprocessError, TimeoutError):
        return False

    return result.returncode == 0
