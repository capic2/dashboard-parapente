"""
Tests for video export API endpoints.

Covers fallback behavior between manual/stream modes and internal status guards.
"""

import tempfile
from unittest.mock import patch

from pathlib import Path

from fastapi.testclient import TestClient

API_PREFIX = "/api"


class TestVideoExportStartEndpoint:
    """Tests for POST /flights/{flight_id}/export-video"""

    def test_start_video_export_prefers_manual_when_available(
        self, client: TestClient, sample_flight
    ):
        """Manual mode should be used when start_video_export_manual succeeds."""
        with patch("routes.start_video_export_manual", return_value="job-manual"):
            response = client.post(f"{API_PREFIX}/flights/flight-test-001/export-video?mode=manual")

        assert response.status_code == 200
        payload = response.json()
        assert payload["job_id"] == "job-manual"
        assert payload["mode"] == "manual"
        assert payload["message"] == "Video export started (manual render)"
        assert payload["status_url"] == "/api/exports/job-manual/status"

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
        assert "mode must be 'manual' or 'stream'" in response.json()["detail"]


class TestGenerateVideoEndpoint:
    """Tests for POST /flights/{flight_id}/generate-video"""

    def test_generate_video_uses_manual_by_default(
        self, client: TestClient, sample_flight, db_session
    ):
        """Generation should default to manual render when available."""
        sample_flight.gpx_file_path = "db/gpx/sample.gpx"
        db_session.commit()

        with patch("routes.start_video_export_manual", return_value="job-manual"):
            response = client.post(f"{API_PREFIX}/flights/flight-test-001/generate-video")

        assert response.status_code == 200
        payload = response.json()
        assert payload["job_id"] == "job-manual"
        assert payload["message"] == "Video generation started (Manual Render, ~60-90 min)"

    def test_generate_video_falls_back_to_stream_on_manual_error(
        self,
        client: TestClient,
        db_session,
        sample_flight,
    ):
        """Generation should fallback to stream mode if manual start fails."""
        sample_flight.gpx_file_path = "db/gpx/sample.gpx"
        db_session.commit()

        with (
            patch(
                "routes.start_video_export_manual", side_effect=RuntimeError("manual unavailable")
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
        sample_flight.gpx_file_path = "db/gpx/sample.gpx"
        db_session.commit()

        response = client.post(f"{API_PREFIX}/flights/flight-test-001/generate-video")
        assert response.status_code == 400
        assert response.json()["detail"] == "Video conversion already in progress"


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
        with patch("routes.cancel_video_export_manual", return_value=False):
            response = client.delete(f"{API_PREFIX}/exports/job-abc/cancel")

        assert response.status_code == 400
        assert "Export job not found or cannot be cancelled" in response.json()["detail"]

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
