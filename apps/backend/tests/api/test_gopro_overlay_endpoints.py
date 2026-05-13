from io import BytesIO
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from starlette.datastructures import Headers
from starlette.datastructures import UploadFile

import config
import gopro_overlay_export
import routes
from gopro_overlay_export import _prepare_layout_file
from gopro_overlay_export import cancel_gopro_overlay_job
from gopro_overlay_export import create_gopro_overlay_job
from gopro_overlay_export import create_gopro_overlay_job_from_paths

API_PREFIX = "/api"


def test_gopro_overlay_layouts_returns_recommended_layout(client: TestClient):
    response = client.get(f"{API_PREFIX}/gopro-overlays/layouts?width=1920&height=1080")

    assert response.status_code == 200
    layouts = response.json()["layouts"]
    assert any(layout["id"] == "parapente-1080" for layout in layouts)
    assert next(layout for layout in layouts if layout["id"] == "parapente-1080")["recommended"]


def test_create_gopro_overlay_job_requires_dependencies(client: TestClient):
    with patch(
        "routes.check_gopro_overlay_dependencies",
        return_value={"gopro_dashboard": False, "ffmpeg": True, "ffprobe": True},
    ):
        response = client.post(
            f"{API_PREFIX}/gopro-overlays/jobs",
            files={
                "video_file": ("flight.mp4", b"video", "video/mp4"),
                "gpx_file": ("flight.gpx", b"<gpx />", "application/gpx+xml"),
            },
            data={"layout_id": "parapente-1080"},
        )

    assert response.status_code == 503
    assert "gopro_dashboard" in response.json()["detail"]


def test_create_gopro_overlay_job_passes_uploaded_files(client: TestClient):
    expected = {
        "job_id": "job-gopro",
        "status": "queued",
        "progress": 0,
        "message": "queued",
        "layout_id": "parapente-1080",
        "layout_label": "Parapente 1920x1080",
        "output_filename": "flight-overlay.mp4",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    create_job = AsyncMock(return_value=expected)

    with (
        patch(
            "routes.check_gopro_overlay_dependencies",
            return_value={"gopro_dashboard": True, "ffmpeg": True, "ffprobe": True},
        ),
        patch("routes.create_gopro_overlay_job", create_job),
    ):
        response = client.post(
            f"{API_PREFIX}/gopro-overlays/jobs",
            files={
                "video_file": ("flight.mp4", b"video", "video/mp4"),
                "gpx_file": ("flight.gpx", b"<gpx />", "application/gpx+xml"),
                "pip_file": ("pip.mp4", b"pip", "video/mp4"),
            },
            data={"layout_id": "parapente-1080", "output_filename": "flight-overlay.mp4"},
        )

    assert response.status_code == 200
    assert response.json()["job_id"] == "job-gopro"
    assert create_job.call_args.kwargs["layout_id"] == "parapente-1080"
    assert create_job.call_args.kwargs["output_filename"] == "flight-overlay.mp4"
    assert create_job.call_args.kwargs["pip_file"] is not None


def test_create_flight_gopro_overlay_job_uses_flight_files(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
):
    video_path = tmp_path / "flight.mp4"
    gpx_path = tmp_path / "flight.gpx"
    video_path.write_bytes(b"video")
    gpx_path.write_text("<gpx />")
    sample_flight.video_file_path = str(video_path)
    sample_flight.gpx_file_path = str(gpx_path)
    sample_flight.title = "Arguel test"
    db_session.commit()

    expected = {
        "job_id": "job-flight-gopro",
        "status": "queued",
        "progress": 0,
        "message": "queued",
        "layout_id": "parapente-1080",
        "layout_label": "Parapente 1920x1080",
        "output_filename": "Arguel_test-overlay.mp4",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }

    with (
        patch(
            "routes.check_gopro_overlay_dependencies",
            return_value={"gopro_dashboard": True, "ffmpeg": True, "ffprobe": True},
        ),
        patch("routes.create_gopro_overlay_job_from_paths", return_value=expected) as create_job,
    ):
        response = client.post(f"{API_PREFIX}/flights/{sample_flight.id}/gopro-overlay")

    assert response.status_code == 200
    assert response.json()["job_id"] == "job-flight-gopro"
    assert create_job.call_args.kwargs["video_path"] == video_path
    assert create_job.call_args.kwargs["gpx_path"] == gpx_path
    assert create_job.call_args.kwargs["output_filename"] == "Arguel test-overlay.mp4"


def test_create_flight_gopro_overlay_job_requires_existing_video(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
):
    gpx_path = tmp_path / "flight.gpx"
    gpx_path.write_text("<gpx />")
    sample_flight.gpx_file_path = str(gpx_path)
    sample_flight.video_file_path = str(tmp_path / "missing.mp4")
    db_session.commit()

    with patch(
        "routes.check_gopro_overlay_dependencies",
        return_value={"gopro_dashboard": True, "ffmpeg": True, "ffprobe": True},
    ):
        response = client.post(f"{API_PREFIX}/flights/{sample_flight.id}/gopro-overlay")

    assert response.status_code == 400
    assert response.json()["detail"] == "Flight has no video file"


def test_create_flight_gopro_overlay_job_resolves_relative_paths(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
    monkeypatch,
):
    backend_root = tmp_path / "backend"
    video_path = backend_root / "db" / "videos" / "flight.mp4"
    gpx_path = backend_root / "db" / "gpx" / "flight.gpx"
    video_path.parent.mkdir(parents=True)
    gpx_path.parent.mkdir(parents=True)
    video_path.write_bytes(b"video")
    gpx_path.write_text("<gpx />")
    sample_flight.video_file_path = "db/videos/flight.mp4"
    sample_flight.gpx_file_path = "db/gpx/flight.gpx"
    db_session.commit()

    expected = {
        "job_id": "job-flight-gopro-relative",
        "status": "queued",
        "progress": 0,
        "message": "queued",
        "layout_id": "parapente-1080",
        "layout_label": "Parapente 1920x1080",
        "output_filename": "flight-overlay.mp4",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    monkeypatch.setattr(routes, "__file__", str(backend_root / "routes.py"))

    with (
        patch(
            "routes.check_gopro_overlay_dependencies",
            return_value={"gopro_dashboard": True, "ffmpeg": True, "ffprobe": True},
        ),
        patch("routes.create_gopro_overlay_job_from_paths", return_value=expected) as create_job,
    ):
        response = client.post(f"{API_PREFIX}/flights/{sample_flight.id}/gopro-overlay")

    assert response.status_code == 200
    assert create_job.call_args.kwargs["video_path"] == video_path
    assert create_job.call_args.kwargs["gpx_path"] == gpx_path


def test_download_gopro_overlay_rejects_unfinished_job(client: TestClient):
    with patch(
        "routes.get_gopro_overlay_job",
        return_value={"job_id": "job-gopro", "status": "running"},
    ):
        response = client.get(f"{API_PREFIX}/gopro-overlays/jobs/job-gopro/download")

    assert response.status_code == 400
    assert response.json()["detail"] == "GoPro overlay video is not ready"


def test_prepare_layout_file_injects_pip_id(tmp_path):
    source = tmp_path / "layout.xml"
    destination = tmp_path / "prepared.xml"
    source.write_text('<layout><component type="video" size="220" /></layout>')

    _prepare_layout_file(source, destination, has_pip=True)

    assert 'id="pip"' in destination.read_text()


def test_prepare_layout_file_removes_pip_without_video(tmp_path):
    source = tmp_path / "layout.xml"
    destination = tmp_path / "prepared.xml"
    source.write_text('<layout><component type="video" size="220" /></layout>')

    _prepare_layout_file(source, destination, has_pip=False)

    assert 'type="video"' not in destination.read_text()


@pytest.mark.asyncio
async def test_create_gopro_overlay_job_cleans_uploads_after_validation_failure(
    tmp_path,
    monkeypatch,
):
    upload_dir = tmp_path / "uploads"
    monkeypatch.setattr(config, "GOPRO_OVERLAY_UPLOAD_DIR", str(upload_dir))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_OUTPUT_DIR", str(tmp_path / "outputs"))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_LAYOUT_DIR", str(tmp_path / "layouts"))
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (1920, 1080))

    with pytest.raises(ValueError, match="Unknown layout"):
        await create_gopro_overlay_job(
            video_file=_upload("flight.mp4", b"video"),
            gpx_file=_upload("flight.gpx", b"<gpx />"),
            pip_file=None,
            layout_id="missing-layout",
            output_filename="flight-overlay.mp4",
        )

    assert not upload_dir.exists() or not any(upload_dir.iterdir())


@pytest.mark.asyncio
async def test_create_gopro_overlay_job_uses_job_unique_output_paths(tmp_path, monkeypatch):
    upload_dir = tmp_path / "uploads"
    output_dir = tmp_path / "outputs"
    layout_dir = tmp_path / "layouts"
    layout_dir.mkdir()
    (layout_dir / "layout_parapente_1080.xml").write_text("<layout />")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_UPLOAD_DIR", str(upload_dir))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_OUTPUT_DIR", str(output_dir))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_LAYOUT_DIR", str(layout_dir))
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (1920, 1080))

    with patch("gopro_overlay_export.threading.Thread") as thread:
        first = await create_gopro_overlay_job(
            video_file=_upload("flight.mp4", b"video"),
            gpx_file=_upload("flight.gpx", b"<gpx />"),
            pip_file=None,
            layout_id="parapente-1080",
            output_filename="overlay.mp4",
        )
        second = await create_gopro_overlay_job(
            video_file=_upload("flight.mp4", b"video"),
            gpx_file=_upload("flight.gpx", b"<gpx />"),
            pip_file=None,
            layout_id="parapente-1080",
            output_filename="overlay.mp4",
        )

    assert first["output_filename"] == "overlay.mp4"
    assert second["output_filename"] == "overlay.mp4"
    assert first["output_path"] != second["output_path"]
    assert Path(first["output_path"]).parent.name == first["job_id"]
    assert Path(second["output_path"]).parent.name == second["job_id"]
    assert thread.call_count == 2


def test_create_gopro_overlay_job_from_paths_rejects_unsupported_input_before_workdir(
    tmp_path,
    monkeypatch,
):
    upload_dir = tmp_path / "uploads"
    monkeypatch.setattr(config, "GOPRO_OVERLAY_UPLOAD_DIR", str(upload_dir))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_OUTPUT_DIR", str(tmp_path / "outputs"))

    with pytest.raises(ValueError, match="Unsupported file extension '.avi'"):
        create_gopro_overlay_job_from_paths(
            video_path=tmp_path / "flight.avi",
            gpx_path=tmp_path / "flight.gpx",
            pip_path=None,
            layout_id="parapente-1080",
            output_filename="overlay.mp4",
        )

    assert not upload_dir.exists()


def test_create_gopro_overlay_job_from_paths_copies_inputs_into_job_dir(
    tmp_path,
    monkeypatch,
):
    upload_dir = tmp_path / "uploads"
    output_dir = tmp_path / "outputs"
    layout_dir = tmp_path / "layouts"
    layout_dir.mkdir()
    (layout_dir / "layout_parapente_1080.xml").write_text("<layout />")
    video_path = tmp_path / "source.mp4"
    gpx_path = tmp_path / "source.gpx"
    video_path.write_bytes(b"video")
    gpx_path.write_text("<gpx />")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_UPLOAD_DIR", str(upload_dir))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_OUTPUT_DIR", str(output_dir))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_LAYOUT_DIR", str(layout_dir))
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (1920, 1080))

    with patch("gopro_overlay_export.threading.Thread"):
        job = create_gopro_overlay_job_from_paths(
            video_path=video_path,
            gpx_path=gpx_path,
            pip_path=None,
            layout_id="parapente-1080",
            output_filename="overlay.mp4",
        )

    assert Path(job["video_path"]).parent == upload_dir / job["job_id"]
    assert Path(job["gpx_path"]).parent == upload_dir / job["job_id"]
    assert Path(job["video_path"]).read_bytes() == b"video"
    assert Path(job["gpx_path"]).read_text() == "<gpx />"


def test_cancelled_queued_job_does_not_start_process():
    job_id = "queued-job"
    gopro_overlay_export._JOBS[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "progress": 0,
        "message": "Overlay queued",
        "gpx_path": "track.gpx",
        "layout_path": "layout.xml",
        "video_path": "flight.mp4",
        "output_path": "overlay.mp4",
        "pip_path": None,
        "video_width": None,
        "video_height": None,
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    try:
        assert cancel_gopro_overlay_job(job_id)
        with patch("gopro_overlay_export.subprocess.Popen") as popen:
            gopro_overlay_export._run_job(job_id)
        assert not popen.called
        assert gopro_overlay_export._JOBS[job_id]["status"] == "cancelled"
    finally:
        gopro_overlay_export._JOBS.pop(job_id, None)
        gopro_overlay_export._PROCESSES.pop(job_id, None)


def _upload(filename: str, content: bytes) -> UploadFile:
    return UploadFile(
        file=BytesIO(content),
        filename=filename,
        headers=Headers({"content-type": "application/octet-stream"}),
    )
