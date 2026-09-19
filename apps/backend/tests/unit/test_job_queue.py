"""Unit tests for RQ queue helpers."""

from datetime import datetime, timedelta

import job_queue


class FakeJob:
    def __init__(
        self,
        status: str,
        delete_error: Exception | None = None,
        last_heartbeat: datetime | None = None,
    ):
        self.status = status
        self.delete_error = delete_error
        self.deleted = False
        self.last_heartbeat = last_heartbeat
        self.started_at = None
        self.enqueued_at = None

    def get_status(self, refresh: bool = True) -> str:
        return self.status

    def delete(self) -> None:
        if self.delete_error:
            raise self.delete_error
        self.deleted = True


class FakeQueue:
    def __init__(self, existing_job: FakeJob | None):
        self.existing_job = existing_job
        self.enqueued: list[dict[str, object]] = []
        self.name = "video_exports"
        self.connection = FakeConnection()

    def fetch_job(self, job_id: str) -> FakeJob | None:
        return self.existing_job

    def enqueue(self, function_path: str, *args: object, **kwargs: object) -> dict[str, object]:
        enqueued_job = {"function_path": function_path, "args": args, "kwargs": kwargs}
        self.enqueued.append(enqueued_job)
        return enqueued_job


class FakeConnection:
    def __init__(self) -> None:
        self.lock_args: tuple[object, ...] | None = None
        self.lock_kwargs: dict[str, object] | None = None

    def lock(self, *args: object, **kwargs: object) -> "FakeLock":
        self.lock_args = args
        self.lock_kwargs = kwargs
        return FakeLock()


class FakeLock:
    def __enter__(self) -> "FakeLock":
        return self

    def __exit__(self, *args: object) -> None:
        return None


def test_enqueue_once_reuses_existing_pending_job(monkeypatch):
    existing_job = FakeJob("queued")
    queue = FakeQueue(existing_job)
    monkeypatch.setattr(job_queue, "get_queue", lambda _name=None: queue)

    result = job_queue.enqueue_once(
        "video_export_manual.process_video_export_job",
        "job-recovered",
        job_id="video-export-job-recovered",
    )

    assert result is existing_job
    assert existing_job.deleted is False
    assert queue.enqueued == []
    assert queue.connection.lock_args == (
        "rq:enqueue-once:video_exports:video-export-job-recovered",
    )
    assert queue.connection.lock_kwargs == {"timeout": 60, "blocking_timeout": 30}


def test_enqueue_once_reuses_started_job(monkeypatch):
    existing_job = FakeJob("started")
    queue = FakeQueue(existing_job)
    monkeypatch.setattr(job_queue, "get_queue", lambda _name=None: queue)

    result = job_queue.enqueue_once(
        "video_export_manual.process_video_export_job",
        "job-recovered",
        job_id="video-export-job-recovered",
    )

    assert existing_job.deleted is False
    assert result is existing_job
    assert queue.enqueued == []


def test_enqueue_once_replaces_terminal_existing_job(monkeypatch):
    existing_job = FakeJob("failed")
    queue = FakeQueue(existing_job)
    monkeypatch.setattr(job_queue, "get_queue", lambda _name=None: queue)

    job_queue.enqueue_once(
        "video_export_manual.process_video_export_job",
        "job-recovered",
        job_id="video-export-job-recovered",
    )

    assert existing_job.deleted is True
    assert len(queue.enqueued) == 1


def test_enqueue_once_ignores_stale_rq_execution_metadata(monkeypatch):
    existing_job = FakeJob(
        "failed",
        delete_error=ValueError("Execution stale-execution-id not found in Redis"),
    )
    queue = FakeQueue(existing_job)
    monkeypatch.setattr(job_queue, "get_queue", lambda _name=None: queue)

    result = job_queue.enqueue_once(
        "video_export_manual.process_video_export_job",
        "job-recovered",
        job_id="video-export-job-recovered",
    )

    assert result == queue.enqueued[0]
    assert queue.enqueued[0]["kwargs"]["job_id"] == "video-export-job-recovered"


def test_enqueue_once_ignores_incomplete_rq_execution_metadata(monkeypatch):
    existing_job = FakeJob("failed", delete_error=KeyError(b"created_at"))
    queue = FakeQueue(existing_job)
    monkeypatch.setattr(job_queue, "get_queue", lambda _name=None: queue)

    result = job_queue.enqueue_once(
        "video_export_manual.process_video_export_job",
        "job-recovered",
        job_id="video-export-job-recovered",
    )

    assert result == queue.enqueued[0]
    assert queue.enqueued[0]["kwargs"]["job_id"] == "video-export-job-recovered"


def test_delete_stale_started_job_preserves_live_heartbeat(monkeypatch) -> None:
    now = datetime.utcnow()
    existing_job = FakeJob("started", last_heartbeat=now)
    queue = FakeQueue(existing_job)
    monkeypatch.setattr(job_queue, "get_queue", lambda _name=None: queue)

    deleted = job_queue.delete_stale_started_job(
        "highlight-video-live",
        stale_before=now - timedelta(minutes=5),
        queue_name="highlight_videos",
    )

    assert deleted is False
    assert existing_job.deleted is False


def test_delete_stale_started_job_removes_expired_heartbeat(monkeypatch) -> None:
    now = datetime.utcnow()
    existing_job = FakeJob("started", last_heartbeat=now - timedelta(minutes=10))
    queue = FakeQueue(existing_job)
    monkeypatch.setattr(job_queue, "get_queue", lambda _name=None: queue)

    deleted = job_queue.delete_stale_started_job(
        "highlight-video-orphaned",
        stale_before=now - timedelta(minutes=5),
        queue_name="highlight_videos",
    )

    assert deleted is True
    assert existing_job.deleted is True
