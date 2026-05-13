import asyncio
import json
import os
import shutil
import subprocess
import threading
import uuid
import xml.etree.ElementTree as ET
from collections.abc import AsyncGenerator, Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import UploadFile

import config

_STATUS_QUEUED = "queued"
_STATUS_RUNNING = "running"
_STATUS_COMPLETED = "completed"
_STATUS_FAILED = "failed"
_STATUS_CANCELLED = "cancelled"
_TERMINAL_STATUSES = {_STATUS_COMPLETED, _STATUS_FAILED, _STATUS_CANCELLED}

_VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v"}
_GPX_EXTENSIONS = {".gpx", ".fit"}


@dataclass(frozen=True)
class GoproOverlayLayout:
    id: str
    label: str
    path: str
    width: int | None
    height: int | None


_LAYOUTS = [
    GoproOverlayLayout(
        id="parapente-1080",
        label="Parapente 1920x1080",
        path="layout_parapente_1080.xml",
        width=1920,
        height=1080,
    ),
    GoproOverlayLayout(
        id="parapente-3840",
        label="Parapente 3840x2160",
        path="layout_parapente_3840.xml",
        width=3840,
        height=2160,
    ),
    GoproOverlayLayout(
        id="parapente-7680",
        label="Parapente 7680x4320",
        path="layout_parapente_7680.xml",
        width=7680,
        height=4320,
    ),
    GoproOverlayLayout(
        id="parapente-360",
        label="Parapente 360 / 6000x3000",
        path="layout_parapente_6000-360-.xml",
        width=6000,
        height=3000,
    ),
]

_JOBS: dict[str, dict[str, Any]] = {}
_PROCESSES: dict[str, subprocess.Popen[str]] = {}
_LOCK = threading.Lock()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _layout_dir() -> Path:
    return Path(config.GOPRO_OVERLAY_LAYOUT_DIR)


def _upload_dir() -> Path:
    return Path(config.GOPRO_OVERLAY_UPLOAD_DIR)


def _output_dir() -> Path:
    return Path(config.GOPRO_OVERLAY_OUTPUT_DIR)


def _layout_path(layout: GoproOverlayLayout) -> Path:
    return _layout_dir() / layout.path


def _prepare_layout_file(layout_path: Path, destination: Path, has_pip: bool) -> Path:
    tree = ET.parse(layout_path)
    root = tree.getroot()

    def normalize_video_components(parent: ET.Element) -> None:
        for child in list(parent):
            if child.tag == "component" and child.attrib.get("type") == "video":
                if child.attrib.get("file") or child.attrib.get("id"):
                    continue
                if has_pip:
                    child.set("id", "pip")
                else:
                    parent.remove(child)
                continue
            normalize_video_components(child)

    normalize_video_components(root)
    destination.parent.mkdir(parents=True, exist_ok=True)
    tree.write(destination, encoding="unicode")
    return destination


def _safe_filename(filename: str | None, fallback: str) -> str:
    raw = filename or fallback
    cleaned = "".join(char if char.isalnum() or char in ".-_" else "_" for char in raw)
    return cleaned or fallback


def _validate_file_extension(path: Path, allowed_extensions: set[str]) -> None:
    suffix = path.suffix.lower()
    if suffix not in allowed_extensions:
        allowed = ", ".join(sorted(allowed_extensions))
        raise ValueError(f"Unsupported file extension '{suffix}'. Expected one of: {allowed}")


def _copy_job_input(source: Path, destination: Path, allowed_extensions: set[str]) -> Path:
    _validate_file_extension(source, allowed_extensions)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return destination


def _update_job(job_id: str, **changes: Any) -> dict[str, Any]:
    with _LOCK:
        job = _JOBS[job_id]
        if job["status"] in _TERMINAL_STATUSES:
            return job.copy()
        job.update(changes)
        job["updated_at"] = _utc_now()
        return job.copy()


def _transition_job_to_running(job_id: str, command: list[str]) -> dict[str, Any] | None:
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job or job["status"] != _STATUS_QUEUED:
            return None
        job.update(
            status=_STATUS_RUNNING,
            progress=5,
            message="Rendering overlay",
            command=command,
            updated_at=_utc_now(),
        )
        return job.copy()


def _finish_job(job_id: str, **changes: Any) -> dict[str, Any]:
    with _LOCK:
        job = _JOBS[job_id]
        if job["status"] in _TERMINAL_STATUSES:
            return job.copy()
        job.update(changes)
        job["updated_at"] = _utc_now()
        return job.copy()


def _find_layout(layout_id: str) -> GoproOverlayLayout | None:
    return next((layout for layout in _LAYOUTS if layout.id == layout_id), None)


def _nearest_layout(width: int | None, height: int | None) -> GoproOverlayLayout:
    if width is None or height is None:
        return _LAYOUTS[0]

    exact = next(
        (layout for layout in _LAYOUTS if layout.width == width and layout.height == height), None
    )
    if exact:
        return exact

    def score(layout: GoproOverlayLayout) -> int:
        if layout.width is None or layout.height is None:
            return 10**12
        return abs(layout.width - width) + abs(layout.height - height)

    return min(_LAYOUTS, key=score)


def list_gopro_overlay_layouts(
    video_width: int | None = None,
    video_height: int | None = None,
) -> list[dict[str, Any]]:
    recommended = _nearest_layout(video_width, video_height)
    return [
        {
            "id": layout.id,
            "label": layout.label,
            "filename": layout.path,
            "width": layout.width,
            "height": layout.height,
            "exists": _layout_path(layout).exists(),
            "recommended": layout.id == recommended.id,
        }
        for layout in _LAYOUTS
    ]


def probe_video_resolution(video_path: Path) -> tuple[int | None, int | None]:
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
                str(video_path),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except (FileNotFoundError, subprocess.SubprocessError, TimeoutError):
        return None, None

    payload = json.loads(result.stdout or "{}")
    streams = payload.get("streams") or []
    if not streams:
        return None, None
    stream = streams[0]
    return stream.get("width"), stream.get("height")


async def save_uploaded_file(
    upload: UploadFile,
    destination: Path,
    allowed_extensions: set[str],
) -> Path:
    _validate_file_extension(Path(upload.filename or ""), allowed_extensions)

    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as output:
        while chunk := await upload.read(1024 * 1024):
            output.write(chunk)
    return destination


async def create_gopro_overlay_job(
    video_file: UploadFile,
    gpx_file: UploadFile,
    pip_file: UploadFile | None,
    layout_id: str | None,
    output_filename: str | None,
) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    job_upload_dir = _upload_dir() / job_id
    try:
        video_path = await save_uploaded_file(
            video_file,
            job_upload_dir / _safe_filename(video_file.filename, "input.mp4"),
            _VIDEO_EXTENSIONS,
        )
        gpx_path = await save_uploaded_file(
            gpx_file,
            job_upload_dir / _safe_filename(gpx_file.filename, "track.gpx"),
            _GPX_EXTENSIONS,
        )
        pip_path = None
        if pip_file and pip_file.filename:
            pip_path = await save_uploaded_file(
                pip_file,
                job_upload_dir / _safe_filename(pip_file.filename, "pip.mp4"),
                _VIDEO_EXTENSIONS,
            )

        return _create_gopro_overlay_job_from_paths(
            job_id=job_id,
            video_path=video_path,
            gpx_path=gpx_path,
            pip_path=pip_path,
            layout_id=layout_id,
            output_filename=output_filename,
            work_dir=job_upload_dir,
        )
    except Exception:
        shutil.rmtree(job_upload_dir, ignore_errors=True)
        raise


def create_gopro_overlay_job_from_paths(
    video_path: Path,
    gpx_path: Path,
    pip_path: Path | None,
    layout_id: str | None,
    output_filename: str | None,
) -> dict[str, Any]:
    _validate_file_extension(video_path, _VIDEO_EXTENSIONS)
    _validate_file_extension(gpx_path, _GPX_EXTENSIONS)
    if pip_path:
        _validate_file_extension(pip_path, _VIDEO_EXTENSIONS)

    job_id = str(uuid.uuid4())
    work_dir = _upload_dir() / job_id
    work_dir.mkdir(parents=True, exist_ok=True)
    try:
        return _create_gopro_overlay_job_from_paths(
            job_id=job_id,
            video_path=video_path,
            gpx_path=gpx_path,
            pip_path=pip_path,
            layout_id=layout_id,
            output_filename=output_filename,
            work_dir=work_dir,
            pin_inputs=True,
        )
    except Exception:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise


def _create_gopro_overlay_job_from_paths(
    job_id: str,
    video_path: Path,
    gpx_path: Path,
    pip_path: Path | None,
    layout_id: str | None,
    output_filename: str | None,
    work_dir: Path,
    pin_inputs: bool = False,
) -> dict[str, Any]:
    output_name = _safe_filename(output_filename, f"gopro-overlay-{job_id}.mp4")
    if Path(output_name).suffix.lower() != ".mp4":
        output_name = f"{Path(output_name).stem}.mp4"

    if pin_inputs:
        video_path = _copy_job_input(
            video_path,
            work_dir / f"input{video_path.suffix.lower()}",
            _VIDEO_EXTENSIONS,
        )
        gpx_path = _copy_job_input(
            gpx_path,
            work_dir / f"track{gpx_path.suffix.lower()}",
            _GPX_EXTENSIONS,
        )
        if pip_path:
            pip_path = _copy_job_input(
                pip_path,
                work_dir / f"pip{pip_path.suffix.lower()}",
                _VIDEO_EXTENSIONS,
            )

    width, height = probe_video_resolution(video_path)
    selected_layout = _find_layout(layout_id) if layout_id else _nearest_layout(width, height)
    if not selected_layout:
        raise ValueError("Unknown layout")
    source_layout_path = _layout_path(selected_layout)
    if not source_layout_path.exists():
        raise ValueError(f"Layout file not found: {source_layout_path}")
    layout_path = _prepare_layout_file(
        source_layout_path,
        work_dir / source_layout_path.name,
        has_pip=pip_path is not None,
    )

    output_path = _output_dir() / job_id / output_name
    output_path.parent.mkdir(parents=True, exist_ok=True)

    job = {
        "job_id": job_id,
        "status": _STATUS_QUEUED,
        "progress": 0,
        "message": "Overlay queued",
        "error": None,
        "video_path": str(video_path),
        "gpx_path": str(gpx_path),
        "pip_path": str(pip_path) if pip_path else None,
        "layout_id": selected_layout.id,
        "layout_label": selected_layout.label,
        "layout_path": str(layout_path),
        "output_path": str(output_path),
        "output_filename": output_path.name,
        "video_width": width,
        "video_height": height,
        "created_at": _utc_now(),
        "updated_at": _utc_now(),
        "completed_at": None,
        "command": None,
    }
    with _LOCK:
        _JOBS[job_id] = job

    thread = threading.Thread(target=_run_job, args=(job_id,), daemon=True)
    thread.start()
    return job.copy()


def _run_job(job_id: str) -> None:
    job = get_gopro_overlay_job(job_id)
    if not job:
        return

    command = [
        config.GOPRO_OVERLAY_BIN,
        "--use-gpx-only",
        "--gpx",
        job["gpx_path"],
        "--layout",
        "xml",
        "--layout-xml",
        job["layout_path"],
    ]
    if job.get("video_width") and job.get("video_height"):
        command.extend(["--overlay-size", f"{job['video_width']}x{job['video_height']}"])
    if job.get("pip_path"):
        command.extend(["--video", f"pip={job['pip_path']}"])
    command.extend([job["video_path"], job["output_path"]])

    if not _transition_job_to_running(job_id, command):
        return
    try:
        process = subprocess.Popen(
            command,
            cwd=config.GOPRO_OVERLAY_ROOT or None,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
    except FileNotFoundError as exc:
        _finish_job(
            job_id,
            status=_STATUS_FAILED,
            progress=100,
            message="gopro-dashboard.py not found",
            error=str(exc),
            completed_at=_utc_now(),
        )
        return

    with _LOCK:
        if _JOBS[job_id]["status"] == _STATUS_CANCELLED:
            process.terminate()
            return
        _PROCESSES[job_id] = process

    output_lines: list[str] = []
    try:
        if process.stdout:
            for line in process.stdout:
                output_lines.append(line.rstrip())
                if len(output_lines) > 50:
                    output_lines = output_lines[-50:]
                _update_job(job_id, progress=50, message=line.strip() or "Rendering overlay")

        return_code = process.wait()
        with _LOCK:
            _PROCESSES.pop(job_id, None)

        if get_gopro_overlay_job(job_id, include_command=True).get("status") == _STATUS_CANCELLED:
            return

        if return_code != 0:
            _finish_job(
                job_id,
                status=_STATUS_FAILED,
                progress=100,
                message="Overlay rendering failed",
                error="\n".join(output_lines[-20:]) or f"Process exited with {return_code}",
                completed_at=_utc_now(),
            )
            return

        if not Path(job["output_path"]).exists():
            _finish_job(
                job_id,
                status=_STATUS_FAILED,
                progress=100,
                message="Output file was not created",
                error=f"Missing output: {job['output_path']}",
                completed_at=_utc_now(),
            )
            return

        _finish_job(
            job_id,
            status=_STATUS_COMPLETED,
            progress=100,
            message="Overlay ready",
            completed_at=_utc_now(),
        )
    finally:
        with _LOCK:
            _PROCESSES.pop(job_id, None)


def get_gopro_overlay_job(job_id: str, include_command: bool = False) -> dict[str, Any] | None:
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return None
        payload = job.copy()
    if not include_command:
        payload.pop("command", None)
    return payload


def cancel_gopro_overlay_job(job_id: str) -> bool:
    with _LOCK:
        process = _PROCESSES.get(job_id)
        job = _JOBS.get(job_id)

    if not job:
        return False
    if job["status"] in _TERMINAL_STATUSES:
        return True

    if process and process.poll() is None:
        process.terminate()

    _finish_job(
        job_id,
        status=_STATUS_CANCELLED,
        progress=100,
        message="Overlay cancelled",
        completed_at=_utc_now(),
    )
    return True


async def stream_gopro_overlay_job(
    job_id: str,
    is_disconnected: Callable[[], Awaitable[bool]] | None = None,
) -> AsyncGenerator[str, None]:
    last_payload = ""
    while True:
        if is_disconnected and await is_disconnected():
            break
        job = get_gopro_overlay_job(job_id)
        if not job:
            yield 'event: error\ndata: {"detail": "Job not found"}\n\n'
            break

        payload = json.dumps(job, sort_keys=True)
        if payload != last_payload:
            yield f"event: status\ndata: {payload}\n\n"
            last_payload = payload

        if job["status"] in {_STATUS_COMPLETED, _STATUS_FAILED, _STATUS_CANCELLED}:
            break
        await asyncio.sleep(2)


def gopro_overlay_output_path(job_id: str) -> Path | None:
    job = get_gopro_overlay_job(job_id)
    if not job or job["status"] != _STATUS_COMPLETED:
        return None
    path = Path(job["output_path"])
    return path if path.exists() else None


def check_gopro_overlay_dependencies() -> dict[str, bool]:
    gopro_bin = config.GOPRO_OVERLAY_BIN
    has_gopro_dashboard = (
        Path(gopro_bin).exists()
        if os.path.sep in gopro_bin
        else shutil.which(gopro_bin) is not None
    )
    return {
        "gopro_dashboard": has_gopro_dashboard,
        "ffmpeg": shutil.which("ffmpeg") is not None,
        "ffprobe": shutil.which("ffprobe") is not None,
    }
