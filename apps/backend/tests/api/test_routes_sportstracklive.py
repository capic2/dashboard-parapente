from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import config
import pytest
from fastapi import HTTPException
from models import SportstrackLiveCredential
import sportstracklive
from sportstracklive import upload_flight
from youtube_upload import encrypt_secret

API_PREFIX = "/api"


@pytest.mark.parametrize("upload_key", ["   ", "x" * 513])
def test_sportstracklive_settings_reject_invalid_upload_key(client, upload_key):
    response = client.put(
        f"{API_PREFIX}/settings/sportstracklive",
        json={"upload_key": upload_key, "auto_upload": False},
    )

    assert response.status_code == 400


def test_sportstracklive_manual_upload_requires_application_secret(
    client, db_session, sample_flight, tmp_path, monkeypatch
):
    gpx_path = tmp_path / "flight.gpx"
    gpx_path.write_text("<gpx />", encoding="utf-8")
    sample_flight.gpx_file_path = str(gpx_path)
    db_session.add(
        SportstrackLiveCredential(
            user_id=1,
            upload_key_encrypted=encrypt_secret("test-upload-key"),
            auto_upload=False,
        )
    )
    db_session.commit()
    monkeypatch.setattr(config, "SPORTSTRACKLIVE_SECRET_KEY", None)

    response = client.post(f"{API_PREFIX}/flights/{sample_flight.id}/sportstracklive-upload")

    assert response.status_code == 503
    assert "côté serveur" in response.json()["detail"]


def test_sportstracklive_manual_upload_rejects_already_uploaded_flight(
    client, db_session, sample_flight
):
    sample_flight.sportstracklive_status = "uploaded"
    db_session.commit()

    response = client.post(f"{API_PREFIX}/flights/{sample_flight.id}/sportstracklive-upload")

    assert response.status_code == 409


def test_sportstracklive_upload_claim_rejects_a_flight_already_in_progress(
    db_session, sample_flight, tmp_path, monkeypatch
):
    gpx_path = tmp_path / "flight.gpx"
    gpx_path.write_text("<gpx />", encoding="utf-8")
    sample_flight.gpx_file_path = str(gpx_path)
    sample_flight.sportstracklive_status = "uploading"
    db_session.add(
        SportstrackLiveCredential(
            user_id=1,
            upload_key_encrypted=encrypt_secret("test-upload-key"),
            auto_upload=False,
        )
    )
    db_session.commit()
    monkeypatch.setattr(config, "SPORTSTRACKLIVE_SECRET_KEY", "test-app-secret")

    with patch("sportstracklive.requests.post") as post:
        with pytest.raises(HTTPException) as error:
            upload_flight(db_session, sample_flight, 1)

    assert error.value.status_code == 409
    post.assert_not_called()


def test_sportstracklive_manual_upload_recovers_a_queued_flight(
    client, db_session, sample_flight, tmp_path, monkeypatch
):
    gpx_path = tmp_path / "flight.gpx"
    gpx_path.write_text("<gpx />", encoding="utf-8")
    sample_flight.gpx_file_path = str(gpx_path)
    sample_flight.sportstracklive_status = "queued"
    db_session.add(
        SportstrackLiveCredential(
            user_id=1,
            upload_key_encrypted=encrypt_secret("test-upload-key"),
            auto_upload=True,
        )
    )
    db_session.commit()
    monkeypatch.setattr(config, "SPORTSTRACKLIVE_SECRET_KEY", "test-app-secret")

    with patch("sportstracklive.requests.post") as post:
        post.return_value.json.return_value = {"success": True, "track_id": 456}
        response = client.post(f"{API_PREFIX}/flights/{sample_flight.id}/sportstracklive-upload")

    assert response.status_code == 200
    assert response.json()["status"] == "uploaded"
    db_session.refresh(sample_flight)
    assert sample_flight.sportstracklive_status == "uploaded"
    post.assert_called_once()


def test_sportstracklive_manual_upload_recovers_stale_uploading_flight(
    client, db_session, sample_flight, tmp_path, monkeypatch
):
    gpx_path = tmp_path / "flight.gpx"
    gpx_path.write_text("<gpx />", encoding="utf-8")
    sample_flight.gpx_file_path = str(gpx_path)
    sample_flight.sportstracklive_status = "uploading"
    sample_flight.sportstracklive_upload_started_at = datetime.utcnow() - timedelta(hours=1)
    db_session.add(
        SportstrackLiveCredential(
            user_id=1,
            upload_key_encrypted=encrypt_secret("test-upload-key"),
            auto_upload=False,
        )
    )
    db_session.commit()
    monkeypatch.setattr(config, "SPORTSTRACKLIVE_SECRET_KEY", "test-app-secret")

    with patch("sportstracklive.requests.post") as post:
        post.return_value.json.return_value = {"success": True, "track_id": 789}
        response = client.post(f"{API_PREFIX}/flights/{sample_flight.id}/sportstracklive-upload")

    assert response.status_code == 200
    assert response.json()["track_id"] == 789
    db_session.refresh(sample_flight)
    assert sample_flight.sportstracklive_status == "uploaded"
    assert sample_flight.sportstracklive_upload_started_at is None
    post.assert_called_once()


def test_sportstracklive_unexpected_upload_error_allows_retry(
    db_session, sample_flight, tmp_path, monkeypatch
):
    gpx_path = tmp_path / "flight.gpx"
    gpx_path.write_text("<gpx />", encoding="utf-8")
    sample_flight.gpx_file_path = str(gpx_path)
    db_session.add(
        SportstrackLiveCredential(
            user_id=1,
            upload_key_encrypted=encrypt_secret("test-upload-key"),
            auto_upload=False,
        )
    )
    db_session.commit()
    monkeypatch.setattr(config, "SPORTSTRACKLIVE_SECRET_KEY", "test-app-secret")

    with patch("sportstracklive.requests.post") as post:
        post.return_value.json.return_value = {"success": True, "track_id": None}
        with pytest.raises(HTTPException) as error:
            upload_flight(db_session, sample_flight, 1)

    assert error.value.status_code == 502
    db_session.refresh(sample_flight)
    assert sample_flight.sportstracklive_status == "failed"
    assert sample_flight.sportstracklive_error


def test_sportstracklive_upload_resolves_relative_gpx_from_backend_directory(
    db_session, sample_flight, tmp_path, monkeypatch
):
    sample_flight.gpx_file_path = "tests/fixtures/sample_arguel.gpx"
    db_session.add(
        SportstrackLiveCredential(
            user_id=1,
            upload_key_encrypted=encrypt_secret("test-upload-key"),
            auto_upload=False,
        )
    )
    db_session.commit()
    monkeypatch.setattr(config, "SPORTSTRACKLIVE_SECRET_KEY", "test-app-secret")
    monkeypatch.chdir(tmp_path)

    with patch("sportstracklive.requests.post") as post:
        post.return_value.json.return_value = {"success": True, "track_id": 456}
        result = upload_flight(db_session, sample_flight, 1)

    assert result == {"success": True, "track_id": 456, "status": "uploaded"}
    post.assert_called_once()


def test_automatic_worker_marks_unexpected_failure_as_retryable(
    test_db, db_session, sample_flight, monkeypatch
):
    sample_flight.sportstracklive_status = "queued"
    db_session.commit()
    worker_session = test_db()

    def fail_upload(*args, **kwargs):
        raise RuntimeError("worker failure")

    monkeypatch.setattr(sportstracklive, "SessionLocal", lambda: worker_session)
    monkeypatch.setattr(sportstracklive, "auto_upload_flight", fail_upload)

    sportstracklive._run_automatic_upload(sample_flight.id, 1)

    db_session.refresh(sample_flight)
    assert sample_flight.sportstracklive_status == "failed"
    assert sample_flight.sportstracklive_error


def test_replacing_gpx_clears_previous_sportstracklive_upload_state(
    client, db_session, sample_flight, sample_gpx
):
    sample_flight.sportstracklive_status = "uploaded"
    sample_flight.sportstracklive_track_id = 123
    sample_flight.sportstracklive_error = "previous error"
    sample_flight.sportstracklive_uploaded_at = datetime(2026, 3, 15, 12)
    db_session.commit()
    files = {"gpx_file": ("replacement.gpx", sample_gpx.encode(), "application/gpx+xml")}

    with (
        patch("routes.write_flight_text_file", return_value=Path("private/replacement.gpx")),
        patch("video_export_manual.trigger_auto_export"),
    ):
        response = client.post(f"{API_PREFIX}/flights/{sample_flight.id}/upload-gpx", files=files)

    assert response.status_code == 200
    db_session.refresh(sample_flight)
    assert sample_flight.sportstracklive_status is None
    assert sample_flight.sportstracklive_track_id is None
    assert sample_flight.sportstracklive_error is None
    assert sample_flight.sportstracklive_uploaded_at is None
