"""
Video export service using Playwright for background rendering
"""
import asyncio
import os
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional
import subprocess

# Storage for export jobs
export_jobs: Dict[str, Dict] = {}

EXPORTS_DIR = Path(__file__).parent / "exports" / "videos"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)


def start_video_export_background(
    flight_id: str,
    quality: str = "1080p",
    fps: int = 30,
    speed: int = 1,
    frontend_url: str = "http://localhost:5173"
):
    """
    Start video export in a background thread
    """
    job_id = f"{flight_id}-{int(time.time())}"
    
    export_jobs[job_id] = {
        "flight_id": flight_id,
        "status": "started",
        "progress": 0,
        "message": "Initializing...",
        "started_at": datetime.now().isoformat(),
        "video_path": None,
        "error": None
    }
    
    # Start export in background thread
    thread = threading.Thread(
        target=_run_async_export,
        args=(job_id, flight_id, quality, fps, speed, frontend_url)
    )
    thread.daemon = True
    thread.start()
    
    return job_id


def _run_async_export(job_id: str, flight_id: str, quality: str, fps: int, speed: int, frontend_url: str):
    """
    Run async export in a separate thread with its own event loop
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_export_video_playwright(job_id, flight_id, quality, fps, speed, frontend_url))
    finally:
        loop.close()


async def _export_video_playwright(
    job_id: str,
    flight_id: str, 
    quality: str,
    fps: int,
    speed: int,
    frontend_url: str
):
    """
    Export video using Playwright to capture frames
    """
    try:
        # Lazy import to avoid blocking server startup
        from playwright.async_api import async_playwright
        
        # Update status
        export_jobs[job_id]["status"] = "capturing"
        export_jobs[job_id]["message"] = "Loading page..."
        
        # Resolution mapping
        resolutions = {
            "720p": (1280, 720),
            "1080p": (1920, 1080),
            "4K": (3840, 2160)
        }
        width, height = resolutions.get(quality, (1920, 1080))
        
        async with async_playwright() as p:
            # Launch browser with GPU acceleration in headless mode
            browser = await p.chromium.launch(
                headless=True,  # Headless mode for faster performance
                args=[
                    '--enable-gpu',
                    '--use-gl=egl',  # Use EGL for headless GPU
                    '--enable-webgl',
                    '--ignore-gpu-blocklist',
                    '--disable-gpu-vsync',
                    '--no-sandbox',  # Required for some environments
                    '--disable-dev-shm-usage',  # Overcome limited resource problems
                ]
            )
            context = await browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=1
            )
            page = await context.new_page()
            
            # Listen to console messages for debugging
            page.on("console", lambda msg: print(f"🖥️  Browser console [{msg.type}]: {msg.text}"))
            page.on("pageerror", lambda err: print(f"❌ Browser error: {err}"))
            
            # Navigate to flight viewer  
            # Use dedicated export viewer page with query param
            url = f"{frontend_url}/export-viewer?flightId={flight_id}"
            print(f"📺 Opening {url}")
            
            # Navigate and check for errors
            response = await page.goto(url, wait_until="networkidle", timeout=60000)
            if response.status >= 400:
                raise Exception(f"Page returned HTTP {response.status}")
            
            # Take a screenshot for debugging
            await page.screenshot(path=f"/tmp/playwright-debug-{job_id}.png")
            print(f"📸 Debug screenshot saved to /tmp/playwright-debug-{job_id}.png")
            
            # Wait for Cesium to load - wait for any canvas element inside the container
            export_jobs[job_id]["message"] = "Waiting for 3D viewer..."
            print("⏳ Waiting for canvas element...")
            
            # Wait for React to load first
            await page.wait_for_load_state("domcontentloaded")
            await asyncio.sleep(2)  # Give React time to hydrate
            
            try:
                # Try to wait for canvas with a longer timeout
                await page.wait_for_selector("canvas", timeout=60000, state="attached")
                print("✅ Cesium canvas found")
                
                # Wait a bit more for Cesium to initialize
                await asyncio.sleep(3)
                
            except Exception as e:
                # Take another screenshot to see what went wrong
                await page.screenshot(path=f"/tmp/playwright-error-{job_id}.png")
                print(f"❌ Canvas not found. Error screenshot: /tmp/playwright-error-{job_id}.png")
                
                # Get page content for debugging
                content = await page.content()
                print(f"Page HTML (first 500 chars): {content[:500]}")
                
                # Try to get console errors
                print("Checking for JavaScript errors...")
                
                raise Exception(f"Canvas element not found after 60s. Check if flight viewer loaded correctly. Error: {str(e)}")
            
            # Give it a bit more time for initialization
            await asyncio.sleep(3)
            
            # Wait for terrain textures to load by checking terrainReady state
            export_jobs[job_id]["message"] = "Waiting for terrain textures..."
            print("⏳ Waiting for terrain to be ready...")
            
            # Add timeout to terrain check (max 60 seconds)
            try:
                print("🔍 Starting terrain readiness check (max 60s)...")
                
                # Wrap page.evaluate() with asyncio.wait_for() to enforce timeout at Python level
                terrain_ready = await asyncio.wait_for(
                    page.evaluate("""
                        () => {
                            return new Promise((resolve, reject) => {
                                let checkCount = 0;
                                const maxChecks = 120; // 60 seconds (500ms * 120)
                                
                                const checkTerrain = () => {
                                    checkCount++;
                                    
                                    // Timeout after maxChecks
                                    if (checkCount >= maxChecks) {
                                        console.log('⚠️ Terrain check timeout after 60s - proceeding anyway');
                                        resolve(false); // Resolve with false to indicate timeout
                                        return;
                                    }
                                    
                                    // Check if terrainReady indicator is visible (hidden when ready)
                                    const loadingIndicator = document.querySelector('[class*="bg-blue-100"]');
                                    const hasLoadingText = loadingIndicator && loadingIndicator.textContent.includes('Chargement des textures');
                                    
                                    if (!hasLoadingText) {
                                        console.log('✅ Terrain textures loaded!');
                                        resolve(true);
                                    } else {
                                        // Log every 10 checks (5 seconds)
                                        if (checkCount % 10 === 0) {
                                            console.log(`⏳ Still loading terrain... (${checkCount * 0.5}s / 60s)`);
                                        }
                                        setTimeout(checkTerrain, 500);
                                    }
                                };
                                setTimeout(checkTerrain, 1000);
                            });
                        }
                    """),
                    timeout=65.0  # Python-level timeout (slightly longer than JS timeout)
                )
                
                if terrain_ready:
                    print("✅ Terrain ready! Waiting 2 more seconds for stability...")
                else:
                    print("⚠️ Terrain check timed out after 60s, proceeding anyway...")
                    
                await asyncio.sleep(2)  # Extra buffer for complete rendering
                
            except asyncio.TimeoutError:
                print("⚠️ Python-level timeout after 65s - terrain still loading. Proceeding anyway...")
                await asyncio.sleep(2)
            except Exception as e:
                print(f"⚠️ Error waiting for terrain: {e}. Proceeding anyway...")
                await asyncio.sleep(2)
            
            # Get flight data to calculate duration
            export_jobs[job_id]["message"] = "Calculating frames..."
            
            # Execute JavaScript to get flight info and prepare for capture
            flight_info = await page.evaluate("""
                async () => {
                    // Wait for React to be ready
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Get flight duration from the displayed time
                    const timeElement = document.querySelector('[class*="text-sm"][class*="text-gray-700"]');
                    if (timeElement && timeElement.textContent.includes('Temps:')) {
                        const match = timeElement.textContent.match(/\\/\\s*(\\d+)min\\s*(\\d+)s/);
                        if (match) {
                            const totalSeconds = parseInt(match[1]) * 60 + parseInt(match[2]);
                            return { duration: totalSeconds };
                        }
                    }
                    return { duration: 1800 }; // Default 30 min
                }
            """)
            
            duration_seconds = flight_info.get("duration", 1800)
            video_duration = duration_seconds / speed
            total_frames = int(video_duration * fps)
            
            print(f"📸 Flight duration: {duration_seconds}s")
            print(f"📸 Video duration: {video_duration}s at {speed}x speed")
            print(f"📸 Total frames: {total_frames}")
            
            export_jobs[job_id]["total_frames"] = total_frames
            export_jobs[job_id]["message"] = f"Capturing {total_frames} frames..."
            
            # Create temp directory for frames
            frames_dir = EXPORTS_DIR / f"frames_{job_id}"
            frames_dir.mkdir(exist_ok=True)
            
            # Trigger playback and capture frames
            await page.evaluate("""
                () => {
                    // Click play button
                    const playButton = document.querySelector('button');
                    if (playButton && playButton.textContent.includes('Play')) {
                        playButton.click();
                    }
                }
            """)
            
            # Capture frames
            frame_count = 0
            ms_per_frame = (duration_seconds * 1000) / total_frames
            
            for i in range(total_frames):
                # Capture screenshot
                frame_path = frames_dir / f"frame{i:05d}.png"
                await page.screenshot(path=str(frame_path))
                
                frame_count += 1
                if frame_count % 10 == 0:
                    progress = int((frame_count / total_frames) * 50)  # 0-50% for capture
                    export_jobs[job_id]["progress"] = progress
                    export_jobs[job_id]["message"] = f"Captured {frame_count}/{total_frames} frames"
                    print(f"📸 Frame {frame_count}/{total_frames}")
                
                # Wait appropriate time before next frame
                await asyncio.sleep(ms_per_frame / 1000)
            
            await browser.close()
            
            # Encode video with FFmpeg
            export_jobs[job_id]["status"] = "encoding"
            export_jobs[job_id]["progress"] = 50
            export_jobs[job_id]["message"] = "Encoding video with FFmpeg..."
            
            output_file = EXPORTS_DIR / f"flight-{flight_id}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.mp4"
            
            ffmpeg_cmd = [
                "ffmpeg",
                "-framerate", str(fps),
                "-i", str(frames_dir / "frame%05d.png"),
                "-c:v", "libx264",
                "-preset", "medium",
                "-crf", "23",
                "-pix_fmt", "yuv420p",
                "-s", f"{width}:{height}",
                "-y",
                str(output_file)
            ]
            
            print(f"🎬 Encoding: {' '.join(ffmpeg_cmd)}")
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                raise Exception(f"FFmpeg failed: {result.stderr}")
            
            # Cleanup frames
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
            
            print(f"✅ Video exported: {output_file}")
            
    except Exception as e:
        print(f"❌ Export failed: {str(e)}")
        export_jobs[job_id]["status"] = "failed"
        export_jobs[job_id]["error"] = str(e)
        export_jobs[job_id]["message"] = f"Error: {str(e)}"


def get_export_status(job_id: str) -> Optional[Dict]:
    """
    Get status of an export job
    """
    return export_jobs.get(job_id)


def list_exports(flight_id: Optional[str] = None) -> list:
    """
    List all export jobs, optionally filtered by flight_id
    """
    jobs = list(export_jobs.values())
    if flight_id:
        jobs = [j for j in jobs if j.get("flight_id") == flight_id]
    return jobs
