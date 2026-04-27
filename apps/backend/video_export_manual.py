"""
Video export using Cesium Manual Render approach
Based on: https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/

This module now stores export jobs in the database and runs from a single background
worker while keeping a small in-memory status snapshot for compatibility.
"""

import asyncio
import json
import shutil
import subprocess
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
from database import SessionLocal
from models import Flight, VideoExportJob

# Storage for export jobs (compatibility snapshot)
export_jobs: dict[str, dict[str, Any]] = {}

EXPORTS_DIR = Path(__file__).parent / "exports" / "videos"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)


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

_CANCEL_CHECK_INTERVAL = 10


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
    }

    with _JOB_RUNTIME_LOCK:
        runtime = _JOB_RUNTIME.get(job.id, {}).copy()
    snapshot.update(runtime)
    return snapshot


def _set_job_runtime(job_id: str, **kwargs):
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


def _clear_job_runtime(job_id: str):
    with _JOB_RUNTIME_LOCK:
        _JOB_RUNTIME.pop(job_id, None)


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


def _cleanup_frames(frames_dir: Path):
    if not frames_dir.exists():
        return

    for frame_file in frames_dir.glob("*.png"):
        frame_file.unlink()
    try:
        frames_dir.rmdir()
    except OSError:
        pass


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


def start_video_export_manual(
    flight_id: str,
    quality: str = "1080p",
    fps: int = 15,
    speed: int = 1,
    frontend_url: str = "http://localhost:5173",
    update_db: bool = True,
    auth_token: str | None = None,
):
    """
    Create a new export job and enqueue it for the singleton worker.
    """
    if not _dependencies_ok:
        raise RuntimeError("Missing dependencies for video export")

    job_id = str(uuid.uuid4())
    now = datetime.utcnow()

    with SessionLocal() as db:
        job = VideoExportJob(
            id=job_id,
            flight_id=flight_id,
            status=_STATUS_QUEUED,
            mode="manual",
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

    _set_job_auth_token(job_id, auth_token)

    start_video_export_worker()
    return job_id


async def _export_video_manual_render(job_id: str):
    """Export video using Cesium manual render - frame by frame."""
    job = _get_job(job_id)
    if not job:
        return

    quality = job.quality or "1080p"
    fps = job.fps or 15
    speed = job.speed or 1
    flight_id = job.flight_id
    frontend_url = resolve_frontend_url(job.frontend_url)
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

            url = f"{frontend_url}/export-viewer?flightId={flight_id}"
            print(f"📺 Opening {url}")

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
            try:
                await asyncio.wait_for(
                    page.evaluate("""
                        () => {
                            return new Promise((resolve) => {
                                const viewer = window._cesiumViewer;
                                const checkTerrain = () => {
                                    if (viewer.scene.globe.tilesLoaded) {
                                        console.log('✅ Terrain tiles loaded');
                                        resolve(true);
                                    } else {
                                        setTimeout(checkTerrain, 500);
                                    }
                                };
                                setTimeout(checkTerrain, 1000);
                            });
                        }
                    """),
                    timeout=60.0,
                )
                print("✅ Initial terrain loaded")
            except TimeoutError:
                print("⚠️  Terrain timeout - continuing anyway")

            await asyncio.sleep(2)

            _update_job(job_id, message="Extracting GPS data")

            flight_data = await page.evaluate("""
                () => {
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

            frames_dir = EXPORTS_DIR / f"frames_{job_id}"
            frames_dir.mkdir(exist_ok=True)

            print(f"📁 Frames directory: {frames_dir}")

            _update_job(job_id, status=_STATUS_CAPTURING, message="Starting frame capture")
            _set_job_runtime(job_id, phase=_STATUS_CAPTURING)

            await page.evaluate("""
                () => {
                    const playButton = Array.from(document.querySelectorAll('button'))
                        .find(btn => btn.textContent.includes('Play') || btn.textContent.includes('▶'));
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

            for i in range(total_frames):
                if i % _CANCEL_CHECK_INTERVAL == 0 and _is_cancelled(job_id):
                    print("🛑 Export cancelled by user")
                    await browser.close()
                    _cleanup_frames(frames_dir)
                    _update_job(
                        job_id,
                        status=_STATUS_CANCELLED,
                        message="Export cancelled by user",
                    )
                    return

                tiles_loaded = await page.evaluate("""
                    () => {
                        const viewer = window._cesiumViewer;
                        viewer.scene.render(viewer.clock.currentTime);
                        return viewer.scene.globe.tilesLoaded;
                    }
                """)

                if not tiles_loaded:
                    await asyncio.sleep(0.1)

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

                await asyncio.sleep(ms_per_frame / 1000)

            total_capture_time = time.time() - start_time
            print(
                f"✅ Captured all {frame_count} frames in {int(total_capture_time/60)}min {int(total_capture_time%60)}s"
            )

            await browser.close()

            if _is_cancelled(job_id):
                print("🛑 Export cancelled by user before encoding")
                _cleanup_frames(frames_dir)
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
            filename = f"flight-{flight_id}-{timestamp}.mp4"
            output_file = EXPORTS_DIR / filename

            ffmpeg_cmd = [
                "ffmpeg",
                "-framerate",
                str(fps),
                "-i",
                str(frames_dir / "frame%05d.png"),
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "18",
                "-pix_fmt",
                "yuv420p",
                "-nostats",
                "-progress",
                "pipe:2",
                "-y",
                str(output_file),
            ]

            print(f"🎬 FFmpeg command: {' '.join(ffmpeg_cmd)}")
            process = subprocess.Popen(
                ffmpeg_cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
            )

            encoding_started_at = time.time()
            ffmpeg_stderr: list[str] = []
            ffmpeg_timeout_seconds = 30 * 60
            total_duration_seconds = max(video_duration, 1e-6)

            try:
                assert process.stderr is not None
                while True:
                    if time.time() - encoding_started_at > ffmpeg_timeout_seconds:
                        process.kill()
                        raise Exception(
                            f"FFmpeg timeout after {ffmpeg_timeout_seconds}s: {' '.join(ffmpeg_cmd)}"
                        )

                    line = process.stderr.readline()
                    if line:
                        ffmpeg_stderr.append(line)
                        encoded_seconds = _parse_ffmpeg_out_time_seconds(line.strip())

                        if encoded_seconds is not None:
                            progress = _encoding_progress_percent(
                                encoded_seconds,
                                total_duration_seconds,
                            )
                            elapsed_encoding = max(time.time() - encoding_started_at, 1e-6)
                            encoding_speed = encoded_seconds / elapsed_encoding
                            remaining = max(total_duration_seconds - encoded_seconds, 0.0)
                            eta_seconds = (
                                max(0, int(remaining / encoding_speed))
                                if encoding_speed > 0
                                else None
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

                    if process.poll() is not None:
                        break

                if process.returncode != 0:
                    stderr_output = "".join(ffmpeg_stderr).strip()
                    raise Exception(f"FFmpeg encoding failed: {stderr_output}")
            finally:
                if process.stderr:
                    process.stderr.close()

            print(f"✅ Video encoded: {output_file}")

            _cleanup_frames(frames_dir)

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
        if frames_dir is not None:
            _cleanup_frames(frames_dir)
        print(f"❌ Export failed: {e}")
        traceback.print_exc()
        _update_job(
            job_id,
            status=_STATUS_FAILED,
            error=str(e),
            message=f"Error: {e}",
        )
    finally:
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


def list_exports(flight_id: str) -> list[dict[str, Any]]:
    """List all exports for a flight from DB and in-memory snapshots."""
    with SessionLocal() as db:
        jobs = (
            db.query(VideoExportJob)
            .filter(VideoExportJob.flight_id == flight_id)
            .order_by(VideoExportJob.created_at.desc())
            .all()
        )

    results = [_snapshot_from_job(job) for job in jobs]

    with _EXPORT_JOBS_LOCK:
        memory_items = list(export_jobs.items())

    for job_id, snapshot in memory_items:
        if snapshot.get("flight_id") != flight_id:
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

    print(f"🚀 Auto-triggering video export for flight {flight_id}")
    try:
        job_id = start_video_export_manual(
            flight_id=flight_id,
            quality="1080p",
            fps=15,
            speed=1,
            frontend_url=frontend_url,
            update_db=True,
        )
        print(f"✅ Manual auto export job {job_id} started for flight {flight_id}")
        return job_id
    except Exception as e:
        print(f"⚠️ Manual auto-export failed for flight {flight_id}, fallback stream: {e}")
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
