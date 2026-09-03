from datetime import date
from unittest.mock import patch

import config
import pytest
import routes
from deployment_drain import DeploymentDrainActive, deployment_drain, job_admission

TOKEN = "test-deployment-drain-token"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
BEGIN_PAYLOAD = {
    "deployment_id": "deploy-123",
    "target_version": "sha-abc",
    "run_url": "https://github.example/runs/123",
}


@pytest.fixture(autouse=True)
def empty_existing_jobs(monkeypatch):
    monkeypatch.setattr(routes, "list_exports_manual", lambda: [])
    monkeypatch.setattr(routes, "list_exports_stream", lambda: [])
    monkeypatch.setattr(routes, "list_gopro_overlay_jobs", lambda: [])


def test_machine_endpoints_require_configured_valid_bearer_token(client, monkeypatch):
    response = client.put("/api/deployment-drain", json=BEGIN_PAYLOAD)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"

    response = client.put(
        "/api/deployment-drain",
        json=BEGIN_PAYLOAD,
        headers={"Authorization": "Bearer wrong"},
    )
    assert response.status_code == 401

    monkeypatch.setattr(config, "DEPLOY_DRAIN_TOKEN", None)
    response = client.put("/api/deployment-drain", json=BEGIN_PAYLOAD, headers=AUTH)
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]


def test_begin_status_mark_and_release_enforce_ownership(client):
    response = client.put("/api/deployment-drain", json=BEGIN_PAYLOAD, headers=AUTH)
    assert response.status_code == 200
    initial = response.json()
    assert initial == {
        "phase": "waiting",
        "accepting_jobs": False,
        "ready_for_deployment": True,
        "active_jobs": 0,
        "admissions_in_progress": 0,
        "deployment_id": "deploy-123",
        "target_version": "sha-abc",
        "run_url": "https://github.example/runs/123",
        "requested_at": initial["requested_at"],
        "phase_changed_at": initial["phase_changed_at"],
        "expires_at": initial["expires_at"],
    }

    repeated = client.put("/api/deployment-drain", json=BEGIN_PAYLOAD, headers=AUTH)
    assert repeated.status_code == 200
    assert repeated.json()["requested_at"] == initial["requested_at"]
    assert repeated.json()["expires_at"] >= initial["expires_at"]

    conflict_payload = {**BEGIN_PAYLOAD, "deployment_id": "deploy-other"}
    assert (
        client.put("/api/deployment-drain", json=conflict_payload, headers=AUTH).status_code == 409
    )
    assert client.get("/api/deployment-drain/deploy-other", headers=AUTH).status_code == 409
    assert (
        client.post("/api/deployment-drain/deploy-other/deploying", headers=AUTH).status_code == 409
    )

    marked = client.post("/api/deployment-drain/deploy-123/deploying", headers=AUTH)
    assert marked.status_code == 200
    assert marked.json()["phase"] == "deploying"
    assert marked.json()["phase_changed_at"] >= initial["phase_changed_at"]

    assert client.delete("/api/deployment-drain/deploy-other", headers=AUTH).status_code == 409
    assert client.delete("/api/deployment-drain/deploy-123", headers=AUTH).status_code == 204
    assert client.get("/api/deployment-drain/deploy-123", headers=AUTH).status_code == 404

    idle = client.get("/api/deployment-drain/status")
    assert idle.status_code == 200
    assert idle.json()["phase"] == "idle"
    assert idle.json()["accepting_jobs"] is True
    assert idle.json()["ready_for_deployment"] is False


def test_status_counts_manual_stream_and_gopro_preparing_jobs(client):
    manual = [{"job_id": "manual", "status": "processing", "internal_status": "capturing"}]
    stream = [{"job_id": "stream", "status": "started"}]
    gopro = [{"job_id": "gopro", "status": "preparing", "output_filename": "overlay.mp4"}]

    with (
        patch("routes.list_exports_manual", return_value=manual),
        patch("routes.list_exports_stream", return_value=stream),
        patch("routes.list_gopro_overlay_jobs", return_value=gopro),
    ):
        response = client.put("/api/deployment-drain", json=BEGIN_PAYLOAD, headers=AUTH)

    assert response.status_code == 200
    assert response.json()["active_jobs"] == 3
    assert response.json()["ready_for_deployment"] is False


def test_status_counts_youtube_uploading_jobs(client, db_session):
    from models import Flight, YoutubeUploadJob

    flight = Flight(id="youtube-drain-flight", name="YouTube drain test", flight_date=date.today())
    db_session.add(flight)
    db_session.add(
        YoutubeUploadJob(
            id="youtube-drain-job",
            flight_id=flight.id,
            user_id=1,
            status="uploading",
            title="YouTube drain test",
            description="",
            privacy_status="private",
        )
    )
    db_session.commit()

    response = client.put("/api/deployment-drain", json=BEGIN_PAYLOAD, headers=AUTH)

    assert response.status_code == 200
    assert response.json()["active_jobs"] == 1
    assert response.json()["ready_for_deployment"] is False


def test_status_reports_admission_in_progress(client):
    with job_admission():
        response = client.put("/api/deployment-drain", json=BEGIN_PAYLOAD, headers=AUTH)
        assert response.status_code == 200
        assert response.json()["admissions_in_progress"] == 1
        assert response.json()["ready_for_deployment"] is False


def test_start_rejection_maps_to_retryable_503(client, db_session):
    from models import Flight

    flight = Flight(id="flight-drain", name="Drain test", flight_date=date.today())
    db_session.add(flight)
    db_session.commit()
    deployment_drain.begin("deploy-123", "sha-abc", "https://github.example/runs/123")

    with patch(
        "routes.start_video_export_manual",
        side_effect=DeploymentDrainActive(
            "A deployment is draining jobs; retry this operation in 5 minutes"
        ),
    ):
        response = client.post("/api/flights/flight-drain/export-video?mode=manual")

    assert response.status_code == 503
    assert response.headers["retry-after"] == "300"
    assert "retry" in response.json()["detail"].lower()


def test_emagram_refresh_is_rejected_while_deployment_drains(client, arguel_site):
    deployment_drain.begin("deploy-123", "sha-abc", "https://github.example/runs/123")

    response = client.post(f"/api/emagram/spot/{arguel_site.id}/refresh")

    assert response.status_code == 503
    assert response.headers["retry-after"] == "300"


def test_admission_rejects_after_begin_and_decrements_in_finally():
    with job_admission():
        assert deployment_drain.admissions_in_progress() == 1
    assert deployment_drain.admissions_in_progress() == 0

    deployment_drain.begin("deploy-123", "sha-abc", "https://github.example/runs/123")
    try:
        with job_admission():
            raise AssertionError("admission unexpectedly succeeded")
    except DeploymentDrainActive:
        pass
