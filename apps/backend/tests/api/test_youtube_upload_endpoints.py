from pathlib import Path
from urllib.parse import parse_qs, urlparse

import config
import job_queue
import pytest
import youtube_upload
from models import Flight, GoproOverlayJob, YoutubeCredential, YoutubeUploadJob
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from youtube_upload import decode_oauth_state, encrypt_secret

API_PREFIX = "/api"


def _configure_youtube(monkeypatch) -> None:
    monkeypatch.setattr(config, "YOUTUBE_CLIENT_ID", "client-id")
    monkeypatch.setattr(config, "YOUTUBE_CLIENT_SECRET", "client-secret")
    monkeypatch.setattr(
        config,
        "YOUTUBE_REDIRECT_URI",
        "http://testserver/api/youtube/oauth/callback",
    )


def _create_completed_overlay(
    db_session: Session, sample_flight: Flight, output_path: Path
) -> GoproOverlayJob:
    overlay = GoproOverlayJob(
        id="overlay-job",
        flight_id=sample_flight.id,
        status="completed",
        progress=100,
        video_path="/input/video.mp4",
        gpx_path="/input/flight.gpx",
        layout_id="parapente",
        layout_label="Parapente",
        layout_path="/layouts/parapente.xml",
        output_path=str(output_path),
        temp_output_path=f"{output_path}.tmp",
        output_filename=output_path.name,
    )
    db_session.add(overlay)
    return overlay


def test_youtube_status_reports_configuration_and_connection(client, db_session, monkeypatch):
    _configure_youtube(monkeypatch)

    response = client.get(f"{API_PREFIX}/youtube/status")

    assert response.status_code == 200
    assert response.json() == {"configured": True, "connected": False}

    db_session.add(
        YoutubeCredential(user_id=1, refresh_token_encrypted=encrypt_secret("refresh-token"))
    )
    db_session.commit()

    response = client.get(f"{API_PREFIX}/youtube/status")
    assert response.json() == {"configured": True, "connected": True}


def test_youtube_auth_url_contains_signed_current_user_state(client, monkeypatch):
    _configure_youtube(monkeypatch)

    response = client.post(
        f"{API_PREFIX}/youtube/auth-url",
        json={"return_to": "/flights/flight-test-001"},
    )

    assert response.status_code == 200
    authorization_url = response.json()["authorization_url"]
    query = parse_qs(urlparse(authorization_url).query)
    assert query["scope"] == ["https://www.googleapis.com/auth/youtube.upload"]
    assert query["access_type"] == ["offline"]
    assert decode_oauth_state(query["state"][0]) == (
        1,
        "/flights/flight-test-001",
    )


def test_start_youtube_upload_creates_durable_job(
    client, db_session, sample_flight, tmp_path, monkeypatch
):
    _configure_youtube(monkeypatch)
    overlay_path = tmp_path / "overlay.mp4"
    overlay_path.write_bytes(b"overlay")
    overlay = _create_completed_overlay(db_session, sample_flight, overlay_path)
    db_session.add(
        YoutubeCredential(user_id=1, refresh_token_encrypted=encrypt_secret("refresh-token"))
    )
    db_session.commit()
    enqueued: list[str] = []
    monkeypatch.setattr("routes.enqueue_youtube_upload", enqueued.append)

    response = client.post(
        f"{API_PREFIX}/flights/{sample_flight.id}/youtube-upload",
        json={
            "gopro_overlay_job_id": overlay.id,
            "title": "  Mon vol à Arguel  ",
            "description": "Une belle journée",
            "privacy_status": "private",
        },
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["status"] == "queued"
    assert payload["progress"] == 0
    job = db_session.get(YoutubeUploadJob, payload["job_id"])
    assert job is not None
    assert job.title == "Mon vol à Arguel"
    assert job.flight_id == sample_flight.id
    assert job.gopro_overlay_job_id == overlay.id
    assert payload["gopro_overlay_job_id"] == overlay.id
    assert enqueued == [job.id]


def test_start_youtube_upload_rejects_standard_video_without_overlay(
    client, db_session, sample_flight, tmp_path, monkeypatch
):
    _configure_youtube(monkeypatch)
    video_path = tmp_path / "flight.mp4"
    video_path.write_bytes(b"standard video")
    sample_flight.video_file_path = str(video_path)
    db_session.add(
        YoutubeCredential(user_id=1, refresh_token_encrypted=encrypt_secret("refresh-token"))
    )
    db_session.commit()

    response = client.post(
        f"{API_PREFIX}/flights/{sample_flight.id}/youtube-upload",
        json={
            "gopro_overlay_job_id": "missing-overlay",
            "title": "Vidéo standard",
            "privacy_status": "private",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "GoPro overlay not found for this flight"


def test_start_youtube_upload_rejects_blank_overlay_id(client, sample_flight):
    response = client.post(
        f"{API_PREFIX}/flights/{sample_flight.id}/youtube-upload",
        json={
            "gopro_overlay_job_id": "   ",
            "title": "Overlay",
            "privacy_status": "private",
        },
    )

    assert response.status_code == 422


def test_get_youtube_upload_includes_recent_job_logs(
    client, db_session, sample_flight, tmp_path, monkeypatch
):
    job = YoutubeUploadJob(
        id="youtube-job-with-logs",
        flight_id=sample_flight.id,
        user_id=1,
        status="uploading",
        progress=42,
        title="Envoi journalisé",
        description="",
        privacy_status="private",
    )
    db_session.add(job)
    db_session.commit()
    log_path = tmp_path / "youtube-job-with-logs.log"
    log_path.write_text("Upload queued\nUpload progress: 42%\n")
    monkeypatch.setattr(youtube_upload, "_youtube_upload_log_path", lambda _job_id: log_path)

    response = client.get(f"{API_PREFIX}/flights/{sample_flight.id}/youtube-upload")

    assert response.status_code == 200
    assert response.json()["log_tail"] == ["Upload queued", "Upload progress: 42%"]


def test_youtube_upload_log_errors_redact_urls():
    error = RuntimeError("Upload failed at https://www.googleapis.com/upload/session-secret")

    assert youtube_upload._safe_log_error(error) == "Upload failed at [redacted-url]"


def test_worker_resolves_only_the_selected_overlay(db_session, sample_flight, tmp_path):
    standard_path = tmp_path / "standard.mp4"
    standard_path.write_bytes(b"standard")
    overlay_path = tmp_path / "overlay.mp4"
    overlay_path.write_bytes(b"overlay")
    sample_flight.video_file_path = str(standard_path)
    overlay = _create_completed_overlay(db_session, sample_flight, overlay_path)
    job = YoutubeUploadJob(
        id="youtube-overlay-source",
        flight_id=sample_flight.id,
        user_id=1,
        gopro_overlay_job_id=overlay.id,
        status="queued",
        progress=0,
        title="Overlay",
        description="",
        privacy_status="private",
    )
    db_session.add(job)
    db_session.commit()

    assert youtube_upload._overlay_video_path(db_session, job) == overlay_path


def test_start_youtube_upload_rejects_flight_with_existing_youtube_video(
    client, db_session, sample_flight, tmp_path, monkeypatch
):
    _configure_youtube(monkeypatch)
    video_path = tmp_path / "flight.mp4"
    video_path.write_bytes(b"video")
    sample_flight.video_file_path = str(video_path)
    sample_flight.youtube_urls = ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]
    db_session.add(
        YoutubeCredential(user_id=1, refresh_token_encrypted=encrypt_secret("refresh-token"))
    )
    db_session.commit()

    response = client.post(
        f"{API_PREFIX}/flights/{sample_flight.id}/youtube-upload",
        json={
            "gopro_overlay_job_id": "overlay-job",
            "title": "Déjà publiée",
            "privacy_status": "private",
        },
    )

    assert response.status_code == 409
    assert "already has" in response.json()["detail"]


def test_database_rejects_two_active_uploads_for_the_same_flight(db_session, sample_flight):
    first = YoutubeUploadJob(
        id="youtube-job-1",
        flight_id=sample_flight.id,
        user_id=1,
        status="queued",
        progress=0,
        title="Premier envoi",
        description="",
        privacy_status="private",
    )
    second = YoutubeUploadJob(
        id="youtube-job-2",
        flight_id=sample_flight.id,
        user_id=1,
        status="uploading",
        progress=1,
        title="Deuxième envoi",
        description="",
        privacy_status="private",
    )
    db_session.add(first)
    db_session.commit()
    db_session.add(second)

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_cancel_youtube_upload_marks_active_job_as_cancelled(
    client, db_session, sample_flight, monkeypatch
):
    stopped_jobs: list[tuple[str, str | None]] = []
    monkeypatch.setattr(config, "JOB_QUEUE_BACKEND", "rq")
    monkeypatch.setattr(
        job_queue,
        "delete_job",
        lambda job_id, queue_name=None: stopped_jobs.append((job_id, queue_name)),
    )
    job = YoutubeUploadJob(
        id="youtube-job-cancel",
        flight_id=sample_flight.id,
        user_id=1,
        status="uploading",
        progress=42,
        title="Envoi à arrêter",
        description="",
        privacy_status="private",
        upload_session_encrypted=encrypt_secret("https://www.googleapis.com/upload/session"),
    )
    db_session.add(job)
    db_session.commit()

    response = client.delete(f"{API_PREFIX}/flights/{sample_flight.id}/youtube-upload")

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    db_session.refresh(job)
    assert job.status == "cancelled"
    assert job.progress == 42
    assert job.upload_session_encrypted is None
    assert stopped_jobs == [("youtube-upload-youtube-job-cancel", config.YOUTUBE_UPLOAD_QUEUE_NAME)]


def test_cancel_youtube_upload_rejects_when_no_job_is_active(client, db_session, sample_flight):
    job = YoutubeUploadJob(
        id="youtube-job-completed",
        flight_id=sample_flight.id,
        user_id=1,
        status="completed",
        progress=100,
        title="Envoi terminé",
        description="",
        privacy_status="private",
    )
    db_session.add(job)
    db_session.commit()

    response = client.delete(f"{API_PREFIX}/flights/{sample_flight.id}/youtube-upload")

    assert response.status_code == 409
    assert response.json()["detail"] == "No YouTube upload is in progress"


def test_cancelled_upload_cannot_be_completed_by_worker(
    db_session, test_db, sample_flight, monkeypatch
):
    job = YoutubeUploadJob(
        id="youtube-job-race",
        flight_id=sample_flight.id,
        user_id=1,
        status="cancelled",
        progress=99,
        title="Envoi annulé",
        description="",
        privacy_status="private",
    )
    db_session.add(job)
    db_session.commit()
    monkeypatch.setattr(youtube_upload, "SessionLocal", test_db)

    youtube_upload._finish_upload(job.id, "dQw4w9WgXcQ")

    db_session.refresh(job)
    db_session.refresh(sample_flight)
    assert job.status == "cancelled"
    assert job.youtube_url is None
    assert sample_flight.youtube_urls == []
