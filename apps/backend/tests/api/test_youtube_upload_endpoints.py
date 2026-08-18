from urllib.parse import parse_qs, urlparse

import config
import pytest
from models import YoutubeCredential, YoutubeUploadJob
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


def test_youtube_status_reports_configuration_and_connection(
    client, db_session, monkeypatch
):
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
    video_path = tmp_path / "flight.mp4"
    video_path.write_bytes(b"video")
    sample_flight.video_file_path = str(video_path)
    db_session.add(
        YoutubeCredential(user_id=1, refresh_token_encrypted=encrypt_secret("refresh-token"))
    )
    db_session.commit()
    enqueued: list[str] = []
    monkeypatch.setattr("routes.enqueue_youtube_upload", enqueued.append)

    response = client.post(
        f"{API_PREFIX}/flights/{sample_flight.id}/youtube-upload",
        json={
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
    assert enqueued == [job.id]


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
        json={"title": "Déjà publiée", "privacy_status": "private"},
    )

    assert response.status_code == 409
    assert "already has" in response.json()["detail"]


def test_database_rejects_two_active_uploads_for_the_same_flight(
    db_session, sample_flight
):
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
