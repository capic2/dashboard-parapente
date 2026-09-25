"""API and adapter tests for user-visible background operations."""

from datetime import datetime, timedelta

import routes
from models import BackgroundOperation


def _operation(
    *,
    operation_id: str,
    user_id: int = 1,
    status: str = "running",
    source_kind: str | None = None,
    source_id: str | None = None,
    can_cancel: bool = False,
    can_retry: bool = False,
) -> BackgroundOperation:
    now = datetime.utcnow()
    return BackgroundOperation(
        id=operation_id,
        user_id=user_id,
        operation_type="test_operation",
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
