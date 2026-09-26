"""Background export of a YouTube source with the generated telemetry layer."""

from __future__ import annotations

import shutil
import re
import subprocess
import tempfile
import time
from collections.abc import Callable, Iterator
from pathlib import Path

import config


class YoutubeExportError(RuntimeError):
    """A user-actionable error while downloading or composing a YouTube export."""


_DOWNLOAD_PROGRESS_RE = re.compile(r"\[download\]\s+(?P<percent>\d+(?:\.\d+)?)%")
ProgressCallback = Callable[[str, int | None], None]
_OVERLAY_TERMINAL_STATUSES = {"completed", "failed", "cancelled"}


def _iter_process_output(stream: object) -> Iterator[str]:
    """Read both newline and carriage-return terminated tool output."""

    current = ""
    read = getattr(stream, "read", None)
    if not callable(read):
        return

    while char := read(1):
        if char in {"\n", "\r"}:
            if current.strip():
                yield current.strip()
            current = ""
        else:
            current += char
    if current.strip():
        yield current.strip()


def _run(
    command: list[str],
    *,
    cwd: Path | None = None,
    on_output: Callable[[str], None] | None = None,
) -> None:
    process: subprocess.Popen[str] | None = None
    try:
        process = subprocess.Popen(
            command,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        output_lines: list[str] = []
        for line in _iter_process_output(process.stdout):
            output_lines.append(line)
            if on_output:
                on_output(line)
        return_code = process.wait()
        if return_code != 0:
            detail = output_lines[-1:] or []
            raise subprocess.CalledProcessError(return_code, command, output="\n".join(detail))
    except FileNotFoundError as exc:
        raise YoutubeExportError(f"Outil vidéo indisponible: {command[0]}") from exc
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or "").strip().splitlines()[-1:]
        raise YoutubeExportError(detail[0] if detail else "Le traitement vidéo a échoué") from exc
    except BaseException:
        if process is not None and process.poll() is None:
            process.kill()
            process.wait()
        raise


def download_youtube(url: str, directory: Path, progress: ProgressCallback) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    temp_directory = directory / "temp"
    temp_directory.mkdir(parents=True, exist_ok=True)
    output = directory / "source.%(ext)s"

    def report_download_output(line: str) -> None:
        match = _DOWNLOAD_PROGRESS_RE.search(line)
        if match:
            percent = min(100, max(0, round(float(match.group("percent")))))
            progress(f"yt-dlp: {line}", percent)
            return
        progress(f"yt-dlp: {line}", None)

    try:
        progress("Téléchargement YouTube démarré", 0)
        _run(
            [
                "yt-dlp",
                "--newline",
                "--no-playlist",
                "--format",
                "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
                "--merge-output-format",
                "mp4",
                "--paths",
                f"home:{directory}",
                "--paths",
                f"temp:{temp_directory}",
                "--output",
                output.name,
                url,
            ],
            on_output=report_download_output,
        )
    finally:
        shutil.rmtree(temp_directory, ignore_errors=True)
    files = sorted(directory.glob("source.*"))
    if not files:
        raise YoutubeExportError("YouTube n’a fourni aucun fichier vidéo exploitable")
    progress(f"Téléchargement YouTube terminé: {files[0].name}", 100)
    return files[0]


def render_saved_overlay(
    overlay_job_id: str,
    source_video_path: Path,
    *,
    offset_seconds: float,
    output_directory: Path,
    progress: ProgressCallback,
) -> Path:
    """Render the saved telemetry directly onto the downloaded YouTube video."""
    from gopro_overlay_export import (
        create_gopro_overlay_job_from_paths,
        get_gopro_overlay_job,
    )

    saved_job = get_gopro_overlay_job(overlay_job_id, include_command=True)
    if not saved_job:
        raise YoutubeExportError("L’overlay enregistré est introuvable")

    saved_command = saved_job.get("command")
    if not isinstance(saved_command, dict):
        saved_command = {}
    render_gpx_path = Path(str(saved_command.get("render_gpx_path") or ""))
    saved_gpx_path = Path(str(saved_job.get("gpx_path") or ""))
    has_prepared_gpx = render_gpx_path.is_file()
    gpx_path = render_gpx_path if has_prepared_gpx else saved_gpx_path
    pip_value = saved_job.get("pip_path")
    pip_path = Path(str(pip_value)) if pip_value else None
    if not source_video_path.is_file() or not gpx_path.is_file():
        raise YoutubeExportError("Les sources de l’overlay enregistré sont indisponibles")
    if pip_path and not pip_path.is_file():
        pip_path = None

    # A prepared render GPX already contains the saved manual offset. Apply
    # only the difference if the export calibration changed after that render.
    saved_gpx_offset = float(saved_command.get("gpx_offset") or saved_job.get("gpx_offset") or 0.0)
    gpx_offset = (
        float(offset_seconds) - saved_gpx_offset if has_prepared_gpx else float(offset_seconds)
    )
    progress("Fusion de la vidéo YouTube et de l’overlay démarrée", 50)
    internal_job = create_gopro_overlay_job_from_paths(
        video_path=source_video_path,
        gpx_path=gpx_path,
        pip_path=pip_path,
        layout_id=saved_job.get("layout_id"),
        output_filename=f"youtube-overlay-{overlay_job_id}.mp4",
        output_resolution="source",
        output_dir=str(output_directory),
        gpx_offset=gpx_offset,
        flight_id=None,
        overlay_only=False,
    )
    internal_job_id = str(internal_job["job_id"])
    deadline = time.monotonic() + config.GOPRO_OVERLAY_JOB_TIMEOUT_SECONDS
    while True:
        current_job = get_gopro_overlay_job(internal_job_id)
        if not current_job:
            raise YoutubeExportError("Le rendu temporaire de l’overlay a disparu")

        status = str(current_job.get("status") or "")
        if status == "completed":
            output = Path(str(current_job.get("output_path") or ""))
            if output.is_file():
                progress(f"Fusion terminée: {output.name}", 99)
                return output
            raise YoutubeExportError("Le rendu temporaire de l’overlay est vide")
        if status in _OVERLAY_TERMINAL_STATUSES:
            detail = current_job.get("error") or current_job.get("message")
            raise YoutubeExportError(f"Le rendu de l’overlay a échoué: {detail or status}")
        if time.monotonic() >= deadline:
            raise YoutubeExportError("Le rendu temporaire de l’overlay a expiré")

        current_progress = current_job.get("progress")
        progress(
            f"Génération de l’overlay synchronisé: {current_progress or 0}%",
            None,
        )
        time.sleep(1)


def export_youtube_overlay(
    *,
    url: str,
    overlay_job_id: str,
    output_path: Path,
    offset_seconds: float,
    work_dir: Path,
    progress: ProgressCallback,
) -> None:
    try:
        source = download_youtube(url, work_dir, progress)
        rendered_video = render_saved_overlay(
            overlay_job_id,
            source,
            offset_seconds=offset_seconds,
            output_directory=work_dir,
            progress=progress,
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(rendered_video, output_path)
        if not output_path.is_file() or output_path.stat().st_size == 0:
            raise YoutubeExportError("Le fichier MP4 final est vide")
    except BaseException:
        cleanup_work_dir(work_dir)
        raise


def new_work_dir(job_id: str) -> Path:
    return Path(tempfile.gettempdir()) / "youtube-exports" / job_id


def output_path(job_id: str) -> Path:
    return Path(config.VIDEO_EXPORT_DIR) / f"youtube-overlay-{job_id}.mp4"


def cleanup_work_dir(path: Path) -> None:
    shutil.rmtree(path, ignore_errors=True)
