"""Background export of a YouTube source with the generated telemetry layer."""

from __future__ import annotations

import shutil
import re
import subprocess
from collections.abc import Callable, Iterator
from pathlib import Path

import config


class YoutubeExportError(RuntimeError):
    """A user-actionable error while downloading or composing a YouTube export."""


_DOWNLOAD_PROGRESS_RE = re.compile(r"\[download\]\s+(?P<percent>\d+(?:\.\d+)?)%")
ProgressCallback = Callable[[str, int | None], None]


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
    output = directory / "source.%(ext)s"

    def report_download_output(line: str) -> None:
        match = _DOWNLOAD_PROGRESS_RE.search(line)
        if match:
            percent = min(100, max(0, round(float(match.group("percent")))))
            progress(f"yt-dlp: {line}", percent)
            return
        progress(f"yt-dlp: {line}", None)

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
            "--output",
            str(output),
            url,
        ],
        on_output=report_download_output,
    )
    files = sorted(directory.glob("source.*"))
    if not files:
        raise YoutubeExportError("YouTube n’a fourni aucun fichier vidéo exploitable")
    progress(f"Téléchargement YouTube terminé: {files[0].name}", 100)
    return files[0]


def compose_with_overlay(
    source: Path,
    overlay: Path,
    output: Path,
    offset_seconds: float,
    progress: ProgressCallback,
) -> None:
    progress("Fusion de la vidéo YouTube et de l’overlay démarrée", 50)
    output.parent.mkdir(parents=True, exist_ok=True)
    offset = max(0.0, float(offset_seconds))

    def report_ffmpeg_output(line: str) -> None:
        progress(f"ffmpeg: {line}", None)

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
        ],
        on_output=report_ffmpeg_output,
    )
    progress(f"Fusion terminée: {output.name}", 99)


def export_youtube_overlay(
    *,
    url: str,
    overlay_path: Path,
    output_path: Path,
    offset_seconds: float,
    work_dir: Path,
    progress: ProgressCallback,
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
