"""Render a saved interactive telemetry layout onto a YouTube source video."""

from __future__ import annotations

import asyncio
import math
import shutil
import subprocess
from collections.abc import Callable
from pathlib import Path
from urllib.parse import urlencode

import config
from video_acceleration import chromium_launch_args, select_video_accelerator
from youtube_overlay_export import YoutubeExportError, _run, download_youtube

ProgressCallback = Callable[[str, int | None], None]


def _video_duration(path: Path) -> float:
    try:
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
            capture_output=True,
            check=True,
            text=True,
        )
        duration = float(result.stdout.strip())
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        raise YoutubeExportError("La durée de la vidéo source est indisponible") from exc
    if not math.isfinite(duration) or duration <= 0:
        raise YoutubeExportError("La durée de la vidéo source est invalide")
    return duration


async def _capture_layout_frames(
    *,
    frontend_url: str,
    flight_id: str,
    job_id: str,
    job_token: str | None,
    timeline_start_timestamp: float,
    offset_seconds: float,
    fps: int,
    frame_count: int,
    frames_directory: Path,
    is_cancelled: Callable[[], bool],
    progress: ProgressCallback,
) -> None:
    from playwright.async_api import TimeoutError as PlaywrightTimeoutError
    from playwright.async_api import async_playwright

    query = urlencode(
        {
            "mode": "telemetry-layout",
            "flightId": flight_id,
            "jobId": job_id,
            "exportToken": job_token or "",
            "timelineStart": str(timeline_start_timestamp * 1000),
            "offset": str(offset_seconds),
        }
    )
    url = f"{frontend_url.rstrip('/')}/export-viewer?{query}"
    accelerator = select_video_accelerator(config.VIDEO_ACCELERATOR)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=True,
            args=chromium_launch_args(accelerator),
        )
        try:
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                device_scale_factor=1,
                java_script_enabled=True,
                color_scheme="dark",
            )
            page = await context.new_page()
            page.on("pageerror", lambda error: progress(f"Erreur du rendu layout: {error}", None))
            response = await page.goto(url, wait_until="networkidle", timeout=60_000)
            if response is None or response.status >= 400:
                raise YoutubeExportError("La page de rendu du layout est inaccessible")
            try:
                await page.wait_for_function(
                    "window._telemetryExportReady === true || Boolean(window._telemetryExportError)",
                    timeout=120_000,
                )
            except PlaywrightTimeoutError as exc:
                raise YoutubeExportError("Le layout de télémétrie n’a pas pu être chargé") from exc
            export_error = await page.evaluate("window._telemetryExportError || null")
            if export_error:
                raise YoutubeExportError(str(export_error))
            await page.add_style_tag(content="html,body,#root{background:transparent!important}")

            frames_directory.mkdir(parents=True, exist_ok=True)
            for frame_index in range(frame_count):
                if is_cancelled():
                    raise YoutubeExportError("Export annulé")
                video_time = frame_index / fps
                await page.evaluate("(time) => window._setTelemetryExportTime(time)", video_time)
                await page.screenshot(
                    path=str(frames_directory / f"frame{frame_index:05d}.png"),
                    omit_background=True,
                    animations="disabled",
                )
                if frame_index % 120 == 0 or frame_index == frame_count - 1:
                    percent = round((frame_index + 1) / max(frame_count, 1) * 100)
                    progress(
                        f"Capture du layout: {frame_index + 1}/{frame_count} images",
                        percent,
                    )
        finally:
            await browser.close()


def export_youtube_telemetry_layout(
    *,
    url: str,
    output_path: Path,
    offset_seconds: float,
    timeline_start_timestamp: float,
    frontend_url: str,
    job_id: str,
    job_token: str | None,
    work_dir: Path,
    progress: ProgressCallback,
    is_cancelled: Callable[[], bool],
    cookies: str | None = None,
) -> None:
    """Download the source, capture the saved layout, then compose an MP4."""
    try:
        source = download_youtube(url, work_dir, progress, cookies=cookies)
        if is_cancelled():
            raise YoutubeExportError("Export annulé")
        duration = _video_duration(source)
        fps = 30
        frame_count = max(1, math.ceil(duration * fps))
        frames_directory = work_dir / "telemetry-layout-frames"
        asyncio.run(
            _capture_layout_frames(
                frontend_url=frontend_url,
                flight_id=_flight_id_for_job(job_id),
                job_id=job_id,
                job_token=job_token,
                timeline_start_timestamp=timeline_start_timestamp,
                offset_seconds=offset_seconds,
                fps=fps,
                frame_count=frame_count,
                frames_directory=frames_directory,
                is_cancelled=is_cancelled,
                progress=progress,
            )
        )
        if is_cancelled():
            raise YoutubeExportError("Export annulé")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        progress("Fusion du layout et de la vidéo YouTube", None)
        _run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(source),
                "-framerate",
                str(fps),
                "-i",
                str(frames_directory / "frame%05d.png"),
                "-filter_complex",
                "[1:v][0:v]scale2ref=w=main_w:h=main_h[overlay][base];"
                "[base][overlay]overlay=0:0:shortest=1[outv]",
                "-map",
                "[outv]",
                "-map",
                "0:a?",
                "-c:v",
                "libx264",
                "-preset",
                "fast",
                "-crf",
                "18",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-shortest",
                "-movflags",
                "+faststart",
                str(output_path),
            ],
            on_output=lambda line: progress(line, None),
        )
        if not output_path.is_file() or output_path.stat().st_size == 0:
            raise YoutubeExportError("Le fichier MP4 final est vide")
    except BaseException:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise


def _flight_id_for_job(job_id: str) -> str:
    """Look up the owning flight without keeping job state in the browser URL."""
    from database import SessionLocal
    from models import VideoExportJob

    with SessionLocal() as db:
        job = db.get(VideoExportJob, job_id)
        if not job or not job.flight_id:
            raise YoutubeExportError("Vol introuvable pour cet export")
        return job.flight_id
