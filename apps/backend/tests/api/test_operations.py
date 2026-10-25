"""API and adapter tests for user-visible background operations."""

from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

import routes
import gopro_overlay_export
from models import (
    BackgroundOperation,
    Flight,
    GoproOverlayJob,
    HighlightVideoJob,
    YoutubeUploadJob,
)


def _operation(
    *,
    operation_id: str,
    user_id: int = 1,
    operation_type: str = "test_operation",
    status: str = "running",
    source_kind: str | None = None,
    source_id: str | None = None,
    can_cancel: bool = False,
    can_retry: bool = False,
) -> BackgroundOperation:
    now = datetime.now(UTC).replace(tzinfo=None)
    return BackgroundOperation(
        id=operation_id,
        user_id=user_id,
        operation_type=operation_type,
        title_key="operations.test",
        status=status,
        progress=0,
        steps_json='[{"key":"work","status":"running","progress":0}]',
        source_kind=source_kind,
        source_id=source_id,
        can_cancel=can_cancel,
        can_retry=can_retry,
        created_at=now,
        updated_at=now,
    )


def test_operation_detail_is_scoped_to_authenticated_user(client, db_session):
    db_session.add(_operation(operation_id="foreign-operation", user_id=2))
    db_session.commit()

    response = client.get("/api/operations/foreign-operation")

    assert response.status_code == 404


def test_delete_removes_terminal_operation(client, db_session):
    db_session.add(_operation(operation_id="completed-operation", status="completed"))
    db_session.commit()

    response = client.delete("/api/operations/completed-operation")

    assert response.status_code == 204
    assert response.content == b""
    assert db_session.get(BackgroundOperation, "completed-operation") is None


def test_delete_rejects_active_operation(client, db_session):
    db_session.add(_operation(operation_id="active-operation", status="running"))
    db_session.commit()

    response = client.delete("/api/operations/active-operation")

    assert response.status_code == 409
    assert db_session.get(BackgroundOperation, "active-operation") is not None


def test_delete_operation_is_scoped_to_authenticated_user(client, db_session):
    db_session.add(
        _operation(
            operation_id="foreign-operation",
            user_id=2,
            status="completed",
        )
    )
    db_session.commit()

    response = client.delete("/api/operations/foreign-operation")

    assert response.status_code == 404
    assert db_session.get(BackgroundOperation, "foreign-operation") is not None


def test_cancel_rejects_terminal_operation(client, db_session):
    db_session.add(
        _operation(
            operation_id="completed-operation",
            status="completed",
            can_cancel=True,
        )
    )
    db_session.commit()

    response = client.post("/api/operations/completed-operation/cancel")

    assert response.status_code == 409


def test_legacy_gpx_enrichment_operation_can_be_cancelled(client, db_session):
    operation = _operation(
        operation_id="legacy-gpx-enrichment",
        operation_type="gpx_enrichment",
        source_kind="gpx_enrichment",
        source_id="flight-1:job-1",
    )
    db_session.add(operation)
    db_session.commit()

    listed_operation = next(
        item
        for item in client.get("/api/operations").json()
        if item["operation_id"] == operation.id
    )
    assert listed_operation["can_cancel"] is True

    response = client.post(f"/api/operations/{operation.id}/cancel")

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


def test_retry_rejects_operation_without_source(client, db_session):
    db_session.add(
        _operation(
            operation_id="failed-operation",
            status="failed",
            can_retry=True,
        )
    )
    db_session.commit()

    response = client.post("/api/operations/failed-operation/retry")

    assert response.status_code == 409


def test_retry_resumes_failed_gopro_overlay_job(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_session.add(
        _operation(
            operation_id="failed-gopro-operation",
            status="failed",
            source_kind="gopro_overlay",
            source_id="failed-gopro-job",
            can_retry=True,
        )
    )
    db_session.commit()
    resumed_jobs: list[str] = []

    def get_overlay_job(_job_id: str) -> dict[str, str]:
        return {"id": "failed-gopro-job"}

    def resume_overlay_job(job_id: str) -> bool:
        resumed_jobs.append(job_id)
        return True

    monkeypatch.setattr(routes, "get_gopro_overlay_job", get_overlay_job)
    monkeypatch.setattr(
        gopro_overlay_export,
        "resume_failed_gopro_overlay_job",
        resume_overlay_job,
    )

    response = client.post("/api/operations/failed-gopro-operation/retry")

    assert response.status_code == 200
    assert response.json()["status"] == "queued"
    assert resumed_jobs == ["failed-gopro-job"]


def test_operation_registry_allows_same_source_for_different_users(db_session):
    first = routes._ensure_job_operation(
        db_session,
        user_id=1,
        source_kind="test",
        source_id="shared-source",
        operation_type="test_operation",
        title_key="operations.test",
        steps=["work"],
    )
    second = routes._ensure_job_operation(
        db_session,
        user_id=2,
        source_kind="test",
        source_id="shared-source",
        operation_type="test_operation",
        title_key="operations.test",
        steps=["work"],
    )

    assert first.user_id == 1
    assert second.user_id == 2
    assert first.id != second.id


def test_spots_freshness_uses_seven_day_window():
    now = datetime(2026, 9, 25, 12, 0, 0)

    assert routes._spots_data_is_recent((now - timedelta(days=6, hours=23)).isoformat(), now=now)
    assert not routes._spots_data_is_recent((now - timedelta(days=7)).isoformat(), now=now)
    assert not routes._spots_data_is_recent("not-a-date", now=now)


def test_cancel_dispatches_to_underlying_video_export(monkeypatch, db_session):
    calls: list[str] = []
    monkeypatch.setattr(routes, "cancel_video_export_manual", lambda _: calls.append("manual"))
    monkeypatch.setattr(routes, "cancel_video_export_stream", lambda _: calls.append("stream"))
    operation = _operation(
        operation_id="video-operation",
        source_kind="video_export",
        source_id="video-job",
    )

    routes._cancel_operation_source(db_session, operation)

    assert calls == ["manual", "stream"]


def test_operation_payloads_include_flight_ids_for_flight_jobs(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    flight = Flight(
        id="flight-linked-to-treatments",
        title="Linked flight",
        flight_date=date(2026, 10, 19),
    )
    db_session.add(flight)
    db_session.add_all(
        [
            GoproOverlayJob(
                id="gopro-job-1",
                flight_id=flight.id,
                status="running",
                video_path="camera.mp4",
                gpx_path="flight.gpx",
                layout_id="layout",
                layout_label="Layout",
                layout_path="layout.xml",
                output_path="overlay.mp4",
                temp_output_path="overlay.tmp.mp4",
                output_filename="overlay.mp4",
            ),
            HighlightVideoJob(
                id="highlight-operation-job",
                flight_id=flight.id,
                status="running",
                source_video_path="pano.mp4",
                output_format="original",
            ),
            YoutubeUploadJob(
                id="youtube-operation-job",
                flight_id=flight.id,
                user_id=1,
                status="running",
                title="Flight upload",
                description="",
            ),
            _operation(
                operation_id="gpx-flight-operation",
                source_kind="gpx_enrichment",
                source_id=f"{flight.id}:job-1",
            ),
            _operation(
                operation_id="video-flight-operation",
                source_kind="video_export",
                source_id="video-job-1",
            ),
            _operation(
                operation_id="gopro-flight-operation",
                source_kind="gopro_overlay",
                source_id="gopro-job-1",
            ),
            _operation(
                operation_id="highlight-flight-operation",
                source_kind="highlight_video",
                source_id="highlight-operation-job",
            ),
            _operation(
                operation_id="youtube-flight-operation",
                source_kind="youtube_upload",
                source_id="youtube-operation-job",
            ),
            _operation(
                operation_id="missing-flight-operation",
                source_kind="highlight_video",
                source_id="missing-highlight-job",
            ),
        ]
    )
    db_session.commit()
    monkeypatch.setattr(routes, "_resolve_export_status", lambda _job_id: {"flight_id": flight.id})

    listed_operations = {
        item["operation_id"]: item for item in client.get("/api/operations").json()
    }
    stream_operations = {
        item["operation_id"]: item for item in routes._read_operations_payload(user_id=1)
    }
    expected_ids = {
        "gpx-flight-operation",
        "video-flight-operation",
        "gopro-flight-operation",
        "highlight-flight-operation",
        "youtube-flight-operation",
    }

    for payload in (listed_operations, stream_operations):
        assert all(payload[operation_id]["flight_id"] == flight.id for operation_id in expected_ids)
        assert all(
            payload[operation_id]["flight_name"] == flight.title for operation_id in expected_ids
        )
        assert payload["missing-flight-operation"]["flight_id"] is None
        assert payload["missing-flight-operation"]["flight_name"] is None
