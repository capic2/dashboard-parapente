"""Render a saved interactive telemetry layout onto a YouTube source video."""

from __future__ import annotations

import asyncio
import json
import math
import re
import subprocess
from collections.abc import Callable
from pathlib import Path
from urllib.parse import urlencode

import config
from video_acceleration import chromium_launch_args, select_video_accelerator
from youtube_overlay_export import YoutubeExportError, _run, download_youtube

ProgressCallback = Callable[[str, int | None], None]
CompositionProgressCallback = Callable[[int, int, int | None, float, float | None], None]
LAYOUT_CANVAS_WIDTH = 1920
LAYOUT_CANVAS_HEIGHT = 1080
_FFMPEG_STATS_RE = re.compile(
    r"frame=\s*(?P<frame>\d+).*?fps=\s*(?P<fps>[\d.]+).*?"
    r"time=(?P<time>\d{2}:\d{2}:\d{2}(?:\.\d+)?).*?"
    r"speed=\s*(?P<speed>[\d.]+)x",
    re.IGNORECASE,
)


def _parse_ffmpeg_stats(line: str) -> tuple[int, float, float, float] | None:
    match = _FFMPEG_STATS_RE.search(line)
    if match is None:
        return None
    hours, minutes, seconds = match.group("time").split(":")
    try:
        return (
            int(match.group("frame")),
            float(match.group("fps")),
            int(hours) * 3600 + int(minutes) * 60 + float(seconds),
            float(match.group("speed")),
        )
    except ValueError:
        return None


def _video_frame_count(video_path: Path, duration: float) -> int:
    """Read the source frame count, with a duration-based fallback."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=nb_frames,avg_frame_rate",
                "-of",
                "json",
                str(video_path),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        streams = json.loads(result.stdout).get("streams", [])
        if streams:
            stream = streams[0]
            try:
                frame_count = int(stream.get("nb_frames", 0))
            except (TypeError, ValueError):
                frame_count = 0
            if frame_count > 0:
                return frame_count
            numerator, denominator = stream.get("avg_frame_rate", "0/1").split("/")
            frame_rate = float(numerator) / float(denominator)
            if frame_rate > 0 and duration > 0:
                return max(1, round(duration * frame_rate))
    except (OSError, subprocess.SubprocessError, ValueError, TypeError, ZeroDivisionError):
        pass
    return max(1, round(duration * 30))


def _report_composition_output(
    line: str,
    *,
    progress: ProgressCallback,
    composition_progress: CompositionProgressCallback | None,
    total_frames: int,
    duration: float,
) -> None:
    progress(line, None)
    stats = _parse_ffmpeg_stats(line)
    if stats is None or composition_progress is None:
        return
    frame, encoding_fps, encoded_seconds, speed = stats
    completion = min(max(frame / max(total_frames, 1), 0.0), 1.0)
    remaining_seconds = max(duration - encoded_seconds, 0.0)
    eta_seconds = max(0, round(remaining_seconds / speed)) if speed > 0 else None
    composition_progress(frame, total_frames, eta_seconds, completion, encoding_fps)


def _normalize_pip_layouts(
    raw_layouts: object, pip_exports: list[dict[str, object]]
) -> list[dict[str, float | str]]:
    if not isinstance(raw_layouts, list) or len(raw_layouts) != len(pip_exports):
        raise YoutubeExportError("La disposition des PiP est indisponible")

    pip_layouts: list[dict[str, float | str]] = []
    for raw_layout, pip_export in zip(raw_layouts, pip_exports, strict=True):
        if not isinstance(raw_layout, dict):
            raise YoutubeExportError("La disposition d’un PiP est invalide")
        slot_id = raw_layout.get("slot_id")
        expected_slot_id = pip_export.get("slot_id")
        if not isinstance(slot_id, str) or slot_id != expected_slot_id:
            raise YoutubeExportError("La disposition d’un PiP est invalide")

        normalized_layout: dict[str, float | str] = {"slot_id": slot_id}
        for key in ("x", "y", "width", "height"):
            try:
                value = float(raw_layout[key])
            except (KeyError, TypeError, ValueError) as exc:
                raise YoutubeExportError("La disposition d’un PiP est invalide") from exc
            if not math.isfinite(value):
                raise YoutubeExportError("La disposition d’un PiP est invalide")
            normalized_layout[key] = value
        try:
            offset_seconds = float(pip_export["offset_seconds"])
        except (KeyError, TypeError, ValueError) as exc:
            raise YoutubeExportError("L’offset d’un PiP est invalide") from exc
        if not math.isfinite(offset_seconds):
            raise YoutubeExportError("L’offset d’un PiP est invalide")
        normalized_layout["offset_seconds"] = offset_seconds
        if normalized_layout["width"] <= 0 or normalized_layout["height"] <= 0:
            raise YoutubeExportError("La taille d’un PiP est invalide")
        pip_layouts.append(normalized_layout)
    return pip_layouts


def _build_ffmpeg_composition(
    *,
    source: Path,
    frames_manifest: Path,
    pip_video_paths: list[Path],
    pip_layouts: list[dict[str, float | str]],
    pip_durations: list[float],
    video_width: int,
    video_height: int,
    fps: int,
) -> tuple[list[str], str]:
    ffmpeg_inputs = [
        "-i",
        str(source),
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(frames_manifest),
    ]
    filter_graph = ["[1:v][0:v]scale2ref=w=main_w:h=main_h[overlay][base]"]
    current_base = "base"
    for index, (pip_video_path, pip_layout, pip_duration) in enumerate(
        zip(pip_video_paths, pip_layouts, pip_durations, strict=True)
    ):
        input_index = index + 2
        ffmpeg_inputs.extend(["-i", str(pip_video_path)])
        width = max(
            2, round(float(pip_layout["width"]) * video_width / LAYOUT_CANVAS_WIDTH / 2) * 2
        )
        height = max(
            2, round(float(pip_layout["height"]) * video_height / LAYOUT_CANVAS_HEIGHT / 2) * 2
        )
        x = round(float(pip_layout["x"]) * video_width / LAYOUT_CANVAS_WIDTH)
        y = round(float(pip_layout["y"]) * video_height / LAYOUT_CANVAS_HEIGHT)
        offset = float(pip_layout["offset_seconds"])
        trim_start = min(max(0.0, -offset), max(0.0, pip_duration - 1 / fps))
        start_pad = max(0.0, offset)
        pip_label = f"pip{index}"
        composed_base = f"basepip{index}"
        filter_graph.append(
            f"[{input_index}:v]trim=start={trim_start:.6f},setpts=PTS-STARTPTS,"
            f"tpad=start_mode=clone:start_duration={start_pad:.6f},"
            f"scale=w={width}:h={height}:force_original_aspect_ratio=increase,"
            f"crop=w={width}:h={height},setsar=1[{pip_label}]"
        )
        filter_graph.append(
            f"[{current_base}][{pip_label}]overlay=x={x}:y={y}:"
            f"eof_action=repeat:shortest=0[{composed_base}]"
        )
        current_base = composed_base
    filter_graph.append(f"[{current_base}][overlay]overlay=0:0:eof_action=repeat:shortest=1[outv]")
    return ffmpeg_inputs, ";".join(filter_graph)


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


def _video_resolution(path: Path) -> tuple[int, int]:
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
                str(path),
            ],
            capture_output=True,
            check=True,
            text=True,
            timeout=20,
        )
        metadata = json.loads(result.stdout)
        streams = metadata.get("streams")
        if not isinstance(streams, list) or not streams or not isinstance(streams[0], dict):
            raise ValueError("La résolution de la vidéo source est absente")
        width = int(streams[0]["width"])
        height = int(streams[0]["height"])
    except (
        OSError,
        ValueError,
        KeyError,
        IndexError,
        TypeError,
        subprocess.SubprocessError,
    ) as exc:
        raise YoutubeExportError("La résolution de la vidéo source est indisponible") from exc
    if width <= 0 or height <= 0:
        raise YoutubeExportError("La résolution de la vidéo source est invalide")
    return width, height


async def _capture_layout_frames(
    *,
    frontend_url: str,
    flight_id: str,
    job_id: str,
    job_token: str | None,
    timeline_start_timestamp: float,
    offset_seconds: float,
    pip_exports: list[dict[str, object]],
    fps: int,
    duration: float,
    video_width: int,
    video_height: int,
    frames_directory: Path,
    is_cancelled: Callable[[], bool],
    progress: ProgressCallback,
) -> list[dict[str, float | str]]:
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
            "pipExports": json.dumps(pip_exports),
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
                viewport={
                    "width": LAYOUT_CANVAS_WIDTH,
                    "height": LAYOUT_CANVAS_HEIGHT,
                },
                device_scale_factor=max(
                    1.0,
                    video_width / LAYOUT_CANVAS_WIDTH,
                    video_height / LAYOUT_CANVAS_HEIGHT,
                ),
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

            sample_times = await page.evaluate(
                "(duration) => window._getTelemetryExportTimes(duration)", duration
            )
            if not isinstance(sample_times, list) or not sample_times:
                raise YoutubeExportError("Aucun instant de télémétrie ne peut être rendu")
            normalized_times: list[float] = []
            for sample_time in sample_times:
                try:
                    video_time = float(sample_time)
                except (TypeError, ValueError) as exc:
                    raise YoutubeExportError("Un instant de télémétrie est invalide") from exc
                if not math.isfinite(video_time):
                    raise YoutubeExportError("Un instant de télémétrie est invalide")
                if 0 <= video_time <= duration:
                    normalized_times.append(video_time)
            if not normalized_times:
                raise YoutubeExportError("Aucun instant de télémétrie ne peut être rendu")

            raw_pip_layouts = await page.evaluate("window._getTelemetryExportPips()")
            pip_layouts = _normalize_pip_layouts(raw_pip_layouts, pip_exports)
            sample_times = []
            min_gap = 1 / fps
            for video_time in sorted(set(normalized_times)):
                if not sample_times or video_time - sample_times[-1] >= min_gap:
                    sample_times.append(video_time)
            if duration - sample_times[-1] >= min_gap:
                sample_times.append(duration)

            frames_directory.mkdir(parents=True, exist_ok=True)
            for frame_index, video_time in enumerate(sample_times):
                if is_cancelled():
                    raise YoutubeExportError("Export annulé")
                await page.evaluate("(time) => window._setTelemetryExportTime(time)", video_time)
                await page.screenshot(
                    path=str(frames_directory / f"frame{frame_index:08d}.png"),
                    omit_background=True,
                    animations="disabled",
                )
                if frame_index % 30 == 0 or frame_index == len(sample_times) - 1:
                    percent = round((frame_index + 1) / len(sample_times) * 100)
                    progress(
                        f"Rendu de l’overlay: {frame_index + 1}/{len(sample_times)} instants télémétriques",
                        percent,
                    )
            manifest = frames_directory / "frames.ffconcat"
            with manifest.open("w", encoding="utf-8") as concat_file:
                concat_file.write("ffconcat version 1.0\n")
                for frame_index, video_time in enumerate(sample_times):
                    frame_path = frames_directory / f"frame{frame_index:08d}.png"
                    next_time = (
                        sample_times[frame_index + 1]
                        if frame_index + 1 < len(sample_times)
                        else duration
                    )
                    frame_duration = min(duration, next_time) - video_time
                    if frame_duration <= 0:
                        frame_duration = 1 / fps
                    concat_file.write(f"file '{frame_path.as_posix()}'\n")
                    concat_file.write(f"duration {frame_duration:.6f}\n")
                last_path = frames_directory / f"frame{len(sample_times) - 1:08d}.png"
                concat_file.write(f"file '{last_path.as_posix()}'\n")
            return pip_layouts
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
    composition_progress: CompositionProgressCallback | None = None,
    cookies: str | None = None,
    pip_exports: list[dict[str, object]] | None = None,
) -> None:
    """Download the source, capture the saved layout, then compose an MP4."""
    source = download_youtube(url, work_dir, progress, cookies=cookies)
    pip_video_paths: list[Path] = []
    for index, pip_export in enumerate(pip_exports or []):
        pip_url = pip_export.get("youtube_url")
        if not isinstance(pip_url, str):
            raise YoutubeExportError("La source YouTube d’un PiP est invalide")
        pip_video_paths.append(
            download_youtube(
                pip_url,
                work_dir / "youtube-pip" / f"pip-{index}",
                lambda message, _percent, pip_index=index: progress(
                    f"PiP {pip_index + 1}: {message}", None
                ),
                cookies=cookies,
            )
        )
    if is_cancelled():
        raise YoutubeExportError("Export annulé")
    duration = _video_duration(source)
    video_width, video_height = _video_resolution(source)
    fps = 30
    frames_directory = work_dir / "telemetry-layout-frames"
    pip_layouts = asyncio.run(
        _capture_layout_frames(
            frontend_url=frontend_url,
            flight_id=_flight_id_for_job(job_id),
            job_id=job_id,
            job_token=job_token,
            timeline_start_timestamp=timeline_start_timestamp,
            offset_seconds=offset_seconds,
            pip_exports=pip_exports or [],
            fps=fps,
            duration=duration,
            video_width=video_width,
            video_height=video_height,
            frames_directory=frames_directory,
            is_cancelled=is_cancelled,
            progress=progress,
        )
    )
    if is_cancelled():
        raise YoutubeExportError("Export annulé")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    progress("Fusion du layout et de la vidéo YouTube", None)
    total_frames = _video_frame_count(source, duration)
    pip_durations = [_video_duration(path) for path in pip_video_paths]
    ffmpeg_inputs, filter_graph = _build_ffmpeg_composition(
        source=source,
        frames_manifest=frames_directory / "frames.ffconcat",
        pip_video_paths=pip_video_paths,
        pip_layouts=pip_layouts,
        pip_durations=pip_durations,
        video_width=video_width,
        video_height=video_height,
        fps=fps,
    )
    _run(
        [
            "ffmpeg",
            "-y",
            "-filter_complex_threads",
            "2",
            *ffmpeg_inputs,
            "-filter_complex",
            filter_graph,
            "-map",
            "[outv]",
            "-map",
            "0:a?",
            "-threads",
            "2",
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
        on_output=lambda line: _report_composition_output(
            line,
            progress=progress,
            composition_progress=composition_progress,
            total_frames=total_frames,
            duration=duration,
        ),
    )
    if not output_path.is_file() or output_path.stat().st_size == 0:
        raise YoutubeExportError("Le fichier MP4 final est vide")


def _flight_id_for_job(job_id: str) -> str:
    """Look up the owning flight without keeping job state in the browser URL."""
    from database import SessionLocal
    from models import VideoExportJob

    with SessionLocal() as db:
        job = db.get(VideoExportJob, job_id)
        if not job or not job.flight_id:
            raise YoutubeExportError("Vol introuvable pour cet export")
        return job.flight_id
