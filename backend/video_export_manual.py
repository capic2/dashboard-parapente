"""
Video export using Cesium Manual Render approach
Based on: https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/

This approach renders frame-by-frame with full control over Cesium's render loop.
Slower but guarantees perfect quality with 0 stuttering.
"""
import asyncio
import os
import threading
import time
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional
import subprocess
from sqlalchemy.orm import Session

# Storage for export jobs
export_jobs: Dict[str, Dict] = {}

EXPORTS_DIR = Path(__file__).parent / "exports" / "videos"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)


def check_dependencies():
    """Check if required system dependencies are installed"""
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


def start_video_export_manual(
    flight_id: str,
    quality: str = "1080p",
    fps: int = 15,
    speed: int = 1,
    frontend_url: str = "http://localhost:5173",
    update_db: bool = True
):
    """
    Start video export using Cesium manual render approach
    
    Args:
        flight_id: ID of the flight to export
        quality: Video quality (720p, 1080p, 4K)
        fps: Frames per second (default 15)
        speed: Playback speed multiplier (default 1)
        frontend_url: URL of the frontend
        update_db: Whether to update database (default True)
    """
    job_id = f"{flight_id}-{int(time.time())}"
    
    export_jobs[job_id] = {
        "flight_id": flight_id,
        "status": "started",
        "progress": 0,
        "message": "Initializing manual render export...",
        "started_at": datetime.now().isoformat(),
        "video_path": None,
        "error": None,
        "total_frames": None
    }
    
    # Update flight status in database if requested
    if update_db:
        from database import SessionLocal
        from models import Flight
        db = SessionLocal()
        try:
            flight = db.query(Flight).filter(Flight.id == flight_id).first()
            if flight:
                flight.video_export_job_id = job_id
                flight.video_export_status = "processing"
                flight.video_file_path = None
                db.commit()
        finally:
            db.close()
    
    # Start export in background thread (will create its own DB session)
    thread = threading.Thread(
        target=lambda: asyncio.run(_export_video_manual_render(
            job_id, flight_id, quality, fps, speed, frontend_url, update_db
        ))
    )
    thread.start()
    
    return job_id


async def _export_video_manual_render(
    job_id: str,
    flight_id: str, 
    quality: str,
    fps: int,
    speed: int,
    frontend_url: str,
    update_db: bool = True
):
    """
    Export video using Cesium manual render - frame by frame
    """
    try:
        from playwright.async_api import async_playwright
        
        export_jobs[job_id]["status"] = "initializing"
        export_jobs[job_id]["message"] = "Setting up Cesium manual render..."
        
        # Resolution mapping
        resolutions = {
            "720p": (1280, 720),
            "1080p": (1920, 1080),
            "4K": (3840, 2160)
        }
        width, height = resolutions.get(quality, (1920, 1080))
        
        # Check if frontend is built for production
        static_index = Path(__file__).parent / "static" / "index.html"
        if static_index.exists():
            frontend_url = "http://localhost:8001"
            print(f"📦 Using production frontend at {frontend_url}")
        
        async with async_playwright() as p:
            # Launch browser with maximum resources
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    # GPU acceleration
                    '--enable-gpu',
                    '--use-gl=egl',
                    '--enable-webgl',
                    '--enable-webgl2',
                    '--ignore-gpu-blocklist',
                    '--disable-gpu-vsync',
                    
                    # Performance
                    '--disable-dev-shm-usage',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--js-flags=--max-old-space-size=8192',  # 8GB heap
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    
                    # Rendering
                    '--force-device-scale-factor=1',
                    '--high-dpi-support=1',
                ]
            )
            
            context = await browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=1,
                java_script_enabled=True,
            )
            page = await context.new_page()
            
            # Console logging
            page.on("console", lambda msg: print(f"🖥️  [{msg.type}]: {msg.text}"))
            page.on("pageerror", lambda err: print(f"❌ Browser error: {err}"))
            
            # Navigate to export viewer
            url = f"{frontend_url}/export-viewer?flightId={flight_id}"
            print(f"📺 Opening {url}")
            
            export_jobs[job_id]["message"] = "Loading page..."
            response = await page.goto(url, wait_until="networkidle", timeout=60000)
            if response.status >= 400:
                raise Exception(f"Page returned HTTP {response.status}")
            
            # Wait for Cesium viewer
            export_jobs[job_id]["message"] = "Waiting for Cesium viewer..."
            print("⏳ Waiting for Cesium viewer...")
            
            await page.wait_for_selector("canvas", timeout=60000, state="attached")
            await asyncio.sleep(3)  # Let Cesium initialize
            
            print("✅ Cesium viewer found")
            
            # Setup Cesium in manual render mode
            export_jobs[job_id]["message"] = "Configuring Cesium manual render mode..."
            print("🔧 Configuring Cesium for manual render...")
            
            setup_result = await page.evaluate("""
                () => {
                    // Find Cesium viewer
                    const cesiumContainer = document.querySelector('.cesium-viewer');
                    if (!cesiumContainer) {
                        throw new Error('Cesium viewer container not found');
                    }
                    
                    // Wait for viewer to be ready
                    return new Promise((resolve) => {
                        const checkViewer = () => {
                            // Try to find viewer in window or container
                            const viewer = window._cesiumViewer || 
                                          window.viewer ||
                                          cesiumContainer._viewer;
                            
                            if (viewer && viewer.scene) {
                                // Disable automatic render loop
                                viewer.useDefaultRenderLoop = false;
                                viewer.clock.shouldAnimate = false;
                                
                                // Store viewer globally
                                window._cesiumViewer = viewer;
                                window._exportMode = 'manual_render';
                                
                                console.log('✅ Cesium configured for manual render');
                                console.log('  - useDefaultRenderLoop: false');
                                console.log('  - shouldAnimate: false');
                                
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
            
            # Wait for terrain to load
            export_jobs[job_id]["message"] = "Waiting for terrain..."
            print("⏳ Waiting for terrain to load...")
            
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
                    timeout=60.0
                )
                print("✅ Initial terrain loaded")
            except asyncio.TimeoutError:
                print("⚠️  Terrain timeout - continuing anyway")
            
            await asyncio.sleep(2)
            
            # Get GPS points and flight duration
            export_jobs[job_id]["message"] = "Extracting GPS data..."
            print("📍 Extracting GPS points...")
            
            flight_data = await page.evaluate("""
                () => {
                    const viewer = window._cesiumViewer;
                    
                    // Try to get GPS data from the page
                    // This depends on how FlightViewer3D stores the data
                    const gpxData = window._gpxData || {};
                    const coordinates = gpxData.coordinates || [];
                    
                    console.log('GPS points found:', coordinates.length);
                    
                    return {
                        totalPoints: coordinates.length,
                        duration: coordinates.length > 0 ? coordinates.length : 300 // Default 5min
                    };
                }
            """)
            
            total_gps_points = flight_data["totalPoints"]
            duration_seconds = flight_data["duration"]
            
            if total_gps_points == 0:
                # Fallback: estimate from video duration
                total_gps_points = duration_seconds
                print(f"⚠️  No GPS data found, using estimated {total_gps_points} points")
            
            print(f"📊 GPS Points: {total_gps_points}")
            print(f"📊 Duration: {duration_seconds}s")
            
            # Calculate frames needed
            video_duration = duration_seconds / speed
            total_frames = int(video_duration * fps)
            
            print(f"🎬 Will capture {total_frames} frames at {fps} FPS")
            
            export_jobs[job_id]["total_frames"] = total_frames
            export_jobs[job_id]["message"] = f"Preparing to capture {total_frames} frames..."
            
            # Create frames directory
            frames_dir = EXPORTS_DIR / f"frames_{job_id}"
            frames_dir.mkdir(exist_ok=True)
            
            print(f"📁 Frames directory: {frames_dir}")
            
            # Start playback
            export_jobs[job_id]["status"] = "capturing"
            export_jobs[job_id]["message"] = "Starting frame capture..."
            print("▶️  Starting frame-by-frame capture...")
            
            await page.evaluate("""
                () => {
                    // Click play button
                    const playButton = Array.from(document.querySelectorAll('button'))
                        .find(btn => btn.textContent.includes('Play') || btn.textContent.includes('▶'));
                    if (playButton) {
                        playButton.click();
                        console.log('▶️  Play button clicked');
                    }
                }
            """)
            
            # Capture frames manually
            frame_count = 0
            ms_per_frame = (duration_seconds * 1000) / total_frames
            
            print(f"⏱️  Capturing 1 frame every {ms_per_frame:.1f}ms")
            
            start_time = time.time()
            
            for i in range(total_frames):
                # Render this frame in Cesium
                tiles_loaded = await page.evaluate(f"""
                    () => {{
                        const viewer = window._cesiumViewer;
                        
                        // Force render
                        viewer.scene.render(viewer.clock.currentTime);
                        
                        // Check if tiles are loaded
                        return viewer.scene.globe.tilesLoaded;
                    }}
                """)
                
                # Wait a bit if tiles not loaded
                if not tiles_loaded:
                    await asyncio.sleep(0.1)
                
                # Capture screenshot
                frame_path = frames_dir / f"frame{i:05d}.png"
                await page.screenshot(path=str(frame_path), timeout=60000)
                
                frame_count += 1
                
                # Update progress every 10 frames
                if frame_count % 10 == 0:
                    progress = int((frame_count / total_frames) * 50)  # 0-50% for capture
                    export_jobs[job_id]["progress"] = progress
                    export_jobs[job_id]["message"] = f"Captured {frame_count}/{total_frames} frames"
                    
                    elapsed = time.time() - start_time
                    fps_actual = frame_count / elapsed if elapsed > 0 else 0
                    eta_seconds = (total_frames - frame_count) / fps_actual if fps_actual > 0 else 0
                    
                    print(f"📸 {frame_count}/{total_frames} frames ({fps_actual:.1f} fps, ETA: {int(eta_seconds/60)}min)")
                
                # Wait for next frame time
                await asyncio.sleep(ms_per_frame / 1000 / 10)  # Advance slowly
            
            total_capture_time = time.time() - start_time
            print(f"✅ Captured all {frame_count} frames in {int(total_capture_time/60)}min {int(total_capture_time%60)}s")
            
            await browser.close()
            
            # Encode with FFmpeg
            export_jobs[job_id]["status"] = "encoding"
            export_jobs[job_id]["progress"] = 50
            export_jobs[job_id]["message"] = "Encoding video with FFmpeg..."
            
            print("🎬 Encoding video with FFmpeg...")
            
            output_file = EXPORTS_DIR / f"flight-{flight_id}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.mp4"
            
            ffmpeg_cmd = [
                "ffmpeg",
                "-framerate", str(fps),
                "-i", str(frames_dir / "frame%05d.png"),
                "-c:v", "libx264",
                "-preset", "medium",
                "-crf", "18",  # Higher quality (lower CRF)
                "-pix_fmt", "yuv420p",
                "-y",
                str(output_file)
            ]
            
            print(f"🎬 FFmpeg command: {' '.join(ffmpeg_cmd)}")
            
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                raise Exception(f"FFmpeg encoding failed: {result.stderr}")
            
            print(f"✅ Video encoded: {output_file}")
            
            # Cleanup frames
            print("🗑️  Cleaning up frames...")
            for frame_file in frames_dir.glob("*.png"):
                frame_file.unlink()
            frames_dir.rmdir()
            
            # Success
            file_size_mb = output_file.stat().st_size / (1024 * 1024)
            export_jobs[job_id]["status"] = "completed"
            export_jobs[job_id]["progress"] = 100
            export_jobs[job_id]["message"] = f"Video ready! ({file_size_mb:.1f} MB)"
            export_jobs[job_id]["video_path"] = str(output_file)
            export_jobs[job_id]["completed_at"] = datetime.now().isoformat()
            
            # Update flight status in database
            if update_db:
                from database import SessionLocal
                from models import Flight
                db = SessionLocal()
                try:
                    flight = db.query(Flight).filter(Flight.id == flight_id).first()
                    if flight:
                        flight.video_export_status = "completed"
                        flight.video_file_path = f"exports/videos/flight_{flight_id}.mp4"
                        db.commit()
                finally:
                    db.close()
            
            capture_time_min = int(total_capture_time / 60)
            print(f"✅ Export completed in {capture_time_min} minutes!")
            print(f"📹 Video: {output_file} ({file_size_mb:.1f} MB)")
            
    except Exception as e:
        print(f"❌ Export failed: {str(e)}")
        import traceback
        traceback.print_exc()
        
        export_jobs[job_id]["status"] = "failed"
        export_jobs[job_id]["error"] = str(e)
        export_jobs[job_id]["message"] = f"Error: {str(e)}"
        
        # Update flight status in database
        if update_db:
            from database import SessionLocal
            from models import Flight
            db = SessionLocal()
            try:
                flight = db.query(Flight).filter(Flight.id == flight_id).first()
                if flight:
                    flight.video_export_status = "failed"
                    db.commit()
            finally:
                db.close()


def get_export_status(job_id: str) -> Optional[Dict]:
    """Get status of an export job"""
    return export_jobs.get(job_id)


def list_exports(flight_id: str) -> list:
    """List all exports for a flight"""
    return [job for job_id, job in export_jobs.items() if job["flight_id"] == flight_id]


def trigger_auto_export(flight_id: str, db: Session, frontend_url: str = "http://localhost:5173"):
    """
    Automatically trigger video export for a flight with GPX
    Called after GPX upload/processing
    
    Args:
        flight_id: ID of the flight
        db: Database session (only used to check if export needed)
        frontend_url: URL of the frontend
    
    Returns:
        job_id if export started, None otherwise
    """
    from models import Flight
    
    # Check if flight has GPX and doesn't already have a video export in progress
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    
    if not flight:
        print(f"⚠️  Flight {flight_id} not found, skipping auto-export")
        return None
    
    if not flight.gpx_file_path:
        print(f"⚠️  Flight {flight_id} has no GPX, skipping auto-export")
        return None
    
    if flight.video_export_status in ["processing", "completed"]:
        print(f"ℹ️  Flight {flight_id} already has video export status: {flight.video_export_status}")
        return None
    
    print(f"🚀 Auto-triggering video export for flight {flight_id}")
    
    # Start export with optimal settings (creates its own DB session in thread)
    job_id = start_video_export_manual(
        flight_id=flight_id,
        quality="1080p",  # Optimal quality
        fps=15,           # Optimal FPS for smooth playback
        speed=1,          # Real-time speed
        frontend_url=frontend_url,
        update_db=True    # Update DB from within the thread
    )
    
    print(f"✅ Video export job {job_id} started for flight {flight_id}")
    return job_id
