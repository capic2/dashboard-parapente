from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from gopro_overlay_export import _prepare_layout_file

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
