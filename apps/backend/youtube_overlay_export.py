"""Background export of a YouTube source with the generated telemetry layer."""

from __future__ import annotations

import fcntl
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import time
import uuid
from collections.abc import Callable, Iterator
from datetime import datetime, timedelta
from pathlib import Path

import config
from database import SessionLocal
from flight_storage import flight_temporary_directory
from models import Flight


class YoutubeExportError(RuntimeError):
    """A user-actionable error while downloading or composing a YouTube export."""


_DOWNLOAD_PROGRESS_RE = re.compile(r"\[download\]\s+(?P<percent>\d+(?:\.\d+)?)%")
_YOUTUBE_VIDEO_EXTENSIONS = {
    ".avi",
    ".flv",
    ".m4v",
    ".mkv",
    ".mov",
    ".mp4",
    ".mpg",
    ".mpeg",
    ".ts",
    ".webm",
}
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


def download_youtube(
    url: str,
    directory: Path,
    progress: ProgressCallback,
    *,
    cookies: str | None = None,
) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    manifest_path = directory / ".youtube-download-complete.json"
    url_digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
    cookies_digest = hashlib.sha256(cookies.encode("utf-8")).hexdigest() if cookies else None

    def write_download_manifest(filename: str) -> None:
        manifest_path.write_text(
            json.dumps(
                {
                    "cache_version": 2,
                    "url_sha256": url_digest,
                    "cookies_sha256": cookies_digest,
                    "filename": filename,
                }
            ),
            encoding="utf-8",
        )

    def completed_download_in(cache_directory: Path) -> Path | None:
        candidate_manifest = cache_directory / ".youtube-download-complete.json"
        try:
            manifest = json.loads(candidate_manifest.read_text(encoding="utf-8"))
            cached_path = cache_directory / str(manifest["filename"])
            if (
                manifest.get("cache_version") == 2
                and manifest.get("url_sha256") == url_digest
                and manifest.get("cookies_sha256") == cookies_digest
                and cached_path.parent == cache_directory
                and cached_path.suffix.lower() in _YOUTUBE_VIDEO_EXTENSIONS
                and cached_path.is_file()
                and not cached_path.is_symlink()
                and cached_path.stat().st_size > 0
            ):
                return cached_path
        except (OSError, ValueError, KeyError, TypeError):
            pass
        return None

    try:
        cached_path = completed_download_in(directory)
        if cached_path is not None:
            progress(f"Vidéo YouTube téléchargée réutilisée: {cached_path.name}", 100)
            return cached_path

        # Reuse completed source and nested PiP downloads from sibling jobs.
        for sibling_directory in _sibling_export_cache_directories(directory):
            cached_path = completed_download_in(sibling_directory)
            if cached_path is None:
                continue
            local_path = directory / cached_path.name
            temporary_copy_path: Path | None = None
            try:
                with tempfile.NamedTemporaryFile(
                    prefix=".youtube-source-reuse-",
                    suffix=cached_path.suffix,
                    dir=directory,
                    delete=False,
                ) as temporary_copy:
                    temporary_copy_path = Path(temporary_copy.name)
                shutil.copy2(cached_path, temporary_copy_path)
                temporary_copy_path.replace(local_path)
            finally:
                if temporary_copy_path is not None:
                    temporary_copy_path.unlink(missing_ok=True)
            write_download_manifest(local_path.name)
            progress(f"Vidéo YouTube téléchargée réutilisée: {cached_path.name}", 100)
            return local_path
    except OSError:
        # A stale cache must never prevent a fresh download.
        pass

    manifest_path.unlink(missing_ok=True)
    for stale_path in directory.glob("source.*"):
        if stale_path.suffix.lower() in _YOUTUBE_VIDEO_EXTENSIONS:
            stale_path.unlink(missing_ok=True)

    temp_directory = directory / "temp"
    temp_directory.mkdir(parents=True, exist_ok=True)
    output = directory / "source.%(ext)s"
    cookie_path: Path | None = None

    if cookies:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            prefix=".youtube-cookies-",
            suffix=".txt",
            dir=directory,
            delete=False,
        ) as cookie_file:
            cookie_file.write(cookies)
            cookie_path = Path(cookie_file.name)

    def report_download_output(line: str) -> None:
        match = _DOWNLOAD_PROGRESS_RE.search(line)
        if match:
            percent = min(100, max(0, round(float(match.group("percent")))))
            progress(f"yt-dlp: {line}", percent)
            return
        progress(f"yt-dlp: {line}", None)

    files: list[Path] = []
    try:
        progress("Téléchargement YouTube démarré", 0)
        command = [
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
        ]
        if cookie_path is not None:
            command.extend(["--cookies", str(cookie_path)])
        command.append(url)
        _run(command, on_output=report_download_output)
        files = sorted(
            path
            for path in directory.glob("source.*")
            if path.is_file() and path.suffix.lower() in _YOUTUBE_VIDEO_EXTENSIONS
        )
        if not files:
            raise YoutubeExportError("YouTube n’a fourni aucun fichier vidéo exploitable")
        write_download_manifest(files[0].name)
    finally:
        if cookie_path is not None:
            cookie_path.unlink(missing_ok=True)
        shutil.rmtree(temp_directory, ignore_errors=True)
    progress(f"Téléchargement YouTube terminé: {files[0].name}", 100)
    return files[0]


def _is_export_directory(path: Path) -> bool:
    try:
        return str(uuid.UUID(path.name)) == path.name.lower()
    except ValueError:
        return False


def _sibling_export_cache_directories(directory: Path) -> list[Path]:
    export_directory = next(
        (parent for parent in (directory, *directory.parents) if _is_export_directory(parent)),
        None,
    )
    if export_directory is None:
        return []

    relative_cache_path = directory.relative_to(export_directory)
    try:
        sibling_export_directories = sorted(
            path
            for path in export_directory.parent.iterdir()
            if path != export_directory
            and path.is_dir()
            and not path.is_symlink()
            and _is_export_directory(path)
        )
    except OSError:
        return []

    return [
        sibling_directory / relative_cache_path
        for sibling_directory in sibling_export_directories
        if (sibling_directory / relative_cache_path).is_dir()
        and not (sibling_directory / relative_cache_path).is_symlink()
    ]


def _render_file_identity(path: Path | None) -> dict[str, str | int] | None:
    if path is None:
        return None
    try:
        if not path.is_file():
            return None
        stat = path.stat()
    except OSError:
        return None
    return {
        "path": str(path.resolve()),
        "size": stat.st_size,
        "mtime_ns": stat.st_mtime_ns,
    }


def _youtube_overlay_render_key(
    *,
    overlay_job_id: str,
    source_video_path: Path,
    gpx_path: Path,
    pip_video_path: Path | None,
    layout_id: str | None,
    offset_seconds: float,
    pip_apply_offset: bool,
    timeline_start: datetime | None,
) -> str:
    render_inputs = {
        "overlay_job_id": overlay_job_id,
        "source": _render_file_identity(source_video_path),
        "gpx": _render_file_identity(gpx_path),
        "pip": _render_file_identity(pip_video_path),
        "layout_id": layout_id,
        "offset_seconds": offset_seconds,
        "pip_apply_offset": pip_apply_offset,
        "timeline_start": timeline_start.isoformat() if timeline_start is not None else None,
    }
    return hashlib.sha256(json.dumps(render_inputs, sort_keys=True).encode("utf-8")).hexdigest()


def _render_lock_path(output_directory: Path) -> Path:
    output_directory.mkdir(parents=True, exist_ok=True)
    return output_directory / ".youtube-overlay-render.lock"


def render_saved_overlay(
    overlay_job_id: str,
    source_video_path: Path,
    *,
    offset_seconds: float,
    output_directory: Path,
    progress: ProgressCallback,
    pip_video_path: Path | None = None,
    pip_apply_offset: bool = True,
) -> Path:
    """Render the saved telemetry, serializing access to this export workspace."""
    with _render_lock_path(output_directory).open("a", encoding="utf-8") as lock_file:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        try:
            return _render_saved_overlay_locked(
                overlay_job_id,
                source_video_path,
                offset_seconds=offset_seconds,
                output_directory=output_directory,
                progress=progress,
                pip_video_path=pip_video_path,
                pip_apply_offset=pip_apply_offset,
            )
        finally:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def _render_saved_overlay_locked(
    overlay_job_id: str,
    source_video_path: Path,
    *,
    offset_seconds: float,
    output_directory: Path,
    progress: ProgressCallback,
    pip_video_path: Path | None = None,
    pip_apply_offset: bool = True,
) -> Path:
    """Render the saved telemetry directly onto the downloaded YouTube video."""
    from gopro_overlay_export import (
        create_gopro_overlay_job_from_paths,
        first_gpx_timestamp,
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
    pip_values = [saved_command.get("source_pip_path"), saved_job.get("pip_path")]
    pip_path = (pip_video_path if pip_video_path and pip_video_path.is_file() else None) or next(
        (Path(str(value)) for value in pip_values if value and Path(str(value)).is_file()),
        None,
    )
    had_saved_pip = any(pip_values)
    if pip_path is None and had_saved_pip:
        # Older completed jobs only retained the prepared path, which was
        # removed with the temporary work directory. Their source camera video
        # is durable and can still serve as the PIP input.
        source_camera = Path(str(saved_job.get("video_path") or ""))
        if source_camera.is_file():
            pip_path = source_camera
    saved_gpx_offset = float(saved_command.get("gpx_offset") or saved_job.get("gpx_offset") or 0.0)
    source_timeline_start = (
        first_gpx_timestamp(saved_gpx_path)
        if saved_gpx_path.is_file()
        else first_gpx_timestamp(gpx_path)
    )
    if source_timeline_start is not None and not saved_gpx_path.is_file() and has_prepared_gpx:
        source_timeline_start -= timedelta(seconds=saved_gpx_offset)
    if not source_video_path.is_file() or not gpx_path.is_file():
        raise YoutubeExportError("Les sources de l’overlay enregistré sont indisponibles")
    # A prepared render GPX already contains the saved manual offset. Apply
    # only the difference if the export calibration changed after that render.
    gpx_offset = (
        float(offset_seconds) - saved_gpx_offset if has_prepared_gpx else float(offset_seconds)
    )
    checkpoint_path = output_directory / ".youtube-overlay-render.json"
    render_key = _youtube_overlay_render_key(
        overlay_job_id=overlay_job_id,
        source_video_path=source_video_path,
        gpx_path=gpx_path,
        pip_video_path=pip_path,
        layout_id=saved_job.get("layout_id"),
        offset_seconds=gpx_offset,
        pip_apply_offset=pip_apply_offset,
        timeline_start=source_timeline_start,
    )
    internal_job_id: str | None = None
    checkpoint_job_id: str | None = None
    try:
        checkpoint = json.loads(checkpoint_path.read_text(encoding="utf-8"))
        if isinstance(checkpoint, dict) and isinstance(checkpoint.get("job_id"), str):
            checkpoint_job_id = checkpoint["job_id"]
            if checkpoint.get("render_key") == render_key:
                internal_job_id = checkpoint_job_id
    except (OSError, ValueError):
        pass

    if checkpoint_job_id is not None and internal_job_id is None:
        stale_job = get_gopro_overlay_job(checkpoint_job_id)
        if stale_job:
            if stale_job.get("status") in {"queued", "preparing", "running"}:
                from gopro_overlay_export import cancel_gopro_overlay_job

                cancel_gopro_overlay_job(checkpoint_job_id)
            else:
                stale_output_value = stale_job.get("output_path")
                if stale_output_value:
                    output_root = output_directory.resolve()
                    stale_output = Path(str(stale_output_value)).resolve()
                    if stale_output.is_relative_to(output_root):
                        stale_output.unlink(missing_ok=True)
        checkpoint_path.unlink(missing_ok=True)

    internal_job = (
        get_gopro_overlay_job(internal_job_id, include_command=True)
        if internal_job_id is not None
        else None
    )
    if internal_job and internal_job.get("status") == "completed":
        existing_output = Path(str(internal_job.get("output_path") or ""))
        if existing_output.is_file() and existing_output.stat().st_size > 0:
            progress(f"Rendu déjà terminé réutilisé: {existing_output.name}", 99)
            return existing_output
        internal_job = None
        internal_job_id = None
    if internal_job and internal_job.get("status") == "cancelled":
        internal_job = None
        internal_job_id = None
    if (
        internal_job
        and internal_job_id is not None
        and internal_job.get("status") in {"failed", "cancelled"}
    ):
        from gopro_overlay_export import resume_failed_gopro_overlay_job

        if not resume_failed_gopro_overlay_job(internal_job_id):
            raise YoutubeExportError("La reprise du rendu de l’overlay a échoué")
    if internal_job is None:
        progress("Fusion de la vidéo YouTube et de l’overlay démarrée", 50)
        internal_job = create_gopro_overlay_job_from_paths(
            video_path=source_video_path,
            gpx_path=gpx_path,
            pip_path=pip_path,
            layout_id=saved_job.get("layout_id"),
            output_filename=(
                f"youtube-overlay-{overlay_job_id}-{render_key[:16]}-{uuid.uuid4().hex[:8]}.mp4"
            ),
            output_resolution="source",
            output_dir=str(output_directory),
            gpx_offset=gpx_offset,
            flight_id=None,
            overlay_only=False,
            video_start_override=source_timeline_start,
            pip_offset_seconds=gpx_offset if pip_apply_offset else 0.0,
        )
        internal_job_id = str(internal_job["job_id"])
        checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_checkpoint = checkpoint_path.with_suffix(".tmp")
        temporary_checkpoint.write_text(
            json.dumps({"job_id": internal_job_id, "render_key": render_key}),
            encoding="utf-8",
        )
        temporary_checkpoint.replace(checkpoint_path)
    else:
        progress("Reprise du rendu de la vidéo YouTube et de l’overlay", 50)

    if internal_job_id is None:
        raise YoutubeExportError("Le rendu temporaire de l’overlay n’a pas pu démarrer")
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
            f"Assemblage de la vidéo avec l’overlay synchronisé: {current_progress or 0}%",
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
    cookies: str | None = None,
    pip_url: str | None = None,
    pip_apply_offset: bool = True,
) -> None:
    source = download_youtube(url, work_dir, progress, cookies=cookies)
    pip_source = None
    if pip_url:
        pip_directory = work_dir / "youtube-pip"
        pip_source = download_youtube(pip_url, pip_directory, progress, cookies=cookies)
    rendered_video = render_saved_overlay(
        overlay_job_id,
        source,
        offset_seconds=offset_seconds,
        output_directory=work_dir,
        progress=progress,
        pip_video_path=pip_source,
        pip_apply_offset=pip_apply_offset,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(rendered_video, output_path)
    if not output_path.is_file() or output_path.stat().st_size == 0:
        raise YoutubeExportError("Le fichier MP4 final est vide")


def new_work_dir(job_id: str, flight_id: str) -> Path:
    """Return the YouTube export workspace below its owning flight's temp folder."""
    with SessionLocal() as db:
        flight = db.get(Flight, flight_id)
        if flight is None:
            raise YoutubeExportError("Le vol associé à l’export YouTube est introuvable")
        return flight_temporary_directory(db, flight, "youtube-exports") / job_id


def output_path(job_id: str, flight_id: str) -> Path:
    """Return the generated upload video path inside its flight's temp workspace."""
    return new_work_dir(job_id, flight_id) / f"youtube-overlay-{job_id}.mp4"


def cleanup_work_dir(path: Path) -> None:
    shutil.rmtree(path, ignore_errors=True)
