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
        "log_tail": ["Starting overlay", "Rendering overlay: 50%"],
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
            data={
                "layout_id": "parapente-1080",
                "output_filename": "flight-overlay.mp4",
                "gpx_offset": "2.5",
            },
        )

    assert response.status_code == 200
    assert response.json()["job_id"] == "job-gopro"
    assert response.json()["log_tail"] == ["Starting overlay", "Rendering overlay: 50%"]
    assert response.json()["job_token"]
    assert create_job.call_args.kwargs["layout_id"] == "parapente-1080"
    assert create_job.call_args.kwargs["output_filename"] == "flight-overlay.mp4"
    assert create_job.call_args.kwargs["gpx_offset"] == 2.5
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
    db_session.refresh(sample_flight)
    assert sample_flight.gopro_overlay_job_id == "job-flight-gopro"
    assert sample_flight.gopro_overlay_status == "queued"
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
    sample_flight.video_file_path = str(pip_path)
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
    db_session.refresh(sample_flight)
    assert sample_flight.gopro_overlay_job_id == "job-flight-gopro-paths"
    assert sample_flight.gopro_overlay_status == "queued"
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
    first_gpx_path = input_dir / "Zepp-a.GPX"
    second_gpx_path = input_dir / "Zepp-b.gpx"
    old_pip_path = input_dir / "flight-old.mp4"
    new_pip_path = input_dir / "flight-new.MP4"
    camera_path.write_bytes(b"camera")
    first_gpx_path.write_text("<gpx>first</gpx>")
    second_gpx_path.write_text("<gpx>second</gpx>")
    old_pip_path.write_bytes(b"old")
    new_pip_path.write_bytes(b"new")
    sample_flight.video_file_path = str(new_pip_path)
    db_session.commit()
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
    generated_video_path = input_dir / "flight-pip.mp4"
    generated_video_path.write_bytes(b"pip")
    sample_flight.gpx_file_path = None
    sample_flight.video_file_path = str(generated_video_path)
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
    sample_flight.video_file_path = str(pip_path)
    db_session.commit()
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
    first_osv = input_dir / "first.OSV"
    second_osv = input_dir / "second.osv"
    camera_path.write_bytes(b"camera")
    gpx_path.write_text("<gpx />")
    pip_path.write_bytes(b"pip")
    first_osv.write_bytes(b"first")
    second_osv.write_bytes(b"second")
    sample_flight.video_file_path = str(pip_path)
    db_session.commit()
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
        patch("routes.create_gopro_overlay_job_from_paths", return_value=expected) as create_job,
    ):
        response = client.post(f"{API_PREFIX}/flights/{sample_flight.id}/gopro-overlay")

    assert response.status_code == 200
    assert create_job.call_args.kwargs["gpx_path"] == gpx_path


def test_create_flight_gopro_overlay_job_uses_merged_uploaded_gpx_when_osv_exists(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
    monkeypatch,
):
    paragliding_root = tmp_path / "gopro-root"
    input_dir = paragliding_root / "20260315" / "01"
    input_dir.mkdir(parents=True)
    pip_path = input_dir / "flight-pip.mp4"
    osv_path = input_dir / "flight.osv"
    pip_path.write_bytes(b"pip")
    osv_path.write_bytes(b"osv")
    sample_flight.gpx_file_path = None
    sample_flight.video_file_path = str(pip_path)
    db_session.commit()
    monkeypatch.setattr(config, "GOPRO_OVERLAY_PARAGLIDING_ROOT", str(paragliding_root))

    expected = {
        "job_id": "job-flight-gopro-uploaded-osv",
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
        patch("routes.create_gopro_overlay_job", AsyncMock(return_value=expected)) as create_job,
    ):
        response = client.post(
            f"{API_PREFIX}/flights/{sample_flight.id}/gopro-overlay",
            files={
                "video_file": ("camera.mp4", b"camera", "video/mp4"),
                "gpx_file": ("uploaded.gpx", b"<gpx>uploaded</gpx>", "application/gpx+xml"),
            },
        )

    assert response.status_code == 200
    assert create_job.call_args.kwargs["gpx_file"] is not None
    assert create_job.call_args.kwargs["fallback_gpx_path"] is None


def test_merge_osv_files_with_gpx_writes_stable_file_in_flight_directory(
    tmp_path,
    monkeypatch,
) -> None:
    gopro_root = tmp_path / "gopro-overlay"
    gopro_root.mkdir()
    (gopro_root / "osv_merge.py").write_text("# merge")
    input_dir = tmp_path / "20260315" / "01"
    input_dir.mkdir(parents=True)
    first_osv = input_dir / "first.osv"
    second_osv = input_dir / "second.osv"
    source_gpx = input_dir / "Zepp-track.gpx"
    merged_gpx_path = input_dir / "merged-gopro-overlay.gpx"
    first_osv.write_bytes(b"first")
    second_osv.write_bytes(b"second")
    source_gpx.write_text("<gpx>source</gpx>")
    merged_gpx_path.write_text("stale")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_ROOT", str(gopro_root))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_OSV_MERGE_TIMEOUT_SECONDS", 123)

    class Result:
        returncode = 0
        stderr = ""
        stdout = ""

    def fake_run(command, **kwargs):
        Path(command[-1]).write_text("<gpx>merged</gpx>")
        return Result()

    with patch("routes.subprocess.run", side_effect=fake_run) as run:
        result = routes._merge_osv_files_with_gpx([first_osv, second_osv], source_gpx, input_dir)

    assert result == merged_gpx_path
    assert merged_gpx_path.read_text() == "<gpx>merged</gpx>"
    command = run.call_args.args[0]
    assert command[-2:] == [str(source_gpx), str(merged_gpx_path)]
    assert str(input_dir / ".gopro-overlay-work") not in command[-1]
    assert run.call_args.kwargs["timeout"] == 123


def test_worker_merge_osv_files_with_gpx_uses_configured_timeout(
    tmp_path,
    monkeypatch,
) -> None:
    gopro_root = tmp_path / "gopro-overlay"
    gopro_root.mkdir()
    (gopro_root / "osv_merge.py").write_text("# merge")
    input_dir = tmp_path / "20260315" / "01"
    input_dir.mkdir(parents=True)
    source_gpx = input_dir / "Zepp-track.gpx"
    osv_path = input_dir / "flight.osv"
    merged_gpx_path = input_dir / "merged-gopro-overlay.gpx"
    source_gpx.write_text("<gpx>source</gpx>")
    osv_path.write_bytes(b"osv")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_ROOT", str(gopro_root))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_OSV_MERGE_TIMEOUT_SECONDS", 456)

    class Result:
        returncode = 0
        stderr = ""
        stdout = ""

    def fake_run(command, **kwargs):
        Path(command[-1]).write_text("<gpx>merged</gpx>")
        return Result()

    with patch("gopro_overlay_export.subprocess.run", side_effect=fake_run) as run:
        result = gopro_overlay_export._merge_osv_files_with_gpx(
            [osv_path],
            source_gpx,
            input_dir,
        )

    assert result == merged_gpx_path
    assert merged_gpx_path.read_text() == "<gpx>merged</gpx>"
    assert run.call_args.kwargs["timeout"] == 456


def test_worker_merge_osv_files_with_gpx_writes_log_steps(
    tmp_path,
    monkeypatch,
) -> None:
    gopro_root = tmp_path / "gopro-overlay"
    gopro_root.mkdir()
    (gopro_root / "osv_merge.py").write_text("# merge")
    input_dir = tmp_path / "20260315" / "01"
    input_dir.mkdir(parents=True)
    source_gpx = input_dir / "Zepp-track.gpx"
    osv_path = input_dir / "flight.osv"
    merged_gpx_path = input_dir / "merged-gopro-overlay.gpx"
    log_path = input_dir / "overlay.log"
    source_gpx.write_text("<gpx>source</gpx>")
    osv_path.write_bytes(b"osv")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_ROOT", str(gopro_root))

    class Result:
        returncode = 0
        stderr = ""
        stdout = ""

    def fake_run(command, **kwargs):
        Path(command[-1]).write_text("<gpx>merged</gpx>")
        return Result()

    with patch("gopro_overlay_export.subprocess.run", side_effect=fake_run):
        result = gopro_overlay_export._merge_osv_files_with_gpx(
            [osv_path],
            source_gpx,
            input_dir,
            log_path=log_path,
        )

    assert result == merged_gpx_path
    log_lines = log_path.read_text().splitlines()
    assert any("Merging 1 OSV file(s)" in line for line in log_lines)
    assert any("Created merged GPX" in line for line in log_lines)


def test_worker_merge_osv_files_with_gpx_uses_absolute_timestamps_without_forced_offset(
    tmp_path,
    monkeypatch,
) -> None:
    gopro_root = tmp_path / "gopro-overlay"
    gopro_root.mkdir()
    (gopro_root / "osv_merge.py").write_text("# merge")
    input_dir = tmp_path / "20260315" / "01"
    input_dir.mkdir(parents=True)
    source_gpx = input_dir / "Zepp-track.gpx"
    osv_path = input_dir / "flight.osv"
    merged_gpx_path = input_dir / "merged-gopro-overlay.gpx"
    source_gpx.write_text(
        "<gpx><trk><trkseg>"
        "<trkpt><time>2026-03-15T10:00:10Z</time></trkpt>"
        "<trkpt><time>2026-03-15T10:00:40Z</time></trkpt>"
        "</trkseg></trk></gpx>"
    )
    osv_path.write_bytes(b"osv")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_ROOT", str(gopro_root))
    monkeypatch.setattr(gopro_overlay_export, "probe_video_duration", lambda _: 30.0)
    monkeypatch.setattr(
        gopro_overlay_export,
        "probe_video_start_time",
        lambda _: gopro_overlay_export._parse_utc_datetime("2026-03-15T10:00:00Z"),
    )

    class Result:
        returncode = 0
        stderr = ""
        stdout = ""

    def fake_run(command, **_kwargs):
        Path(command[-1]).write_text("<gpx>merged</gpx>")
        return Result()

    with patch("gopro_overlay_export.subprocess.run", side_effect=fake_run) as run:
        result = gopro_overlay_export._merge_osv_files_with_gpx(
            [osv_path],
            source_gpx,
            input_dir,
        )

    assert result == merged_gpx_path
    assert merged_gpx_path.read_text() == "<gpx>merged</gpx>"
    command = run.call_args.args[0]
    assert "--first-gpx-at" not in command


def test_worker_merge_osv_files_with_gpx_keeps_source_gpx_when_video_starts_after_gpx(
    tmp_path,
    monkeypatch,
) -> None:
    gopro_root = tmp_path / "gopro-overlay"
    gopro_root.mkdir()
    (gopro_root / "osv_merge.py").write_text("# merge")
    input_dir = tmp_path / "work"
    input_dir.mkdir()
    source_gpx = input_dir / "Zepp-track.gpx"
    osv_path = input_dir / "flight.osv"
    merged_gpx_path = input_dir / "merged-gopro-overlay.gpx"
    source_gpx.write_text(
        "<gpx><trk><trkseg>"
        "<trkpt><time>2026-06-13T08:20:26Z</time></trkpt>"
        "<trkpt><time>2026-06-13T08:20:33Z</time></trkpt>"
        "<trkpt><time>2026-06-13T08:20:34Z</time></trkpt>"
        "<trkpt><time>2026-06-13T08:20:35Z</time></trkpt>"
        "</trkseg></trk></gpx>"
    )
    osv_path.write_bytes(b"osv")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_ROOT", str(gopro_root))
    monkeypatch.setattr(gopro_overlay_export, "probe_video_duration", lambda _: 548.8)
    monkeypatch.setattr(
        gopro_overlay_export,
        "probe_video_start_time",
        lambda _: gopro_overlay_export._parse_utc_datetime("2026-06-13T09:20:34Z"),
    )

    class Result:
        returncode = 0
        stderr = ""
        stdout = ""

    def fake_run(command, **_kwargs):
        Path(command[-1]).write_text("<gpx>merged</gpx>")
        return Result()

    with patch("gopro_overlay_export.subprocess.run", side_effect=fake_run) as run:
        result = gopro_overlay_export._merge_osv_files_with_gpx(
            [osv_path],
            source_gpx,
            input_dir,
        )

    assert result == merged_gpx_path
    command = run.call_args.args[0]
    assert "--first-gpx-at" not in command
    assert Path(command[-2]) == source_gpx


def test_gopro_overlay_output_resolution_is_rescaled_when_needed(tmp_path, monkeypatch) -> None:
    output_path = tmp_path / "overlay.mp4"
    output_path.write_bytes(b"small")
    scaled_path = gopro_overlay_export._scaled_video_path(output_path)

    def fake_probe(path: Path):
        if path == output_path:
            return (1280, 720)
        if path == scaled_path:
            return (1920, 1080)
        return (None, None)

    class Result:
        returncode = 0
        stderr = ""
        stdout = ""

    def fake_run(command, **kwargs):
        Path(command[-1]).write_bytes(b"scaled")
        return Result()

    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", fake_probe)
    with patch("gopro_overlay_export.subprocess.run", side_effect=fake_run) as run:
        ok, error = gopro_overlay_export._ensure_video_output_resolution(
            output_path,
            1920,
            1080,
        )

    assert ok is True
    assert error is None
    assert output_path.read_bytes() == b"scaled"
    command = run.call_args.args[0]
    assert command[command.index("-vf") + 1] == "scale=1920:1080:flags=lanczos"


def test_gopro_overlay_output_resolution_noops_when_size_matches(tmp_path, monkeypatch) -> None:
    output_path = tmp_path / "overlay.mp4"
    output_path.write_bytes(b"video")
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (1920, 1080))

    with patch("gopro_overlay_export.subprocess.run") as run:
        ok, error = gopro_overlay_export._ensure_video_output_resolution(
            output_path,
            1920,
            1080,
        )

    assert ok is True
    assert error is None
    assert not run.called
    assert output_path.read_bytes() == b"video"


def test_gopro_overlay_output_resolution_rejects_invalid_expected_dimensions(tmp_path) -> None:
    output_path = tmp_path / "overlay.mp4"
    output_path.write_bytes(b"video")

    ok, error = gopro_overlay_export._ensure_video_output_resolution(output_path, -1, 1080)

    assert ok is False
    assert error == "Invalid expected dimensions: -1x1080"


def test_gopro_overlay_output_resolution_cleans_scaled_file_on_ffmpeg_error(
    tmp_path,
    monkeypatch,
) -> None:
    output_path = tmp_path / "overlay.mp4"
    output_path.write_bytes(b"small")
    scaled_path = gopro_overlay_export._scaled_video_path(output_path)

    class Result:
        returncode = 1
        stderr = "scale failed"
        stdout = ""

    def fake_run(command, **kwargs):
        Path(command[-1]).write_bytes(b"partial")
        return Result()

    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (1280, 720))
    with patch("gopro_overlay_export.subprocess.run", side_effect=fake_run):
        ok, error = gopro_overlay_export._ensure_video_output_resolution(
            output_path,
            1920,
            1080,
        )

    assert ok is False
    assert error == "scale failed"
    assert not scaled_path.exists()
    assert output_path.read_bytes() == b"small"


def test_gopro_overlay_output_resolution_cleans_scaled_file_on_wrong_scaled_size(
    tmp_path,
    monkeypatch,
) -> None:
    output_path = tmp_path / "overlay.mp4"
    output_path.write_bytes(b"small")
    scaled_path = gopro_overlay_export._scaled_video_path(output_path)

    def fake_probe(path: Path):
        if path == output_path:
            return (1280, 720)
        if path == scaled_path:
            return (1600, 900)
        return (None, None)

    class Result:
        returncode = 0
        stderr = ""
        stdout = ""

    def fake_run(command, **kwargs):
        Path(command[-1]).write_bytes(b"wrong-size")
        return Result()

    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", fake_probe)
    with patch("gopro_overlay_export.subprocess.run", side_effect=fake_run):
        ok, error = gopro_overlay_export._ensure_video_output_resolution(
            output_path,
            1920,
            1080,
        )

    assert ok is False
    assert error == "scaled output resolution is 1600x900, expected 1920x1080"
    assert not scaled_path.exists()
    assert output_path.read_bytes() == b"small"


def test_create_flight_gopro_overlay_job_rejects_paths_outside_paragliding_root(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
    monkeypatch,
):
    paragliding_root = tmp_path / "paragliding"
    outside_video = tmp_path / "outside" / "flight.mp4"
    generated_video = paragliding_root / "generated.mp4"
    outside_video.parent.mkdir(parents=True)
    generated_video.parent.mkdir(parents=True)
    outside_video.write_bytes(b"camera")
    generated_video.write_bytes(b"video")
    sample_flight.video_file_path = str(generated_video)
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
    video_path = tmp_path / "flight.mp4"
    video_path.write_bytes(b"video")
    sample_flight.gpx_file_path = None
    sample_flight.video_file_path = str(video_path)
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


def test_create_flight_gopro_overlay_job_accepts_provided_pip_without_generated_video(
    client: TestClient,
    db_session,
    sample_flight,
    tmp_path,
    monkeypatch,
):
    paragliding_root = tmp_path / "paragliding"
    gpx_path = tmp_path / "flight.gpx"
    pip_path = paragliding_root / "flight-pip.mp4"
    gpx_path.write_text("<gpx />")
    pip_path.parent.mkdir(parents=True)
    pip_path.write_bytes(b"pip")
    sample_flight.gpx_file_path = str(gpx_path)
    sample_flight.video_file_path = None
    db_session.commit()
    monkeypatch.setattr(config, "GOPRO_OVERLAY_PARAGLIDING_ROOT", str(paragliding_root))
    expected = {
        "job_id": "job-flight-gopro-pip-path",
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
            files={"video_file": ("camera.mp4", b"camera", "video/mp4")},
            data={"pip_path": str(pip_path)},
        )

    assert response.status_code == 200
    assert response.json()["job_id"] == "job-flight-gopro-pip-path"
    assert create_job.call_args.kwargs["fallback_pip_path"] == pip_path


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


def test_delete_gopro_overlay_job_removes_terminal_row_and_work_dir(
    tmp_path,
    test_db,
    monkeypatch,
):
    job_id = "job-gopro-delete"
    work_dir = tmp_path / ".gopro-overlay-work" / job_id
    work_dir.mkdir(parents=True)
    layout_path = work_dir / "layout.xml"
    layout_path.write_text("<layout />")

    monkeypatch.setattr(gopro_overlay_export, "SessionLocal", test_db)
    session = test_db()
    try:
        from models import GoproOverlayJob

        session.add(
            GoproOverlayJob(
                id=job_id,
                status="failed",
                progress=100,
                message="Overlay rendering failed",
                error="boom",
                video_path=str(tmp_path / "flight.mp4"),
                gpx_path=str(tmp_path / "track.gpx"),
                layout_id="parapente-1080",
                layout_label="Parapente 1920x1080",
                layout_path=str(layout_path),
                output_path=str(tmp_path / "final.mp4"),
                temp_output_path=str(tmp_path / "final.part.mp4"),
                output_filename="final.mp4",
            )
        )
        session.add(
            Flight(
                id="flight-gopro-delete",
                name="Flight GoPro delete",
                flight_date=date(2026, 3, 15),
                gopro_overlay_job_id=job_id,
                gopro_overlay_status="failed",
            )
        )
        session.commit()

        result = delete_gopro_overlay_job(job_id)
    finally:
        session.close()

    assert result is not None
    assert result["deleted"] is True
    assert result["files_deleted"] == 1
    assert not work_dir.exists()
    assert gopro_overlay_export.get_gopro_overlay_job(job_id) is None
    session = test_db()
    try:
        flight = session.get(Flight, "flight-gopro-delete")
        assert flight is not None
        assert flight.gopro_overlay_job_id is None
        assert flight.gopro_overlay_status is None
    finally:
        session.close()


def test_reconcile_gopro_overlay_flight_refs_clears_missing_active_job(test_db, monkeypatch):
    monkeypatch.setattr(gopro_overlay_export, "SessionLocal", test_db)
    session = test_db()
    try:
        session.add(
            Flight(
                id="flight-orphan-gopro",
                name="Flight orphan GoPro",
                flight_date=date(2026, 3, 15),
                gopro_overlay_job_id="missing-gopro-job",
                gopro_overlay_status="queued",
            )
        )
        session.commit()

        assert gopro_overlay_export.reconcile_gopro_overlay_flight_refs() == 1

        session.expire_all()
        refreshed = session.get(Flight, "flight-orphan-gopro")
        assert refreshed is not None
        assert refreshed.gopro_overlay_job_id is None
        assert refreshed.gopro_overlay_status is None
    finally:
        session.close()


def test_mark_interrupted_jobs_failed_marks_active_rows_failed(test_db, monkeypatch):
    monkeypatch.setattr(gopro_overlay_export, "SessionLocal", test_db)
    session = test_db()
    try:
        from models import GoproOverlayJob

        for job_id, status in (("job-preparing", "preparing"), ("job-running", "running")):
            session.add(
                GoproOverlayJob(
                    id=job_id,
                    status=status,
                    progress=55,
                    message="Rendering overlay",
                    video_path="video.mp4",
                    gpx_path="track.gpx",
                    layout_id="parapente-1080",
                    layout_label="Parapente 1920x1080",
                    layout_path="layout.xml",
                    output_path="final.mp4",
                    temp_output_path=f".final.{job_id}.part.mp4",
                    output_filename="final.mp4",
                )
            )
            session.add(
                Flight(
                    id=f"flight-{job_id}",
                    name=f"Flight {job_id}",
                    flight_date=date(2026, 3, 15),
                    gopro_overlay_job_id=job_id,
                    gopro_overlay_status=status,
                )
            )
        session.commit()

        gopro_overlay_export._mark_interrupted_jobs_failed()

        for job_id in ("job-preparing", "job-running"):
            refreshed = gopro_overlay_export.get_gopro_overlay_job(job_id)
            assert refreshed is not None
            assert refreshed["status"] == "failed"
            assert refreshed["message"] == "Overlay interrupted by backend restart"
            refreshed_flight = session.get(Flight, f"flight-{job_id}")
            assert refreshed_flight is not None
            assert refreshed_flight.gopro_overlay_status == "failed"
    finally:
        session.close()


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


def test_prepare_layout_file_sets_video_dimensions(tmp_path):
    source = tmp_path / "layout.xml"
    destination = tmp_path / "prepared.xml"
    source.write_text(
        '<layout width="1920" height="1080">'
        '<component type="video" size="220" x="100" y="50" width="300" height="100" />'
        "</layout>"
    )

    _prepare_layout_file(source, destination, has_pip=True, target_width=3840, target_height=2160)

    prepared = destination.read_text()
    assert 'width="3840"' in prepared
    assert 'height="2160"' in prepared
    assert 'id="pip"' in prepared
    assert 'size="440"' in prepared
    assert 'x="200"' in prepared
    assert 'y="100"' in prepared
    assert 'width="600"' in prepared
    assert 'height="200"' in prepared


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


def test_prepare_pip_video_delays_pip_until_gpx_start(tmp_path, monkeypatch):
    video_path = tmp_path / "camera.mp4"
    gpx_path = tmp_path / "track.gpx"
    pip_path = tmp_path / "pip.mp4"
    work_dir = tmp_path / "work"
    video_path.write_bytes(b"video")
    pip_path.write_bytes(b"pip")
    gpx_path.write_text(
        "<gpx><trk><trkseg><trkpt><time>2026-03-15T10:00:05Z</time></trkpt></trkseg></trk></gpx>"
    )
    work_dir.mkdir()
    commands: list[list[str]] = []

    monkeypatch.setattr(
        gopro_overlay_export,
        "probe_video_duration",
        lambda path: 30.0 if path == video_path else 10.0,
    )
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (640, 480))
    monkeypatch.setattr(
        gopro_overlay_export,
        "probe_video_start_time",
        lambda _: gopro_overlay_export._parse_utc_datetime("2026-03-15T10:00:00Z"),
    )

    class Result:
        returncode = 0
        stderr = ""
        stdout = ""

    def run(command, **_kwargs):
        commands.append(command)
        Path(command[-1]).write_bytes(b"prepared")
        return Result()

    monkeypatch.setattr(gopro_overlay_export.subprocess, "run", run)

    prepared = gopro_overlay_export._prepare_pip_video_for_overlay(
        "job-pip", video_path, gpx_path, pip_path, work_dir
    )

    assert prepared == work_dir / "pip-prepared-job-pip.mp4"
    assert prepared.read_bytes() == b"prepared"
    command = commands[0]
    assert "-ss" not in command
    video_filter = command[command.index("-vf") + 1]
    assert "setpts=PTS-STARTPTS" in video_filter
    assert "tpad=start_mode=add:start_duration=5.000" in video_filter
    assert "tpad=stop_mode=clone:stop_duration=15.000" in video_filter


def test_prepare_pip_video_trims_pip_when_camera_starts_after_gpx(tmp_path, monkeypatch):
    video_path = tmp_path / "camera.mp4"
    gpx_path = tmp_path / "track.gpx"
    pip_path = tmp_path / "pip.mp4"
    work_dir = tmp_path / "work"
    video_path.write_bytes(b"video")
    pip_path.write_bytes(b"pip")
    gpx_path.write_text("<gpx><time>2026-03-15T10:00:00Z</time></gpx>")
    work_dir.mkdir()
    commands: list[list[str]] = []

    monkeypatch.setattr(
        gopro_overlay_export,
        "probe_video_duration",
        lambda path: 30.0 if path == video_path else 20.0,
    )
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (640, 480))
    monkeypatch.setattr(
        gopro_overlay_export,
        "probe_video_start_time",
        lambda _: gopro_overlay_export._parse_utc_datetime("2026-03-15T10:00:05Z"),
    )

    class Result:
        returncode = 0
        stderr = ""
        stdout = ""

    def run(command, **_kwargs):
        commands.append(command)
        Path(command[-1]).write_bytes(b"prepared")
        return Result()

    monkeypatch.setattr(gopro_overlay_export.subprocess, "run", run)

    prepared = gopro_overlay_export._prepare_pip_video_for_overlay(
        "job-pip", video_path, gpx_path, pip_path, work_dir
    )

    assert prepared.exists()
    command = commands[0]
    assert command[command.index("-ss") + 1] == "5.000"
    assert "tpad=stop_mode=clone:stop_duration=15.000" in command[command.index("-vf") + 1]


def test_prepare_pip_video_auto_aligns_start_time_by_timezone_offset(tmp_path, monkeypatch):
    video_path = tmp_path / "camera.mp4"
    gpx_path = tmp_path / "track.gpx"
    pip_path = tmp_path / "pip.mp4"
    work_dir = tmp_path / "work"
    video_path.write_bytes(b"video")
    pip_path.write_bytes(b"pip")
    gpx_path.write_text(
        "<gpx><trk><trkseg><trkpt><time>2026-03-15T10:00:00Z</time></trkpt></trkseg></trk></gpx>"
    )
    work_dir.mkdir()
    commands: list[list[str]] = []

    monkeypatch.setattr(
        gopro_overlay_export,
        "probe_video_duration",
        lambda path: 30.0 if path == video_path else 10.0,
    )
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (640, 480))
    monkeypatch.setattr(
        gopro_overlay_export,
        "probe_video_start_time",
        lambda _: gopro_overlay_export._parse_utc_datetime("2026-03-15T11:00:00Z"),
    )

    class Result:
        returncode = 0
        stderr = ""
        stdout = ""

    def run(command, **_kwargs):
        commands.append(command)
        Path(command[-1]).write_bytes(b"prepared")
        return Result()

    monkeypatch.setattr(gopro_overlay_export.subprocess, "run", run)

    prepared = gopro_overlay_export._prepare_pip_video_for_overlay(
        "job-pip", video_path, gpx_path, pip_path, work_dir
    )

    assert prepared == work_dir / "pip-prepared-job-pip.mp4"
    assert prepared.read_bytes() == b"prepared"
    command = commands[0]
    assert "tpad=stop_mode=clone:stop_duration=20.000" in command[command.index("-vf") + 1]


def test_prepare_queued_job_uses_prepared_pip_path(tmp_path, monkeypatch, test_db):
    layout_dir = tmp_path / "layouts"
    layout_dir.mkdir()
    (layout_dir / "layout_parapente_1080.xml").write_text("<layout />")
    video_path = tmp_path / "source.mp4"
    gpx_path = tmp_path / "source.gpx"
    pip_path = tmp_path / "pip.mp4"
    prepared_pip_path = tmp_path / "prepared-pip.mp4"
    video_path.write_bytes(b"video")
    gpx_path.write_text("<gpx />")
    pip_path.write_bytes(b"pip")
    prepared_pip_path.write_bytes(b"prepared")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_LAYOUT_DIR", str(layout_dir))
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (1920, 1080))
    monkeypatch.setattr(gopro_overlay_export, "SessionLocal", test_db)
    monkeypatch.setattr(
        gopro_overlay_export,
        "_prepare_pip_video_for_overlay",
        lambda *_args, **_kwargs: prepared_pip_path,
    )

    job = create_gopro_overlay_job_from_paths(
        video_path=video_path,
        gpx_path=gpx_path,
        pip_path=pip_path,
        layout_id="parapente-1080",
        output_filename="overlay.mp4",
    )
    queued_job = gopro_overlay_export.get_gopro_overlay_job(job["job_id"], include_command=True)
    assert queued_job is not None

    prepared = gopro_overlay_export._prepare_queued_job(job["job_id"], queued_job)

    assert prepared is not None
    assert Path(prepared["pip_path"]) == prepared_pip_path


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
async def test_create_gopro_overlay_job_uses_job_unique_output_paths(
    tmp_path,
    monkeypatch,
    test_db,
):
    upload_dir = tmp_path / "uploads"
    layout_dir = tmp_path / "layouts"
    layout_dir.mkdir()
    (layout_dir / "layout_parapente_1080.xml").write_text("<layout />")
    monkeypatch.setattr(gopro_overlay_export, "_UPLOAD_WORK_ROOT", upload_dir)
    monkeypatch.setattr(config, "GOPRO_OVERLAY_LAYOUT_DIR", str(layout_dir))
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (1920, 1080))
    monkeypatch.setattr(gopro_overlay_export, "SessionLocal", test_db)

    with (
        patch(
            "gopro_overlay_export.asyncio.to_thread",
            AsyncMock(side_effect=lambda func, *args, **kwargs: func(*args, **kwargs)),
        ) as to_thread,
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
    assert first["temp_output_path"].endswith(".part.mp4")
    assert gopro_overlay_export.get_gopro_overlay_job(first["job_id"])["status"] == "queued"
    assert to_thread.call_count == 2
    assert to_thread.call_args.args[0] is gopro_overlay_export._create_gopro_overlay_job_from_paths


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


def test_create_gopro_overlay_job_from_paths_defers_input_copy_to_worker_preparation(
    tmp_path,
    monkeypatch,
    test_db,
):
    layout_dir = tmp_path / "layouts"
    layout_dir.mkdir()
    (layout_dir / "layout_parapente_1080.xml").write_text("<layout />")
    video_path = tmp_path / "source.mp4"
    gpx_path = tmp_path / "source.gpx"
    video_path.write_bytes(b"video")
    gpx_path.write_text("<gpx />")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_LAYOUT_DIR", str(layout_dir))
    monkeypatch.setattr(
        gopro_overlay_export,
        "probe_video_resolution",
        lambda _: pytest.fail("video probing should be deferred to worker preparation"),
    )
    monkeypatch.setattr(gopro_overlay_export, "SessionLocal", test_db)

    job = create_gopro_overlay_job_from_paths(
        video_path=video_path,
        gpx_path=gpx_path,
        pip_path=None,
        layout_id="parapente-1080",
        output_filename="overlay.mp4",
    )

    work_dir = tmp_path / ".gopro-overlay-work" / job["job_id"]
    assert Path(job["video_path"]) == video_path
    assert Path(job["gpx_path"]) == gpx_path
    assert Path(job["output_path"]) == tmp_path / "overlay.mp4"

    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (1920, 1080))
    queued_job = gopro_overlay_export.get_gopro_overlay_job(job["job_id"], include_command=True)
    assert queued_job is not None

    prepared = gopro_overlay_export._prepare_queued_job(job["job_id"], queued_job)

    assert prepared is not None
    assert prepared["status"] == "queued"
    assert Path(prepared["video_path"]) == video_path
    assert Path(prepared["gpx_path"]) == gpx_path
    assert Path(prepared["command"]["render_gpx_path"]).parent == work_dir
    assert Path(prepared["command"]["render_gpx_path"]).read_text() == "<gpx />"
    assert prepared["video_width"] == 1920
    assert prepared["video_height"] == 1080


def test_auto_layout_selection_uses_4k_layout_for_4k_source():
    selected = gopro_overlay_export._nearest_layout(3840, 2160)

    assert selected.id == "parapente-3840"


def test_worker_preparation_uses_video_render_size_for_4k_source(
    tmp_path,
    monkeypatch,
    test_db,
):
    layout_dir = tmp_path / "layouts"
    layout_dir.mkdir()
    (layout_dir / "layout_parapente_1080.xml").write_text(
        '<layout width="1920" height="1080">'
        '<component type="video" size="220" x="100" y="50" width="300" height="100" />'
        "</layout>"
    )
    video_path = tmp_path / "source.mp4"
    gpx_path = tmp_path / "source.gpx"
    pip_path = tmp_path / "pip.mp4"
    video_path.write_bytes(b"video")
    gpx_path.write_text("<gpx />")
    pip_path.write_bytes(b"pip")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_LAYOUT_DIR", str(layout_dir))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_MAX_AUTO_LAYOUT_WIDTH", 1920)
    monkeypatch.setattr(config, "GOPRO_OVERLAY_MAX_AUTO_LAYOUT_HEIGHT", 1080)
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (3840, 2160))
    monkeypatch.setattr(gopro_overlay_export, "SessionLocal", test_db)

    job = create_gopro_overlay_job_from_paths(
        video_path=video_path,
        gpx_path=gpx_path,
        pip_path=pip_path,
        layout_id="parapente-1080",
        output_filename="overlay.mp4",
    )
    queued_job = gopro_overlay_export.get_gopro_overlay_job(job["job_id"], include_command=True)
    assert queued_job is not None

    prepared = gopro_overlay_export._prepare_queued_job(job["job_id"], queued_job)

    assert prepared is not None
    assert prepared["layout_id"] == "parapente-1080"
    assert prepared["video_width"] == 3840
    assert prepared["video_height"] == 2160
    prepared_layout = Path(prepared["layout_path"]).read_text()
    assert 'width="3840"' in prepared_layout
    assert 'height="2160"' in prepared_layout
    assert 'id="pip"' in prepared_layout
    assert 'size="440"' in prepared_layout
    assert 'x="200"' in prepared_layout
    assert 'y="100"' in prepared_layout


def test_worker_preparation_merges_osv_files_before_rendering(
    tmp_path,
    monkeypatch,
    test_db,
):
    layout_dir = tmp_path / "layouts"
    layout_dir.mkdir()
    (layout_dir / "layout_parapente_1080.xml").write_text("<layout />")
    video_path = tmp_path / "source.mp4"
    gpx_path = tmp_path / "source.gpx"
    pip_path = tmp_path / "pip.mp4"
    first_osv = tmp_path / "first.OSV"
    second_osv = tmp_path / "second.osv"
    video_path.write_bytes(b"video")
    gpx_path.write_text("<gpx />")
    pip_path.write_bytes(b"pip")
    first_osv.write_bytes(b"first")
    second_osv.write_bytes(b"second")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_LAYOUT_DIR", str(layout_dir))
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (1920, 1080))
    monkeypatch.setattr(gopro_overlay_export, "SessionLocal", test_db)

    job = create_gopro_overlay_job_from_paths(
        video_path=video_path,
        gpx_path=gpx_path,
        pip_path=pip_path,
        layout_id="parapente-1080",
        output_filename="overlay.mp4",
    )
    work_dir = tmp_path / ".gopro-overlay-work" / job["job_id"]
    merged_gpx_path = work_dir / "merged-gopro-overlay.gpx"
    queued_job = gopro_overlay_export.get_gopro_overlay_job(job["job_id"], include_command=True)
    assert queued_job is not None

    with patch(
        "gopro_overlay_export._merge_osv_files_with_gpx",
        return_value=merged_gpx_path,
    ) as merge_osv:
        prepared = gopro_overlay_export._prepare_queued_job(job["job_id"], queued_job)

    assert prepared is not None
    assert merge_osv.call_args.args[0] == [first_osv, second_osv]
    assert merge_osv.call_args.args[1].name == "gpx-" + job["job_id"] + ".gpx"
    assert merge_osv.call_args.args[2] == work_dir
    assert prepared["command"]["render_gpx_path"] == str(merged_gpx_path)


def test_worker_preparation_uses_exact_video_size_for_non_standard_source(
    tmp_path,
    monkeypatch,
    test_db,
):
    layout_dir = tmp_path / "layouts"
    layout_dir.mkdir()
    (layout_dir / "layout_parapente_1080.xml").write_text(
        '<layout width="1920" height="1080">'
        '<component type="video" size="220" x="100" y="50" width="300" height="100" />'
        "</layout>"
    )
    video_path = tmp_path / "source.mp4"
    gpx_path = tmp_path / "source.gpx"
    video_path.write_bytes(b"video")
    gpx_path.write_text("<gpx />")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_LAYOUT_DIR", str(layout_dir))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_MAX_AUTO_LAYOUT_WIDTH", 1920)
    monkeypatch.setattr(config, "GOPRO_OVERLAY_MAX_AUTO_LAYOUT_HEIGHT", 1080)
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (2704, 1520))
    monkeypatch.setattr(gopro_overlay_export, "SessionLocal", test_db)

    job = create_gopro_overlay_job_from_paths(
        video_path=video_path,
        gpx_path=gpx_path,
        pip_path=None,
        layout_id=None,
        output_filename="overlay.mp4",
    )
    queued_job = gopro_overlay_export.get_gopro_overlay_job(job["job_id"], include_command=True)
    assert queued_job is not None

    prepared = gopro_overlay_export._prepare_queued_job(job["job_id"], queued_job)

    assert prepared is not None
    assert prepared["layout_id"] == "parapente-1080"
    assert prepared["video_width"] == 2704
    assert prepared["video_height"] == 1520
    prepared_layout = Path(prepared["layout_path"]).read_text()
    assert 'width="2704"' in prepared_layout
    assert 'height="1520"' in prepared_layout


def test_explicit_4k_layout_is_preserved_for_4k_source(
    tmp_path,
    monkeypatch,
    test_db,
):
    layout_dir = tmp_path / "layouts"
    layout_dir.mkdir()
    (layout_dir / "layout_parapente_1080.xml").write_text("<layout />")
    (layout_dir / "layout_parapente_3840.xml").write_text("<layout />")
    video_path = tmp_path / "source.mp4"
    gpx_path = tmp_path / "source.gpx"
    video_path.write_bytes(b"video")
    gpx_path.write_text("<gpx />")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_LAYOUT_DIR", str(layout_dir))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_MAX_AUTO_LAYOUT_WIDTH", 1920)
    monkeypatch.setattr(config, "GOPRO_OVERLAY_MAX_AUTO_LAYOUT_HEIGHT", 1080)
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (3840, 2160))
    monkeypatch.setattr(gopro_overlay_export, "SessionLocal", test_db)

    job = create_gopro_overlay_job_from_paths(
        video_path=video_path,
        gpx_path=gpx_path,
        pip_path=None,
        layout_id="parapente-3840",
        output_filename="overlay.mp4",
    )
    queued_job = gopro_overlay_export.get_gopro_overlay_job(job["job_id"], include_command=True)
    assert queued_job is not None

    prepared = gopro_overlay_export._prepare_queued_job(job["job_id"], queued_job)

    assert prepared is not None
    assert prepared["layout_id"] == "parapente-3840"
    assert prepared["video_width"] == 3840
    assert prepared["video_height"] == 2160


def test_create_gopro_overlay_job_from_paths_enqueues_rq_job(
    tmp_path,
    monkeypatch,
    test_db,
):
    layout_dir = tmp_path / "layouts"
    layout_dir.mkdir()
    (layout_dir / "layout_parapente_1080.xml").write_text("<layout />")
    video_path = tmp_path / "source.mp4"
    gpx_path = tmp_path / "source.gpx"
    video_path.write_bytes(b"video")
    gpx_path.write_text("<gpx />")
    enqueued_job_ids: list[str] = []
    monkeypatch.setattr(config, "GOPRO_OVERLAY_LAYOUT_DIR", str(layout_dir))
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (1920, 1080))
    monkeypatch.setattr(gopro_overlay_export, "SessionLocal", test_db)
    monkeypatch.setattr(gopro_overlay_export.config, "JOB_QUEUE_BACKEND", "rq")
    monkeypatch.setattr(
        gopro_overlay_export,
        "_enqueue_gopro_overlay_job_in_rq",
        lambda job_id: enqueued_job_ids.append(job_id),
    )

    job = create_gopro_overlay_job_from_paths(
        video_path=video_path,
        gpx_path=gpx_path,
        pip_path=None,
        layout_id="parapente-1080",
        output_filename="overlay.mp4",
    )

    assert enqueued_job_ids == [job["job_id"]]


def test_enqueue_gopro_overlay_job_uses_dedicated_rq_queue(monkeypatch):
    enqueued: list[dict[str, object]] = []

    def enqueue_once(function_path: str, *args, **kwargs):
        enqueued.append({"function_path": function_path, "args": args, "kwargs": kwargs})

    monkeypatch.setattr(config, "GOPRO_OVERLAY_QUEUE_NAME", "overlay-test-queue")
    monkeypatch.setattr("job_queue.enqueue_once", enqueue_once)

    gopro_overlay_export._enqueue_gopro_overlay_job_in_rq("job-rq")

    assert enqueued == [
        {
            "function_path": "gopro_overlay_export.process_gopro_overlay_job",
            "args": ("job-rq",),
            "kwargs": {
                "job_id": "gopro-overlay-job-rq",
                "timeout": config.JOB_QUEUE_TIMEOUT_SECONDS,
                "queue_name": "overlay-test-queue",
            },
        }
    ]


def test_start_gopro_overlay_worker_with_rq_does_not_start_local_thread(monkeypatch):
    enqueued: list[bool] = []
    monkeypatch.setattr(gopro_overlay_export.config, "JOB_QUEUE_BACKEND", "rq")
    monkeypatch.setattr(gopro_overlay_export, "reconcile_gopro_overlay_flight_refs", lambda: 0)
    monkeypatch.setattr(
        gopro_overlay_export,
        "enqueue_pending_gopro_overlay_jobs",
        lambda: enqueued.append(True) or 0,
    )
    monkeypatch.setattr(
        gopro_overlay_export.threading,
        "Thread",
        lambda *_, **__: pytest.fail("RQ mode must not start a local overlay worker thread"),
    )

    gopro_overlay_export.start_gopro_overlay_worker()

    assert enqueued == [True]


def test_enqueue_pending_gopro_overlay_jobs_does_not_mark_running_failed_by_default(monkeypatch):
    monkeypatch.setattr(gopro_overlay_export.config, "JOB_QUEUE_BACKEND", "rq")
    monkeypatch.setattr(gopro_overlay_export, "_queued_job_ids", lambda: [])
    monkeypatch.setattr(
        gopro_overlay_export,
        "_mark_interrupted_jobs_failed",
        lambda: pytest.fail("API startup must not fail active worker jobs"),
    )

    assert gopro_overlay_export.enqueue_pending_gopro_overlay_jobs() == 0


def test_read_process_updates_from_process_terminates_cancelled_job(monkeypatch):
    terminated: list[bool] = []

    class FakeProcess:
        stdout = object()

        def poll(self):
            return None

        def terminate(self):
            terminated.append(True)

    monkeypatch.setattr(gopro_overlay_export, "_is_job_cancelled", lambda _job_id: True)

    assert list(gopro_overlay_export._read_process_updates_from_process(FakeProcess(), "job")) == []
    assert terminated == [True]


def test_cancel_queued_gopro_overlay_job_removes_rq_job(monkeypatch):
    job_id = "queued-rq-job"
    deleted_rq_jobs: list[tuple[str, str | None]] = []
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
    monkeypatch.setattr(gopro_overlay_export.config, "JOB_QUEUE_BACKEND", "rq")
    monkeypatch.setattr(
        gopro_overlay_export.config, "GOPRO_OVERLAY_QUEUE_NAME", "overlay-test-queue"
    )
    monkeypatch.setattr(
        "job_queue.delete_job",
        lambda rq_job_id, queue_name=None: deleted_rq_jobs.append((rq_job_id, queue_name)) or True,
    )
    try:
        assert cancel_gopro_overlay_job(job_id)
        assert deleted_rq_jobs == [("gopro-overlay-queued-rq-job", "overlay-test-queue")]
        assert gopro_overlay_export._JOBS[job_id]["status"] == "cancelled"
    finally:
        gopro_overlay_export._JOBS.pop(job_id, None)
        gopro_overlay_export._PROCESSES.pop(job_id, None)


def test_run_job_prepares_inputs_before_starting_process(
    tmp_path,
    monkeypatch,
    test_db,
):
    layout_dir = tmp_path / "layouts"
    layout_dir.mkdir()
    (layout_dir / "layout_parapente_1080.xml").write_text("<layout />")
    video_path = tmp_path / "source.mp4"
    gpx_path = tmp_path / "source.gpx"
    video_path.write_bytes(b"video")
    gpx_path.write_text("<gpx />")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_LAYOUT_DIR", str(layout_dir))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_BIN", "gopro-dashboard.py")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_ROOT", str(tmp_path / "runner-root"))
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (1920, 1080))
    monkeypatch.setattr(gopro_overlay_export, "SessionLocal", test_db)
    monkeypatch.setattr(gopro_overlay_export, "_verify_video_output", lambda _: (True, None))

    job = create_gopro_overlay_job_from_paths(
        video_path=video_path,
        gpx_path=gpx_path,
        pip_path=None,
        layout_id="parapente-1080",
        output_filename="overlay.mp4",
        gpx_offset=-1.5,
    )
    work_dir = tmp_path / ".gopro-overlay-work" / job["job_id"]

    class FakeProcess:
        def __init__(self, command: list[str]):
            self.command = command
            self.stdout = None

        def wait(self) -> int:
            Path(self.command[-1]).write_bytes(b"video")
            return 0

    with patch(
        "gopro_overlay_export.subprocess.Popen",
        side_effect=lambda command, **kwargs: FakeProcess(command),
    ) as popen:
        gopro_overlay_export._run_job(job["job_id"])

    assert popen.called
    command = popen.call_args.args[0]
    assert popen.call_args.kwargs["cwd"] == str(tmp_path / "runner-root")
    assert Path(command[command.index("--layout-xml") + 1]).parent == work_dir
    assert command[command.index("--overlay-size") + 1] == "1920x1080"
    assert command[command.index("--gpx-offset") + 1] == "-1.5"
    assert Path(command[-2]) == video_path
    assert Path(command[-1]) == Path(job["temp_output_path"])
    assert gopro_overlay_export.get_gopro_overlay_job(job["job_id"])["status"] == "completed"
    assert Path(job["output_path"]).read_bytes() == b"video"
    assert not Path(job["temp_output_path"]).exists()
    assert not work_dir.exists()


def test_run_job_cleans_temp_files_after_process_failure(
    tmp_path,
    monkeypatch,
    test_db,
):
    layout_dir = tmp_path / "layouts"
    layout_dir.mkdir()
    (layout_dir / "layout_parapente_1080.xml").write_text("<layout />")
    video_path = tmp_path / "source.mp4"
    gpx_path = tmp_path / "source.gpx"
    video_path.write_bytes(b"video")
    gpx_path.write_text("<gpx />")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_LAYOUT_DIR", str(layout_dir))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_BIN", "gopro-dashboard.py")
    monkeypatch.setattr(gopro_overlay_export, "probe_video_resolution", lambda _: (1920, 1080))
    monkeypatch.setattr(gopro_overlay_export, "SessionLocal", test_db)

    job = create_gopro_overlay_job_from_paths(
        video_path=video_path,
        gpx_path=gpx_path,
        pip_path=None,
        layout_id="parapente-1080",
        output_filename="overlay.mp4",
    )
    work_dir = tmp_path / ".gopro-overlay-work" / job["job_id"]

    class FailedProcess:
        def __init__(self, command: list[str]):
            self.command = command
            self.stdout = None

        def wait(self) -> int:
            Path(self.command[-1]).write_bytes(b"partial")
            return 1

    with patch(
        "gopro_overlay_export.subprocess.Popen",
        side_effect=lambda command, **kwargs: FailedProcess(command),
    ):
        gopro_overlay_export._run_job(job["job_id"])

    failed_job = gopro_overlay_export.get_gopro_overlay_job(job["job_id"])
    assert failed_job is not None
    assert failed_job["status"] == "failed"
    assert not Path(job["temp_output_path"]).exists()
    assert not work_dir.exists()


def test_create_gopro_overlay_job_from_paths_sanitizes_output_filename_in_source_dir(
    tmp_path,
    monkeypatch,
    test_db,
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
    monkeypatch.setattr(gopro_overlay_export, "SessionLocal", test_db)

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
