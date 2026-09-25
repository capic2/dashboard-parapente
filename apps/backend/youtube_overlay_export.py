"""Background export of a YouTube source with the generated telemetry layer."""

from __future__ import annotations

import shutil
import subprocess
from collections.abc import Callable
from pathlib import Path

import config


class YoutubeExportError(RuntimeError):
    """A user-actionable error while downloading or composing a YouTube export."""


def _run(command: list[str], *, cwd: Path | None = None) -> None:
    try:
        subprocess.run(command, cwd=cwd, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise YoutubeExportError(f"Outil vidéo indisponible: {command[0]}") from exc
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or "").strip().splitlines()[-1:]
        raise YoutubeExportError(detail[0] if detail else "Le traitement vidéo a échoué") from exc


def download_youtube(url: str, directory: Path, progress: Callable[[str], None]) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    output = directory / "source.%(ext)s"
    progress("Téléchargement de la vidéo YouTube")
    _run(
        [
            "yt-dlp",
            "--no-playlist",
            "--format",
            "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "--merge-output-format",
            "mp4",
            "--output",
            str(output),
            url,
        ]
    )
    files = sorted(directory.glob("source.*"))
    if not files:
        raise YoutubeExportError("YouTube n’a fourni aucun fichier vidéo exploitable")
    return files[0]


def compose_with_overlay(
    source: Path,
    overlay: Path,
    output: Path,
    offset_seconds: float,
    progress: Callable[[str], None],
) -> None:
    progress("Fusion de la vidéo YouTube et de l’overlay")
    output.parent.mkdir(parents=True, exist_ok=True)
    offset = max(0.0, float(offset_seconds))
    _run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(source),
            "-itsoffset",
            str(offset),
            "-i",
            str(overlay),
            "-filter_complex",
            "[1:v][0:v]scale2ref[ov][base];[base][ov]overlay=0:0:format=auto[v]",
            "-map",
            "[v]",
            "-map",
            "0:a?",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-movflags",
            "+faststart",
            str(output),
        ]
    )


def export_youtube_overlay(
    *,
    url: str,
    overlay_path: Path,
    output_path: Path,
    offset_seconds: float,
    work_dir: Path,
    progress: Callable[[str], None],
) -> None:
    source = download_youtube(url, work_dir, progress)
    if not overlay_path.is_file():
        raise YoutubeExportError("La couche overlay n’est plus disponible")
    compose_with_overlay(source, overlay_path, output_path, offset_seconds, progress)
    if not output_path.is_file() or output_path.stat().st_size == 0:
        raise YoutubeExportError("Le fichier MP4 final est vide")


def new_work_dir(job_id: str) -> Path:
    return Path(config.VIDEO_EXPORT_DIR) / ".youtube-exports" / job_id


def output_path(job_id: str) -> Path:
    return Path(config.VIDEO_EXPORT_DIR) / f"youtube-overlay-{job_id}.mp4"


def cleanup_work_dir(path: Path) -> None:
    shutil.rmtree(path, ignore_errors=True)
