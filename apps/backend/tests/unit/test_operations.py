"""Tests for the durable treatment progress model."""

from datetime import datetime

from models import BackgroundOperation
from operations import (
    OperationReporter,
    _compute_progress,
    operation_payload,
    sync_operation_from_snapshot,
)


def test_compute_progress_uses_completed_and_current_step_progress() -> None:
    assert (
        _compute_progress(
            [
                {"status": "completed", "progress": 100},
                {"status": "running", "progress": 50},
                {"status": "pending", "progress": None},
            ]
        )
        == 50
    )


def test_operation_payload_exposes_timeline_and_unread_state() -> None:
    operation = BackgroundOperation(
        id="operation-1",
        user_id=7,
        operation_type="video_export",
        title_key="operations.videoExport",
        status="running",
        progress=25,
        current_step_key="render",
        current_step_progress=25,
        current_step_detail="Frame 25 / 100",
        steps_json='[{"key":"render","status":"running","progress":25,"detail":null}]',
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        can_cancel=True,
        can_retry=False,
    )

    payload = operation_payload(operation)

    assert payload["operation_id"] == "operation-1"
    assert payload["unread"] is True
    assert payload["steps"][0]["detail"] is None
    assert payload["can_cancel"] is True


def test_reporter_reopen_resets_terminal_state() -> None:
    operation = BackgroundOperation(
        id="operation-2",
        user_id=7,
        operation_type="highlight_video",
        title_key="operations.highlightVideo",
        status="failed",
        progress=40,
        error_detail="render failed",
        steps_json='[{"key":"render","status":"failed","progress":40}]',
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
    )

    class FakeSession:
        def add(self, _value):
            return None

        def commit(self):
            return None

        def refresh(self, _value):
            return None

    reporter = OperationReporter(FakeSession(), operation)  # type: ignore[arg-type]
    reporter.reopen()

    assert operation.status == "queued"
    assert operation.progress == 0
    assert operation.error_detail is None
    assert '"status":"pending"' in operation.steps_json


def test_snapshot_projects_specialized_status_to_current_timeline_step() -> None:
    operation = BackgroundOperation(
        id="operation-3",
        user_id=7,
        operation_type="video_export",
        title_key="operations.videoExport",
        status="queued",
        progress=0,
        steps_json=(
            '[{"key":"prepare","status":"pending"},'
            '{"key":"render","status":"pending"},'
            '{"key":"finalize","status":"pending"}]'
        ),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    class FakeSession:
        def add(self, _value):
            return None

        def commit(self):
            return None

        def refresh(self, _value):
            return None

    sync_operation_from_snapshot(
        FakeSession(),  # type: ignore[arg-type]
        operation,
        status="encoding",
        progress=42,
        detail="Frame 42 / 100",
    )

    assert operation.current_step_key == "render"
    assert operation.current_step_progress == 42
    assert '"key":"prepare","status":"completed"' in operation.steps_json
    assert '"key":"render","status":"running","progress":42' in operation.steps_json
