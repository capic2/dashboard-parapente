"""
Video export using Cesium Manual Render approach
Based on: https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/

This module now stores export jobs in the database and runs from a single background
worker while keeping a small in-memory status snapshot for compatibility.
"""

import asyncio
import json
import shutil
import threading
import uuid
import traceback
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from sqlalchemy.orm import Session

import config
from auth import create_job_token
from database import SessionLocal
from flight_storage import get_video_output_path
from models import Flight, VideoExportJob

# Storage for export jobs (compatibility snapshot)
export_jobs: dict[str, dict[str, Any]] = {}


def _video_export_dir() -> Path:
    return Path(config.VIDEO_EXPORT_DIR)


def _video_temp_images_dir() -> Path:
    return Path(config.VIDEO_TEMP_IMAGES_DIR)


_STATUS_QUEUED = "queued"
_STATUS_RUNNING = "running"
_STATUS_CAPTURING = "capturing"
_STATUS_ENCODING = "encoding"
_STATUS_INITIALIZING = "initializing"
_STATUS_COMPLETED = "completed"
_STATUS_FAILED = "failed"
_STATUS_CANCELLED = "cancelled"

_ACTIVE_STATUSES = {
    _STATUS_QUEUED,
    _STATUS_RUNNING,
    _STATUS_CAPTURING,
    _STATUS_ENCODING,
    _STATUS_INITIALIZING,
}

_TERMINAL_STATUSES = {_STATUS_COMPLETED, _STATUS_FAILED, _STATUS_CANCELLED}

_WORKER_THREAD: threading.Thread | None = None
_WORKER_STOP = threading.Event()
_WORKER_LOCK = threading.Lock()
_JOB_UPDATE_DB_LOCK = threading.Lock()
_EXPORT_JOBS_LOCK = threading.Lock()
_JOB_RUNTIME_LOCK = threading.Lock()
_JOB_UPDATE_DB: dict[str, bool] = {}
_JOB_RUNTIME: dict[str, dict[str, Any]] = {}
_JOB_CANCEL_REQUESTS: set[str] = set()

_CANCEL_CHECK_INTERVAL = 10
_FFMPEG_STALL_TIMEOUT_SECONDS = 10 * 60
_ORPHAN_TEMP_CLEANUP_GRACE_SECONDS = 30
_EXPORT_FRAME_TERRAIN_TIMEOUT_SECONDS = 10.0
_EXPORT_FRAME_TERRAIN_POLL_SECONDS = 0.1


def check_dependencies():
    """Check if required system dependencies are installed."""
    missing = []

    if not shutil.which("ffmpeg"):
        missing.append("ffmpeg")

    if missing:
        deps_str = ", ".join(missing)
        print(f"⚠️  WARNING: Missing dependencies: {deps_str}")
        return False

    print("✅ Video export dependencies OK (ffmpeg found)")
    return True


_dependencies_ok = check_dependencies()


def _to_public_status(status: str) -> str:
    """Map internal job status to frontend-compatible status."""
    if status == _STATUS_COMPLETED:
        return "completed"
    if status in {_STATUS_FAILED, _STATUS_CANCELLED}:
        return "failed"
    return "processing"


def _to_iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _default_frontend_url() -> str:
    if config.FRONTEND_URL:
        return config.FRONTEND_URL.rstrip("/")

    static_index = Path(__file__).parent / "static" / "index.html"
    if static_index.exists():
        return _backend_base_url()

    return "http://localhost:5173"


def _backend_base_url() -> str:
    host = "localhost" if config.API_HOST == "0.0.0.0" else config.API_HOST
    return f"http://{host}:{config.API_PORT}"


def _is_local_vite_url(candidate: str) -> bool:
    parsed = urlparse(candidate)
    hostname = (parsed.hostname or "").lower()
    return hostname in {"localhost", "127.0.0.1", "::1"} and parsed.port == 5173


def resolve_frontend_url(frontend_url: str | None = None) -> str:
    """Return a usable frontend base URL for browser automation."""
    if frontend_url:
        return _normalize_frontend_url(frontend_url)
    return _default_frontend_url()


def _normalize_frontend_url(frontend_url: str) -> str:
    candidate = frontend_url.rstrip("/") if frontend_url else _default_frontend_url()
    static_index = Path(__file__).parent / "static" / "index.html"

    if not candidate and static_index.exists():
        return _backend_base_url()

    if not candidate:
        return "http://localhost:5173"

    if "/export-viewer" in candidate:
        candidate = candidate.split("/export-viewer")[0]

    if (
        static_index.exists()
        and config.ENVIRONMENT == "production"
        and _is_local_vite_url(candidate)
    ):
        return _backend_base_url()

    return candidate.rstrip("/")


def _snapshot_from_job(job: VideoExportJob) -> dict[str, Any]:
    resume_info = _job_resume_info(job)
    snapshot = {
        "job_id": job.id,
        "flight_id": job.flight_id,
        "status": _to_public_status(job.status),
        "internal_status": job.status,
        "progress": job.progress or 0,
        "message": job.message,
        "started_at": _to_iso(job.started_at),
        "completed_at": _to_iso(job.completed_at),
        "video_path": job.video_path,
        "error": job.error,
        "total_frames": job.total_frames,
        "fps": job.fps,
        "quality": job.quality,
        "speed": job.speed,
        "mode": job.mode,
        "created_at": _to_iso(job.created_at),
        "updated_at": _to_iso(job.updated_at),
        "cancelled_at": _to_iso(job.cancelled_at),
        **resume_info,
    }

    with _JOB_RUNTIME_LOCK:
        runtime = _JOB_RUNTIME.get(job.id, {}).copy()
    snapshot.update(runtime)
    return snapshot


def _set_job_runtime(job_id: str, **kwargs: Any) -> None:
    with _JOB_RUNTIME_LOCK:
        current = _JOB_RUNTIME.get(job_id, {}).copy()
        for key, value in kwargs.items():
            if value is None:
                current.pop(key, None)
            else:
                current[key] = value
        if current:
            _JOB_RUNTIME[job_id] = current
        else:
            _JOB_RUNTIME.pop(job_id, None)


def _clear_job_runtime(job_id: str) -> None:
    with _JOB_RUNTIME_LOCK:
        _JOB_RUNTIME.pop(job_id, None)


def _set_job_cancel_requested(job_id: str) -> None:
    with _JOB_RUNTIME_LOCK:
        _JOB_CANCEL_REQUESTS.add(job_id)


def _clear_job_cancel_requested(job_id: str) -> None:
    with _JOB_RUNTIME_LOCK:
        _JOB_CANCEL_REQUESTS.discard(job_id)


def _is_job_cancel_requested(job_id: str) -> bool:
    with _JOB_RUNTIME_LOCK:
        return job_id in _JOB_CANCEL_REQUESTS


def _set_memory_snapshot(job_id: str, data: dict[str, Any] | None):
    with _EXPORT_JOBS_LOCK:
        if data is None:
            export_jobs.pop(job_id, None)
        else:
            export_jobs[job_id] = data


def _get_memory_snapshot(job_id: str) -> dict[str, Any] | None:
    with _EXPORT_JOBS_LOCK:
        snapshot = export_jobs.get(job_id)
    return snapshot


def _set_job_update_db_flag(job_id: str, should_update_db: bool):
    with _JOB_UPDATE_DB_LOCK:
        _JOB_UPDATE_DB[job_id] = should_update_db


def _pop_job_update_db_flag(job_id: str) -> bool | None:
    with _JOB_UPDATE_DB_LOCK:
        return _JOB_UPDATE_DB.pop(job_id, None)


def _get_job_update_db_flag(job_id: str, default: bool = True) -> bool:
    with _JOB_UPDATE_DB_LOCK:
        return _JOB_UPDATE_DB.get(job_id, default)


def _set_job_auth_token(job_id: str, token: str | None):
    with SessionLocal() as db:
        job = db.query(VideoExportJob).filter(VideoExportJob.id == job_id).first()
        if not job:
            return

        job.auth_token = token
        job.updated_at = datetime.utcnow()
        db.commit()


def _get_job_auth_token(job_id: str) -> str | None:
    with SessionLocal() as db:
        job = db.query(VideoExportJob).filter(VideoExportJob.id == job_id).first()
        if not job:
            return None
        return job.auth_token


def get_video_export_job_token(job_id: str) -> str | None:
    return _get_job_auth_token(job_id)


def _clear_job_auth_token(job_id: str):
    _set_job_auth_token(job_id, None)


def _build_playwright_init_script(auth_token: str | None) -> str:
    token_literal = json.dumps(auth_token) if auth_token else "null"
    return f"""
        (() => {{
            window._exportMode = 'manual_render';

            const token = {token_literal};
            if (token) {{
                localStorage.setItem(
                    'parapente-auth',
                    JSON.stringify({{ state: {{ token }} }})
                );
            }}
        }})();
    """


def _create_video_export_job_token(job_id: str, flight_id: str) -> str:
    return create_job_token(purpose="video_export", job_id=job_id, flight_id=flight_id)


def _get_job(job_id: str, db: Session | None = None) -> VideoExportJob | None:
    owns_session = False
    if db is None:
        db = SessionLocal()
        owns_session = True
    try:
        return db.query(VideoExportJob).filter(VideoExportJob.id == job_id).first()
    finally:
        if owns_session:
            db.close()


def _update_flight_from_job(db: Session, job: VideoExportJob):
    flight = db.query(Flight).filter(Flight.id == job.flight_id).first()
    if not flight:
        return

    flight.video_export_job_id = job.id
    flight.video_export_status = _to_public_status(job.status)

    if job.status == _STATUS_COMPLETED:
        flight.video_file_path = job.video_path
    elif job.status == _STATUS_QUEUED:
        flight.video_file_path = None


def _update_job(
    job_id: str,
    *,
    update_db: bool | None = None,
    **kwargs,
) -> VideoExportJob | None:
    with SessionLocal() as db:
        job = db.query(VideoExportJob).filter(VideoExportJob.id == job_id).first()
        if not job:
            return None

        for key, value in kwargs.items():
            setattr(job, key, value)

        job.updated_at = datetime.utcnow()
        if job.status == _STATUS_RUNNING and not job.started_at:
            job.started_at = datetime.utcnow()

        popped_update_db: bool | None = None
        if job.status in _TERMINAL_STATUSES:
            job.auth_token = None
            if job.status == _STATUS_COMPLETED:
                if not job.completed_at:
                    job.completed_at = datetime.utcnow()
            if job.status == _STATUS_CANCELLED and not job.cancelled_at:
                job.cancelled_at = datetime.utcnow()

            _clear_job_runtime(job_id)

            popped_update_db = _pop_job_update_db_flag(job_id)

        if update_db is not None:
            should_update_flight = update_db
        elif popped_update_db is not None:
            should_update_flight = popped_update_db
        else:
            should_update_flight = _get_job_update_db_flag(job_id, True)
        if should_update_flight:
            _update_flight_from_job(db, job)
        db.commit()

        snapshot = _snapshot_from_job(job)
        _set_memory_snapshot(job_id, snapshot)
        return job


def _is_cancelled(job_id: str) -> bool:
    if _is_job_cancel_requested(job_id):
        return True

    snapshot = _get_memory_snapshot(job_id)
    if snapshot and snapshot.get("internal_status") == _STATUS_CANCELLED:
        return True

    job = _get_job(job_id)
    return bool(job and job.status == _STATUS_CANCELLED)


def _mark_stale_jobs_as_queued():
    with SessionLocal() as db:
        cutoff = datetime.utcnow() - timedelta(minutes=2)
        stale_jobs = (
            db.query(VideoExportJob)
            .filter(VideoExportJob.status.in_(list(_ACTIVE_STATUSES)))
            .filter(VideoExportJob.updated_at < cutoff)
            .all()
        )

        if not stale_jobs:
            return

        for job in stale_jobs:
            job.status = _STATUS_QUEUED
            job.message = "Recovered from restart"
            job.updated_at = datetime.utcnow()

        db.commit()

        for job in stale_jobs:
            _set_memory_snapshot(job.id, _snapshot_from_job(job))


def _acquire_next_job() -> str | None:
    with SessionLocal() as db:
        job = (
            db.query(VideoExportJob)
            .filter(VideoExportJob.status == _STATUS_QUEUED)
            .with_for_update(skip_locked=True)
            .order_by(VideoExportJob.created_at)
            .first()
        )
        if not job:
            return None

        job.status = _STATUS_RUNNING
        job.message = "Starting manual export"
        job.updated_at = datetime.utcnow()
        job.started_at = datetime.utcnow()
        db.commit()
        _set_memory_snapshot(job.id, _snapshot_from_job(job))
        return job.id


def _acquire_job(job_id: str) -> str | None:
    with SessionLocal() as db:
        job = db.query(VideoExportJob).filter(VideoExportJob.id == job_id).first()
        if not job or job.status != _STATUS_QUEUED:
            return None

        job.status = _STATUS_RUNNING
        job.message = "Starting manual export"
        job.updated_at = datetime.utcnow()
        job.started_at = datetime.utcnow()
        db.commit()
        _set_memory_snapshot(job.id, _snapshot_from_job(job))
        return job.id


def _queued_job_ids() -> list[str]:
    with SessionLocal() as db:
        jobs = (
            db.query(VideoExportJob.id)
            .filter(VideoExportJob.status == _STATUS_QUEUED)
            .order_by(VideoExportJob.created_at)
            .all()
        )
    return [str(job_id) for (job_id,) in jobs]


def _rq_job_id(job_id: str) -> str:
    return f"video-export:{job_id}"


def _enqueue_video_export_job_in_rq(job_id: str) -> None:
    from job_queue import enqueue_once

    enqueue_once(
        "video_export_manual.process_video_export_job",
        job_id,
        job_id=_rq_job_id(job_id),
        timeout=config.JOB_QUEUE_TIMEOUT_SECONDS,
    )


def _enqueue_existing_video_export_job(job_id: str) -> None:
    from job_queue import is_rq_enabled

    if is_rq_enabled():
        _enqueue_video_export_job_in_rq(job_id)
    else:
        start_video_export_worker()


def enqueue_pending_video_export_jobs() -> int:
    """Enqueue queued DB jobs into RQ after an API or worker restart."""
    from job_queue import is_rq_enabled

    if not is_rq_enabled():
        return 0

    _mark_stale_jobs_as_queued()
    job_ids = _queued_job_ids()
    for job_id in job_ids:
        _enqueue_video_export_job_in_rq(job_id)
    return len(job_ids)


def process_video_export_job(job_id: str) -> None:
    """RQ job target for a single manual video export."""
    acquired_job_id = _acquire_job(job_id)
    if not acquired_job_id:
        return

    asyncio.run(_export_video_manual_render(acquired_job_id))


def _cleanup_temp_dir(temp_dir: Path | None) -> None:
    if temp_dir is not None:
        shutil.rmtree(temp_dir, ignore_errors=True)


def _frame_index_from_path(path: Path) -> int | None:
    name = path.name
    if not name.startswith("frame") or not name.endswith(".png"):
        return None

    raw_index = name.removeprefix("frame").removesuffix(".png")
    if not raw_index.isdigit():
        return None
    return int(raw_index)


def _existing_frame_indexes(frames_dir: Path) -> set[int]:
    if not frames_dir.exists():
        return set()

    indexes: set[int] = set()
    for frame_path in frames_dir.glob("frame*.png"):
        frame_index = _frame_index_from_path(frame_path)
        if frame_index is not None:
            indexes.add(frame_index)
    return indexes


def _first_missing_frame_index(frames_dir: Path, total_frames: int) -> int:
    existing_indexes = _existing_frame_indexes(frames_dir)
    for frame_index in range(max(total_frames, 0)):
        if frame_index not in existing_indexes:
            return frame_index
    return max(total_frames, 0)


def _job_resume_info(job: VideoExportJob) -> dict[str, Any]:
    frames_dir = _job_frames_dir(_video_temp_images_dir(), job.id)
    existing_indexes = _existing_frame_indexes(frames_dir)
    total_frames = job.total_frames or 0
    resume_from_frame = _first_missing_frame_index(frames_dir, total_frames)
    is_resumable_status = job.status in {_STATUS_CANCELLED, _STATUS_FAILED}
    can_resume = is_resumable_status and bool(existing_indexes)

    return {
        "can_resume": can_resume,
        "frames_captured": len(existing_indexes),
        "resume_from_frame": resume_from_frame if can_resume else None,
    }


def _is_path_inside(path: Path, directory: Path) -> bool:
    try:
        path.resolve(strict=False).relative_to(directory.resolve(strict=False))
    except ValueError:
        return False
    return True


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


def _delete_temp_path(path: Path, allowed_root: Path) -> dict[str, Any]:
    result: dict[str, Any] = {
        "path": str(path),
        "deleted": False,
        "files_deleted": 0,
        "dirs_deleted": 0,
        "bytes_deleted": 0,
        "error": None,
    }

    if not path.exists():
        return result

    if not _is_path_inside(path, allowed_root):
        result["error"] = "Refusing to delete outside configured temp directory"
        return result

    files_count, dirs_count, bytes_count = _path_usage(path)
    try:
        if path.is_dir() and not path.is_symlink():
            shutil.rmtree(path)
        else:
            path.unlink()
    except OSError as exc:
        result["error"] = str(exc)
        return result

    result.update(
        {
            "deleted": True,
            "files_deleted": files_count,
            "dirs_deleted": dirs_count,
            "bytes_deleted": bytes_count,
        }
    )
    return result


def _is_export_active(export: dict[str, Any]) -> bool:
    internal_status = export.get("internal_status")
    if isinstance(internal_status, str):
        return internal_status in _ACTIVE_STATUSES
    return export.get("status") in {"started", "processing", *_ACTIVE_STATUSES}


def _is_path_older_than(path: Path, age_seconds: int) -> bool:
    try:
        return time.time() - path.stat().st_mtime >= age_seconds
    except OSError:
        return False


def cleanup_video_export_temp_files(exports: list[dict[str, Any]]) -> dict[str, Any]:
    """Delete non-active video export temporary files from configured storage."""
    active_job_ids = {
        str(export["job_id"])
        for export in exports
        if export.get("job_id") and _is_export_active(export)
    }
    known_inactive_job_ids = {
        str(export["job_id"])
        for export in exports
        if export.get("job_id") and not _is_export_active(export)
    }

    candidates: list[tuple[Path, Path]] = []
    temp_root = _video_temp_images_dir()
    export_root = _video_export_dir()

    for job_id in known_inactive_job_ids:
        candidates.append((_job_temp_dir(temp_root, job_id), temp_root))
        candidates.append((export_root / f"frames_{job_id}", export_root))
        candidates.append((Path("/tmp") / f"playwright-debug-{job_id}.png", Path("/tmp")))
        candidates.append((Path("/tmp") / f"playwright-error-{job_id}.png", Path("/tmp")))

    if temp_root.exists():
        for child in temp_root.iterdir():
            if child.name not in active_job_ids and _is_path_older_than(
                child, _ORPHAN_TEMP_CLEANUP_GRACE_SECONDS
            ):
                candidates.append((child, temp_root))

    if export_root.exists():
        for child in export_root.glob("frames_*"):
            job_id = child.name.removeprefix("frames_")
            if job_id not in active_job_ids and _is_path_older_than(
                child, _ORPHAN_TEMP_CLEANUP_GRACE_SECONDS
            ):
                candidates.append((child, export_root))

    seen: set[str] = set()
    deleted_paths: list[str] = []
    errors: list[dict[str, str]] = []
    files_deleted = 0
    dirs_deleted = 0
    bytes_deleted = 0

    for path, allowed_root in candidates:
        resolved_key = str(path.resolve(strict=False))
        if resolved_key in seen:
            continue
        seen.add(resolved_key)

        deletion = _delete_temp_path(path, allowed_root)
        if deletion["deleted"]:
            deleted_paths.append(str(deletion["path"]))
            files_deleted += int(deletion["files_deleted"])
            dirs_deleted += int(deletion["dirs_deleted"])
            bytes_deleted += int(deletion["bytes_deleted"])
        elif deletion["error"]:
            errors.append({"path": str(deletion["path"]), "error": str(deletion["error"])})

    return {
        "files_deleted": files_deleted,
        "dirs_deleted": dirs_deleted,
        "bytes_deleted": bytes_deleted,
        "paths_deleted": deleted_paths,
        "errors": errors,
    }


def cleanup_video_export_job_temp_files(job_id: str) -> dict[str, Any]:
    """Delete temporary files for a single inactive video export job."""
    candidates = [
        (_job_temp_dir(_video_temp_images_dir(), job_id), _video_temp_images_dir()),
        (_video_export_dir() / f"frames_{job_id}", _video_export_dir()),
        (Path("/tmp") / f"playwright-debug-{job_id}.png", Path("/tmp")),
        (Path("/tmp") / f"playwright-error-{job_id}.png", Path("/tmp")),
    ]

    deleted_paths: list[str] = []
    errors: list[dict[str, str]] = []
    files_deleted = 0
    dirs_deleted = 0
    bytes_deleted = 0

    for path, allowed_root in candidates:
        deletion = _delete_temp_path(path, allowed_root)
        if deletion["deleted"]:
            deleted_paths.append(str(deletion["path"]))
            files_deleted += int(deletion["files_deleted"])
            dirs_deleted += int(deletion["dirs_deleted"])
            bytes_deleted += int(deletion["bytes_deleted"])
        elif deletion["error"]:
            errors.append({"path": str(deletion["path"]), "error": str(deletion["error"])})

    return {
        "files_deleted": files_deleted,
        "dirs_deleted": dirs_deleted,
        "bytes_deleted": bytes_deleted,
        "paths_deleted": deleted_paths,
        "errors": errors,
    }


def delete_video_export_job(job_id: str) -> dict[str, Any] | None:
    """Delete an inactive video export row and its temporary files."""
    job = _get_job(job_id)
    snapshot = _snapshot_from_job(job) if job else _get_memory_snapshot(job_id)
    if not snapshot:
        return None
    if _is_export_active(snapshot):
        return {"job_id": job_id, "deleted": False, "error": "active"}

    cleanup = cleanup_video_export_job_temp_files(job_id)
    if job:
        with SessionLocal() as db:
            db_job = db.query(VideoExportJob).filter(VideoExportJob.id == job_id).first()
            if db_job:
                db.delete(db_job)
                db.commit()

    _set_memory_snapshot(job_id, None)
    _clear_job_runtime(job_id)
    _clear_job_cancel_requested(job_id)
    _clear_job_auth_token(job_id)
    return {"job_id": job_id, "deleted": True, **cleanup}


def _prepare_export_dirs(export_root: Path, temp_dir: Path, frames_dir: Path) -> None:
    try:
        export_root.mkdir(parents=True, exist_ok=True)
        temp_dir.mkdir(parents=True, exist_ok=True)
        frames_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise RuntimeError(f"Video export storage is not writable: {exc}") from exc


def _job_temp_dir(temp_root: Path, job_id: str) -> Path:
    return temp_root / job_id


def _job_frames_dir(temp_root: Path, job_id: str) -> Path:
    return _job_temp_dir(temp_root, job_id) / "frames"


def _video_output_path(flight_id: str, timestamp: str) -> Path:
    return get_video_output_path(flight_id, timestamp)


def _capture_progress_percent(frame_count: int, total_frames: int) -> int:
    if total_frames <= 0:
        return 5
    ratio = min(max(frame_count / total_frames, 0.0), 1.0)
    return min(80, max(5, int(5 + ratio * 75)))


def _parse_ffmpeg_out_time_seconds(line: str) -> float | None:
    if "=" not in line:
        return None

    key, raw_value = line.split("=", 1)
    value = raw_value.strip()

    # FFmpeg uses a historical misnomer: out_time_ms is also reported in microseconds.
    # Keep division by 1_000_000 for both keys (not 1_000).
    if key == "out_time_ms" and value.isdigit():
        return int(value) / 1_000_000

    if key == "out_time_us" and value.isdigit():
        return int(value) / 1_000_000

    if key == "out_time":
        parts = value.split(":")
        if len(parts) != 3:
            return None
        try:
            hours = float(parts[0])
            minutes = float(parts[1])
            seconds = float(parts[2])
        except ValueError:
            return None
        return max(0.0, hours * 3600 + minutes * 60 + seconds)

    return None


def _ffmpeg_encoding_settings(is_fast_mode: bool) -> tuple[str, str]:
    if is_fast_mode:
        return "veryfast", "23"
    return "medium", "18"


def _ffmpeg_timeout_seconds(video_duration_seconds: float) -> int:
    dynamic_timeout = int(max(video_duration_seconds, 1.0) * 20)
    return max(6 * 60 * 60, dynamic_timeout)


async def _wait_for_export_frame_terrain(
    page: Any,
    timeout_seconds: float = _EXPORT_FRAME_TERRAIN_TIMEOUT_SECONDS,
    poll_seconds: float = _EXPORT_FRAME_TERRAIN_POLL_SECONDS,
) -> bool:
    deadline = time.monotonic() + timeout_seconds

    while True:
        tiles_loaded = await page.evaluate("""
            () => {
                const viewer = window._cesiumViewer;
                const scene = viewer?.scene;
                const globe = scene?.globe;

                if (!viewer || !scene || !globe) {
                    return false;
                }

                try {
                    scene.requestRender?.();
                    viewer.render?.();
                } catch {
                    return false;
                }

                return Boolean(globe.tilesLoaded);
            }
        """)

        if tiles_loaded:
            return True

        remaining_seconds = deadline - time.monotonic()
        if remaining_seconds <= 0:
            return False

        await asyncio.sleep(min(poll_seconds, remaining_seconds))


def _ffmpeg_output_file_activity(
    output_file: Path, last_size: int, last_mtime_ns: int
) -> tuple[bool, int, int]:
    try:
        stat = output_file.stat()
    except FileNotFoundError:
        return False, last_size, last_mtime_ns

    size = stat.st_size
    mtime_ns = stat.st_mtime_ns
    return size != last_size or mtime_ns != last_mtime_ns, size, mtime_ns


def _encoding_progress_percent(encoded_seconds: float, total_duration_seconds: float) -> int:
    if total_duration_seconds <= 0:
        return 80
    ratio = min(max(encoded_seconds / total_duration_seconds, 0.0), 1.0)
    return min(99, max(80, int(80 + ratio * 19)))


def _worker_loop():
    print("🚀 Manual video export worker started")
    while not _WORKER_STOP.is_set():
        job_id = None
        try:
            job_id = _acquire_next_job()

            if not job_id:
                _WORKER_STOP.wait(1)
                continue

            asyncio.run(_export_video_manual_render(job_id))
        except Exception as e:
            if job_id:
                print(f"❌ Worker failed for job {job_id}: {e}")
                traceback.print_exc()
                _update_job(
                    job_id,
                    status=_STATUS_FAILED,
                    error=str(e),
                    message="Worker internal error",
                )
            else:
                print(f"❌ Worker error: {e}")


def start_video_export_worker():
    """Start the singleton background worker for manual exports."""
    from job_queue import is_rq_enabled

    if is_rq_enabled():
        enqueue_pending_video_export_jobs()
        return

    global _WORKER_THREAD
    with _WORKER_LOCK:
        if _WORKER_THREAD and _WORKER_THREAD.is_alive():
            return

        _WORKER_STOP.clear()
        _mark_stale_jobs_as_queued()

        _WORKER_THREAD = threading.Thread(
            target=_worker_loop,
            name="video-export-manual-worker",
            daemon=True,
        )
        _WORKER_THREAD.start()


def stop_video_export_worker():
    """Stop the manual export worker (used during shutdown)."""
    _WORKER_STOP.set()
    if _WORKER_THREAD and _WORKER_THREAD.is_alive():
        _WORKER_THREAD.join(timeout=5)


def _enqueue_video_export_job(
    flight_id: str,
    mode: str,
    quality: str = "1080p",
    fps: int = 15,
    speed: int = 1,
    frontend_url: str = "http://localhost:5173",
    update_db: bool = True,
    auth_token: str | None = None,
):
    """Create a new export job and enqueue it for the configured queue backend."""
    if not _dependencies_ok:
        raise RuntimeError("Missing dependencies for video export")

    job_id = str(uuid.uuid4())
    now = datetime.utcnow()

    with SessionLocal() as db:
        job = VideoExportJob(
            id=job_id,
            flight_id=flight_id,
            status=_STATUS_QUEUED,
            mode=mode,
            quality=quality,
            fps=fps,
            speed=speed,
            progress=0,
            message="Job enqueued",
            frontend_url=frontend_url,
            started_at=None,
            updated_at=now,
            created_at=now,
        )
        db.add(job)

        if update_db:
            _set_job_update_db_flag(job_id, True)
        else:
            _set_job_update_db_flag(job_id, False)

        flight = db.query(Flight).filter(Flight.id == flight_id).first()
        if flight:
            if update_db:
                flight.video_export_job_id = job_id
                flight.video_export_status = _to_public_status(_STATUS_QUEUED)
                flight.video_file_path = None

        db.commit()
        _set_memory_snapshot(job_id, _snapshot_from_job(job))
        _set_job_runtime(job_id, phase=_STATUS_QUEUED)

    _set_job_auth_token(job_id, auth_token or _create_video_export_job_token(job_id, flight_id))

    _enqueue_existing_video_export_job(job_id)
    return job_id


def start_video_export_manual(
    flight_id: str,
    quality: str = "1080p",
    fps: int = 15,
    speed: int = 1,
    frontend_url: str = "http://localhost:5173",
    update_db: bool = True,
    auth_token: str | None = None,
):
    """Create a classic manual render export job."""
    return _enqueue_video_export_job(
        flight_id=flight_id,
        mode="manual",
        quality=quality,
        fps=fps,
        speed=speed,
        frontend_url=frontend_url,
        update_db=update_db,
        auth_token=auth_token,
    )


def start_video_export_manual_fast(
    flight_id: str,
    quality: str = "1080p",
    fps: int = 15,
    speed: int = 1,
    frontend_url: str = "http://localhost:5173",
    update_db: bool = True,
    auth_token: str | None = None,
):
    """Create a deterministic screenshot export job without realtime playback waits."""
    return _enqueue_video_export_job(
        flight_id=flight_id,
        mode="manual_fast",
        quality=quality,
        fps=fps,
        speed=speed,
        frontend_url=frontend_url,
        update_db=update_db,
        auth_token=auth_token,
    )


async def _export_video_manual_render(job_id: str):
    """Export video using Cesium manual render - frame by frame."""
    job = _get_job(job_id)
    if not job:
        return

    quality = job.quality or "1080p"
    fps = job.fps or 15
    speed = job.speed or 1
    is_fast_mode = job.mode == "manual_fast"
    flight_id = job.flight_id
    frontend_url = resolve_frontend_url(job.frontend_url)
    export_root = _video_export_dir()
    temp_root = _video_temp_images_dir()
    temp_dir: Path | None = None
    frames_dir: Path | None = None

    try:
        from playwright.async_api import async_playwright

        _update_job(job_id, status=_STATUS_INITIALIZING, message="Setting up manual render")
        _set_job_runtime(job_id, phase=_STATUS_INITIALIZING)

        # Resolution mapping
        resolutions = {"720p": (1280, 720), "1080p": (1920, 1080), "4K": (3840, 2160)}
        width, height = resolutions.get(quality, (1920, 1080))

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--enable-gpu",
                    "--use-gl=egl",
                    "--enable-webgl",
                    "--enable-webgl2",
                    "--ignore-gpu-blocklist",
                    "--disable-gpu-vsync",
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--js-flags=--max-old-space-size=8192",
                    "--disable-background-timer-throttling",
                    "--disable-backgrounding-occluded-windows",
                    "--disable-renderer-backgrounding",
                    "--force-device-scale-factor=1",
                    "--high-dpi-support=1",
                ],
            )

            context = await browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=1,
                java_script_enabled=True,
            )
            page = await context.new_page()

            auth_token = job.auth_token
            await page.add_init_script(_build_playwright_init_script(auth_token))

            page.on("console", lambda msg: print(f"🖥️  [{msg.type}]: {msg.text}"))
            page.on("pageerror", lambda err: print(f"❌ Browser error: {err}"))

            url = f"{frontend_url}/export-viewer?flightId={flight_id}&jobId={job_id}"
            log_url = url
            if auth_token:
                url = f"{url}&exportToken={auth_token}"
                log_url = f"{log_url}&exportToken=<redacted>"
            print(f"📺 Opening {log_url}")

            _update_job(job_id, message="Loading export viewer")
            response = await page.goto(url, wait_until="networkidle", timeout=60000)
            if response.status >= 400:
                raise Exception(f"Page returned HTTP {response.status}")

            _update_job(job_id, message="Waiting for Cesium viewer")
            await page.wait_for_load_state("domcontentloaded")
            await page.wait_for_function(
                """
                () => {
                    const hasCanvas = Boolean(document.querySelector('.cesium-viewer canvas, canvas'));
                    const isLoginPage =
                        window.location.pathname === '/login' ||
                        Boolean(document.querySelector('input[type="password"]'));

                    const errorText = document.body?.innerText || '';
                    const hasViewerError =
                        errorText.includes("Erreur d'initialisation Cesium") ||
                        errorText.includes('VITE_CESIUM_ION_TOKEN is required') ||
                        errorText.includes('No flight ID provided');

                    return hasCanvas || isLoginPage || hasViewerError;
                }
                """,
                timeout=60000,
            )

            viewer_state = await page.evaluate("""
                () => {
                    const hasCanvas = Boolean(document.querySelector('.cesium-viewer canvas, canvas'));
                    const isLoginPage =
                        window.location.pathname === '/login' ||
                        Boolean(document.querySelector('input[type="password"]'));
                    const errorText = document.body?.innerText || '';

                    return {
                        hasCanvas,
                        isLoginPage,
                        path: window.location.pathname,
                        hasViewerError: errorText.includes("Erreur d'initialisation Cesium"),
                        missingIonToken: errorText.includes('VITE_CESIUM_ION_TOKEN is required'),
                        missingFlightId: errorText.includes('No flight ID provided'),
                    };
                }
                """)

            if viewer_state.get("isLoginPage"):
                raise Exception(
                    "Export viewer redirected to /login (missing auth token in Playwright context)"
                )

            if viewer_state.get("missingIonToken"):
                raise Exception("Cesium token missing: VITE_CESIUM_ION_TOKEN is required")

            if viewer_state.get("missingFlightId"):
                raise Exception("Export viewer opened without flightId")

            if not viewer_state.get("hasCanvas"):
                raise Exception(
                    f"Cesium canvas not available (path={viewer_state.get('path', 'unknown')})"
                )

            await asyncio.sleep(3)

            print("✅ Cesium viewer found")

            _update_job(job_id, message="Configuring manual render mode")

            setup_result = await page.evaluate("""
                () => {
                    const cesiumContainer = document.querySelector('.cesium-viewer');
                    if (!cesiumContainer) {
                        throw new Error('Cesium viewer container not found');
                    }

                    return new Promise((resolve) => {
                        const checkViewer = () => {
                            const viewer = window._cesiumViewer ||
                                          window.viewer ||
                                          cesiumContainer._viewer;

                            if (viewer && viewer.scene) {
                                viewer.useDefaultRenderLoop = false;
                                viewer.clock.shouldAnimate = false;

                                window._cesiumViewer = viewer;
                                window._exportMode = 'manual_render';

                                console.log('✅ Cesium configured for manual render');

                                resolve({ success: true });
                            } else {
                                setTimeout(checkViewer, 100);
                            }
                        };
                        checkViewer();
                    });
                }
            """)

            if not setup_result.get("success"):
                raise Exception("Failed to configure Cesium manual render mode")

            print("✅ Cesium manual render mode configured")

            _update_job(job_id, message="Waiting for terrain")
            terrain_ready = await _wait_for_export_frame_terrain(
                page,
                timeout_seconds=60.0,
                poll_seconds=0.5,
            )
            if terrain_ready:
                print("✅ Initial terrain loaded")
            else:
                print("⚠️  Terrain timeout - continuing anyway")

            await asyncio.sleep(2)

            _update_job(job_id, message="Extracting GPS data")

            flight_data = await page.evaluate("""
                () => {
                    if (typeof window._getExportMetadata === 'function') {
                        return window._getExportMetadata();
                    }

                    const gpxData = window._gpxData || {};
                    const coordinates = gpxData.coordinates || [];

                    console.log('GPS points found:', coordinates.length);

                    return {
                        totalPoints: coordinates.length,
                        duration: coordinates.length > 0 ? coordinates.length : 300
                    };
                }
            """)

            total_gps_points = flight_data["totalPoints"]
            duration_seconds = flight_data["duration"]

            if total_gps_points == 0:
                total_gps_points = duration_seconds
                print(f"⚠️  No GPS data found, using estimated {total_gps_points} points")

            print(f"📊 GPS Points: {total_gps_points}")
            print(f"📊 Duration: {duration_seconds}s")

            video_duration = float(duration_seconds) / max(speed, 1)
            total_frames = int(video_duration * fps)
            if total_frames <= 0:
                total_frames = 1

            print(f"🎬 Will capture {total_frames} frames at {fps} FPS")

            _update_job(
                job_id,
                status=_STATUS_INITIALIZING,
                progress=5,
                total_frames=total_frames,
                message=f"Preparing to capture {total_frames} frames",
            )
            _set_job_runtime(job_id, phase=_STATUS_INITIALIZING)

            temp_dir = _job_temp_dir(temp_root, job_id)
            frames_dir = _job_frames_dir(temp_root, job_id)
            _prepare_export_dirs(export_root, temp_dir, frames_dir)

            print(f"📁 Frames directory: {frames_dir}")

            capture_mode_message = (
                "Starting fast deterministic frame capture"
                if is_fast_mode
                else "Starting frame capture"
            )
            _update_job(
                job_id,
                status=_STATUS_CAPTURING,
                message=capture_mode_message,
            )
            _set_job_runtime(job_id, phase=_STATUS_CAPTURING)

            if is_fast_mode:
                await page.wait_for_function(
                    "() => typeof window._setExportFrame === 'function'",
                    timeout=30000,
                )
            else:
                await page.evaluate("""
                    () => {
                        const playButton = Array.from(document.querySelectorAll('button'))
                            .find(btn =>
                                btn.textContent.includes('Play') ||
                                btn.textContent.includes('▶')
                            );
                        if (playButton) {
                            playButton.click();
                            console.log('▶️  Play button clicked');
                        }
                    }
                """)

            frame_count = 0
            ms_per_frame = (duration_seconds * 1000) / max(total_frames, 1)
            print(f"⏱️  Capturing 1 frame every {ms_per_frame:.1f}ms")
            start_time = time.time()
            resume_from_frame = _first_missing_frame_index(frames_dir, total_frames)
            if resume_from_frame > 0:
                frame_count = resume_from_frame
                progress = _capture_progress_percent(frame_count, total_frames)
                _set_job_runtime(
                    job_id,
                    phase=_STATUS_CAPTURING,
                    frames_captured=frame_count,
                    eta_seconds=None,
                )
                _update_job(
                    job_id,
                    status=_STATUS_CAPTURING,
                    progress=progress,
                    message=f"Resuming from frame {resume_from_frame}/{total_frames}",
                )
                print(f"▶️  Resuming capture from frame {resume_from_frame}/{total_frames}")

            terrain_wait_enabled = True
            for i in range(resume_from_frame, total_frames):
                if i % _CANCEL_CHECK_INTERVAL == 0 and _is_cancelled(job_id):
                    print("🛑 Export cancelled by user")
                    await browser.close()
                    _update_job(
                        job_id,
                        status=_STATUS_CANCELLED,
                        message="Export cancelled by user",
                    )
                    return

                if is_fast_mode:
                    frame_state = await page.evaluate(
                        """
                        ({ frameIndex, totalFrames }) => {
                            return window._setExportFrame(frameIndex, totalFrames);
                        }
                        """,
                        {"frameIndex": i, "totalFrames": total_frames},
                    )
                    tiles_loaded = bool(frame_state and frame_state.get("tilesLoaded"))
                else:
                    tiles_loaded = False

                if not tiles_loaded and terrain_wait_enabled:
                    tiles_loaded = await _wait_for_export_frame_terrain(page)
                    if not tiles_loaded:
                        print(f"⚠️  Terrain still loading for frame {i} after timeout")
                        terrain_wait_enabled = False
                        print("⚠️  Disabling per-frame terrain waits after timeout")

                frame_path = frames_dir / f"frame{i:05d}.png"
                await page.screenshot(path=str(frame_path), timeout=60000)

                frame_count += 1
                if frame_count % 10 == 0:
                    progress = _capture_progress_percent(frame_count, total_frames)
                    elapsed = time.time() - start_time
                    fps_actual = frame_count / elapsed if elapsed > 0 else 0
                    eta_seconds = (total_frames - frame_count) / fps_actual if fps_actual > 0 else 0
                    eta_seconds_int = max(0, int(eta_seconds)) if eta_seconds > 0 else None

                    _set_job_runtime(
                        job_id,
                        phase=_STATUS_CAPTURING,
                        eta_seconds=eta_seconds_int,
                        frames_captured=frame_count,
                    )

                    _update_job(
                        job_id,
                        status=_STATUS_CAPTURING,
                        progress=progress,
                        message=f"Captured {frame_count}/{total_frames} frames",
                    )

                    print(
                        f"📸 {frame_count}/{total_frames} frames ({fps_actual:.1f} fps, ETA: {int(eta_seconds/60)}min)"
                    )

                if not is_fast_mode:
                    await asyncio.sleep(ms_per_frame / 1000)

            total_capture_time = time.time() - start_time
            print(
                f"✅ Captured all {frame_count} frames in {int(total_capture_time/60)}min {int(total_capture_time%60)}s"
            )

            await browser.close()

            if _is_cancelled(job_id):
                print("🛑 Export cancelled by user before encoding")
                _update_job(
                    job_id,
                    status=_STATUS_CANCELLED,
                    message="Export cancelled before encoding",
                )
                return

            _update_job(
                job_id,
                status=_STATUS_ENCODING,
                progress=80,
                message="Encoding with FFmpeg",
            )
            _set_job_runtime(job_id, phase=_STATUS_ENCODING, eta_seconds=None)

            timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
            output_file = _video_output_path(flight_id, timestamp)
            ffmpeg_preset, ffmpeg_crf = _ffmpeg_encoding_settings(is_fast_mode)

            ffmpeg_cmd = [
                "ffmpeg",
                "-framerate",
                str(fps),
                "-i",
                str(frames_dir / "frame%05d.png"),
                "-c:v",
                "libx264",
                "-preset",
                ffmpeg_preset,
                "-crf",
                ffmpeg_crf,
                "-pix_fmt",
                "yuv420p",
                "-nostats",
                "-progress",
                "pipe:2",
                "-y",
                str(output_file),
            ]

            print(f"🎬 FFmpeg command: {' '.join(ffmpeg_cmd)}")
            process = await asyncio.create_subprocess_exec(
                *ffmpeg_cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )

            encoding_started_at = time.monotonic()
            last_ffmpeg_output_at = encoding_started_at
            ffmpeg_stderr: list[str] = []
            total_duration_seconds = max(video_duration, 1e-6)
            ffmpeg_timeout_seconds = _ffmpeg_timeout_seconds(total_duration_seconds)
            last_output_file_size = -1
            last_output_file_mtime_ns = -1

            try:
                assert process.stderr is not None
                while True:
                    if _is_cancelled(job_id):
                        process.kill()
                        await process.wait()
                        _update_job(
                            job_id,
                            status=_STATUS_CANCELLED,
                            message="Export cancelled during encoding",
                        )
                        return

                    now = time.monotonic()
                    (
                        has_output_file_activity,
                        last_output_file_size,
                        last_output_file_mtime_ns,
                    ) = _ffmpeg_output_file_activity(
                        output_file,
                        last_output_file_size,
                        last_output_file_mtime_ns,
                    )
                    if has_output_file_activity:
                        last_ffmpeg_output_at = now

                    if now - last_ffmpeg_output_at > _FFMPEG_STALL_TIMEOUT_SECONDS:
                        process.kill()
                        await process.wait()
                        raise Exception(
                            "FFmpeg stalled for "
                            f"{_FFMPEG_STALL_TIMEOUT_SECONDS}s: {' '.join(ffmpeg_cmd)}"
                        )

                    if now - encoding_started_at > ffmpeg_timeout_seconds:
                        process.kill()
                        await process.wait()
                        raise Exception(
                            f"FFmpeg timeout after {ffmpeg_timeout_seconds}s: {' '.join(ffmpeg_cmd)}"
                        )

                    try:
                        line_bytes = await asyncio.wait_for(process.stderr.readline(), timeout=1.0)
                    except TimeoutError:
                        if process.returncode is not None:
                            break
                        continue

                    if not line_bytes:
                        if process.returncode is not None:
                            break
                        continue

                    line = line_bytes.decode("utf-8", errors="replace").strip()
                    last_ffmpeg_output_at = time.monotonic()
                    ffmpeg_stderr.append(line)
                    encoded_seconds = _parse_ffmpeg_out_time_seconds(line)

                    if encoded_seconds is not None:
                        progress = _encoding_progress_percent(
                            encoded_seconds,
                            total_duration_seconds,
                        )
                        elapsed_encoding = max(time.monotonic() - encoding_started_at, 1e-6)
                        encoding_speed = encoded_seconds / elapsed_encoding
                        remaining = max(total_duration_seconds - encoded_seconds, 0.0)
                        eta_seconds = (
                            max(0, int(remaining / encoding_speed)) if encoding_speed > 0 else None
                        )

                        _set_job_runtime(
                            job_id,
                            phase=_STATUS_ENCODING,
                            eta_seconds=eta_seconds,
                            encoded_seconds=round(encoded_seconds, 2),
                        )
                        _update_job(
                            job_id,
                            status=_STATUS_ENCODING,
                            progress=progress,
                            message=(
                                f"Encoding {int(min(max((encoded_seconds / total_duration_seconds) * 100, 0), 100))}%"
                            ),
                        )

                return_code = await process.wait()
                if return_code != 0:
                    stderr_output = "\n".join(ffmpeg_stderr).strip()
                    raise Exception(f"FFmpeg encoding failed: {stderr_output}")
            finally:
                if process.returncode is None:
                    process.kill()
                    await process.wait()

            print(f"✅ Video encoded: {output_file}")

            _cleanup_temp_dir(temp_dir)

            file_size_mb = output_file.stat().st_size / (1024 * 1024)
            _update_job(
                job_id,
                status=_STATUS_COMPLETED,
                progress=100,
                message=f"Video ready! ({file_size_mb:.1f} MB)",
                video_path=str(output_file),
            )
            _set_job_runtime(job_id, phase=_STATUS_COMPLETED, eta_seconds=0)

            capture_time_min = int(total_capture_time / 60)
            print(f"✅ Export completed in {capture_time_min} minutes")
            print(f"📹 Video: {output_file} ({file_size_mb:.1f} MB)")

    except Exception as e:
        print(f"❌ Export failed: {e}")
        traceback.print_exc()
        _update_job(
            job_id,
            status=_STATUS_FAILED,
            error=str(e),
            message=f"Error: {e}",
        )
    finally:
        _clear_job_cancel_requested(job_id)
        _clear_job_auth_token(job_id)


def get_export_status(job_id: str) -> dict[str, Any] | None:
    """Get status of an export job."""
    job = _get_job(job_id)
    if job:
        snapshot = _snapshot_from_job(job)
        _set_memory_snapshot(job_id, snapshot)
        return snapshot
    return _get_memory_snapshot(job_id)


def cancel_video_export(job_id: str, update_db: bool = True) -> bool:
    """Cancel an ongoing video export."""
    job = _get_job(job_id)
    if not job:
        return False

    if job.status in _TERMINAL_STATUSES:
        return False

    if job.status != _STATUS_QUEUED:
        _set_job_cancel_requested(job_id)

    _update_job(
        job_id,
        status=_STATUS_CANCELLED,
        message="Export cancelled by user",
        error=None,
        update_db=update_db,
    )
    _clear_job_auth_token(job_id)

    print(f"🛑 Video export {job_id} cancelled")
    return True


def resume_video_export(job_id: str, auth_token: str | None = None) -> bool:
    """Resume a cancelled or failed manual export when captured frames are still present."""
    job = _get_job(job_id)
    if not job:
        return False

    if job.status not in {_STATUS_CANCELLED, _STATUS_FAILED}:
        return False

    if _is_job_cancel_requested(job_id):
        return False

    resume_info = _job_resume_info(job)
    if not resume_info["can_resume"]:
        return False

    _set_job_update_db_flag(job_id, True)
    _update_job(
        job_id,
        status=_STATUS_QUEUED,
        progress=_capture_progress_percent(
            int(resume_info["frames_captured"]),
            job.total_frames or int(resume_info["frames_captured"]),
        ),
        message=(
            f"Resume enqueued from frame {resume_info['resume_from_frame']}"
            if resume_info["resume_from_frame"] is not None
            else "Resume enqueued"
        ),
        error=None,
        video_path=None,
        completed_at=None,
        cancelled_at=None,
    )
    _set_job_auth_token(job_id, auth_token or _create_video_export_job_token(job_id, job.flight_id))
    _set_job_runtime(
        job_id,
        phase=_STATUS_QUEUED,
        frames_captured=int(resume_info["frames_captured"]),
        eta_seconds=None,
    )
    _enqueue_existing_video_export_job(job_id)
    print(f"▶️  Video export {job_id} resumed")
    return True


def list_exports(flight_id: str | None = None) -> list[dict[str, Any]]:
    """List exports from DB and in-memory snapshots."""
    with SessionLocal() as db:
        query = db.query(VideoExportJob)
        if flight_id:
            query = query.filter(VideoExportJob.flight_id == flight_id)
        jobs = query.order_by(VideoExportJob.created_at.desc()).all()

    results = [_snapshot_from_job(job) for job in jobs]

    with _EXPORT_JOBS_LOCK:
        memory_items = list(export_jobs.items())

    for job_id, snapshot in memory_items:
        if flight_id and snapshot.get("flight_id") != flight_id:
            continue
        if not any(item.get("job_id") == job_id for item in results):
            results.append(snapshot)

    return results


def trigger_auto_export(
    flight_id: str,
    db: Session,
    frontend_url: str = "http://localhost:5173",
):
    """
    Automatically trigger video export for a flight with GPX.

    Called after GPX upload/processing.
    """
    flight = db.query(Flight).filter(Flight.id == flight_id).first()

    if not flight:
        print(f"⚠️  Flight {flight_id} not found, skipping auto-export")
        return None

    if not flight.gpx_file_path:
        print(f"⚠️  Flight {flight_id} has no GPX, skipping auto-export")
        return None

    if flight.video_export_status in [
        "processing",
        "completed",
        "queued",
        "running",
        "initializing",
        "capturing",
        "encoding",
    ]:
        print(
            f"ℹ️  Flight {flight_id} already has video export status: {flight.video_export_status}"
        )
        return None

    print(f"🚀 Auto-triggering fast video export for flight {flight_id}")
    try:
        job_id = start_video_export_manual_fast(
            flight_id=flight_id,
            quality="1080p",
            fps=15,
            speed=1,
            frontend_url=frontend_url,
            update_db=True,
        )
        print(f"✅ Manual fast auto export job {job_id} started for flight {flight_id}")
        return job_id
    except Exception as e:
        print(f"⚠️ Manual fast auto-export failed for flight {flight_id}, fallback stream: {e}")
        from video_export import start_video_export_background

        job_id = start_video_export_background(
            flight_id=flight_id,
            quality="1080p",
            fps=15,
            speed=1,
            frontend_url=frontend_url,
        )
        flight.video_export_job_id = job_id
        flight.video_export_status = "processing"
        flight.video_file_path = None
        db.commit()
        print(f"✅ Stream fallback auto export job {job_id} started for flight {flight_id}")
        return job_id
