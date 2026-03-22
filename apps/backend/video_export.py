"""
Video export service using Playwright for background rendering
"""

import asyncio
import shutil
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path

# Storage for export jobs
export_jobs: dict[str, dict] = {}

EXPORTS_DIR = Path(__file__).parent / "exports" / "videos"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)


def check_dependencies():
    """
    Check if required system dependencies are installed
    """
    missing = []

    # Check FFmpeg
    if not shutil.which("ffmpeg"):
        missing.append("ffmpeg")

    if missing:
        deps_str = ", ".join(missing)
        print(f"⚠️  WARNING: Missing required dependencies: {deps_str}")
        print("⚠️  Video export will not work until these are installed.")
        print("⚠️  See PRODUCTION_SETUP.md for installation instructions.")
        return False

    print("✅ Video export dependencies OK (ffmpeg found)")
    return True


# Check dependencies on module load
_dependencies_ok = check_dependencies()


def start_video_export_background(
    flight_id: str,
    quality: str = "1080p",
    fps: int = 30,
    speed: int = 1,
    frontend_url: str = "http://localhost:5173",
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
        "error": None,
    }

    # Start export in background thread
    thread = threading.Thread(
        target=_run_async_export, args=(job_id, flight_id, quality, fps, speed, frontend_url)
    )
    thread.daemon = True
    thread.start()

    return job_id


def _run_async_export(
    job_id: str, flight_id: str, quality: str, fps: int, speed: int, frontend_url: str
):
    """
    Run async export in a separate thread with its own event loop
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(
            _export_video_playwright(job_id, flight_id, quality, fps, speed, frontend_url)
        )
    finally:
        loop.close()


async def _export_video_playwright(
    job_id: str, flight_id: str, quality: str, fps: int, speed: int, frontend_url: str
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
        resolutions = {"720p": (1280, 720), "1080p": (1920, 1080), "4K": (3840, 2160)}
        width, height = resolutions.get(quality, (1920, 1080))

        async with async_playwright() as p:
            # Launch browser with GPU acceleration and increased resources
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    # GPU acceleration
                    "--enable-gpu",
                    "--use-gl=egl",
                    "--enable-webgl",
                    "--enable-webgl2",
                    "--ignore-gpu-blocklist",
                    "--disable-gpu-vsync",
                    # Performance optimizations
                    "--disable-dev-shm-usage",  # Use /tmp instead of /dev/shm
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    # Increase memory and resources
                    "--js-flags=--max-old-space-size=4096",  # 4GB heap for JS
                    "--disable-background-timer-throttling",  # Don't throttle timers
                    "--disable-backgrounding-occluded-windows",
                    "--disable-renderer-backgrounding",
                    # Better rendering
                    "--force-device-scale-factor=1",
                    "--high-dpi-support=1",
                    "--disable-blink-features=AutomationControlled",  # Appear more like real browser
                ],
            )
            context = await browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=1,
                # Disable unnecessary features to improve performance
                java_script_enabled=True,
                bypass_csp=True,  # Bypass Content Security Policy
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

            # Take a screenshot for debugging (with longer timeout for headless)
            try:
                await page.screenshot(path=f"/tmp/playwright-debug-{job_id}.png", timeout=60000)
                print(f"📸 Debug screenshot saved to /tmp/playwright-debug-{job_id}.png")
            except Exception as e:
                print(f"⚠️  Debug screenshot failed: {e} (continuing anyway)")

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

                raise Exception(
                    f"Canvas element not found after 60s. Check if flight viewer loaded correctly. Error: {str(e)}"
                ) from e

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
                    timeout=65.0,  # Python-level timeout (slightly longer than JS timeout)
                )

                if terrain_ready:
                    print("✅ Terrain ready! Waiting 2 more seconds for stability...")
                else:
                    print("⚠️ Terrain check timed out after 60s, proceeding anyway...")

                await asyncio.sleep(2)  # Extra buffer for complete rendering

            except TimeoutError:
                print(
                    "⚠️ Python-level timeout after 65s - terrain still loading. Proceeding anyway..."
                )
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
            export_jobs[job_id]["message"] = "Recording video with Canvas API..."

            print(f"🎥 Starting canvas recording for {video_duration}s...")

            # Start canvas recording using MediaRecorder API with forced framerate
            recording_started = await page.evaluate(f"""
                async () => {{
                    // Find the Cesium canvas
                    const canvas = document.querySelector('canvas');
                    if (!canvas) {{
                        throw new Error('Canvas not found');
                    }}

                    console.log('✅ Canvas found, dimensions:', canvas.width, 'x', canvas.height);

                    // Force canvas to requested resolution
                    canvas.width = {width};
                    canvas.height = {height};
                    console.log('📐 Canvas resized to {width}x{height}');

                    // Create a stream from the canvas with manual frame capture
                    const stream = canvas.captureStream(0); // 0 = manual mode, we control frame capture
                    const track = stream.getVideoTracks()[0];

                    // Setup MediaRecorder with highest quality
                    const recorder = new MediaRecorder(stream, {{
                        mimeType: 'video/webm;codecs=vp9',
                        videoBitsPerSecond: 20000000 // 20 Mbps for high quality
                    }});

                    const chunks = [];

                    recorder.ondataavailable = (e) => {{
                        if (e.data.size > 0) {{
                            chunks.push(e.data);
                            console.log('📦 Chunk received:', e.data.size, 'bytes');
                        }}
                    }};

                    // Store recorder, chunks, and track globally
                    window._videoRecorder = recorder;
                    window._videoChunks = chunks;
                    window._videoTrack = track;

                    // Start recording
                    recorder.start(100); // Collect data every 100ms for smoother chunks
                    console.log('🎥 Recording started in manual mode');

                    // Setup frame capture at precise FPS
                    const targetFPS = {fps};
                    const msPerFrame = 1000 / targetFPS;
                    let frameCount = 0;

                    window._captureInterval = setInterval(() => {{
                        // Request a new frame to be captured
                        track.requestFrame();
                        frameCount++;
                        if (frameCount % 30 === 0) {{
                            console.log(`📸 Captured ${{frameCount}} frames`);
                        }}
                    }}, msPerFrame);

                    console.log(`⏱️  Frame capture interval: ${{msPerFrame}}ms ({fps} FPS)`);

                    // Click play button to start animation
                    const playButton = Array.from(document.querySelectorAll('button'))
                        .find(btn => btn.textContent.includes('Play') || btn.textContent.includes('▶'));
                    if (playButton) {{
                        playButton.click();
                        console.log('▶️  Playback started');
                    }} else {{
                        console.warn('⚠️  Play button not found');
                    }}

                    return true;
                }}
            """)

            if not recording_started:
                raise Exception("Failed to start canvas recording")

            print("✅ Canvas recording started successfully")

            # Wait for the full duration + buffer
            export_jobs[job_id]["message"] = f"Recording in progress ({int(video_duration)}s)..."

            # Check recording progress every 5 seconds
            elapsed = 0
            check_interval = 5
            while elapsed < video_duration + 5:  # Add 5s buffer
                await asyncio.sleep(check_interval)
                elapsed += check_interval

                progress = min(int((elapsed / video_duration) * 40), 40)  # 0-40% for recording
                export_jobs[job_id]["progress"] = progress
                export_jobs[job_id]["message"] = f"Recording... {elapsed}s / {int(video_duration)}s"
                print(f"🎥 Recording progress: {elapsed}s / {int(video_duration)}s")

            print("⏹️  Stopping recording...")

            # Stop recording and get the video data
            export_jobs[job_id]["message"] = "Finalizing recording..."
            video_data = await page.evaluate("""
                async () => {
                    return new Promise((resolve) => {
                        const recorder = window._videoRecorder;
                        const chunks = window._videoChunks;

                        // Stop frame capture interval
                        if (window._captureInterval) {
                            clearInterval(window._captureInterval);
                            console.log('⏹️  Frame capture stopped');
                        }

                        recorder.onstop = async () => {
                            console.log('✅ Recording stopped, chunks:', chunks.length);

                            // Create blob from chunks
                            const blob = new Blob(chunks, { type: 'video/webm' });
                            console.log('📦 Video blob size:', blob.size, 'bytes');

                            // Convert blob to base64
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const base64data = reader.result.split(',')[1];
                                console.log('✅ Video converted to base64');
                                resolve(base64data);
                            };
                            reader.readAsDataURL(blob);
                        };

                        recorder.stop();
                        console.log('⏹️  Recorder.stop() called');
                    });
                }
            """)

            print(f"✅ Received video data: {len(video_data)} bytes (base64)")

            # Save WebM file
            webm_file = (
                EXPORTS_DIR / f"flight-{flight_id}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.webm"
            )
            import base64

            webm_data = base64.b64decode(video_data)
            webm_file.write_bytes(webm_data)
            print(f"💾 WebM saved: {webm_file} ({len(webm_data)} bytes)")

            await browser.close()

            # Convert WebM to MP4 with FFmpeg
            export_jobs[job_id]["status"] = "encoding"
            export_jobs[job_id]["progress"] = 50
            export_jobs[job_id]["message"] = "Converting WebM to MP4..."

            output_file = (
                EXPORTS_DIR / f"flight-{flight_id}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.mp4"
            )

            # Convert WebM to MP4
            ffmpeg_cmd = [
                "ffmpeg",
                "-i",
                str(webm_file),
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "23",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",  # Audio codec (even if no audio)
                "-y",  # Overwrite output file
                str(output_file),
            ]

            print(f"🎬 Converting WebM to MP4: {' '.join(ffmpeg_cmd)}")
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)

            if result.returncode != 0:
                raise Exception(f"FFmpeg conversion failed: {result.stderr}")

            # Cleanup temporary WebM file
            if webm_file.exists():
                webm_file.unlink()
                print("🗑️  Cleaned up temporary WebM file")

            # Success
            file_size_mb = output_file.stat().st_size / (1024 * 1024)
            export_jobs[job_id]["status"] = "completed"
            export_jobs[job_id]["progress"] = 100
            export_jobs[job_id]["message"] = f"Video ready! ({file_size_mb:.1f} MB)"
            export_jobs[job_id]["video_path"] = str(output_file)
            export_jobs[job_id]["completed_at"] = datetime.now().isoformat()

            print(f"✅ Video exported: {output_file} ({file_size_mb:.1f} MB)")

    except Exception as e:
        print(f"❌ Export failed: {str(e)}")
        export_jobs[job_id]["status"] = "failed"
        export_jobs[job_id]["error"] = str(e)
        export_jobs[job_id]["message"] = f"Error: {str(e)}"


def get_export_status(job_id: str) -> dict | None:
    """
    Get status of an export job
    """
    return export_jobs.get(job_id)


def list_exports(flight_id: str | None = None) -> list:
    """
    List all export jobs, optionally filtered by flight_id
    """
    jobs = list(export_jobs.values())
    if flight_id:
        jobs = [j for j in jobs if j.get("flight_id") == flight_id]
    return jobs
