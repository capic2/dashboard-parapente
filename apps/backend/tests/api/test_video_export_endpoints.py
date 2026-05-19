"""
Tests for video export API endpoints.

Covers fallback behavior between manual/stream modes and internal status guards.
"""

import tempfile
from unittest.mock import patch

from pathlib import Path

from fastapi.testclient import TestClient

from auth import create_job_token

API_PREFIX = "/api"


class TestVideoExportStartEndpoint:
    """Tests for POST /flights/{flight_id}/export-video"""

    def test_start_video_export_prefers_manual_when_available(
        self, client: TestClient, sample_flight
    ):
        """Manual mode should be used when start_video_export_manual succeeds."""
        with patch("routes.start_video_export_manual", return_value="job-manual") as mock_start:
            response = client.post(
                f"{API_PREFIX}/flights/flight-test-001/export-video?mode=manual",
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["job_id"] == "job-manual"
        assert payload["mode"] == "manual"
        assert payload["message"] == "Video export started (manual render)"
        assert payload["status_url"] == "/api/exports/job-manual/status"
        assert "auth_token" not in mock_start.call_args.kwargs

    def test_start_video_export_accepts_manual_fast_mode(self, client: TestClient, sample_flight):
        """Fast manual mode should use the deterministic screenshot exporter."""
        with patch(
            "routes.start_video_export_manual_fast",
            return_value="job-manual-fast",
        ) as mock_start:
            response = client.post(
                f"{API_PREFIX}/flights/flight-test-001/export-video?mode=manual_fast",
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["job_id"] == "job-manual-fast"
        assert payload["mode"] == "manual_fast"
        assert payload["message"] == "Video export started (manual fast render)"
        assert "auth_token" not in mock_start.call_args.kwargs

    def test_start_video_export_manual_fast_falls_back_to_manual(
        self, client: TestClient, sample_flight
    ):
        """Fast manual errors should fall back to the existing manual renderer."""
        with (
            patch(
                "routes.start_video_export_manual_fast",
                side_effect=RuntimeError("fast unavailable"),
            ),
            patch("routes.start_video_export_manual", return_value="job-manual"),
        ):
            response = client.post(
                f"{API_PREFIX}/flights/flight-test-001/export-video?mode=manual_fast"
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["job_id"] == "job-manual"
        assert payload["mode"] == "manual"
        assert payload["message"] == "Video export started (manual render)"

    def test_start_video_export_returns_error_when_manual_fast_and_fallback_fail(
        self, client: TestClient, sample_flight
    ):
        """Fallback startup failures should return an actionable API error."""
        with (
            patch(
                "routes.start_video_export_manual_fast",
                side_effect=RuntimeError("fast unavailable"),
            ),
            patch(
                "routes.start_video_export_manual",
                side_effect=RuntimeError("manual unavailable"),
            ),
        ):
            response = client.post(
                f"{API_PREFIX}/flights/flight-test-001/export-video?mode=manual_fast"
            )

        assert response.status_code == 500
        assert (
            response.json()["detail"]
            == "Unable to start video export: manual_fast failed and fallback manual also failed"
        )

    def test_start_video_export_falls_back_to_stream_on_manual_error(
        self,
        client: TestClient,
        db_session,
        sample_flight,
    ):
        """Manual errors should be captured and stream mode used instead."""
        with (
            patch(
                "routes.start_video_export_manual", side_effect=RuntimeError("manual unavailable")
            ),
            patch("routes._start_video_export_stream", return_value="job-stream"),
        ):
            response = client.post(f"{API_PREFIX}/flights/flight-test-001/export-video?mode=manual")

        assert response.status_code == 200
        payload = response.json()
        assert payload["job_id"] == "job-stream"
        assert payload["mode"] == "stream"
        assert payload["message"] == "Video export started (media stream)"

        db_session.refresh(sample_flight)
        assert sample_flight.video_export_status == "processing"
        assert sample_flight.video_export_job_id == "job-stream"

    def test_start_video_export_rejects_invalid_mode(self, client: TestClient, sample_flight):
        """Unsupported export mode should return HTTP 400."""
        response = client.post(f"{API_PREFIX}/flights/flight-test-001/export-video?mode=invalid")
        assert response.status_code == 400
        assert "mode must be 'manual', 'manual_fast' or 'stream'" in response.json()["detail"]


class TestGenerateVideoEndpoint:
    """Tests for POST /flights/{flight_id}/generate-video"""

    def test_generate_video_uses_manual_fast_by_default(
        self, client: TestClient, sample_flight, db_session
    ):
        """Generation should default to manual fast render when available."""
        sample_flight.gpx_file_path = "db/gpx/sample.gpx"
        db_session.commit()

        with patch(
            "routes.start_video_export_manual_fast", return_value="job-manual-fast"
        ) as mock_start:
            response = client.post(
                f"{API_PREFIX}/flights/flight-test-001/generate-video",
                headers={"Authorization": "Bearer token-generate"},
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["job_id"] == "job-manual-fast"
        assert payload["message"] == "Video generation started (Manual Fast Render)"
        assert "auth_token" not in mock_start.call_args.kwargs

    def test_generate_video_falls_back_to_stream_on_manual_fast_error(
        self,
        client: TestClient,
        db_session,
        sample_flight,
    ):
        """Generation should fallback to stream mode if manual fast start fails."""
        sample_flight.gpx_file_path = "db/gpx/sample.gpx"
        db_session.commit()

        with (
            patch(
                "routes.start_video_export_manual_fast",
                side_effect=RuntimeError("manual fast unavailable"),
            ),
            patch("routes._start_video_export_stream", return_value="job-stream"),
        ):
            response = client.post(f"{API_PREFIX}/flights/flight-test-001/generate-video")

        assert response.status_code == 200
        payload = response.json()
        assert payload["job_id"] == "job-stream"
        assert payload["message"] == "Video generation started (MediaRecorder stream fallback)"

        db_session.refresh(sample_flight)
        assert sample_flight.video_export_status == "processing"
        assert sample_flight.video_export_job_id == "job-stream"

    def test_generate_video_rejects_internal_in_progress_status(
        self, client: TestClient, db_session, sample_flight
    ):
        """In-progress internal states must be treated as running conversions."""
        sample_flight.video_export_status = "capturing"
        sample_flight.video_export_job_id = "job-capturing"
        sample_flight.gpx_file_path = "db/gpx/sample.gpx"
        db_session.commit()

        with patch("routes._resolve_export_status", return_value={"status": "capturing"}):
            response = client.post(f"{API_PREFIX}/flights/flight-test-001/generate-video")

        assert response.status_code == 400
        assert response.json()["detail"] == "Video conversion already in progress"

    def test_generate_video_allows_orphan_in_progress_status(
        self, client: TestClient, db_session, sample_flight
    ):
        """Stale in-progress flight state without a job id should not block generation."""
        sample_flight.video_export_status = "processing"
        sample_flight.video_export_job_id = None
        sample_flight.gpx_file_path = "db/gpx/sample.gpx"
        db_session.commit()

        with patch("routes.start_video_export_manual_fast", return_value="job-manual-fast"):
            response = client.post(f"{API_PREFIX}/flights/flight-test-001/generate-video")

        assert response.status_code == 200
        assert response.json()["job_id"] == "job-manual-fast"

    def test_generate_video_allows_missing_in_progress_job(
        self, client: TestClient, db_session, sample_flight
    ):
        """Stale in-progress flight state pointing to a missing job should not block generation."""
        sample_flight.video_export_status = "processing"
        sample_flight.video_export_job_id = "job-missing"
        sample_flight.gpx_file_path = "db/gpx/sample.gpx"
        db_session.commit()

        with (
            patch("routes._resolve_export_status", return_value=None),
            patch("routes.start_video_export_manual_fast", return_value="job-manual-fast"),
        ):
            response = client.post(f"{API_PREFIX}/flights/flight-test-001/generate-video")

        assert response.status_code == 200
        assert response.json()["job_id"] == "job-manual-fast"


class TestExportStatusAndCancel:
    """Tests for export status/cancel endpoints."""

    def test_export_status_prefers_manual_status(self, client: TestClient):
        """If manual has a status, stream fallback should not be used."""
        manual_status = {"status": "running", "message": "Manual running", "progress": 10}

        with (
            patch("routes.get_export_status_manual", return_value=manual_status) as mock_manual,
            patch(
                "routes.get_export_status_stream", return_value={"status": "completed"}
            ) as mock_stream,
        ):
            response = client.get(f"{API_PREFIX}/exports/job-abc/status")

        assert response.status_code == 200
        assert response.json() == manual_status
        mock_manual.assert_called_once_with("job-abc")
        mock_stream.assert_not_called()

    def test_export_cancel_propagates_manual_cancel_result(self, client: TestClient):
        """Cancel endpoint returns a 400 when manual cancellation fails."""
        with (
            patch("routes.cancel_video_export_manual", return_value=False),
            patch("routes.cancel_video_export_stream", return_value=False),
            patch("routes.cancel_gopro_overlay_job", return_value=False),
        ):
            response = client.delete(f"{API_PREFIX}/exports/job-abc/cancel")

        assert response.status_code == 400
        assert "Export job not found or cannot be cancelled" in response.json()["detail"]

    def test_export_cancel_falls_back_to_stream_cancel(self, client: TestClient):
        """Cancel endpoint should stop stream jobs when no manual job matches."""
        with (
            patch("routes.cancel_video_export_manual", return_value=False),
            patch("routes.cancel_video_export_stream", return_value=True) as mock_stream,
            patch("routes.cancel_gopro_overlay_job", return_value=False) as mock_overlay,
        ):
            response = client.delete(f"{API_PREFIX}/exports/job-stream/cancel")

        assert response.status_code == 200
        assert response.json()["job_id"] == "job-stream"
        mock_stream.assert_called_once_with("job-stream")
        mock_overlay.assert_not_called()

    def test_export_cancel_falls_back_to_gopro_overlay_cancel(self, client: TestClient):
        """Cancel endpoint should stop overlay jobs when no video export matches."""
        with (
            patch("routes.cancel_video_export_manual", return_value=False),
            patch("routes.cancel_video_export_stream", return_value=False),
            patch("routes.cancel_gopro_overlay_job", return_value=True) as mock_overlay,
        ):
            response = client.delete(f"{API_PREFIX}/exports/job-overlay/cancel")

        assert response.status_code == 200
        assert response.json()["job_id"] == "job-overlay"
        mock_overlay.assert_called_once_with("job-overlay")

    def test_export_resume_requeues_resumable_manual_job(self, client: TestClient):
        """Resume endpoint should pass auth token through to manual exporter."""
        with patch("routes.resume_video_export", return_value=True) as resume:
            response = client.post(
                f"{API_PREFIX}/exports/job-cancelled/resume",
                headers={"Authorization": "Bearer resume-token"},
            )

        assert response.status_code == 200
        assert response.json() == {
            "message": "Export resume enqueued",
            "job_id": "job-cancelled",
        }
        resume.assert_called_once_with("job-cancelled")

    def test_export_resume_returns_400_when_job_cannot_resume(self, client: TestClient):
        with patch("routes.resume_video_export", return_value=False):
            response = client.post(f"{API_PREFIX}/exports/job-completed/resume")

        assert response.status_code == 400
        assert response.json()["detail"] == "Export job not found or cannot be resumed"

    def test_export_download_missing_file_returns_not_found(self, client: TestClient):
        """Completed status without existing file should return 404."""
        with patch(
            "routes.get_export_status_manual",
            return_value={"status": "completed", "video_path": "/tmp/does-not-exist.mp4"},
        ):
            response = client.get(f"{API_PREFIX}/exports/job-missing/download")

        assert response.status_code == 404
        assert response.json()["detail"] == "Video file not found"

    def test_export_download_returns_video_when_file_exists(self, client: TestClient):
        """Completed export with a valid file path should stream the video."""
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp_file:
            tmp_file.write(b"dummy video bytes")
            video_path = tmp_file.name

        try:
            with patch(
                "routes.get_export_status_manual",
                return_value={"status": "completed", "video_path": video_path},
            ):
                response = client.get(f"{API_PREFIX}/exports/job-existing/download")

            assert response.status_code == 200
            assert response.headers["content-type"].startswith("video/mp4")
            assert response.headers["content-disposition"].startswith("attachment; filename=")
            assert response.content == b"dummy video bytes"
        finally:
            Path(video_path).unlink(missing_ok=True)

    def test_export_video_delete_removes_generated_file(
        self, client: TestClient, db_session, sample_flight, tmp_path
    ):
        video_path = tmp_path / "generated.mp4"
        video_path.write_bytes(b"video")
        sample_flight.video_file_path = str(video_path)
        db_session.commit()

        with patch(
            "routes._resolve_export_status",
            return_value={
                "job_id": "job-delete",
                "flight_id": sample_flight.id,
                "status": "completed",
                "internal_status": "completed",
                "video_path": str(video_path),
            },
        ):
            response = client.delete(f"{API_PREFIX}/exports/job-delete/video")

        assert response.status_code == 200
        assert response.json()["deleted"] is True
        assert not video_path.exists()
        db_session.refresh(sample_flight)
        assert sample_flight.video_file_path is None

    def test_export_video_delete_rejects_active_job(self, client: TestClient, tmp_path):
        video_path = tmp_path / "active.mp4"
        video_path.write_bytes(b"video")

        with patch(
            "routes._resolve_export_status",
            return_value={
                "job_id": "job-active",
                "status": "processing",
                "internal_status": "encoding",
                "video_path": str(video_path),
            },
        ):
            response = client.delete(f"{API_PREFIX}/exports/job-active/video")

        assert response.status_code == 400
        assert response.json()["detail"] == "Cannot delete video for an active export"
        assert video_path.exists()

    def test_export_status_stream_sends_sse_status_event(self, client: TestClient):
        """SSE endpoint should emit status events for active jobs."""
        active_status = {
            "job_id": "job-stream-1",
            "status": "processing",
            "internal_status": "capturing",
            "progress": 44,
            "message": "Captured 44/100 frames",
        }
        completed_status = {
            "job_id": "job-stream-1",
            "status": "completed",
            "internal_status": "completed",
            "progress": 100,
            "message": "Video ready",
        }

        with patch(
            "routes._resolve_export_status",
            side_effect=[active_status, completed_status],
        ):
            response = client.get(f"{API_PREFIX}/exports/job-stream-1/stream")

        assert response.status_code == 200
        assert "retry: 3000" in response.text
        assert "event: status" in response.text
        assert '"progress": 44' in response.text

    def test_export_status_stream_returns_404_when_job_missing(self, client: TestClient):
        """SSE endpoint should return HTTP 404 for missing jobs."""
        with patch("routes._resolve_export_status", return_value=None):
            response = client.get(f"{API_PREFIX}/exports/job-missing/stream")

        assert response.status_code == 404
        assert response.json()["detail"] == "Export job not found"

    def test_job_access_export_viewer_returns_flight_with_job_token(
        self, client: TestClient, sample_flight
    ):
        token = create_job_token(
            purpose="video_export",
            job_id="job-export-viewer",
            flight_id=sample_flight.id,
        )

        response = client.get(
            f"{API_PREFIX}/export-viewer/jobs/job-export-viewer/flight",
            params={"access_token": token},
        )

        assert response.status_code == 200
        assert response.json()["id"] == sample_flight.id

    def test_job_access_export_viewer_rejects_wrong_job_token(self, client: TestClient):
        token = create_job_token(purpose="video_export", job_id="other-job")

        response = client.get(
            f"{API_PREFIX}/export-viewer/jobs/job-export-viewer/flight",
            params={"access_token": token},
        )

        assert response.status_code == 401


class TestVideoExportJobsEndpoint:
    """Tests for GET /video-export-jobs."""

    def test_video_export_jobs_lists_jobs_with_cancel_state(
        self, client: TestClient, sample_flight
    ):
        manual_jobs = [
            {
                "job_id": "job-running",
                "flight_id": sample_flight.id,
                "status": "processing",
                "internal_status": "capturing",
                "progress": 42,
                "message": "Capturing frames",
                "mode": "manual_fast",
                "updated_at": "2026-04-30T10:00:00",
            },
            {
                "job_id": "job-cancelled",
                "flight_id": sample_flight.id,
                "status": "failed",
                "internal_status": "cancelled",
                "progress": 10,
                "message": "Export cancelled by user",
                "mode": "manual",
                "updated_at": "2026-04-30T09:00:00",
            },
        ]

        with (
            patch("routes.list_exports_manual", return_value=manual_jobs),
            patch("routes.list_exports_stream", return_value=[]),
            patch(
                "routes.list_gopro_overlay_jobs",
                return_value=[
                    {
                        "job_id": "job-overlay",
                        "status": "running",
                        "progress": 50,
                        "message": "Rendering overlay",
                        "layout_label": "Parapente 1920x1080",
                        "output_filename": "flight-overlay.mp4",
                        "updated_at": "2026-04-30T11:00:00",
                    }
                ],
            ),
        ):
            response = client.get(f"{API_PREFIX}/video-export-jobs")

        assert response.status_code == 200
        jobs = response.json()["jobs"]
        assert jobs[0]["job_id"] == "job-overlay"
        assert jobs[0]["status"] == "running"
        assert jobs[0]["mode"] == "gopro_overlay"
        assert jobs[0]["can_cancel"] is True
        assert jobs[1]["job_id"] == "job-running"
        assert jobs[1]["status"] == "processing"
        assert jobs[1]["can_cancel"] is True
        assert jobs[1]["flight_name"] == sample_flight.name
        assert jobs[2]["job_id"] == "job-cancelled"
        assert jobs[2]["status"] == "cancelled"
        assert jobs[2]["can_cancel"] is False

    def test_video_export_jobs_can_filter_active_jobs(self, client: TestClient):
        with (
            patch(
                "routes.list_exports_manual",
                return_value=[
                    {
                        "job_id": "job-queued",
                        "flight_id": "flight-1",
                        "status": "processing",
                        "internal_status": "queued",
                    },
                    {
                        "job_id": "job-done",
                        "flight_id": "flight-1",
                        "status": "completed",
                        "internal_status": "completed",
                    },
                ],
            ),
            patch(
                "routes.list_exports_stream",
                return_value=[
                    {
                        "job_id": "job-stream-encoding",
                        "flight_id": "flight-1",
                        "status": "encoding",
                    }
                ],
            ),
            patch(
                "routes.list_gopro_overlay_jobs",
                return_value=[
                    {
                        "job_id": "job-overlay-running",
                        "status": "running",
                        "progress": 50,
                    },
                    {
                        "job_id": "job-overlay-complete",
                        "status": "completed",
                        "progress": 100,
                    },
                ],
            ),
        ):
            response = client.get(f"{API_PREFIX}/video-export-jobs?active_only=true")

        assert response.status_code == 200
        jobs = response.json()["jobs"]
        assert {job["job_id"] for job in jobs} == {
            "job-queued",
            "job-stream-encoding",
            "job-overlay-running",
        }
        assert all(job["can_cancel"] is True for job in jobs)

    def test_video_export_jobs_temp_files_endpoint_cleans_known_exports(self, client: TestClient):
        manual_jobs = [{"job_id": "job-failed", "internal_status": "failed"}]
        stream_jobs = [{"job_id": "job-stream", "status": "completed"}]
        cleanup_payload = {
            "files_deleted": 2,
            "dirs_deleted": 2,
            "bytes_deleted": 10,
            "paths_deleted": ["/tmp/job-failed", "/tmp/job-stream"],
            "errors": [],
        }

        with (
            patch("routes.list_exports_manual", return_value=manual_jobs),
            patch("routes.list_exports_stream", return_value=stream_jobs),
            patch(
                "routes.cleanup_video_export_temp_files",
                return_value=cleanup_payload,
            ) as cleanup,
        ):
            response = client.delete(f"{API_PREFIX}/video-export-jobs/temp-files")

        assert response.status_code == 200
        assert response.json() == cleanup_payload
        cleanup.assert_called_once_with(manual_jobs + stream_jobs)

    def test_delete_video_export_job_row_removes_overlay_job(self, client: TestClient):
        delete_payload = {
            "job_id": "job-overlay-failed",
            "deleted": True,
            "files_deleted": 2,
            "dirs_deleted": 1,
            "bytes_deleted": 10,
            "paths_deleted": ["/tmp/overlay-work"],
            "errors": [],
        }

        with patch("routes.delete_gopro_overlay_job", return_value=delete_payload):
            response = client.delete(f"{API_PREFIX}/video-export-jobs/job-overlay-failed")

        assert response.status_code == 200
        assert response.json() == delete_payload

    def test_delete_video_export_job_row_rejects_active_overlay(self, client: TestClient):
        with patch(
            "routes.delete_gopro_overlay_job",
            return_value={"job_id": "job-overlay", "deleted": False, "error": "active"},
        ):
            response = client.delete(f"{API_PREFIX}/video-export-jobs/job-overlay")

        assert response.status_code == 400
        assert response.json()["detail"] == "Cannot delete an active job"

    def test_delete_video_export_job_row_removes_manual_job(self, client: TestClient):
        delete_payload = {
            "job_id": "job-failed",
            "deleted": True,
            "files_deleted": 1,
            "dirs_deleted": 1,
            "bytes_deleted": 5,
            "paths_deleted": ["/tmp/export-work"],
            "errors": [],
        }

        with (
            patch("routes.delete_gopro_overlay_job", return_value=None),
            patch("routes.delete_video_export_manual_job", return_value=delete_payload),
        ):
            response = client.delete(f"{API_PREFIX}/video-export-jobs/job-failed")

        assert response.status_code == 200
        assert response.json() == delete_payload
