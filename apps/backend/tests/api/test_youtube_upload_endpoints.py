from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import config
import httpx
import job_queue
import pytest
import youtube_upload
from fastapi.testclient import TestClient
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


def test_existing_youtube_video_ids_returns_only_remote_matches(monkeypatch) -> None:
    requests: list[dict[str, Any]] = []
    monkeypatch.setattr(youtube_upload, "_access_token", lambda user_id: f"token-{user_id}")

    def get_videos(url: str, **kwargs: Any) -> httpx.Response:
        requests.append({"url": url, **kwargs})
        return httpx.Response(
            200,
            json={"items": [{"id": "dQw4w9WgXcQ"}]},
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr(youtube_upload.httpx, "get", get_videos)

    result = youtube_upload.existing_youtube_video_ids({1: {"dQw4w9WgXcQ", "9bZkp7q19f0"}})

    assert result == {"dQw4w9WgXcQ"}
    assert requests[0]["params"] == {
        "part": "id",
        "id": "9bZkp7q19f0,dQw4w9WgXcQ",
    }
    assert requests[0]["headers"] == {"Authorization": "Bearer token-1"}


def test_existing_youtube_video_ids_tolerates_token_refresh_failure(monkeypatch) -> None:
    def unavailable_token(_user_id: int) -> str:
        raise httpx.ConnectError("YouTube unavailable")

    monkeypatch.setattr(youtube_upload, "_access_token", unavailable_token)

    assert youtube_upload.existing_youtube_video_ids({1: {"dQw4w9WgXcQ"}}) == set()


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


def test_youtube_status_requires_reauthorization_for_legacy_upload_scope(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _configure_youtube(monkeypatch)
    db_session.add(
        YoutubeCredential(
            user_id=1,
            refresh_token_encrypted=encrypt_secret("refresh-token"),
            oauth_scope="https://www.googleapis.com/auth/youtube.upload",
        )
    )
    db_session.commit()

    response = client.get(f"{API_PREFIX}/youtube/status")

    assert response.status_code == 200
    assert response.json() == {"configured": True, "connected": False}


def test_youtube_auth_url_contains_signed_current_user_state(client, monkeypatch):
    _configure_youtube(monkeypatch)

    response = client.post(
        f"{API_PREFIX}/youtube/auth-url",
        json={"return_to": "/flights/flight-test-001"},
    )

    assert response.status_code == 200
    authorization_url = response.json()["authorization_url"]
    query = parse_qs(urlparse(authorization_url).query)
    assert query["scope"] == ["https://www.googleapis.com/auth/youtube.force-ssl"]
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


def test_start_youtube_upload_accepts_panorama_source(
    client, db_session, sample_flight, tmp_path, monkeypatch
):
    _configure_youtube(monkeypatch)
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    pano_path = tmp_path / sample_flight.flight_date.strftime("%Y%m%d") / "01" / "pano.mp4"
    pano_path.parent.mkdir(parents=True)
    pano_path.write_bytes(b"panorama")
    db_session.add(
        YoutubeCredential(user_id=1, refresh_token_encrypted=encrypt_secret("refresh-token"))
    )
    db_session.commit()
    enqueued: list[str] = []
    monkeypatch.setattr("routes.enqueue_youtube_upload", enqueued.append)

    response = client.post(
        f"{API_PREFIX}/flights/{sample_flight.id}/youtube-upload",
        json={
            "source_type": "pano",
            "title": "Panorama",
            "privacy_status": "unlisted",
        },
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["source_type"] == "pano"
    assert payload["gopro_overlay_job_id"] is None
    job = db_session.get(YoutubeUploadJob, payload["job_id"])
    assert job is not None
    assert job.source_type == "pano"
    assert enqueued == [job.id]


def test_start_youtube_upload_rejects_missing_panorama(
    client, db_session, sample_flight, tmp_path, monkeypatch
):
    _configure_youtube(monkeypatch)
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    db_session.add(
        YoutubeCredential(user_id=1, refresh_token_encrypted=encrypt_secret("refresh-token"))
    )
    db_session.commit()

    response = client.post(
        f"{API_PREFIX}/flights/{sample_flight.id}/youtube-upload",
        json={"source_type": "pano", "title": "Panorama"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Panorama video is not available"


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

    assert youtube_upload._source_video_path(db_session, job) == overlay_path


def test_worker_resolves_panorama_from_the_flight_directory(
    db_session, sample_flight, tmp_path, monkeypatch
):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    pano_path = tmp_path / sample_flight.flight_date.strftime("%Y%m%d") / "01" / "pano.mp4"
    pano_path.parent.mkdir(parents=True)
    pano_path.write_bytes(b"panorama")
    job = YoutubeUploadJob(
        id="youtube-pano-source",
        flight_id=sample_flight.id,
        user_id=1,
        source_type="pano",
        status="queued",
        progress=0,
        title="Panorama",
        description="",
        privacy_status="private",
    )
    db_session.add(job)
    db_session.commit()

    assert youtube_upload._source_video_path(db_session, job) == pano_path


def test_worker_injects_spherical_metadata_for_panorama_uploads(tmp_path, monkeypatch) -> None:
    source_path = tmp_path / "pano.mp4"
    source_path.write_bytes(b"flat panorama")
    monkeypatch.setattr(config, "VIDEO_EXPORT_DIR", str(tmp_path / "exports"))
    injected: list[tuple[Path, Path, str | None]] = []

    def inject_metadata(source, destination, metadata, _console) -> None:
        destination_path = Path(destination)
        destination_path.write_bytes(b"spherical panorama")
        injected.append((Path(source), destination_path, metadata.video))

    parsed_metadata = youtube_upload.metadata_utils.ParsedMetadata()
    parsed_metadata.video["Track 0"] = {
        "Spherical": "true",
        "ProjectionType": "equirectangular",
    }
    monkeypatch.setattr(youtube_upload.metadata_utils, "inject_metadata", inject_metadata)
    monkeypatch.setattr(
        youtube_upload.metadata_utils,
        "parse_metadata",
        lambda _path, _console: parsed_metadata,
    )

    upload_path = youtube_upload._prepare_upload_video("youtube-pano", "pano", source_path)

    assert upload_path.read_bytes() == b"spherical panorama"
    assert injected[0][0] == source_path
    assert injected[0][1].name == "youtube-pano.spherical.part.mp4"
    assert "<GSpherical:Spherical>true</GSpherical:Spherical>" in (injected[0][2] or "")
    assert "<GSpherical:ProjectionType>equirectangular</GSpherical:ProjectionType>" in (
        injected[0][2] or ""
    )


def test_worker_rejects_unverified_spherical_metadata(tmp_path, monkeypatch) -> None:
    source_path = tmp_path / "pano.mp4"
    source_path.write_bytes(b"flat panorama")
    monkeypatch.setattr(config, "VIDEO_EXPORT_DIR", str(tmp_path / "exports"))

    def inject_metadata(_source, destination, _metadata, _console) -> None:
        Path(destination).write_bytes(b"still flat")

    parsed_metadata = youtube_upload.metadata_utils.ParsedMetadata()
    monkeypatch.setattr(youtube_upload.metadata_utils, "inject_metadata", inject_metadata)
    monkeypatch.setattr(
        youtube_upload.metadata_utils,
        "parse_metadata",
        lambda _path, _console: parsed_metadata,
    )

    with pytest.raises(RuntimeError, match="could not be verified"):
        youtube_upload._prepare_upload_video("youtube-flat", "pano", source_path)

    upload_path = youtube_upload._panorama_upload_path("youtube-flat")
    assert not upload_path.exists()
    assert not upload_path.with_suffix(".part.mp4").exists()


def test_worker_keeps_standard_youtube_upload_source_unchanged(tmp_path) -> None:
    source_path = tmp_path / "overlay.mp4"

    assert (
        youtube_upload._prepare_upload_video("youtube-overlay", "gopro_overlay", source_path)
        == source_path
    )


def test_start_youtube_upload_allows_an_overlay_with_an_existing_youtube_video(
    client, db_session, sample_flight, tmp_path, monkeypatch
):
    _configure_youtube(monkeypatch)
    overlay_path = tmp_path / "overlay.mp4"
    overlay_path.write_bytes(b"video")
    overlay = _create_completed_overlay(db_session, sample_flight, overlay_path)
    sample_flight.youtube_urls = ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]
    db_session.add(
        YoutubeCredential(user_id=1, refresh_token_encrypted=encrypt_secret("refresh-token"))
    )
    db_session.commit()

    response = client.post(
        f"{API_PREFIX}/flights/{sample_flight.id}/youtube-upload",
        json={
            "gopro_overlay_job_id": overlay.id,
            "title": "Déjà publiée",
            "privacy_status": "private",
        },
    )

    assert response.status_code == 202


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


def _completed_youtube_job(
    db_session: Session,
    sample_flight: Flight,
    *,
    job_id: str = "youtube-job-delete",
    user_id: int = 1,
    video_id: str = "dQw4w9WgXcQ",
) -> YoutubeUploadJob:
    job = YoutubeUploadJob(
        id=job_id,
        flight_id=sample_flight.id,
        user_id=user_id,
        status="completed",
        progress=100,
        title="Uploaded video",
        description="",
        privacy_status="private",
        youtube_video_id=video_id,
        youtube_url=f"https://www.youtube.com/watch?v={video_id}",
    )
    db_session.add(job)
    return job


def test_youtube_video_metadata_marks_only_current_users_completed_upload_as_deletable(
    client: TestClient, db_session: Session, sample_flight: Flight
) -> None:
    sample_flight.youtube_urls = [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/watch?v=abcdefghijk",
        "https://www.youtube.com/watch?v=Zyxwvutsr_1",
    ]
    _completed_youtube_job(db_session, sample_flight)
    _completed_youtube_job(
        db_session,
        sample_flight,
        job_id="youtube-job-other-user",
        user_id=2,
        video_id="abcdefghijk",
    )
    db_session.add(
        YoutubeCredential(
            user_id=1,
            refresh_token_encrypted=encrypt_secret("refresh-token"),
        )
    )
    db_session.commit()

    response = client.get(f"{API_PREFIX}/flights/{sample_flight.id}/youtube-videos")

    assert response.status_code == 200
    assert response.json() == [
        {
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "video_id": "dQw4w9WgXcQ",
            "can_delete_from_youtube": True,
        },
        {
            "url": "https://www.youtube.com/watch?v=abcdefghijk",
            "video_id": "abcdefghijk",
            "can_delete_from_youtube": False,
        },
        {
            "url": "https://www.youtube.com/watch?v=Zyxwvutsr_1",
            "video_id": "Zyxwvutsr_1",
            "can_delete_from_youtube": False,
        },
    ]


def test_youtube_video_metadata_disables_remote_deletion_when_disconnected(
    client: TestClient, db_session: Session, sample_flight: Flight
) -> None:
    youtube_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    sample_flight.youtube_urls = [youtube_url]
    _completed_youtube_job(db_session, sample_flight)
    db_session.commit()

    response = client.get(f"{API_PREFIX}/flights/{sample_flight.id}/youtube-videos")

    assert response.status_code == 200
    assert response.json() == [
        {
            "url": youtube_url,
            "video_id": "dQw4w9WgXcQ",
            "can_delete_from_youtube": False,
        }
    ]


def test_remove_youtube_video_can_unlink_locally(
    client: TestClient, db_session: Session, sample_flight: Flight
) -> None:
    sample_flight.youtube_urls = ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]
    db_session.commit()

    response = client.post(
        f"{API_PREFIX}/flights/{sample_flight.id}/youtube-videos/dQw4w9WgXcQ/remove",
        json={"delete_from_youtube": False},
    )

    assert response.status_code == 204
    db_session.refresh(sample_flight)
    assert sample_flight.youtube_urls == []


@pytest.mark.parametrize("remote_status", [204, 404])
def test_remove_youtube_video_unlinks_after_remote_success(
    client: TestClient,
    db_session: Session,
    sample_flight: Flight,
    monkeypatch: pytest.MonkeyPatch,
    remote_status: int,
) -> None:
    sample_flight.youtube_urls = ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]
    job = _completed_youtube_job(db_session, sample_flight)
    db_session.commit()

    def access_token(_user_id: int) -> str:
        return "access-token"

    monkeypatch.setattr(youtube_upload, "_access_token", access_token)
    requests: list[dict[str, Any]] = []

    def delete_video(url: str, **kwargs: Any) -> httpx.Response:
        requests.append({"url": url, **kwargs})
        return httpx.Response(remote_status)

    monkeypatch.setattr(youtube_upload.httpx, "delete", delete_video)

    response = client.post(
        f"{API_PREFIX}/flights/{sample_flight.id}/youtube-videos/dQw4w9WgXcQ/remove",
        json={"delete_from_youtube": True},
    )

    assert response.status_code == 204
    assert requests[0]["params"] == {"id": "dQw4w9WgXcQ"}
    assert requests[0]["headers"] == {"Authorization": "Bearer access-token"}
    db_session.refresh(sample_flight)
    db_session.refresh(job)
    assert sample_flight.youtube_urls == []
    assert db_session.get(YoutubeUploadJob, job.id) is job


@pytest.mark.parametrize("job_user_id", [None, 2])
def test_remove_youtube_video_rejects_remote_deletion_for_manual_or_other_users_upload(
    client: TestClient,
    db_session: Session,
    sample_flight: Flight,
    monkeypatch: pytest.MonkeyPatch,
    job_user_id: int | None,
) -> None:
    youtube_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    sample_flight.youtube_urls = [youtube_url]
    if job_user_id is not None:
        _completed_youtube_job(db_session, sample_flight, user_id=job_user_id)
    db_session.commit()
    delete_called = False

    def delete_video(*_args: Any, **_kwargs: Any) -> None:
        nonlocal delete_called
        delete_called = True

    monkeypatch.setattr(youtube_upload.httpx, "delete", delete_video)

    response = client.post(
        f"{API_PREFIX}/flights/{sample_flight.id}/youtube-videos/dQw4w9WgXcQ/remove",
        json={"delete_from_youtube": True},
    )

    assert response.status_code == 403
    assert "uploaded" in response.json()["detail"]
    assert delete_called is False
    db_session.refresh(sample_flight)
    assert sample_flight.youtube_urls == [youtube_url]


@pytest.mark.parametrize(
    ("failure", "expected_status"),
    [
        (youtube_upload.YoutubeOAuthError("Reconnect YouTube"), 409),
        (youtube_upload.httpx.ConnectError("network failure"), 502),
        (403, 409),
        (503, 502),
    ],
)
def test_remove_youtube_video_remote_failures_keep_association(
    client: TestClient,
    db_session: Session,
    sample_flight: Flight,
    monkeypatch: pytest.MonkeyPatch,
    failure: Exception | int,
    expected_status: int,
) -> None:
    youtube_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    sample_flight.youtube_urls = [youtube_url]
    _completed_youtube_job(db_session, sample_flight)
    db_session.commit()

    if isinstance(failure, Exception) and not isinstance(
        failure, youtube_upload.httpx.RequestError
    ):

        def access_token(_user_id: int) -> str:
            raise failure

        monkeypatch.setattr(youtube_upload, "_access_token", access_token)
    else:

        def access_token(_user_id: int) -> str:
            return "access-token"

        monkeypatch.setattr(youtube_upload, "_access_token", access_token)

        def delete_video(*_args: Any, **_kwargs: Any) -> httpx.Response:
            if isinstance(failure, Exception):
                raise failure
            return httpx.Response(failure)

        monkeypatch.setattr(youtube_upload.httpx, "delete", delete_video)

    response = client.post(
        f"{API_PREFIX}/flights/{sample_flight.id}/youtube-videos/dQw4w9WgXcQ/remove",
        json={"delete_from_youtube": True},
    )

    assert response.status_code == expected_status
    db_session.refresh(sample_flight)
    assert sample_flight.youtube_urls == [youtube_url]
