"""Durable, user-visible progress for long-running treatments."""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import Iterable
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from models import BackgroundOperation

logger = logging.getLogger(__name__)

ACTIVE_STATUSES = {"queued", "running"}
TERMINAL_STATUSES = {"completed", "failed", "cancelled"}
STEP_STATUSES = {"pending", "running", "completed", "failed", "cancelled", "skipped"}
RETENTION_DAYS = 30


def _utcnow() -> datetime:
    return datetime.utcnow()


def _clamp_progress(value: int | float | None) -> int | None:
    if value is None:
        return None
    return max(0, min(100, round(float(value))))


def _load_steps(operation: BackgroundOperation) -> list[dict[str, Any]]:
    try:
        value = json.loads(operation.steps_json or "[]")
    except (TypeError, ValueError):
        return []
    return value if isinstance(value, list) else []


def _dump(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=str)


def _compute_progress(steps: list[dict[str, Any]]) -> int | None:
    if not steps:
        return None
    completed = 0
    partial = 0
    has_known_progress = False
    for step in steps:
        status = step.get("status")
        if status in {"completed", "skipped"}:
            completed += 1
            continue
        value = _clamp_progress(step.get("progress"))
        if status == "running" and value is not None:
            partial = value
            has_known_progress = True
        elif value is not None:
            has_known_progress = True
    if not has_known_progress and completed == 0:
        return 0
    return _clamp_progress(((completed * 100) + partial) / len(steps))


class OperationReporter:
    """Small transaction-aware API used by routes and background workers."""

    def __init__(self, db: Session, operation: BackgroundOperation):
        self.db = db
        self.operation = operation

    @classmethod
    def create(
        cls,
        db: Session,
        *,
        user_id: int,
        operation_type: str,
        title_key: str,
        steps: Iterable[str],
        source_kind: str | None = None,
        source_id: str | None = None,
        can_cancel: bool = False,
        can_retry: bool = False,
    ) -> OperationReporter:
        now = _utcnow()
        step_rows = [
            {
                "key": key,
                "status": "pending",
                "progress": None,
                "detail": None,
                "started_at": None,
                "completed_at": None,
            }
            for key in steps
        ]
        operation = BackgroundOperation(
            id=str(uuid.uuid4()),
            user_id=user_id,
            operation_type=operation_type,
            title_key=title_key,
            status="queued",
            progress=0,
            steps_json=_dump(step_rows) or "[]",
            source_kind=source_kind,
            source_id=source_id,
            can_cancel=can_cancel,
            can_retry=can_retry,
            expires_at=now + timedelta(days=RETENTION_DAYS),
            created_at=now,
            updated_at=now,
        )
        db.add(operation)
        db.commit()
        db.refresh(operation)
        return cls(db, operation)

    def _save(self, *, commit: bool = True) -> None:
        self.operation.steps_json = _dump(_load_steps(self.operation)) or "[]"
        self.operation.progress = _compute_progress(_load_steps(self.operation))
        self.operation.updated_at = _utcnow()
        self.db.add(self.operation)
        if commit:
            self.db.commit()
            self.db.refresh(self.operation)

    def _find_step(self, key: str, steps: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        steps = steps if steps is not None else _load_steps(self.operation)
        for step in steps:
            if step.get("key") == key:
                return step
        raise KeyError(f"Unknown operation step: {key}")

    def start(self) -> None:
        if self.operation.status == "queued":
            self.operation.status = "running"
            self.operation.started_at = self.operation.started_at or _utcnow()
            self._save()

    def start_step(self, key: str, detail: str | None = None) -> None:
        now = _utcnow().isoformat()
        steps = _load_steps(self.operation)
        step = self._find_step(key, steps)
        step["status"] = "running"
        step["progress"] = 0
        step["detail"] = detail
        step["started_at"] = step.get("started_at") or now
        self.operation.status = "running"
        self.operation.started_at = self.operation.started_at or _utcnow()
        self.operation.current_step_key = key
        self.operation.current_step_progress = 0
        self.operation.current_step_detail = detail
        self.operation.steps_json = _dump(steps) or "[]"
        self._save()

    def update_step(
        self, key: str, progress: int | float | None, detail: str | None = None
    ) -> None:
        steps = _load_steps(self.operation)
        step = self._find_step(key, steps)
        normalized = _clamp_progress(progress)
        step["progress"] = normalized
        if detail is not None:
            step["detail"] = detail
        self.operation.current_step_key = key
        self.operation.current_step_progress = normalized
        self.operation.current_step_detail = detail or step.get("detail")
        self.operation.steps_json = _dump(steps) or "[]"
        self._save()

    def complete_step(self, key: str, detail: str | None = None) -> None:
        steps = _load_steps(self.operation)
        step = self._find_step(key, steps)
        step["status"] = "completed"
        step["progress"] = 100
        if detail is not None:
            step["detail"] = detail
        step["completed_at"] = _utcnow().isoformat()
        self.operation.current_step_progress = 100
        self.operation.current_step_detail = detail or step.get("detail")
        self.operation.steps_json = _dump(steps) or "[]"
        self._save()

    def complete(self, result: dict[str, Any] | None = None) -> None:
        now = _utcnow()
        steps = _load_steps(self.operation)
        for step in steps:
            if step.get("status") in {"pending", "running"}:
                step["status"] = "completed"
                step["progress"] = 100
                step["completed_at"] = now.isoformat()
        self.operation.status = "completed"
        self.operation.progress = 100
        self.operation.completed_at = now
        self.operation.result_json = _dump(result)
        self.operation.current_step_progress = 100
        self.operation.expires_at = now + timedelta(days=RETENTION_DAYS)
        self.operation.steps_json = _dump(steps) or "[]"
        self._save()

    def fail(self, detail: str, error_key: str = "operations.genericError") -> None:
        now = _utcnow()
        steps = _load_steps(self.operation)
        for step in steps:
            if step.get("key") == self.operation.current_step_key:
                step["status"] = "failed"
                step["detail"] = detail
                break
        self.operation.status = "failed"
        self.operation.error_key = error_key
        self.operation.error_detail = detail
        self.operation.completed_at = now
        self.operation.expires_at = now + timedelta(days=RETENTION_DAYS)
        self.operation.steps_json = _dump(steps) or "[]"
        self._save()

    def cancel(self, detail: str = "Cancelled by user") -> None:
        self.operation.status = "cancelled"
        self.operation.error_detail = detail
        self.operation.completed_at = _utcnow()
        self.operation.expires_at = _utcnow() + timedelta(days=RETENTION_DAYS)
        self._save()

    def reopen(self) -> None:
        steps = _load_steps(self.operation)
        for step in steps:
            step["status"] = "pending"
            step["progress"] = None
            step["detail"] = None
            step["started_at"] = None
            step["completed_at"] = None
        self.operation.status = "queued"
        self.operation.progress = 0
        self.operation.current_step_key = None
        self.operation.current_step_progress = None
        self.operation.current_step_detail = None
        self.operation.error_key = None
        self.operation.error_detail = None
        self.operation.completed_at = None
        self.operation.read_at = None
        self.operation.expires_at = _utcnow() + timedelta(days=RETENTION_DAYS)
        self.operation.steps_json = _dump(steps) or "[]"
        self._save()


def operation_payload(operation: BackgroundOperation) -> dict[str, Any]:
    result = None
    if operation.result_json:
        try:
            result = json.loads(operation.result_json)
        except (TypeError, ValueError):
            result = None
    return {
        "operation_id": operation.id,
        "operation_type": operation.operation_type,
        "title_key": operation.title_key,
        "status": operation.status,
        "progress": operation.progress,
        "current_step_key": operation.current_step_key,
        "current_step_progress": operation.current_step_progress,
        "current_step_detail": operation.current_step_detail,
        "steps": _load_steps(operation),
        "result": result,
        "error_key": operation.error_key,
        "error_detail": operation.error_detail,
        "source_kind": operation.source_kind,
        "source_id": operation.source_id,
        "can_cancel": bool(operation.can_cancel and operation.status in ACTIVE_STATUSES),
        "can_retry": bool(operation.can_retry and operation.status in TERMINAL_STATUSES),
        "unread": operation.read_at is None,
        "created_at": operation.created_at,
        "started_at": operation.started_at,
        "completed_at": operation.completed_at,
        "updated_at": operation.updated_at,
    }


def purge_expired_operations(db: Session) -> None:
    now = _utcnow()
    db.query(BackgroundOperation).filter(
        BackgroundOperation.expires_at.isnot(None),
        BackgroundOperation.expires_at < now,
        BackgroundOperation.status.in_(TERMINAL_STATUSES),
    ).delete(synchronize_session=False)
    db.commit()


def get_user_operation(db: Session, operation_id: str, user_id: int) -> BackgroundOperation | None:
    return (
        db.query(BackgroundOperation)
        .filter(BackgroundOperation.id == operation_id, BackgroundOperation.user_id == user_id)
        .first()
    )


def sync_operation_from_snapshot(
    db: Session,
    operation: BackgroundOperation,
    *,
    status: str | None,
    progress: int | float | None,
    detail: str | None = None,
    error: str | None = None,
) -> None:
    """Project an existing specialized job into the common operation model."""
    if operation.status in TERMINAL_STATUSES:
        return
    normalized_status = str(status or "running").lower()
    steps = _load_steps(operation)
    step_by_key = {str(step.get("key")): step for step in steps}
    phase_by_status = {
        "initializing": "prepare",
        "preparing": "prepare",
        "started": "prepare",
        "selecting": "select",
        "capturing": "render",
        "encoding": "render",
        "processing": "render",
        "running": "render",
        "uploading": "upload",
        "finalizing": "finalize",
    }
    current = phase_by_status.get(normalized_status, operation.current_step_key)
    if current not in step_by_key:
        current = operation.current_step_key
    if current not in step_by_key and steps:
        current = str(steps[0].get("key"))
    current_index = next(
        (index for index, step in enumerate(steps) if step.get("key") == current),
        None,
    )
    if current_index is not None:
        for step in steps[:current_index]:
            if step.get("status") in {"pending", "running"}:
                step["status"] = "completed"
                step["progress"] = 100
                step["completed_at"] = step.get("completed_at") or _utcnow().isoformat()
    if current is not None and steps:
        for step in steps:
            if step.get("key") == current:
                if normalized_status not in {"queued", "pending"}:
                    step["status"] = "running"
                    step["progress"] = _clamp_progress(progress)
                if detail:
                    step["detail"] = detail
                break
    operation.steps_json = _dump(steps) or "[]"
    operation.current_step_key = current
    operation.current_step_progress = _clamp_progress(progress)
    operation.current_step_detail = detail
    if normalized_status in {"completed", "success", "done"}:
        OperationReporter(db, operation).complete()
        return
    if normalized_status in {"failed", "error"}:
        OperationReporter(db, operation).fail(error or detail or "Operation failed")
        return
    if normalized_status in {"cancelled", "canceled"}:
        OperationReporter(db, operation).cancel(detail or "Operation cancelled")
        return
    operation.status = "running"
    operation.started_at = operation.started_at or _utcnow()
    operation.progress = _compute_progress(steps)
    operation.updated_at = _utcnow()
    db.add(operation)
    db.commit()
    db.refresh(operation)
