"""
Video export using Cesium Manual Render approach
Based on: https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/

This module now stores export jobs in the database and runs from a single background
worker while keeping a small in-memory status snapshot for compatibility.
"""

import asyncio
import shutil
import subprocess
import threading
import uuid
import traceback
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

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
_JOB_UPDATE_DB: dict[str, bool] = {}


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
        host = "localhost" if config.API_HOST == "0.0.0.0" else config.API_HOST
        return f"http://{host}:{config.API_PORT}"

    return "http://localhost:5173"


def resolve_frontend_url(frontend_url: str | None = None) -> str:
    """Return a usable frontend base URL for browser automation."""
    if frontend_url:
        return _normalize_frontend_url(frontend_url)
    return _default_frontend_url()


def _normalize_frontend_url(frontend_url: str) -> str:
    candidate = frontend_url.rstrip("/") if frontend_url else _default_frontend_url()
    static_index = Path(__file__).parent / "static" / "index.html"

    if not candidate and static_index.exists():
        host = "localhost" if config.API_HOST == "0.0.0.0" else config.API_HOST
        return f"http://{host}:{config.API_PORT}"

    if not candidate:
        return "http://localhost:5173"

    if "/export-viewer" in candidate:
        candidate = candidate.split("/export-viewer")[0]

    return candidate.rstrip("/")


def _snapshot_from_job(job: VideoExportJob) -> dict[str, Any]:
    return {
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


def _set_memory_snapshot(job_id: str, data: dict[str, Any] | None):
    if data is None:
        export_jobs.pop(job_id, None)
    else:
        export_jobs[job_id] = data


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
        if job.status in _TERMINAL_STATUSES:
            if job.status == _STATUS_COMPLETED:
                if not job.completed_at:
                    job.completed_at = datetime.utcnow()
            if job.status == _STATUS_CANCELLED and not job.cancelled_at:
                job.cancelled_at = datetime.utcnow()

            _JOB_UPDATE_DB.pop(job_id, None)

        should_update_flight = _JOB_UPDATE_DB.get(job_id, True) if update_db is None else update_db
        if should_update_flight:
            _update_flight_from_job(db, job)
        db.commit()

        snapshot = _snapshot_from_job(job)
        _set_memory_snapshot(job_id, snapshot)
        return job


def _is_cancelled(job_id: str) -> bool:
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

        for job in stale_jobs:
            if job.status in {_STATUS_QUEUED, _STATUS_RUNNING}:
                job.status = _STATUS_QUEUED if job.status != _STATUS_QUEUED else job.status
            else:
                job.status = _STATUS_QUEUED
            job.message = "Recovered from restart"
            job.updated_at = datetime.utcnow()
            db.commit()

            _set_memory_snapshot(job.id, _snapshot_from_job(job))


def _acquire_next_job() -> str | None:
    with SessionLocal() as db:
        job = (
            db.query(VideoExportJob)
            .filter(VideoExportJob.status == _STATUS_QUEUED)
            .order_by(VideoExportJob.created_at)
            .first()
        )
        if not job:
            return None

        job.status = _STATUS_RUNNING
        job.message = "Starting manual export"
        job.updated_at = datetime.utcnow()
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
            traceback.print_exc()


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
            started_at=now,
            updated_at=now,
            created_at=now,
        )
        db.add(job)

        if update_db:
            _JOB_UPDATE_DB[job_id] = True
        else:
            _JOB_UPDATE_DB[job_id] = False

        flight = db.query(Flight).filter(Flight.id == flight_id).first()
        if flight:
            if update_db:
                flight.video_export_job_id = job_id
                flight.video_export_status = _to_public_status(_STATUS_QUEUED)
                flight.video_file_path = None

        db.commit()
        _set_memory_snapshot(job_id, _snapshot_from_job(job))

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

    try:
        from playwright.async_api import async_playwright

        _update_job(job_id, status=_STATUS_INITIALIZING, message="Setting up manual render")

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

            page.on("console", lambda msg: print(f"🖥️  [{msg.type}]: {msg.text}"))
            page.on("pageerror", lambda err: print(f"❌ Browser error: {err}"))

            url = f"{frontend_url}/export-viewer?flightId={flight_id}"
            print(f"📺 Opening {url}")

            _update_job(job_id, message="Loading export viewer")
            response = await page.goto(url, wait_until="networkidle", timeout=60000)
            if response.status >= 400:
                raise Exception(f"Page returned HTTP {response.status}")

            _update_job(job_id, message="Waiting for Cesium viewer")
            await page.wait_for_selector("canvas", timeout=60000, state="attached")
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
                total_frames=total_frames,
                message=f"Preparing to capture {total_frames} frames",
            )

            frames_dir = EXPORTS_DIR / f"frames_{job_id}"
            frames_dir.mkdir(exist_ok=True)

            print(f"📁 Frames directory: {frames_dir}")

            _update_job(job_id, status=_STATUS_CAPTURING, message="Starting frame capture")

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
                if _is_cancelled(job_id):
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
                    progress = int((frame_count / total_frames) * 50)
                    elapsed = time.time() - start_time
                    fps_actual = frame_count / elapsed if elapsed > 0 else 0
                    eta_seconds = (total_frames - frame_count) / fps_actual if fps_actual > 0 else 0

                    _update_job(
                        job_id,
                        status=_STATUS_CAPTURING,
                        progress=progress,
                        message=f"Captured {frame_count}/{total_frames} frames",
                    )

                    print(
                        f"📸 {frame_count}/{total_frames} frames ({fps_actual:.1f} fps, ETA: {int(eta_seconds/60)}min)"
                    )

                await asyncio.sleep(ms_per_frame / 1000 / 10)

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
                job_id, status=_STATUS_ENCODING, progress=50, message="Encoding with FFmpeg"
            )

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
                "-y",
                str(output_file),
            ]

            print(f"🎬 FFmpeg command: {' '.join(ffmpeg_cmd)}")
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)

            if result.returncode != 0:
                raise Exception(f"FFmpeg encoding failed: {result.stderr}")

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


def get_export_status(job_id: str) -> dict[str, Any] | None:
    """Get status of an export job."""
    job = _get_job(job_id)
    if job:
        snapshot = _snapshot_from_job(job)
        _set_memory_snapshot(job_id, snapshot)
        return snapshot
    return export_jobs.get(job_id)


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

    for job_id, snapshot in export_jobs.items():
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
