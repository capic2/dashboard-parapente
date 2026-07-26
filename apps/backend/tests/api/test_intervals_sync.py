from datetime import datetime
from unittest.mock import AsyncMock, patch

import config
from intervals_icu import ExternalActivity, IntervalsAuthenticationError


def activity() -> ExternalActivity:
    return ExternalActivity(
        id="i123",
        name="Zepp flight",
        start_date=datetime(2026, 7, 1, 10),
        activity_type="HangGliding",
        source="ZEPP",
        file_type="GPX",
        external_url="https://intervals.icu/activities/i123",
    )


def test_preview_returns_typed_candidate_metadata(client):
    provider = AsyncMock()
    provider.list_activities.return_value = [activity()]
    with patch("routes._intervals_client", return_value=provider):
        response = client.get(
            "/api/flights/sync-intervals/preview?date_from=2026-07-01&date_to=2026-07-02"
        )

    assert response.status_code == 200
    assert response.json()["activities"][0]["id"] == "i123"
    assert response.json()["activities"][0]["type"] == "HangGliding"
    assert response.json()["activity_types"] == ["HangGliding"]
    provider.list_activities.assert_awaited_once()


def test_preview_rejects_reversed_dates(client):
    response = client.get(
        "/api/flights/sync-intervals/preview?date_from=2026-07-02&date_to=2026-07-01"
    )
    assert response.status_code == 422


def test_preview_reports_missing_api_key(client, monkeypatch):
    monkeypatch.setattr(config, "INTERVALS_ICU_API_KEY", None)

    response = client.get(
        "/api/flights/sync-intervals/preview?date_from=2026-07-01&date_to=2026-07-02"
    )

    assert response.status_code == 503
    assert "API_KEY" in response.json()["detail"]


def test_sync_maps_intervals_authentication_failure(client):
    provider = AsyncMock()
    provider.list_activities.side_effect = IntervalsAuthenticationError("bad key")
    with (
        patch("routes._intervals_client", return_value=provider),
        patch.object(config, "INTERVALS_ICU_ACTIVITY_TYPES", ["HangGliding"]),
    ):
        response = client.post(
            "/api/flights/sync-intervals",
            json={"date_from": "2026-07-01", "date_to": "2026-07-02"},
        )
    assert response.status_code == 502


def test_sync_requires_a_configured_activity_type(client, monkeypatch):
    monkeypatch.setattr(config, "INTERVALS_ICU_ACTIVITY_TYPES", [])

    response = client.post(
        "/api/flights/sync-intervals",
        json={"date_from": "2026-07-01", "date_to": "2026-07-02"},
    )

    assert response.status_code == 409


def test_sync_rejects_concurrent_import(client):
    with (
        patch.object(config, "INTERVALS_ICU_ACTIVITY_TYPES", ["Other"]),
        patch("intervals_sync._acquire_shared_lock", new=AsyncMock(return_value=(None, ""))),
    ):
        response = client.post(
            "/api/flights/sync-intervals",
            json={"date_from": "2026-07-01", "date_to": "2026-07-02"},
        )

    assert response.status_code == 409


def test_sync_returns_the_frontend_contract(client):
    provider = AsyncMock()
    provider.list_activities.return_value = [activity()]
    result = {
        "imported": 1,
        "updated": 0,
        "skipped": 0,
        "failed": 0,
        "flights": [
            {
                "id": "flight-1",
                "external_provider": "intervals_icu",
                "external_activity_id": "i123",
                "name": "Zepp flight",
                "date": "2026-07-01",
            }
        ],
    }
    with (
        patch("routes._intervals_client", return_value=provider),
        patch.object(config, "INTERVALS_ICU_ACTIVITY_TYPES", ["HangGliding"]),
        patch(
            "external_flight_import.import_external_activities",
            new=AsyncMock(return_value=result),
        ),
    ):
        response = client.post(
            "/api/flights/sync-intervals",
            json={"date_from": "2026-07-01", "date_to": "2026-07-02"},
        )

    assert response.status_code == 200
    assert response.json() == {"success": True, **result}


def test_status_never_exposes_api_key(client, monkeypatch):
    monkeypatch.setattr(config, "INTERVALS_ICU_API_KEY", "top-secret")
    monkeypatch.setattr(config, "INTERVALS_ICU_SYNC_ENABLED", True)
    monkeypatch.setattr(config, "INTERVALS_ICU_ACTIVITY_TYPES", [])

    response = client.get("/api/admin/intervals/status")

    assert response.status_code == 200
    assert response.json()["awaiting_activity_type"] is True
    assert response.json()["automatic_sync_ready"] is False
    assert "top-secret" not in response.text
