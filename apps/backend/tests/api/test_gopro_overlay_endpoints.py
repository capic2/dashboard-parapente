import logging
import os
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from starlette.datastructures import Headers
from starlette.datastructures import UploadFile

import config
import gopro_overlay_export
from auth import create_job_token
import routes
from gopro_overlay_export import _prepare_layout_file
from gopro_overlay_export import _progress_from_output_chunk
from gopro_overlay_export import _read_process_updates
from gopro_overlay_export import cancel_gopro_overlay_job
from gopro_overlay_export import create_gopro_overlay_job
from gopro_overlay_export import create_gopro_overlay_job_from_paths
from gopro_overlay_export import delete_gopro_overlay_job
from models import Flight

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
    assert response.json()["job_token"]
    assert create_job.call_args.kwargs["layout_id"] == "parapente-1080"
    assert create_job.call_args.kwargs["output_filename"] == "flight-overlay.mp4"
    assert create_job.call_args.kwargs["pip_file"] is not None


def test_gopro_overlay_job_access_status_accepts_job_token(client: TestClient):
    token = create_job_token(purpose="gopro_overlay", job_id="job-gopro")
    expected = {
        "job_id": "job-gopro",
        "status": "completed",
        "progress": 100,
        "message": "ready",
        "layout_id": "parapente-1080",
        "layout_label": "Parapente 1920x1080",
        "output_filename": "flight-overlay.mp4",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }

    with patch("routes.get_gopro_overlay_job", return_value=expected):
        response = client.get(
            f"{API_PREFIX}/job-access/gopro-overlays/jobs/job-gopro/status",
            params={"access_token": token},
        )

    assert response.status_code == 200
    assert response.json()["job_id"] == "job-gopro"


def test_create_flight_gopro_overlay_job_uses_flight_files(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
    monkeypatch,
):
    video_path = tmp_path / "flight.mp4"
    gpx_path = tmp_path / "flight.gpx"
    video_path.write_bytes(b"video")
    gpx_path.write_text("<gpx />")
    sample_flight.video_file_path = str(video_path)
    sample_flight.gpx_file_path = str(gpx_path)
    sample_flight.title = "Arguel test"
    db_session.commit()
    paragliding_root = tmp_path / "parapente"
    output_dir = paragliding_root / "exports"
    monkeypatch.setattr(config, "GOPRO_OVERLAY_PARAGLIDING_ROOT", str(paragliding_root))

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
        patch("routes.create_gopro_overlay_job", AsyncMock(return_value=expected)) as create_job,
    ):
        response = client.post(
            f"{API_PREFIX}/flights/{sample_flight.id}/gopro-overlay",
            files={
                "video_file": ("camera.mp4", b"camera", "video/mp4"),
                "osv_video_file": ("osv.mp4", b"osv", "video/mp4"),
            },
            data={
                "output_filename": "Arguel test-overlay.mp4",
                "output_dir": str(output_dir),
            },
        )

    assert response.status_code == 200
    assert response.json()["job_id"] == "job-flight-gopro"
    assert create_job.call_args.kwargs["video_file"] is not None
    assert create_job.call_args.kwargs["gpx_file"] is None
    assert create_job.call_args.kwargs["fallback_gpx_path"] == gpx_path
    assert create_job.call_args.kwargs["fallback_pip_path"] == video_path
    assert create_job.call_args.kwargs["pip_file"] is not None
    assert create_job.call_args.kwargs["output_filename"] == "Arguel test-overlay.mp4"
    assert create_job.call_args.kwargs["output_dir"] == str(output_dir)


def test_create_flight_gopro_overlay_job_resolves_paragliding_root_paths(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
    monkeypatch,
):
    paragliding_root = tmp_path / "paragliding"
    video_path = paragliding_root / "camera" / "flight.mp4"
    gpx_path = paragliding_root / "tracks" / "flight.gpx"
    pip_path = paragliding_root / "pip" / "flight-pip.mp4"
    output_dir = paragliding_root / "exports"
    video_path.parent.mkdir(parents=True)
    gpx_path.parent.mkdir(parents=True)
    pip_path.parent.mkdir(parents=True)
    video_path.write_bytes(b"camera")
    gpx_path.write_text("<gpx />")
    pip_path.write_bytes(b"pip")
    sample_flight.title = "Arguel test"
    db_session.commit()
    monkeypatch.setattr(config, "GOPRO_OVERLAY_PARAGLIDING_ROOT", str(paragliding_root))

    expected = {
        "job_id": "job-flight-gopro-paths",
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
        patch(
            "routes.asyncio.to_thread",
            AsyncMock(side_effect=lambda func, *args, **kwargs: func(*args, **kwargs)),
        ) as to_thread,
        patch("routes.create_gopro_overlay_job_from_paths", return_value=expected) as create_job,
    ):
        response = client.post(
            f"{API_PREFIX}/flights/{sample_flight.id}/gopro-overlay",
            data={
                "video_path": "camera/flight.mp4",
                "gpx_path": "tracks/flight.gpx",
                "pip_path": "pip/flight-pip.mp4",
                "output_filename": "Arguel test-overlay.mp4",
                "output_dir": str(output_dir),
            },
        )

    assert response.status_code == 200
    assert to_thread.call_args.args[0] is create_job
    assert create_job.call_args.kwargs["video_path"] == video_path
    assert create_job.call_args.kwargs["gpx_path"] == gpx_path
    assert create_job.call_args.kwargs["pip_path"] == pip_path
    assert create_job.call_args.kwargs["output_filename"] == "Arguel test-overlay.mp4"
    assert create_job.call_args.kwargs["output_dir"] == str(output_dir)


def test_create_flight_gopro_overlay_job_uses_auto_flight_directory_files(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
    monkeypatch,
):
    paragliding_root = tmp_path / "gopro-root"
    input_dir = paragliding_root / "20260315" / "01"
    input_dir.mkdir(parents=True)
    camera_path = input_dir / "camera.mp4"
    first_gpx_path = input_dir / "Zepp-a.gpx"
    second_gpx_path = input_dir / "Zepp-b.gpx"
    old_pip_path = input_dir / "flight-old.mp4"
    new_pip_path = input_dir / "flight-new.mp4"
    camera_path.write_bytes(b"camera")
    first_gpx_path.write_text("<gpx>first</gpx>")
    second_gpx_path.write_text("<gpx>second</gpx>")
    old_pip_path.write_bytes(b"old")
    new_pip_path.write_bytes(b"new")
    os.utime(first_gpx_path, (2, 2))
    os.utime(second_gpx_path, (1, 1))
    os.utime(old_pip_path, (1, 1))
    os.utime(new_pip_path, (2, 2))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_PARAGLIDING_ROOT", str(paragliding_root))

    expected = {
        "job_id": "job-flight-gopro-auto",
        "status": "queued",
        "progress": 0,
        "message": "queued",
        "layout_id": "parapente-1080",
        "layout_label": "Parapente 1920x1080",
        "output_filename": "final.mp4",
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
    assert create_job.call_args.kwargs["video_path"] == camera_path
    assert create_job.call_args.kwargs["gpx_path"] == first_gpx_path
    assert create_job.call_args.kwargs["pip_path"] == new_pip_path
    assert create_job.call_args.kwargs["output_dir"] == str(input_dir)
    assert create_job.call_args.kwargs["output_filename"] == "final.mp4"


def test_create_flight_gopro_overlay_job_requires_auto_zepp_gpx(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
    monkeypatch,
):
    paragliding_root = tmp_path / "gopro-root"
    input_dir = paragliding_root / "20260315" / "01"
    input_dir.mkdir(parents=True)
    (input_dir / "camera.mp4").write_bytes(b"camera")
    (input_dir / "flight-pip.mp4").write_bytes(b"pip")
    sample_flight.gpx_file_path = None
    sample_flight.video_file_path = None
    db_session.commit()
    monkeypatch.setattr(config, "GOPRO_OVERLAY_PARAGLIDING_ROOT", str(paragliding_root))

    with patch(
        "routes.check_gopro_overlay_dependencies",
        return_value={"gopro_dashboard": True, "ffmpeg": True, "ffprobe": True},
    ):
        response = client.post(f"{API_PREFIX}/flights/{sample_flight.id}/gopro-overlay")

    assert response.status_code == 400
    assert response.json()["detail"] == "Flight has no GPX file"


def test_create_flight_gopro_overlay_job_uses_daily_departure_index(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
    monkeypatch,
):
    earlier = Flight(
        id="flight-earlier",
        flight_date=date(2026, 3, 15),
        departure_time=datetime(2026, 3, 15, 8, 0),
    )
    db_session.add(earlier)
    db_session.commit()
    paragliding_root = tmp_path / "gopro-root"
    input_dir = paragliding_root / "20260315" / "02"
    input_dir.mkdir(parents=True)
    camera_path = input_dir / "camera.mp4"
    gpx_path = input_dir / "Zepp-track.gpx"
    pip_path = input_dir / "flight-pip.mp4"
    camera_path.write_bytes(b"camera")
    gpx_path.write_text("<gpx />")
    pip_path.write_bytes(b"pip")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_PARAGLIDING_ROOT", str(paragliding_root))

    expected = {
        "job_id": "job-flight-gopro-second",
        "status": "queued",
        "progress": 0,
        "message": "queued",
        "layout_id": "parapente-1080",
        "layout_label": "Parapente 1920x1080",
        "output_filename": "final.mp4",
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
    assert create_job.call_args.kwargs["video_path"] == camera_path
    assert create_job.call_args.kwargs["gpx_path"] == gpx_path
    assert create_job.call_args.kwargs["pip_path"] == pip_path


def test_create_flight_gopro_overlay_job_merges_all_auto_osv_files(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
    monkeypatch,
):
    paragliding_root = tmp_path / "gopro-root"
    input_dir = paragliding_root / "20260315" / "01"
    input_dir.mkdir(parents=True)
    camera_path = input_dir / "camera.mp4"
    gpx_path = input_dir / "Zepp-track.gpx"
    pip_path = input_dir / "flight-pip.mp4"
    first_osv = input_dir / "first.osv"
    second_osv = input_dir / "second.osv"
    merged_gpx_path = input_dir / ".gopro-overlay-work" / "merged.gpx"
    camera_path.write_bytes(b"camera")
    gpx_path.write_text("<gpx />")
    pip_path.write_bytes(b"pip")
    first_osv.write_bytes(b"first")
    second_osv.write_bytes(b"second")
    merged_gpx_path.parent.mkdir(parents=True)
    merged_gpx_path.write_text("<gpx>merged</gpx>")
    os.utime(first_osv, (1, 1))
    os.utime(second_osv, (2, 2))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_PARAGLIDING_ROOT", str(paragliding_root))

    expected = {
        "job_id": "job-flight-gopro-osv",
        "status": "queued",
        "progress": 0,
        "message": "queued",
        "layout_id": "parapente-1080",
        "layout_label": "Parapente 1920x1080",
        "output_filename": "final.mp4",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }

    with (
        patch(
            "routes.check_gopro_overlay_dependencies",
            return_value={"gopro_dashboard": True, "ffmpeg": True, "ffprobe": True},
        ),
        patch("routes._merge_osv_files_with_gpx", return_value=merged_gpx_path) as merge_osv,
        patch("routes.create_gopro_overlay_job_from_paths", return_value=expected) as create_job,
    ):
        response = client.post(f"{API_PREFIX}/flights/{sample_flight.id}/gopro-overlay")

    assert response.status_code == 200
    assert merge_osv.call_args.args == ([first_osv, second_osv], gpx_path, input_dir)
    assert create_job.call_args.kwargs["gpx_path"] == merged_gpx_path


def test_create_flight_gopro_overlay_job_rejects_paths_outside_paragliding_root(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
    monkeypatch,
):
    paragliding_root = tmp_path / "paragliding"
    outside_video = tmp_path / "outside" / "flight.mp4"
    outside_video.parent.mkdir(parents=True)
    outside_video.write_bytes(b"camera")
    db_session.commit()
    monkeypatch.setattr(config, "GOPRO_OVERLAY_PARAGLIDING_ROOT", str(paragliding_root))

    with patch(
        "routes.check_gopro_overlay_dependencies",
        return_value={"gopro_dashboard": True, "ffmpeg": True, "ffprobe": True},
    ):
        response = client.post(
            f"{API_PREFIX}/flights/{sample_flight.id}/gopro-overlay",
            data={"video_path": str(outside_video)},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "GoPro overlay path must be inside the paragliding root"


def test_create_flight_gopro_overlay_job_rejects_output_dir_outside_paragliding_root(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
    monkeypatch,
):
    paragliding_root = tmp_path / "paragliding"
    outside_output_dir = tmp_path / "outside"
    db_session.commit()
    monkeypatch.setattr(config, "GOPRO_OVERLAY_PARAGLIDING_ROOT", str(paragliding_root))

    with patch(
        "routes.check_gopro_overlay_dependencies",
        return_value={"gopro_dashboard": True, "ffmpeg": True, "ffprobe": True},
    ):
        response = client.post(
            f"{API_PREFIX}/flights/{sample_flight.id}/gopro-overlay",
            data={"output_dir": str(outside_output_dir)},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "GoPro overlay path must be inside the paragliding root"


def test_create_flight_gopro_overlay_job_requires_gpx_when_no_upload(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
):
    sample_flight.gpx_file_path = None
    db_session.commit()

    with patch(
        "routes.check_gopro_overlay_dependencies",
        return_value={"gopro_dashboard": True, "ffmpeg": True, "ffprobe": True},
    ):
        response = client.post(
            f"{API_PREFIX}/flights/{sample_flight.id}/gopro-overlay",
            files={"video_file": ("camera.mp4", b"camera", "video/mp4")},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Flight has no GPX file"


def test_create_flight_gopro_overlay_job_uses_uploaded_gpx_over_fallback(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
):
    gpx_path = tmp_path / "flight.gpx"
    video_path = tmp_path / "flight.mp4"
    gpx_path.write_text("<gpx />")
    video_path.write_bytes(b"video")
    sample_flight.gpx_file_path = str(gpx_path)
    sample_flight.video_file_path = str(video_path)
    db_session.commit()

    expected = {
        "job_id": "job-flight-gopro-uploaded-gpx",
        "status": "queued",
        "progress": 0,
        "message": "queued",
        "layout_id": "parapente-1080",
        "layout_label": "Parapente 1920x1080",
        "output_filename": "flight-overlay.mp4",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }

    with (
        patch(
            "routes.check_gopro_overlay_dependencies",
            return_value={"gopro_dashboard": True, "ffmpeg": True, "ffprobe": True},
        ),
        patch("routes.create_gopro_overlay_job", AsyncMock(return_value=expected)) as create_job,
    ):
        response = client.post(
            f"{API_PREFIX}/flights/{sample_flight.id}/gopro-overlay",
            files={
                "video_file": ("camera.mp4", b"camera", "video/mp4"),
                "gpx_file": ("uploaded.gpx", b"<gpx />", "application/gpx+xml"),
            },
        )

    assert response.status_code == 200
    assert create_job.call_args.kwargs["gpx_file"] is not None
    assert create_job.call_args.kwargs["fallback_gpx_path"] == gpx_path


def test_create_flight_gopro_overlay_job_resolves_relative_paths(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
    monkeypatch,
):
    backend_root = tmp_path / "backend"
    gpx_path = backend_root / "db" / "gpx" / "flight.gpx"
    video_path = tmp_path / "flight.mp4"
    gpx_path.parent.mkdir(parents=True)
    gpx_path.write_text("<gpx />")
    video_path.write_bytes(b"video")
    sample_flight.gpx_file_path = "db/gpx/flight.gpx"
    sample_flight.video_file_path = str(video_path)
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
        patch("routes.create_gopro_overlay_job", AsyncMock(return_value=expected)) as create_job,
    ):
        response = client.post(
            f"{API_PREFIX}/flights/{sample_flight.id}/gopro-overlay",
            files={"video_file": ("camera.mp4", b"camera", "video/mp4")},
        )

    assert response.status_code == 200
    assert create_job.call_args.kwargs["fallback_gpx_path"] == gpx_path


def test_create_flight_gopro_overlay_job_requires_generated_video_for_pip(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
):
    gpx_path = tmp_path / "flight.gpx"
    gpx_path.write_text("<gpx />")
    sample_flight.gpx_file_path = str(gpx_path)
    sample_flight.video_file_path = None
    db_session.commit()

    with patch(
        "routes.check_gopro_overlay_dependencies",
        return_value={"gopro_dashboard": True, "ffmpeg": True, "ffprobe": True},
    ):
        response = client.post(
            f"{API_PREFIX}/flights/{sample_flight.id}/gopro-overlay",
            files={"video_file": ("camera.mp4", b"camera", "video/mp4")},
        )

    assert response.status_code == 400
    assert (
        response.json()["detail"] == "Generate the flight video before creating the GoPro overlay"
    )


def test_download_gopro_overlay_rejects_unfinished_job(client: TestClient):
    with patch(
        "routes.get_gopro_overlay_job",
        return_value={"job_id": "job-gopro", "status": "running"},
    ):
        response = client.get(f"{API_PREFIX}/gopro-overlays/jobs/job-gopro/download")

    assert response.status_code == 400
    assert response.json()["detail"] == "GoPro overlay video is not ready"


def test_delete_gopro_overlay_video_removes_completed_output(client: TestClient):
    with patch(
        "routes.delete_gopro_overlay_output",
        return_value={"job_id": "job-gopro", "deleted": True, "path": "/tmp/final.mp4"},
    ):
        response = client.delete(f"{API_PREFIX}/gopro-overlays/jobs/job-gopro/video")

    assert response.status_code == 200
    assert response.json() == {
        "job_id": "job-gopro",
        "deleted": True,
        "path": "/tmp/final.mp4",
        "message": "GoPro overlay video file deleted",
    }


def test_delete_gopro_overlay_video_rejects_running_job(client: TestClient):
    with patch(
        "routes.delete_gopro_overlay_output",
        return_value={"job_id": "job-gopro", "deleted": False, "error": "active"},
    ):
        response = client.delete(f"{API_PREFIX}/gopro-overlays/jobs/job-gopro/video")

    assert response.status_code == 400
    assert response.json()["detail"] == "Cannot delete video for an active overlay"


def test_delete_gopro_overlay_job_removes_terminal_row_and_work_dir(tmp_path):
    job_id = "job-gopro-delete"
    work_dir = tmp_path / ".gopro-overlay-work" / job_id
    work_dir.mkdir(parents=True)
    layout_path = work_dir / "layout.xml"
    layout_path.write_text("<layout />")

    gopro_overlay_export._JOBS[job_id] = {
        "job_id": job_id,
        "status": "failed",
        "layout_path": str(layout_path),
        "output_path": str(tmp_path / "final.mp4"),
    }

    try:
        result = delete_gopro_overlay_job(job_id)
    finally:
        gopro_overlay_export._JOBS.pop(job_id, None)

    assert result is not None
    assert result["deleted"] is True
    assert result["files_deleted"] == 1
    assert not work_dir.exists()
    assert gopro_overlay_export.get_gopro_overlay_job(job_id) is None


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


def test_gopro_overlay_progress_is_parsed_from_render_output():
    assert _progress_from_output_chunk("Render: 42 [42%] [1.2/s] ETA: 00:10") == 42


def test_gopro_overlay_progress_is_clamped_until_output_is_ready():
    assert _progress_from_output_chunk("Render: 100 [100%]") == 99


def test_gopro_overlay_process_updates_split_carriage_returns():
    class Stream:
        def __init__(self, value: str):
            self.value = value
            self.index = 0

        def read(self, size: int) -> str:
            if self.index >= len(self.value):
                return ""
            chunk = self.value[self.index : self.index + size]
            self.index += size
            return chunk

    assert list(_read_process_updates(Stream("Render: 1%\rRender: 2%\nDone"))) == [
        "Render: 1%",
        "Render: 2%",
        "Done",
    ]


@pytest.mark.asyncio
async def test_create_gopro_overlay_job_cleans_uploads_after_validation_failure(
    tmp_path,
    monkeypatch,
):
    upload_dir = tmp_path / "uploads"
    monkeypatch.setattr(gopro_overlay_export, "_UPLOAD_WORK_ROOT", upload_dir)
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
    layout_dir = tmp_path / "layouts"
    layout_dir.mkdir()
    (layout_dir / "layout_parapente_1080.xml").write_text("<layout />")
    monkeypatch.setattr(gopro_overlay_export, "_UPLOAD_WORK_ROOT", upload_dir)
    monkeypatch.setattr(config, "GOPRO_OVERLAY_LAYOUT_DIR", str(layout_dir))
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (1920, 1080))

    with (
        patch(
            "gopro_overlay_export.asyncio.to_thread",
            AsyncMock(side_effect=lambda func, *args, **kwargs: func(*args, **kwargs)),
        ) as to_thread,
        patch("gopro_overlay_export.threading.Thread") as thread,
    ):
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
    assert to_thread.call_count == 2
    assert to_thread.call_args.args[0] is gopro_overlay_export._create_gopro_overlay_job_from_paths
    assert thread.call_count == 2


def test_create_gopro_overlay_job_from_paths_rejects_unsupported_input_before_workdir(
    tmp_path,
):
    work_root = tmp_path / ".gopro-overlay-work"

    with pytest.raises(ValueError, match="Unsupported file extension '.avi'"):
        create_gopro_overlay_job_from_paths(
            video_path=tmp_path / "flight.avi",
            gpx_path=tmp_path / "flight.gpx",
            pip_path=None,
            layout_id="parapente-1080",
            output_filename="overlay.mp4",
        )

    assert not work_root.exists()


def test_create_gopro_overlay_job_from_paths_copies_inputs_into_job_dir(
    tmp_path,
    monkeypatch,
):
    layout_dir = tmp_path / "layouts"
    layout_dir.mkdir()
    (layout_dir / "layout_parapente_1080.xml").write_text("<layout />")
    video_path = tmp_path / "source.mp4"
    gpx_path = tmp_path / "source.gpx"
    video_path.write_bytes(b"video")
    gpx_path.write_text("<gpx />")
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

    work_dir = tmp_path / ".gopro-overlay-work" / job["job_id"]
    assert Path(job["video_path"]).parent == work_dir
    assert Path(job["gpx_path"]).parent == work_dir
    assert Path(job["video_path"]).read_bytes() == b"video"
    assert Path(job["gpx_path"]).read_text() == "<gpx />"
    assert Path(job["output_path"]) == tmp_path / "overlay.mp4"


def test_create_gopro_overlay_job_from_paths_sanitizes_output_filename_in_source_dir(
    tmp_path,
    monkeypatch,
):
    layout_dir = tmp_path / "layouts"
    layout_dir.mkdir()
    (layout_dir / "layout_parapente_1080.xml").write_text("<layout />")
    video_path = tmp_path / "source.mp4"
    gpx_path = tmp_path / "source.gpx"
    video_path.write_bytes(b"video")
    gpx_path.write_text("<gpx />")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_LAYOUT_DIR", str(layout_dir))
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (1920, 1080))

    with patch("gopro_overlay_export.threading.Thread"):
        job = create_gopro_overlay_job_from_paths(
            video_path=video_path,
            gpx_path=gpx_path,
            pip_path=None,
            layout_id="parapente-1080",
            output_filename="custom overlay.mov",
        )

    assert Path(job["output_path"]) == tmp_path / "custom_overlay.mp4"


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


def test_run_job_passes_configured_font(monkeypatch):
    job_id = "font-job"
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
    monkeypatch.setattr(config, "GOPRO_OVERLAY_FONT", "/fonts/LiberationSans-Regular.ttf")

    class FailedProcess:
        stdout: list[str] = []

        def wait(self) -> int:
            return 1

    try:
        with patch("gopro_overlay_export.subprocess.Popen", return_value=FailedProcess()) as popen:
            gopro_overlay_export._run_job(job_id)

        command = popen.call_args.args[0]
        assert "--font" in command
        assert command[command.index("--font") + 1] == "/fonts/LiberationSans-Regular.ttf"
    finally:
        gopro_overlay_export._JOBS.pop(job_id, None)
        gopro_overlay_export._PROCESSES.pop(job_id, None)


def test_run_job_marks_unexpected_start_error_failed(caplog):
    job_id = "start-error-job"
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
        with (
            caplog.at_level(logging.ERROR),
            patch(
                "gopro_overlay_export.subprocess.Popen",
                side_effect=RuntimeError("boom"),
            ),
        ):
            gopro_overlay_export._run_job(job_id)

        job = gopro_overlay_export._JOBS[job_id]
        assert job["status"] == "failed"
        assert job["message"] == "Overlay rendering failed to start"
        assert job["error"] == "boom"
        assert "Failed to start GoPro overlay job start-error-job" in caplog.text
    finally:
        gopro_overlay_export._JOBS.pop(job_id, None)
        gopro_overlay_export._PROCESSES.pop(job_id, None)


def _upload(filename: str, content: bytes) -> UploadFile:
    return UploadFile(
        file=BytesIO(content),
        filename=filename,
        headers=Headers({"content-type": "application/octet-stream"}),
    )
